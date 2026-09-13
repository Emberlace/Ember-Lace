/* Ember & Lace — PaymentIntent-metadata encoding for cart lines.
   Stripe metadata values are capped at 500 chars per key, so the webhook must
   be able to rebuild the cart from metadata alone (no /tmp lookups). We store
   compact JSON [{"p":cjPid,"q":qty,"v":cjVid}] — short keys keep ~8-10 lines
   under one 500-char key; larger carts are chunked across items0..itemsN keys,
   each ≤ 450 chars, and reassembled by the webhook. Pure + testable.

   `v` invariant (card-checkout): the PaymentIntent route validates items with
   requireVid, so every line reaching this encoder has a cjVid and every PI
   metadata item carries `v` — the CJ variant the webhook needs for
   createOrder. decodeItemsMetadata stays lenient on purpose: metadata written
   before the invariant (or by other callers) without `v` still decodes into
   {cjPid, qty} lines, which buildCjPayload maps to vid=cjPid (CJ rejects that
   with 1602000 — documented in order.ts as the legacy fallback). */

import type { OrderItem } from "./order";

const CHUNK_MAX = 450;
const MAX_CHUNKS = 50;

type ItemsMeta = Record<string, string>;

export function encodeItemsMetadata(items: OrderItem[]): ItemsMeta {
  const compact = JSON.stringify(
    items.map((it) =>
      it.cjVid ? { p: it.cjPid, q: it.qty, v: it.cjVid } : { p: it.cjPid, q: it.qty }
    )
  );
  const out: ItemsMeta = {};
  if (compact.length <= CHUNK_MAX) {
    out.items = compact;
    out.itemsChunks = "1";
    return out;
  }
  const chunks: string[] = [];
  for (let i = 0; i < compact.length && chunks.length < MAX_CHUNKS; i += CHUNK_MAX) {
    chunks.push(compact.slice(i, i + CHUNK_MAX));
  }
  chunks.forEach((c, i) => {
    out[`items${i}`] = c;
  });
  out.itemsChunks = String(chunks.length);
  out.itemsTruncated = "1";
  return out;
}

export function decodeItemsMetadata(meta: ItemsMeta | null | undefined): OrderItem[] {
  if (!meta) return [];
  const chunkCount = Number(meta.itemsChunks ?? (typeof meta.items === "string" ? 1 : 0));
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS)
    return [];
  let compact = "";
  if (chunkCount === 1) {
    compact = typeof meta.items === "string" ? meta.items : "";
  } else {
    for (let i = 0; i < chunkCount; i++) {
      const c = meta[`items${i}`];
      if (typeof c !== "string") return [];
      compact += c;
    }
  }
  if (!compact) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(compact);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: OrderItem[] = [];
  for (const it of parsed) {
    const o = it as { p?: unknown; q?: unknown; v?: unknown } | null;
    if (!o || typeof o.p !== "string" || typeof o.q !== "number") return [];
    out.push(
      typeof o.v === "string" && o.v.length > 0
        ? { cjPid: o.p, qty: o.q, cjVid: o.v }
        : { cjPid: o.p, qty: o.q }
    );
  }
  return out;
}