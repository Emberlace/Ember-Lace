// scripts/sweep-bras-backfill.ts — server-side only (bun). NOT bundled to client.
// Backfill pass: page-2 bra queries, accept ONLY usWarehouse true/"unknown",
// cap +6 (catalog is at 120 after dropping non-US picks; target 126 = +30).
// Never logs CJ_API_KEY or tokens.
//
// Run:  bun scripts/sweep-bras-backfill.ts
// Out:  src/data/live-catalog.json + src/data/live-catalog-stats.json

import { cjProductList } from "../src/server/cj.ts";

const OUT = new URL("../src/data/live-catalog.json", import.meta.url);
const STATS_OUT = new URL("../src/data/live-catalog-stats.json", import.meta.url);
const EXISTING = new URL("../src/data/live-catalog.json", import.meta.url);

const QUERIES: Array<[string, number]> = [
  ["bra", 2],
  ["bralette", 1],
  ["bustier", 1],
  ["strapless", 1],
  ["sports bra", 1],
  ["push-up", 1],
  ["nursing", 1],
  ["underwire", 1],
];
const PAGE_SIZE = 50;
const SLEEP_MS = 400;
const ADD_CAP = 6;

const ALLOW = new Set([
  "bra", "bras", "bralette", "bralettes", "bustier",
  "brief", "briefs", "panty", "panties", "pantie", "underpants", "knickers",
  "lace", "silk", "satin", "teddy", "teddies", "chemise", "robe", "robes",
  "thong", "thongs", "gstring", "g-string",
  "bodysuit", "camisole", "cami", "underwear", "lingerie", "corset",
  "garter", "garters", "nightgown", "nightgowns", "nightdress", "nightie",
  "negligee", "babydoll", "sleepwear", "sleep", "lounge", "loungewear",
  "pajama", "pajamas", "pyjama", "pyjamas", "hipster", "boyshort", "bikini",
  "bikinis", "velvet", "bridal", "stocking", "stockings", "hosiery", "mesh",
]);

const JUNK = new Set([
  "lamp", "lamps", "lighting", "furniture", "sofa", "couch", "chair", "chairs",
  "table", "desk", "phone", "phones", "charger", "chargers", "cable", "cables",
  "laptop", "tablet", "earphone", "headphone", "earbuds", "speaker",
  "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals",
  "bag", "bags", "handbag", "backpack", "wallet", "watch", "watches",
  "necklace", "necklaces", "earring", "earrings", "bracelet", "bracelets",
  "jewelry", "jewellery", "toy", "toys", "doll", "dolls", "led",
  "kitchen", "knife", "knives", "cook", "cooker", "car", "cars", "vehicle",
  "motor", "moto", "pet", "pets", "dog", "dogs", "cat", "cats", "plant",
  "plants", "garden", "tent", "bike", "bicycle", "mower", "drill", "hammer",
  "wrench", "paint", "curtain", "curtains", "rug", "carpet", "mattress",
  "pillow", "pillows", "blanket", "blankets", "towel", "towels", "quilt",
  "bedding", "sheet", "sheets", "comforter", "duvet", "umbrella",
  "jacket", "jackets", "coat", "coats", "sweater", "sweaters", "hoodie",
  "hoodies", "jeans", "tshirt", "tshirts", "t-shirt", "swimsuit", "swimwear",
  "swim", "bathing", "suit", "suits", "uniform", "uniforms", "costume",
  "costumes", "wig", "wigs", "hat", "hats", "cap", "caps", "glove", "gloves",
  "scarf", "scarves", "sock", "socks", "men", "mens", "male", "boy", "boys",
  "kid", "kids", "child", "children", "baby", "babies", "toddler",
  "mug", "cup", "bottle", "lunch", "school", "office", "mouse", "keyboard",
  "drone", "camera", "projector", "microphone", "tripod", "humidifier",
  "fan", "heater", "vacuum", "kettle", "fryer", "blender", "mixer", "oven",
  "fridge", "freezer", "washer", "dryer", "candle", "candles", "clock",
  "mirror", "vase", "book", "books", "pen", "pencil", "notebook", "sticker",
  "balloon", "party", "christmas", "halloween", "helmet", "skateboard",
  "fishing", "camping", "hiking", "golf", "tennis", "soccer", "basketball",
  "football", "yoga", "dumbbell", "treadmill",
]);

const NON_BRA = new Set([
  "dress", "dresses", "gown", "gowns", "top", "tops", "tank", "shirt", "shirts",
  "blouse", "skirt", "skirts", "pants", "leggings", "jumpsuit", "romper",
]);

const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const BRA_WORD = new Set(["bra", "bras", "bralette", "bralettes", "bustier", "bustiers"]);

function isRealBra(nameEn: string): { ok: boolean; reason?: string } {
  const words = wordsOf(nameEn);
  if (words.length === 0) return { ok: false, reason: "empty-name" };
  for (const w of words) if (JUNK.has(w)) return { ok: false, reason: `junk:${w}` };
  if (!words.some((w) => ALLOW.has(w))) return { ok: false, reason: "no-allow-hit" };
  if (!words.some((w) => BRA_WORD.has(w))) return { ok: false, reason: "not-a-bra" };
  for (const w of words) if (NON_BRA.has(w)) return { ok: false, reason: `non-bra-garment:${w}` };
  return { ok: true };
}

