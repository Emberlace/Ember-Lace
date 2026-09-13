import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

/* POST /api/stripe-checkout — create a Stripe Hosted Checkout Session for the
   cart. Body: { items: [{cjPid, qty, cjVid}], earlyAccess?: boolean,
   email?: string }. Validated exactly like the legacy PaymentIntent route:
   - items via validateItems(requireVid: true) — every line MUST carry a real
     CJ variant id (CJ createOrder rejects a product-level pid as vid, code
     1602000), so we never mint a session for an unfulfillable item;
   - each cjVid must exist in the harvested variants index for its product;
   - the amount is recomputed HERE from live-catalog.json retail prices + the
     shared cartTotal discount rule (15% early-shopper when earlyAccess, else
     10%-over-$250) — the client's total is never trusted. The charged amount
     (session line item unit_amount) is exactly that recomputed total.

   The customer completes payment on Stripe's HTTPS-hosted page (no embedded
   iframe — works in every browser), which also collects shipping and handles
   3DS. Returns { ok: true, url: session.url }; the client redirects there.
   Server-side only: STRIPE_SECRET_KEY never leaves this handler. */

import LIVE_CATALOG from "../../data/live-catalog.json";
import { cartTotal, round2 } from "../../lib/cart";
import { validateItems } from "../../server/order";
import { encodeItemsMetadata } from "../../server/items-metadata";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Public origins the client may send as its checkout return origin. The
   platform proxy rewrites Host on every request, so the server trusts only
   these two (live + dev preview); anything else → live fallback. */
const KNOWN_ORIGINS = new Set([
  "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app",
  "https://783aeabe91b1a4a10aee76a4357372c8-dev.ctonew.app",
]);

/** Countries the Stripe-hosted shipping-address form offers. Kept broad so the
    hosted flow doesn't narrow today's customers; the CJ rail determines
    deliverability at order time. */
const SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "IT", "ES", "NL", "BE",
  "AT", "CH", "SE", "NO", "DK", "FI", "PL", "PT", "JP", "KR", "SG",
];

type CatalogEntry = {
  retail: number;
  name: string;
  collection: string;
};

/* Index live catalog by CJ product id (the client cart lines reference). */
const PRICE_INDEX = new Map<string, CatalogEntry>();
/* Index harvested variant ids per product — the only vids a cart line may
   carry. A vid outside this set (typo, stale data, fabrication) would mint a
   chargeable session CJ cannot fulfill, so it is rejected here. */
const VARIANTS_INDEX = new Map<string, Set<string>>();
for (const p of LIVE_CATALOG as unknown as { cjPid: string; retail: number; name: string; collection: string; variants?: { vid: string }[] }[]) {
  if (p?.cjPid) {
    PRICE_INDEX.set(p.cjPid, { retail: p.retail, name: p.name, collection: p.collection });
    const vids = new Set<string>();
    for (const v of Array.isArray(p.variants) ? p.variants : []) {
      if (typeof v?.vid === "string" && /^[0-9]+$/.test(v.vid)) vids.add(v.vid);
    }
    VARIANTS_INDEX.set(p.cjPid, vids);
  }
}

function getStripe(): Stripe {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error("STRIPE_SECRET_KEY env secret is not set");
  // Never log the key — it only lives in this client instance.
  return new Stripe(sk);
}

