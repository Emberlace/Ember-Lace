#!/usr/bin/env node
/**
 * Replay a Stripe checkout.session.completed webhook event against a webhook
 * endpoint. This is the tool used to re-drive session
 * cs_live_a1bxrlaEAOLCTvI4mw54VMeHCOfXH0zML1BEcOeyyxoAx6ja5lB9reInZt
 * (orderRef EL-MTYUUILA, paid $16.15) through the fixed webhook so the missed
 * CJ fulfillment order for Jason Moyer / 8745 Quarry Road, Hillsboro OH 45133
 * finally gets created.
 *
 * Usage:
 *   node verify/replay-checkout-event.mjs <eventId|sessionId> [webhookUrl] [--fetch-event-from-stripe]
 *
 *   <eventId>   (evt_...)  fetch that stored event from the Stripe API and
 *                          replay it. Its data.object is the Checkout Session
 *                          as it was at event delivery.
 *   <sessionId> (cs_...)   fetch the CURRENT session object from the Stripe
 *                          API, wrap it as checkout.session.completed and
 *                          replay it (default). Past completion the session
 *                          object is static, so re-fetching it is safe.
 *   --fetch-event-from-stripe  force event retrieval even when the id starts
 *                          with cs_ (e.g. when only the session id is known
 *                          but you want the original delivery payload).
 *   webhookUrl  defaults to http://localhost:3000/api/stripe-webhook (dev);
 *                          point it at the LIVE webhook URL after publish to
 *                          fulfill EL-MTYUUILA for real.
 *
 * Secrets: STRIPE_SECRET_KEY from env (required; the value is never printed).
 * Webhook secret: src/data/webhook-secret.json is authoritative (same file the
 * route reads), STRIPE_WEBHOOK_SECRET (whsec_...) env is the fallback.
 *
 * The payload is signed exactly the way Stripe signs real deliveries
 * (t=<ts>,v1=HMAC-SHA256 over "<ts>.<payload>") and POSTed with the
 * stripe-signature header. Prints HTTP status + short body; the receiving
 * server's own [stripe-webhook] logs show whether the CJ order was created.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Stripe from "stripe";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

function usage() {
  console.error(
    "Usage: node verify/replay-checkout-event.mjs <eventId|sessionId> [webhookUrl] [--fetch-event-from-stripe]"
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
if (!id) usage();
const webhookUrl = args.find(
  (a, i) => !a.startsWith("--") && i !== args.indexOf(id)
) ?? "http://localhost:3000/api/stripe-webhook";
const forceEventFetch = args.includes("--fetch-event-from-stripe");

const sk = process.env.STRIPE_SECRET_KEY;
if (!sk) {
  console.error("STRIPE_SECRET_KEY env var is required (its value is never printed).");
  process.exit(2);
}

let whsec = "";
try {
  const file = JSON.parse(
    readFileSync(path.join(repo, "src", "data", "webhook-secret.json"), "utf8"),
  );
  if (typeof file?.whsec === "string" && file.whsec.startsWith("whsec_")) whsec = file.whsec;
} catch {
  /* fall through to env fallback below */
}
if (!whsec && process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
  whsec = process.env.STRIPE_WEBHOOK_SECRET;
}
if (!whsec) {
  console.error(
    "No usable webhook secret: src/data/webhook-secret.json or STRIPE_WEBHOOK_SECRET (whsec_...).",
  );
  process.exit(2);
}

const stripe = new Stripe(sk);

const useEvent = id.startsWith("evt_") || forceEventFetch;
let event;
if (useEvent) {
  const ev = await stripe.events.retrieve(id);
  const obj = ev.data.object;
  event = {
    id: ev.id,
    object: "event",
    type: ev.type,
    created: ev.created,
    livemode: ev.livemode,
    pending_webhooks: ev.pending_webhooks,
    api_version: ev.api_version,
    request: ev.request ?? null,
    data: { object: obj },
  };
} else {
  const session = await stripe.checkout.sessions.retrieve(id);
  event = {
    id: `evt_replay_${session.id}`,
    object: "event",
    type: "checkout.session.completed",
    created: session.created,
    livemode: session.livemode,
    pending_webhooks: 0,
    api_version: null,
    request: null,
    data: { object: session },
  };
}

const payload = JSON.stringify(event);
const ts = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", whsec).update(`${ts}.${payload}`).digest("hex");
const header = `t=${ts},v1=${signature}`;

const s = event.data.object;
const cd = s?.customer_details;
console.log(
  `Replaying ${event.type} for ${String(s?.id ?? "")} -> ${webhookUrl}\n` +
    `  session.shipping_details: ${JSON.stringify(s?.shipping_details ?? null)}\n` +
    `  customer_details: ${JSON.stringify(
      cd ? { name: cd.name, email: cd.email, phone: cd.phone, address: cd.address } : null,
    )}\n` +
    `  metadata: ${JSON.stringify(s?.metadata ?? null)}`,
);

const res = await fetch(webhookUrl, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": header },
  body: payload,
});
const text = (await res.text()).slice(0, 500);
console.log(`HTTP ${res.status} ${res.statusText} — body: ${text || "(empty)"}`);

// Non-200 means the endpoint did not accept/process the event — flag it.
process.exit(res.status === 200 ? 0 : 1);