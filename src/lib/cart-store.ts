/* Ember & Lace — client cart store (localStorage-persisted).
   Module-level store shared by Nav, catalog grid, drawer, and checkout modal.
   SSR-safe: guards localStorage (module evaluates on the server too). */

import { useSyncExternalStore } from "react";

export type CartLine = { id: string; qty: number; cjVid?: string; size?: string };

const KEY = "el-cart";
const MAX_LINES = 50;

function load(): CartLine[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof l === "object" &&
          typeof (l as CartLine).id === "string" &&
          Number.isInteger((l as CartLine).qty) &&
          (l as CartLine).qty > 0
      )
      .map((l) => {
        // Sanitize optional variant fields (digits-only vid; short size label).
        const cjVid =
          typeof l.cjVid === "string" && /^[0-9]{1,40}$/.test(l.cjVid.trim())
            ? l.cjVid.trim()
            : undefined;
        const size =
          typeof l.size === "string" && l.size.trim().length > 0 && l.size.trim().length <= 24
            ? l.size.trim()
            : undefined;
        return cjVid || size ? { id: l.id, qty: l.qty, ...(cjVid ? { cjVid } : {}), ...(size ? { size } : {}) } : { id: l.id, qty: l.qty };
      })
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

let lines: CartLine[] = load();
let cartOpen = false;

const listeners = new Set<() => void>();

function emit() {
  try {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable — cart still works for the session */
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshotLines(): CartLine[] {
  return lines;
}

function snapshotOpen(): boolean {
  return cartOpen;
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, snapshotLines, snapshotLines);
}

export function useCartOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshotOpen, snapshotOpen);
}

export function cartLineCount(): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function addToCart(id: string, qty = 1, variant?: { cjVid?: string; size?: string }): void {
  const cjVid =
    variant?.cjVid && /^[0-9]{1,40}$/.test(variant.cjVid) ? variant.cjVid : undefined;
  const size =
    variant?.size && variant.size.trim().length > 0 && variant.size.trim().length <= 24
      ? variant.size.trim()
      : undefined;
  const cur = lines.find((l) => l.id === id && (l.cjVid ?? undefined) === cjVid);
  if (cur) {
    cur.qty = Math.min(999, cur.qty + qty);
    if (size) cur.size = size;
  } else if (lines.length < MAX_LINES) {
    lines = [...lines, { id, qty, ...(cjVid ? { cjVid } : {}), ...(size ? { size } : {}) }];
  }
  emit();
}

/** Unique React/store key for a line: product id + variant id when present. */
export function lineKey(l: Pick<CartLine, "id" | "cjVid">): string {
  return l.cjVid ? `${l.id}::${l.cjVid}` : l.id;
}

function findLine(id: string, cjVid?: string): CartLine | undefined {
  const norm = cjVid && /^[0-9]{1,40}$/.test(cjVid) ? cjVid : undefined;
  return (
    lines.find((l) => l.id === id && (l.cjVid ?? undefined) === norm) ??
    (norm === undefined ? undefined : lines.find((l) => l.id === id))
  );
}

export function setLineQty(id: string, qty: number, cjVid?: string): void {
  const cur = findLine(id, cjVid);
  if (!cur) return;
  if (qty <= 0) {
    const key = lineKey(cur);
    lines = lines.filter((l) => lineKey(l) !== key);
  } else {
    cur.qty = Math.min(999, Math.floor(qty));
  }
  emit();
}

export function removeLine(id: string, cjVid?: string): void {
  const cur = findLine(id, cjVid);
  if (!cur) {
    // Legacy callers may pass only an id; fall back to id-only removal.
    lines = lines.filter((l) => l.id !== id);
  } else {
    const key = lineKey(cur);
    lines = lines.filter((l) => lineKey(l) !== key);
  }
  emit();
}

export function clearCart(): void {
  lines = [];
  emit();
}

export function setCartOpen(v: boolean): void {
  cartOpen = v;
  listeners.forEach((l) => l());
}

let checkoutOpen = false;

function snapshotCheckout(): boolean {
  return checkoutOpen;
}

export function useCheckoutOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshotCheckout, snapshotCheckout);
}

export function setCheckoutOpen(v: boolean): void {
  checkoutOpen = v;
  listeners.forEach((l) => l());
}
