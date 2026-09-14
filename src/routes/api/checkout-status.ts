import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createHash } from "node:crypto";

/* GET /api/checkout-status?session_id=cs_... — confirmation-page lookup after
   the customer returns from Stripe Hosted Checkout. Reads the Checkout
   Session server-side and returns { ok, orderRef, status, message,
   amountTotal }. `status` is Stripe's payment_status ("paid" | "unpaid" |
   "no_payment_required"); the confirmation page renders the success state for
   "paid" and a neutral retry state otherwise. Server-side only:
   STRIPE_SECRET_KEY never leaves this handler. */

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

function getStripe(): Stripe {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error("STRIPE_SECRET_KEY env secret is not set");
  return new Stripe(sk);
}

const META_PIXEL_ID = "2974846332866187";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function reportPaidOrderToMeta(
  session: Stripe.Checkout.Session,
  orderRef: string,
): Promise<void> {
  const token = process.env.META_CONVERSIONS_TOKEN?.trim();
  const email = session.customer_details?.email?.trim() ||
    String((session.metadata ?? {})["web-email"] ?? "").trim();
  if (!token || !email || !orderRef) return;

  const phone = session.customer_details?.phone?.replace(/\D/g, "") ?? "";
  const userData: Record<string, string[]> = { em: [sha256(email)] };
  if (phone) userData.ph = [sha256(phone)];

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: orderRef,
          event_source_url: "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app/checkout-confirm",
          action_source: "website",
          user_data: userData,
          custom_data: {
            currency: String(session.currency ?? "usd").toUpperCase(),
            value: (session.amount_total ?? 0) / 100,
          },
        }],
      }),
    },
  );
  if (!response.ok) {
    console.error(`[checkout-status] Meta purchase report failed for ${orderRef}`);
  }
}

export const Route = createFileRoute("/api/checkout-status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const sid = (url.searchParams.get("session_id") ?? "").trim();
        if (!SESSION_ID_RE.test(sid)) {
          return Response.json(
            { ok: false, error: "We couldn't find that payment session — please check the link and try again." },
            { status: 400 }
          );
        }
        try {
          const session = await getStripe().checkout.sessions.retrieve(sid);
          const meta = (session.metadata ?? {}) as Record<string, string>;
          const orderRef = meta.orderRef ?? "";
          const status = session.payment_status ?? "unknown";
          const paid = status === "paid";
          if (paid) {
            await reportPaidOrderToMeta(session, orderRef);
          }
          return Response.json(
            {
              ok: true,
              orderRef,
              status,
              amountTotal: session.amount_total ?? null,
              message: paid
                ? "Payment received"
                : status === "no_payment_required"
                  ? "Order complete"
                  : "Order not completed",
            },
            { status: 200 }
          );
        } catch (err) {
          // Server-side only; never log the session id wholesale.
          console.error("CHECKOUT_STATUS_ERROR", err);
          return Response.json(
            { ok: false, error: "We couldn't look up your payment just now — please try again in a moment." },
            { status: 502 }
          );
        }
      },
    },
  },
});