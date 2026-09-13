import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import webhookSecret from "~/data/webhook-secret.json";

/* POST /api/stripe-webhook — Stripe webhook endpoint.
   Verifies the Stripe signature (STRIPE_WEBHOOK_SECRET; when the secret is
   not configured we warn and reject — never process unsigned events).
   Handles two event types:
   - payment_intent.succeeded — legacy path (Payment Links / buy-now links and
     any payment whose PaymentIntent carries cart metadata). Builds the CJ
     dropship order from the PaymentIntent metadata (compact items JSON,
     encoded at PI creation) plus the customer details Stripe captured
     (receipt_email / billing details / shipping), then calls cjCreateOrder.
   - checkout.session.completed — our hosted-checkout path. Verified live
     2026-09-12 that hosted Checkout Sessions on this account do NOT create a
     PaymentIntent up front (session.payment_intent is null until payment) and
     Stripe does not copy session metadata anywhere the PI path could read —
     so the CJ order is built here from the SESSION metadata (items, orderRef,
     web-email) plus session.customer_details / shipping_details. Only fires
     for OUR sessions (those with decodable items metadata); Payment Link
     sessions carry no such metadata and are skipped so the legacy PI path
     stays the only one that fulfills them. The session metadata orderRef is
     passed to buildCjPayload as the CJ orderNumber, so the customer-facing
     /api/track?ref=<ref> lookup resolves; a retried event whose orderNumber
     already exists at CJ is treated as already-fulfilled (no error loop).
   Signature: unsigned → 400, unhandled error → 500 (Stripe retries), all else
   → 200. Server-side only: keys are never logged. */

import { cjCreateOrder } from "../../server/cj";
import { decodeItemsMetadata } from "../../server/items-metadata";
import { buildCjPayload, validateOrderBody } from "../../server/order";

/* In-process idempotency guards: Stripe retries must not double-create a CJ
   order for the same payment. Keyed by PaymentIntent id (legacy path) and by
   Checkout Session id (hosted path) respectively. The two paths cannot
   double-create for one payment: hosted-checkout PaymentIntents carry no
   cart metadata (verified live 2026-09-12), so the PI path logs-and-skips
   them, and Payment Link sessions carry no session metadata, so the session
   path logs-and-skips them. */
const processedPis = new Set<string>();
const processedSessions = new Set<string>();

function getStripe(): Stripe {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error("STRIPE_SECRET_KEY env secret is not set");
  return new Stripe(sk);
}

