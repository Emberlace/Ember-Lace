// scripts/expand-cj.ts — server-side only (bun). NOT bundled to client.
// Expands live-catalog.json to ~100-115 with LUXE silk/satin coverage.
// Keeps existing 50 entries (dedupe by cjPid), adds luxe-targeted queries.
// Never logs CJ_API_KEY or tokens.
//
// Run:  bun scripts/expand-cj.ts
// Out:  src/data/live-catalog.json + src/data/live-catalog-stats.json

import { cjProductList } from "../src/server/cj.ts";

const OUT = new URL("../src/data/live-catalog.json", import.meta.url);
const STATS_OUT = new URL("../src/data/live-catalog-stats.json", import.meta.url);
const EXISTING = new URL("../src/data/live-catalog.json", import.meta.url);

// Queries: [keyword, pageNum]. 'lace set' split to single word 'lace'
// (productName is word-OR; multi-word pulls junk — verified 2026-09-08).
const QUERIES: Array<[string, number]> = [
  ["silk", 1],
  ["satin", 1],
  ["embroidery", 1],
  ["robe", 1],
  ["chemise", 1],
  ["negligee", 1],
  ["camisole", 1],
  ["lace", 1],
  ["lingerie", 2],
  ["bodysuit", 2],
  ["bralette", 2],
];
const PAGE_SIZE = 50;
const SLEEP_MS = 350;
const CAP = 115;

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

const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

function isIntimates(nameEn: string): { ok: boolean; reason?: string } {
  const words = wordsOf(nameEn);
  if (words.length === 0) return { ok: false, reason: "empty-name" };
  for (const w of words) if (JUNK.has(w)) return { ok: false, reason: `junk:${w}` };
  return words.some((w) => ALLOW.has(w))
    ? { ok: true }
    : { ok: false, reason: "no-allow-hit" };
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

const BRA_WORDS = /\b(bra|bralette|bustier|corset)\b/i;

// Luxe-aware retail: wholesale $30+ → 2.5x (lands $98–168 band where supported);
// otherwise everyday 2.2x, min $18.
function priceAndCollection(wholesale: number): { retail: number; collection: Product["collection"] } {
  const retail = wholesale >= 30
    ? Math.round(wholesale * 2.5)
    : Math.max(18, Math.round(wholesale * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return { retail, collection };
}

function toProduct(c: Raw): Product {
  const { retail, collection } = priceAndCollection(c.wholesale);
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
    sizes: BRA_WORDS.test(c.name) ? "30A–44H+" : "XS–4X",
    usWarehouse: c.us,
    currency: "USD",
  };
}

/* ---- load existing (keep) ---- */
const existing: Product[] = await Bun.file(EXISTING).json();
const seen = new Map<string, Raw>();
for (const p of existing) {
  seen.set(p.cjPid, {
    pid: p.cjPid, name: p.name, sku: p.cjSku, image: p.image,
    wholesale: p.wholesale, us: p.usWarehouse,
  });
}
console.log(`existing kept: ${existing.length}`);

/* ---- fetch new queries ---- */
let apiCalls = 0;
let apiErrors = 0;

for (const [kw, page] of QUERIES) {
  const t0 = Date.now();
  try {
    const json: any = await cjProductList({ pageNum: page, pageSize: PAGE_SIZE, keyWords: kw });
    apiCalls++;
    const list: any[] = json?.data?.list ?? [];
    console.log(`query "${kw}" p${page} → ${list.length} results ms=${Date.now() - t0}`);
    const rej: Record<string, number> = {};
    const rejSamples: Record<string, string> = {};
    for (const c of list) {
      const name: string = c.productNameEn ?? "";
      const pid = String(c.pid ?? "");
      if (!pid || seen.has(pid)) { rej.dup = (rej.dup ?? 0) + 1; continue; }
      const check = isIntimates(name);
      if (!check.ok) {
        const r = check.reason ?? "?";
        rej[r] = (rej[r] ?? 0) + 1;
        if (!(r in rejSamples)) rejSamples[r] = name.slice(0, 80);
        continue;
      }
      const image = String(c.productImage ?? "");
      if (!image) { rej["no-image"] = (rej["no-image"] ?? 0) + 1; continue; }
      const wholesale = parseWholesale(c.sellPrice);
      if (wholesale === null) { rej["no-price"] = (rej["no-price"] ?? 0) + 1; continue; }
      seen.set(pid, {
        pid, name, sku: String(c.productSku ?? ""), image, wholesale, us: usWarehouse(c),
      });
    }
    console.log(`  reject "${kw}" p${page}: ${JSON.stringify(rej)} samples=${JSON.stringify(rejSamples)}`);
  } catch (e) {
    apiErrors++;
    console.log(`query "${kw}" p${page} ERROR: ${e instanceof Error ? e.message : String(e)} (skip)`);
  }
  await sleep(SLEEP_MS);
}

/* ---- build: existing first, then rank new (luxe → US → margin) ---- */
const existingIds = new Set(existing.map((p) => p.cjPid));
const fresh: Product[] = [...seen.values()]
  .filter((c) => !existingIds.has(c.pid))
  .map(toProduct);

// Accept unknown-warehouse for luxe if US unavailable (flagged via usWarehouse field).
const rank = (p: Product) =>
  (p.collection === "luxe" ? 0 : 100) +
  (p.usWarehouse === true ? 0 : p.usWarehouse === "unknown" ? 1 : 2);
fresh.sort((a, b) => rank(a) - rank(b) || b.margin - a.margin);

const merged = [...existing, ...fresh].slice(0, CAP);

await Bun.write(OUT, JSON.stringify(merged, null, 1) + "\n");

const stats = {
  count: merged.length,
  candidates: seen.size,
  existingKept: existing.length,
  newAdded: merged.length - existing.length,
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
  luxeSamples: merged.filter((p) => p.collection === "luxe").slice(0, 8)
    .map((p) => ({ name: p.name.slice(0, 90), retail: p.retail, wholesale: p.wholesale, us: p.usWarehouse })),
  source: "CJ /product/list via productName param, expanded 2026-09-08",
};

await Bun.write(STATS_OUT, JSON.stringify(stats, null, 1) + "\n");
console.log("STATS " + JSON.stringify(stats, null, 1));
console.log(`Wrote ${OUT} (${merged.length} products) + stats`);