function parseWholesale(sellPrice: unknown): number | null {
  if (typeof sellPrice !== "string") return null;
  const m = sellPrice.match(/[\d.]+/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function usWarehouse(raw: any): boolean | "unknown" {
  const codes = raw?.shippingCountryCodes;
  if (!Array.isArray(codes)) return "unknown";
  return codes.some((c: unknown) => typeof c === "string" && /(^|_)US$/.test(c) && c !== "US");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r2 = (n: number) => Math.round(n * 100) / 100;

type Raw = { pid: string; name: string; sku: string; image: string; wholesale: number; us: boolean | "unknown" };
type Product = {
  id: string; name: string; cjPid: string; cjSku: string;
  wholesale: number; retail: number; margin: number; marginPct: number;
  collection: "everyday" | "lace" | "luxe";
  image: string; sizes: string; usWarehouse: boolean | "unknown"; currency: string;
};

function toProduct(c: Raw): Product {
  const retail = Math.max(18, Math.round(c.wholesale * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return {
    id: `cj-${c.pid}`,
    name: c.name,
    cjPid: c.pid,
    cjSku: c.sku,
    wholesale: r2(c.wholesale),
    retail,
    margin: r2(retail - c.wholesale),
    marginPct: r2(((retail - c.wholesale) / retail) * 100),
    collection,
    image: c.image,
    sizes: "30A–44H+",
    usWarehouse: c.us,
    currency: "USD",
  };
}

const existing: Product[] = await Bun.file(EXISTING).json();
const seen = new Set(existing.map((p) => p.cjPid));
console.log(`existing kept: ${existing.length}`);

const cands: Raw[] = [];
let apiCalls = 0;
let apiErrors = 0;

for (const [kw, page] of QUERIES) {
  if (cands.length >= ADD_CAP * 4) { console.log("enough candidates, stopping queries"); break; }
  const t0 = Date.now();
  try {
    const json: any = await cjProductList({ pageNum: page, pageSize: PAGE_SIZE, keyWords: kw });
    apiCalls++;
    const list: any[] = json?.data?.list ?? [];
    console.log(`query "${kw}" p${page} → ${list.length} results ms=${Date.now() - t0}`);
    const rej: Record<string, number> = {};
    for (const c of list) {
      const name: string = c.productNameEn ?? "";
      const pid = String(c.pid ?? "");
      if (!pid || seen.has(pid)) { rej.dup = (rej.dup ?? 0) + 1; continue; }
      if (!isRealBra(name).ok) { rej.filtered = (rej.filtered ?? 0) + 1; continue; }
      const image = String(c.productImage ?? "");
      if (!image) { rej["no-image"] = (rej["no-image"] ?? 0) + 1; continue; }
      const wholesale = parseWholesale(c.sellPrice);
      if (wholesale === null) { rej["no-price"] = (rej["no-price"] ?? 0) + 1; continue; }
      const us = usWarehouse(c);
      if (us === false) { rej["non-us"] = (rej["non-us"] ?? 0) + 1; continue; }
      seen.add(pid);
      cands.push({ pid, name, sku: String(c.productSku ?? ""), image, wholesale, us });
    }
    console.log(`  reject "${kw}" p${page}: ${JSON.stringify(rej)} kept=${cands.length}`);
  } catch (e) {
    apiErrors++;
    console.log(`query "${kw}" p${page} ERROR: ${e instanceof Error ? e.message : String(e)} (skip)`);
  }
  await sleep(SLEEP_MS);
}

const fresh = cands.map(toProduct);
// US first, then unknown; then margin.
fresh.sort((a, b) =>
  (a.usWarehouse === true ? 0 : 1) - (b.usWarehouse === true ? 0 : 1) || b.margin - a.margin);
const picked = fresh.slice(0, ADD_CAP);
const merged = [...existing, ...picked];

await Bun.write(OUT, JSON.stringify(merged, null, 1) + "\n");

const braCount = merged.filter((p) => wordsOf(p.name).some((w) => BRA_WORD.has(w))).length;
const stats = {
  count: merged.length,
  braCount,
  existingKept: existing.length,
  newAdded: picked.length,
  apiCalls,
  apiErrors,
  avgWholesale: merged.length ? r2(merged.reduce((a, p) => a + p.wholesale, 0) / merged.length) : null,
  avgRetail: merged.length ? r2(merged.reduce((a, p) => a + p.retail, 0) / merged.length) : null,
  avgMargin: merged.length ? r2(merged.reduce((a, p) => a + p.margin, 0) / merged.length) : null,
  usCount: merged.filter((p) => p.usWarehouse === true).length,
  unknownWarehouseCount: merged.filter((p) => p.usWarehouse === "unknown").length,
  nonUsCount: merged.filter((p) => p.usWarehouse === false).length,
  byCollection: {
    everyday: merged.filter((p) => p.collection === "everyday").length,
    lace: merged.filter((p) => p.collection === "lace").length,
    luxe: merged.filter((p) => p.collection === "luxe").length,
  },
  braSamples: picked.slice(0, 10)
    .map((p) => ({ name: p.name.slice(0, 90), retail: p.retail, wholesale: p.wholesale, us: p.usWarehouse })),
  source: "CJ /product/list via productName param, bra sweep + backfill 2026-09-08",
};

await Bun.write(STATS_OUT, JSON.stringify(stats, null, 1) + "\n");
console.log("STATS " + JSON.stringify(stats, null, 1));
console.log(`Wrote ${OUT} (${merged.length} products, +${picked.length}) + stats`);
