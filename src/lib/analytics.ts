/* First-party analytics (client). Fires a pageview beacon on every full page
   load and checkout_success from the order-confirmation page — both via
   navigator.sendBeacon to /api/evt (non-blocking; no impact on LCP or
   checkout). No cookies and no third parties: the only storage is
   localStorage, used solely for first-touch attribution — the FIRST
   referrer / utm / direct source ever seen on this device — so a customer
   who lands from an ad still counts as that source after the redirect to
   Stripe Hosted Checkout and back. Payloads carry no names, emails,
   addresses or IPs. Imported for its side effect by src/routes/__root.tsx;
   the window guard makes the import a no-op during SSR. */
const EVT_URL = "/api/evt";
const FIRST_TOUCH_KEY = "el_first_touch";
const CONV_DONE_PREFIX = "el_conv_done_";
const META_PIXEL_ID = "2974846332866187";

/* Start Meta reporting from the client bundle as a fallback when the hosting
   layer omits inline head scripts. If the head script already started it,
   this is a no-op, so page views and purchases are never duplicated. */
function ensureMetaPixel(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const w = window as Window & {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[][];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
  };
  if (w.fbq) return;

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  }) as NonNullable<typeof w.fbq>;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = (...args: unknown[]) => fbq(...args);
  w.fbq = fbq;
  w._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}

export type EvtSrc = "referrer" | "utm" | "direct";

type Evt = {
  evt: "pageview" | "checkout_success";
  ts: string;
  ref?: string;
  amount?: number;
  src?: EvtSrc;
};

function send(evt: Evt): void {
  try {
    const payload = JSON.stringify(evt);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(EVT_URL, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(EVT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // Analytics must never break the page (or the checkout click-through).
  }
}

function readFirstTouch(): EvtSrc | null {
  try {
    const v = window.localStorage.getItem(FIRST_TOUCH_KEY);
    if (v === "referrer" || v === "utm" || v === "direct") return v;
  } catch {
    // Storage unavailable (private mode etc.) — attribute per load instead.
  }
  return null;
}

function captureFirstTouch(): EvtSrc {
  const seen = readFirstTouch();
  if (seen) return seen;
  let src: EvtSrc = "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].some((k) =>
        params.has(k),
      )
    ) {
      src = "utm";
    } else if (document.referrer) {
      try {
        if (new URL(document.referrer).origin !== window.location.origin) src = "referrer";
      } catch {
        src = "referrer";
      }
    }
    window.localStorage.setItem(FIRST_TOUCH_KEY, src);
  } catch {
    // Storage unavailable — keep the computed source for this event anyway.
  }
  return src;
}

let pageviewSent = false;
function trackPageview(): void {
  if (pageviewSent) return;
  pageviewSent = true;
  send({ evt: "pageview", ts: new Date().toISOString(), src: captureFirstTouch() });
}

/* Fired from /checkout-confirm once the server confirms the payment. The
   localStorage guard makes it fire at most once per order ref, ever — a
   refresh of the confirmation page must not count a second conversion or
   double the revenue. */
export function trackCheckoutSuccess(orderRef: string, amountUsd: number | null): void {
  try {
    const key = CONV_DONE_PREFIX + orderRef;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // No storage → fire anyway; the refresh-dedupe just degrades.
  }
  const evt: Evt = {
    evt: "checkout_success",
    ts: new Date().toISOString(),
    ref: orderRef,
    src: readFirstTouch() ?? "direct",
  };
  if (amountUsd !== null && Number.isFinite(amountUsd) && amountUsd >= 0) {
    evt.amount = Math.round(amountUsd * 100) / 100;
  }
  send(evt);
}

/* Auto-fire the pageview once per full page load, deferred (idle callback or a
   macrotask) so it never blocks first paint. SPA route changes don't re-run
   this module, so client-side navigations can't double-count a load. */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  ensureMetaPixel();
  const fire = (): void => trackPageview();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fire, { timeout: 1500 });
  } else {
    setTimeout(fire, 0);
  }
}