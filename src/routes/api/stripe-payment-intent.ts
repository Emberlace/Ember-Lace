import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

/* POST /api/stripe-payment-intent — create a Stripe PaymentIntent for the
   cart. Body: { items: [{cjPid, qty, cjVid}], earlyAccess?: boolean }. Every
   item MUST carry a real CJ variant id (cjVid): the webhook rebuilds the CJ
   order from PI metadata alone, and CJ createOrder rejects a product-level
   pid as vid (code 1602000 "Variant not found") — so we never mint a
   chargeable PI for an item that cannot be fulfilled. The amount is
   recomputed HERE from live-catalog.json retail prices + the shared cart
   discount rule (15% early-shopper when earlyAccess, else 10%-over-$250) —
   the client's total is never trusted. Returns { clientSecret, orderRef } for
   confirmPayment in the browser. Server-side only: STRIPE_SECRET_KEY never
   leaves this handler. */

import LIVE_CATALOG from "../../data/live-catalog.json";
import { cartTotal, round2 } from "../../lib/cart";
import { validateItems } from "../../server/order";
import { encodeItemsMetadata } from "../../server/items-metadata";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CatalogEntry = {
  retail: number;
  name: string;
  collection: string;
};

/* Index live catalog by CJ product id (the client cart lines reference). */
const PRICE_INDEX = new Map<string, CatalogEntry>();
/* Index harvested variant ids per product — the only vids a cart line may
   carry. A vid outside this set (typo, stale data, fabrication) would mint a
   chargeable PI CJ cannot fulfill, so it is rejected here. */
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

export const Route = createFileRoute("/api/stripe-payment-intent")({
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

        /* requireVid: a PI without a CJ variant id in its metadata would
           charge the customer but fail CJ order creation at webhook time.
           Reject vid-less items up front so every PI carries `v`. */
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

        /* Server-side price recompute — never trust a client-sent total. */
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
        const total = cartTotal(subtotal, b.earlyAccess === true);
        const amountCents = Math.round(total * 100);
        if (!Number.isFinite(amountCents) || amountCents <= 0)
          return Response.json({ ok: false, error: "Cart total looks invalid." }, { status: 400 });

        const email = typeof b.email === "string" ? b.email.trim() : "";
        const name = typeof b.name === "string" ? b.name.trim() : "";
        const addr = (b.address ?? null) as Partial<{
          line1: string; city: string; state: string; zip: string; country: string;
        }> | null;

        const orderRef = `EL-${Date.now().toString(36).toUpperCase()}`;
        const itemCount = checked.items.reduce((n, it) => n + it.qty, 0);

        const shipping =
          name && addr && typeof addr === "object"
            ? {
                name,
                address: {
                  line1: (addr.line1 ?? "").trim().slice(0, 200),
                  city: (addr.city ?? "").trim().slice(0, 120),
                  state: (addr.state ?? "").trim().slice(0, 120),
                  postal_code: (addr.zip ?? "").trim().slice(0, 20),
                  country: (addr.country ?? "").trim().toUpperCase().slice(0, 2),
                },
              }
            : undefined;

        try {
          const stripe = getStripe();
          const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            ...(EMAIL_RE.test(email) ? { receipt_email: email } : {}),
            ...(shipping ? { shipping } : {}),
            metadata: {
              orderRef,
              source: "el-card-checkout",
              ...encodeItemsMetadata(checked.items),
              // Unit count (sum of quantities) wins over encode's line count.
              itemCount: String(itemCount),
            },
          });
          return Response.json(
            { ok: true, clientSecret: intent.client_secret, orderRef, amountCents, itemCount },
            { status: 200 }
          );
        } catch (err) {
          // Server-side only; message may contain Stripe error text, never keys.
          console.log(
            `[stripe-payment-intent] create failed: ${(err instanceof Error ? err.message : "unknown").slice(0, 300)}`
          );
          return Response.json(
            { ok: false, error: "We couldn't start your payment just now — please try again in a moment." },
            { status: 502 }
          );
        }
      },
    },
  },
});