export const Route = createFileRoute("/api/stripe-checkout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
        }
        if (!body || typeof body !== "object")
          return Response.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
        const b = body as Record<string, unknown>;

        /* requireVid: a session without a CJ variant id in its metadata would
           charge the customer but fail CJ order creation at webhook time.
           Reject vid-less items up front so every session carries `v`. */
        const checked = validateItems(b.items, { requireVid: true });
        if (!checked.ok)
          return Response.json({ ok: false, error: checked.error }, { status: 400 });

        /* The submitted vid must be one of the product's harvested variants —
           a vid we don't have in the catalog cannot be fulfilled either. */
        for (const it of checked.items) {
          const known = VARIANTS_INDEX.get(it.cjPid);
          if (!known || !known.has(it.cjVid ?? "")) {
            return Response.json(
              { ok: false, error: "One of your cart items has an unavailable size — please refresh and choose another." },
              { status: 400 }
            );
          }
        }

        /* Server-side price recompute — never trust a client-sent total. The
           session's line item unit_amount (the charge) MUST equal the total
           the client displayed: total = cartTotal(recomputed subtotal,
           earlyAccess). */
        let subtotal = 0;
        for (const it of checked.items) {
          const entry = PRICE_INDEX.get(it.cjPid);
          if (!entry) {
            return Response.json(
              { ok: false, error: "One of your cart items is no longer available — please refresh and try again." },
              { status: 400 }
            );
          }
          subtotal = round2(subtotal + entry.retail * it.qty);
        }
        const earlyAccess = b.earlyAccess === true;
        const total = cartTotal(subtotal, earlyAccess);
        const amountCents = Math.round(total * 100);
        if (!Number.isFinite(amountCents) || amountCents <= 0)
          return Response.json({ ok: false, error: "Cart total looks invalid." }, { status: 400 });

        const email = typeof b.email === "string" ? b.email.trim() : "";

        const orderRef = `EL-${Date.now().toString(36).toUpperCase()}`;

        /* Metadata the webhook needs to build the CJ order on
           checkout.session.completed: machine-readable cart (encodeItemsMetadata
           — the exact format decodeItemsMetadata reads, chunked under 500 chars
           per key), plus a human-readable summary and the early-access flag /
           customer email. Hosted-checkout PaymentIntents carry NO metadata of
           their own (verified live 2026-09-12: session.payment_intent is null
           until payment), so the session metadata is the single source of
           truth for the webhook. */
        const itemsReadable = checked.items.map((it) => ({
          cjPid: it.cjPid,
          cjVid: it.cjVid ?? "",
          qty: it.qty,
          name: (PRICE_INDEX.get(it.cjPid)?.name ?? "").slice(0, 120),
        }));
        const metadata: Record<string, string> = {
          source: "el-hosted-checkout",
          orderRef,
          ...encodeItemsMetadata(checked.items),
          itemsReadable: JSON.stringify(itemsReadable),
          earlyAccess: earlyAccess ? "true" : "false",
          ...(EMAIL_RE.test(email) ? { "web-email": email } : {}),
        };

        /* Absolute return URLs — Stripe requires real HTTPS URLs. The platform
           proxy rewrites the Host header (verified live 2026-09-12:
           request.url carries an internal beamlit host even when the customer
           is on the public ctonew.app domain), so the server cannot derive the
           public origin from the request. Instead the client sends its own
           window.location.origin and we accept ONLY the two known Ember & Lace
           origins (live + dev preview); anything else falls back to the live
           site. Success/cancel therefore land on the exact site the customer
           was shopping on. */
        const rawOrigin =
          typeof b.returnOrigin === "string" ? b.returnOrigin.trim() : "";
        const origin = KNOWN_ORIGINS.has(rawOrigin)
          ? rawOrigin
          : "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app";
        const successUrl = `${origin}/checkout-confirm?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin}/`;

        try {
          const stripe = getStripe();
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: amountCents,
                  product_data: {
                    name: "Ember & Lace order",
                    description: orderRef,
                  },
                },
              },
            ],
            customer_email: EMAIL_RE.test(email) ? email : undefined,
            shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
            phone_number_collection: { enabled: true },
            automatic_tax: { enabled: false },
            allow_promotion_codes: false,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata,
          });
          if (!session.url) throw new Error("Checkout session returned no url");
          return Response.json({ ok: true, url: session.url, orderRef, amountCents }, { status: 200 });
        } catch (err) {
          // Server-side only; message may contain Stripe error text, never keys.
          console.error("CHECKOUT_CREATE_ERROR", err);
          return Response.json(
            { ok: false, error: "We couldn't start your payment just now — please try again in a moment." },
            { status: 502 }
          );
        }
      },
    },
  },
});