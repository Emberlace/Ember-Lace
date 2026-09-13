import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/* /checkout-confirm?session_id=cs_... — return destination for Stripe Hosted
   Checkout success_url. Fetches GET /api/checkout-status server-side (never
   trusts the URL alone), then renders:
   - paid      → the success state: thank-you + order ref + tracking links
                 (mirrors the old card-checkout onSuccess display);
   - unpaid    → neutral "order not completed" state with a retry button;
   - error     → friendly error with a way back to the store.
   The fetch is what matters here — opening this page with any session id
   (even a placeholder one) tells the customer the truth from Stripe. */

type Status =
  | { phase: "loading" }
  | { phase: "done"; paid: boolean; orderRef: string; status: string; message: string }
  | { phase: "error"; error: string };

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

export const Route = createFileRoute("/checkout-confirm")({
  component: CheckoutConfirm,
});

function CheckoutConfirm() {
  const [status, setStatus] = useState<Status>({ phase: "loading" });

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session_id") ?? "";
    if (!SESSION_ID_RE.test(sid)) {
      setStatus({
        phase: "error",
        error: "We couldn't find your payment session — please check the link and try again.",
      });
      return;
    }
    let cancelled = false;
    fetch(`/api/checkout-status?session_id=${encodeURIComponent(sid)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          orderRef?: string;
          status?: string;
          message?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data.status) {
          setStatus({
            phase: "error",
            error:
              (data?.error as string) ||
              "We couldn't check your payment just now — please try again in a moment.",
          });
          return;
        }
        setStatus({
          phase: "done",
          paid: data.status === "paid" || data.status === "no_payment_required",
          orderRef: data.orderRef ?? "",
          status: data.status,
          message: data.message ?? "Order not completed",
        });
      })
      .catch(() => {
        if (!cancelled)
          setStatus({
            phase: "error",
            error: "We couldn't reach our order desk — check your connection and try again.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-noir text-ivory">
      <header className="sticky top-0 z-20 border-b border-gold/25 bg-noir/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a
            href="/"
            className="font-display flex items-center gap-2 text-xl tracking-wide text-ivory sm:text-2xl"
          >
            <img
              src="/rose.svg"
              alt="Ember and Lace red rose logo"
              width={30}
              height={30}
              className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
            />
            Ember <span className="text-gold">&amp;</span> Lace
          </a>
          <a href="/" className="text-xs font-semibold text-goldlight transition hover:text-ivory">
            ← Back to the store
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:px-6">
        {status.phase === "loading" ? (
          <div className="w-full rounded-2xl border border-gold/20 bg-card p-8">
            <p className="text-sm text-rosetaupe">Checking your order…</p>
          </div>
        ) : status.phase === "error" ? (
          <div className="w-full rounded-2xl border border-gold/20 bg-card p-8">
            <p className="font-display text-3xl text-goldlight">Hmm ♡</p>
            <p className="mt-3 text-sm leading-relaxed text-ivory/85">{status.error}</p>
            <a
              href="/"
              className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir transition hover:bg-goldlight"
            >
              Back to the store
            </a>
          </div>
        ) : status.paid ? (
          <div className="lace-dots w-full rounded-2xl border-2 border-gold bg-card p-8">
            <p className="font-display text-3xl text-goldlight">Thank you ♡</p>
            <p className="mt-2 text-sm leading-relaxed text-ivory/90">
              Payment received — your order is headed to our US warehouse in
              discreet, unmarked packaging. We'll email you when it ships.
            </p>
            {status.orderRef ? (
              <p className="mt-4 rounded-xl bg-noir/60 px-4 py-3 text-sm text-ivory/85 ring-1 ring-gold/20">
                Order ref: <strong className="text-goldlight">{status.orderRef}</strong>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-rosetaupe">
              ✎ Save your ref to track your order — you'll need it for order status and exchanges.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/#track"
                className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir transition hover:bg-goldlight"
              >
                Track your order
              </a>
              <a
                href="/"
                className="rounded-full border border-gold/40 px-6 py-3 text-sm font-semibold text-goldlight transition hover:bg-gold/10"
              >
                Continue shopping
              </a>
            </div>
          </div>
        ) : (
          <div className="lace-dots w-full rounded-2xl border border-gold/20 bg-card p-8">
            <p className="font-display text-3xl text-goldlight">Order not completed</p>
            <p className="mt-3 text-sm leading-relaxed text-ivory/85">
              We didn't receive any payment, so no charge was made. Your cart is
              still waiting for you — you can try the secure checkout again
              whenever you're ready.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/"
                className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir transition hover:bg-goldlight"
              >
                Try checkout again
              </a>
              <a
                href="/#track"
                className="rounded-full border border-gold/40 px-6 py-3 text-sm font-semibold text-goldlight transition hover:bg-gold/10"
              >
                Track an order
              </a>
            </div>
          </div>
        )}
        <p className="mt-8 text-xs text-rosetaupe">
          🔒 Secure payment processed by Stripe · Discreet, unmarked packaging · Free 60-day exchanges
        </p>
      </main>
    </div>
  );
}