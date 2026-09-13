/* Ember & Lace — cart math (pure functions, shared by UI + server).
   Discount rules (single source of truth — the server's charged total MUST
   match the client's displayed total, both call these):
   - Early-shopper entitlement (joined the email list): 15% off, always.
   - Else: AUTOMATIC 10% off when subtotal >= $250 (bulk). No code needed.
   Never stack: entitled shoppers get 15%, never 10% on top. */

export const BULK_THRESHOLD = 250;
export const BULK_RATE = 0.1;
const EARLY_RATE = 0.15;

export type CartPricedLine = { price: number; qty: number };

export function cartSubtotal(lines: CartPricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

/** Discount dollars: 15% when entitled to the early-shopper discount, else
    10% of subtotal when subtotal >= $250, else 0. */
export function cartDiscount(subtotal: number, earlyAccess: boolean): number {
  if (earlyAccess) return round2(subtotal * EARLY_RATE);
  if (subtotal >= BULK_THRESHOLD) return round2(subtotal * BULK_RATE);
  return 0;
}

export function cartTotal(subtotal: number, earlyAccess: boolean): number {
  return round2(subtotal - cartDiscount(subtotal, earlyAccess));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** $X for whole dollars, $X.XX otherwise. */
export function money(n: number): string {
  const r = round2(n);
  return Number.isInteger(r) ? `$${r}` : `$${r.toFixed(2)}`;
}

/** $X.XX always — for cart lines where cents matter. */
export function moneyExact(n: number): string {
  return `$${round2(n).toFixed(2)}`;
}