function addrPiece(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/* Shared CJ submission step used by both webhook paths: validate → build the
   CJ payload → createOrder. Throws on CJ failure so Stripe retries the event.
   When opts.orderNumber is provided (hosted-checkout path), the payload uses
   it as the CJ orderNumber — so a Stripe retry that hits CJ after an earlier
   attempt already created the order gets the duplicate-ref rejection and is
   treated as already-fulfilled instead of error-looping. Without it (legacy
   PI path) orderNumber is unique per attempt, so a retry can never collide. */
async function submitCjOrder(
  body: Record<string, unknown>,
  label: string,
  opts?: { orderNumber?: string },
): Promise<void> {
  const checked = validateOrderBody(body);
  if (!checked.ok) {
    console.log(
      `[stripe-webhook] ${label} order rejected: ${checked.error} — customer will need manual follow-up`
    );
    return;
  }
  // Server-side only: resolved fulfillment contact/address (name + address,
  // no keys). Makes the fallback source (shipping_details vs customer_details)
  // observable in the logs for verification.
  const o = checked.order;
  console.log(
    `[stripe-webhook] ${label} fulfillment: name="${o.name}" address="${o.address.line1}, ${o.address.city} ${o.address.state} ${o.address.zip} ${o.address.country}"`
  );
  const payload = buildCjPayload(checked.order, opts);
  const cj = (await cjCreateOrder(payload)) as {
    code?: number;
    message?: string;
    data?: unknown;
  };
  // Server-side only: log code/message (never keys/tokens).
  console.log(
    `[stripe-webhook] CJ createOrder for ${label} ref ${payload.orderNumber}: code=${String(cj?.code)} message=${String(cj?.message ?? "").slice(0, 200)}`
  );
  if (cj?.code !== 200) {
    // Duplicate-ref rejection: the payload used a caller-provided orderNumber
    // and CJ says that order number already exists (a Stripe retry after a
    // partially-completed earlier attempt). That earlier attempt created the
    // order, so this retry is already fulfilled — log and return so Stripe
    // stops retrying. Any other non-200 still throws exactly as before.
    const usedProvidedRef =
      opts?.orderNumber != null && payload.orderNumber === opts.orderNumber;
    const cjMsg = String(cj?.message ?? "");
    const dupRefRejection =
      usedProvidedRef &&
      ((cj?.code === 1600300 && /exist|duplicate|repeat/i.test(cjMsg)) ||
        // Any code whose message clearly says this order number already exists
        (/order\s*n(?:umber)?/i.test(cjMsg) && /exist|duplicate|repeat|already/i.test(cjMsg)));
    if (dupRefRejection) {
      console.log(
        `[stripe-webhook] ${label} order already exists at CJ (ref ${payload.orderNumber}) — treating as fulfilled`
      );
      return;
    }
    throw new Error(`CJ createOrder failed: code ${String(cj?.code)}`);
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  if (processedPis.has(pi.id)) {
    console.log(`[stripe-webhook] duplicate event for PI ${pi.id} — ignoring`);
    return;
  }
  const items = decodeItemsMetadata(pi.metadata as Record<string, string> | null);
  if (items.length === 0) {
    console.log(
      `[stripe-webhook] PI ${pi.id} has no decodable cart items in metadata — order skipped`
    );
    return;
  }
  const shipping = pi.shipping;
  const addr = shipping?.address;
  // Email captured via the PI's receipt_email (we pass it explicitly in
  // confirmPayment params). The SDK's PaymentIntent resource type carries
  // receipt_email + shipping but not billing_details.
  const name = shipping?.name?.trim() || "";
  const email = (pi.receipt_email ?? "").trim();
  const phone = shipping?.phone?.trim() || undefined;

  const body = {
    name,
    email,
    paidEmail: email,
    ...(phone ? { phone } : {}),
    address: {
      line1: addrPiece(addr?.line1, 200),
      city: addrPiece(addr?.city, 120),
      state: addrPiece(addr?.state, 120),
      zip: addrPiece(addr?.postal_code, 20),
      country: addrPiece(addr?.country, 2).toUpperCase(),
    },
    items,
  };
  await submitCjOrder(body, `PI ${pi.id}`);
  processedPis.add(pi.id);
}

/* Hosted-checkout fulfillment. Reads OUR checkout-session metadata (items in
   the encodeItemsMetadata format, orderRef, web-email) plus the shipping and
   customer details Stripe captured on its hosted page. Sessions without
   decodable items metadata (e.g. Payment Link sessions) are skipped — the
   legacy PI path fulfills those from PaymentIntent metadata. */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (processedSessions.has(session.id)) {
    console.log(`[stripe-webhook] duplicate event for session ${session.id} — ignoring`);
    return;
  }
  const items = decodeItemsMetadata(session.metadata as Record<string, string> | null);
  if (items.length === 0) {
    console.log(
      `[stripe-webhook] session ${session.id} has no decodable cart items in metadata — order skipped`
    );
    return;
  }
  // Shipping/contact resolution — verified live 2026-09-12: for our hosted
  // Checkout setup (mode=payment + shipping_address_collection, no
  // shipping_options) Stripe does NOT populate session.shipping_details; the
  // shipping address the customer typed arrives in
  // session.customer_details.address instead (and on the PaymentIntent's
  // `shipping`). Prefer shipping_details when present (other setups do
  // populate it), else fall back to customer_details, else blank — the
  // validator still rejects cleanly, exactly as before.
  const sd = session.shipping_details;
  const cd = session.customer_details;
  const addr = sd?.address ?? cd?.address;
  const email =
    (cd?.email ?? "").trim() || ((session.metadata ?? {})["web-email"] ?? "").trim();
  const name = sd?.name?.trim() || cd?.name?.trim() || "";
  const phone = sd?.phone?.trim() || cd?.phone?.trim() || undefined;

  const body = {
    name,
    email,
    paidEmail: email,
    ...(phone ? { phone } : {}),
    address: {
      line1: addrPiece(addr?.line1, 200),
      city: addrPiece(addr?.city, 120),
      state: addrPiece(addr?.state, 120),
      zip: addrPiece(addr?.postal_code, 20),
      country: addrPiece(addr?.country, 2).toUpperCase(),
    },
    items,
  };
  await submitCjOrder(
    body,
    `session ${session.id}`,
    // Pass our customer-facing orderRef (created at checkout) as the CJ
    // orderNumber so /api/track?ref=<confirmation ref> resolves. Absent/invalid
    // refs fall back to the unique EL-<stamp> inside buildCjPayload.
    (session.metadata ?? {})["orderRef"]
      ? { orderNumber: String((session.metadata ?? {})["orderRef"]) }
      : undefined,
  );
  processedSessions.add(session.id);
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Secret resolution — the whsec pinned in src/data/webhook-secret.json
        // is the source of truth (it ships with every build, so live always
        // gets it). Defensive fallback only: if the pinned value is unusable
        // (missing/empty/non-whsec), accept a genuine env STRIPE_WEBHOOK_SECRET
        // (whsec_…); otherwise reject. Logs only booleans, never values.
        // constructEventAsync is required: the live runtime's WebCrypto provider
        // cannot run the synchronous constructEvent.
        const env = process.env.STRIPE_WEBHOOK_SECRET;
        const fileValue = webhookSecret.whsec;
        const secret =
          fileValue && fileValue.startsWith("whsec_")
            ? fileValue
            : env && env.startsWith("whsec_")
              ? env
              : "";
        console.log(
          `[stripe-webhook] secret env=${env?.startsWith("whsec_") ?? false} file=${fileValue?.startsWith("whsec_") ?? false} used=${secret.startsWith("whsec_")}`
        );
        if (!secret) {
          console.warn(
            "[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting webhook; configure it to enable event processing"
          );
          return Response.json(
            { error: "webhook endpoint not configured" },
            { status: 400 }
          );
        }
        const sig = request.headers.get("stripe-signature");
        if (!sig) {
          return Response.json({ error: "missing stripe-signature header" }, { status: 400 });
        }
        const raw = await request.text();
        let event: Stripe.Event;
        try {
          event = await getStripe().webhooks.constructEventAsync(raw, sig, secret);
        } catch (err) {
          console.log(
            `[stripe-webhook] signature verification failed: ${(err instanceof Error ? err.message : "unknown").slice(0, 200)}`
          );
          return Response.json({ error: "invalid signature" }, { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          } else if (event.type === "payment_intent.succeeded") {
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          }
          return Response.json({ received: true }, { status: 200 });
        } catch (err) {
          console.log(
            `[stripe-webhook] processing failed: ${(err instanceof Error ? err.message : "unknown").slice(0, 200)}`
          );
          return Response.json({ error: "processing failed" }, { status: 500 });
        }
      },
    },
  },
});