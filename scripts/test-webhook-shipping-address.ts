/* Regression test — hosted-checkout shipping address sourcing (2026-09-14).
   Real paid order EL-MU1DGE82 ($19) was charged with NO CJ supplier order:
   the webhook picked session.shipping_details.address ?? customer_details.address,
   both partial/empty (line1/city/state null), validateOrderBody rejected,
   submitCjOrder silently logged-and-returned → HTTP 200 → Stripe never
   retried. The full customer-typed address actually lives in
   session.collected_information.shipping_details.

   This test replays the real Stripe `checkout.session.completed` event and
   proves: (a) the OLD extraction yields no usable line1 and would be rejected
   by validateOrderBody (the regression), and (b) the FIXED extraction
   (resolveSessionShipping, which the webhook handler now uses) yields the
   full address and passes validateOrderBody.

   Run from repo root (bun):
     bun run scripts/test-webhook-shipping-address.ts
   Requires the real event JSON at
   /home/team/shared/evt-checkout-session-completed.json
   (kept out of the repo — contains a real customer's PII). */

import { readFileSync } from "node:fs";
import { decodeItemsMetadata } from "../src/server/items-metadata";
import { validateOrderBody } from "../src/server/order";
import {
  resolveSessionShipping,
  type SessionShippingSource,
} from "../src/server/session-address";

const EVENT_PATH = "/home/team/shared/evt-checkout-session-completed.json";

function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) {
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function piece(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const raw = JSON.parse(readFileSync(EVENT_PATH, "utf8")) as {
  type?: string;
  data?: { object?: Record<string, unknown> };
};
if (raw?.type !== "checkout.session.completed" || !raw.data?.object) {
  fail(`event JSON at ${EVENT_PATH} does not look like a checkout.session.completed event`);
}
const session = raw.data.object as SessionShippingSource & {
  metadata?: Record<string, string>;
};
const ref = String((session.metadata ?? {})["orderRef"] ?? "?");
console.log(`replaying checkout.session.completed for order ref ${ref}`);

// ── Old (broken) extraction — what the webhook did before the fix ──────────
const sd = session.shipping_details;
const cd = session.customer_details;
const oldAddr = sd?.address ?? cd?.address;
const oldLine1 = piece(oldAddr?.line1);
console.log(`[old extraction] line1=${JSON.stringify(oldLine1)}`);
if (oldLine1.length > 0) {
  fail("precondition: old extraction unexpectedly produced a usable line1");
}
const oldBody = {
  name: piece(sd?.name) || piece(cd?.name),
  email: piece(cd?.email),
  paidEmail: piece(cd?.email),
  address: {
    line1: oldLine1,
    city: piece(oldAddr?.city),
    state: piece(oldAddr?.state),
    zip: piece(oldAddr?.postal_code),
    country: piece(oldAddr?.country),
  },
  items: decodeItemsMetadata(session.metadata),
};
const oldChecked = validateOrderBody(oldBody);
console.log(
  `[old path] validateOrderBody ok=${oldChecked.ok}${
    oldChecked.ok ? "" : ` — rejected with: ${oldChecked.error}`
  }`
);
if (oldChecked.ok) fail("precondition: old extraction passed validation (no regression proven)");

// ── New extraction (the fix — same code the webhook handler now uses) ──────
const { addr, name } = resolveSessionShipping(session);
assertEq(addr?.line1, "8745 Quarry Road", "addr.line1");
assertEq(addr?.city, "Hillsboro", "addr.city");
assertEq(addr?.state, "OH", "addr.state");
assertEq(addr?.postal_code, "45133", "addr.postal_code");
assertEq(addr?.country, "US", "addr.country");
assertEq(name, "Jason T Moyer", "shipping name");

const newBody = {
  name,
  email: piece(cd?.email),
  paidEmail: piece(cd?.email),
  address: {
    line1: piece(addr?.line1),
    city: piece(addr?.city),
    state: piece(addr?.state),
    zip: piece(addr?.postal_code),
    country: piece(addr?.country).toUpperCase(),
  },
  items: decodeItemsMetadata(session.metadata),
};
const newChecked = validateOrderBody(newBody);
console.log(`[new path] validateOrderBody ok=${newChecked.ok}`);
if (!newChecked.ok) {
  fail(`fixed extraction still fails validation: ${newChecked.error}`);
}
const o = (newChecked as { ok: true; order: { address: { line1: string; city: string; state: string; zip: string; country: string } } }).order;
console.log(
  `[new path] fulfillment address: "${o.address.line1}, ${o.address.city} ${o.address.state} ${o.address.zip} ${o.address.country}"`
);
console.log(`[new path] shipping name: "${name}"`);

console.log("\nPASS — fix verified against the real checkout.session.completed event");