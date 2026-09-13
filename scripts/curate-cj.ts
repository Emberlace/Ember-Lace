// scripts/curate-cj.ts — server-side only (bun). NOT bundled to client.
// Curates 30-50 REAL CJ intimates products into src/data/live-catalog.json.
// Never logs CJ_API_KEY or tokens.
//
// Run:  bun scripts/curate-cj.ts
// Out:  src/data/live-catalog.json + STATS JSON on stdout

import { cjProductList } from "../src/server/cj.ts";

const OUT = new URL("../src/data/live-catalog.json", import.meta.url);

const KEYWORDS = [
  // Single distinctive words only. CJ /product/list `productName` matching
  // is word-OR: multi-word queries like "lace lingerie set" match anything
  // containing "set" (chairs, curtains, dental sets — verified 2026-09-08).
  // Single intimates-specific words keep all 50 results in-category.
  "lingerie",
  "bralette",
  "chemise",
  "bodysuit",
  "corset",
  "babydoll",
  "negligee",
  "camisole",
  "boyshort",
  "panties",
  "thong",
  "nightgown",
];
const PAGE_SIZE = 50;
const SLEEP_MS = 350;

/* ---- filter sets (copied from scripts/map-cj.ts) ---- */
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

// US-warehouse signal: CJ list rows carry `shippingCountryCodes`
// (e.g. ["CN","CN_US"]). A code containing "US" (other than the CN
// origin prefix) means US warehouse/line available.
function usWarehouse(raw: any): boolean | "unknown" {
  const codes = raw?.shippingCountryCodes;
  if (!Array.isArray(codes)) return "unknown";
  return codes.some((c: unknown) => typeof c === "string" && /(^|_)US$/.test(c) && c !== "US");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---- fetch ---- */
type Raw = { pid: string; name: string; sku: string; image: string; wholesale: number; us: boolean | "unknown" };

const seen = new Map<string, Raw>();
let apiCalls = 0;
let apiErrors = 0;

for (const kw of KEYWORDS) {
  const t0 = Date.now();
  try {
    const json: any = await cjProductList({ pageNum: 1, pageSize: PAGE_SIZE, keyWords: kw });
    apiCalls++;
    const list: any[] = json?.data?.list ?? [];
    console.log(`query "${kw}" → ${list.length} results ms=${Date.now() - t0}`);
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
        pid,
        name,
        sku: String(c.productSku ?? ""),
        image,
        wholesale,
        us: usWarehouse(c),
      });
    }
    console.log(`  reject "${kw}": ${JSON.stringify(rej)} samples=${JSON.stringify(rejSamples)}`);
  } catch (e) {
    apiErrors++;
    console.log(`query "${kw}" ERROR: ${e instanceof Error ? e.message : String(e)} (skip)`);
  }
  await sleep(SLEEP_MS);
}

console.log(`unique intimates candidates: ${seen.size}`);

/* ---- price, collection, rank, cap ---- */
type Product = {
  id: string;
  name: string;
  cjPid: string;
  cjSku: string;
  wholesale: number;
  retail: number;
  margin: number;
  marginPct: number;
  collection: "everyday" | "lace" | "luxe";
  image: string;
  sizes: string;
  usWarehouse: boolean | "unknown";
  currency: string;
};

const BRA_WORDS = /\b(bra|bralette|bustier|corset)\b/i;

const products: Product[] = [...seen.values()].map((c) => {
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
    sizes: BRA_WORDS.test(c.name) ? "30A–44H+" : "XS–4X",
    usWarehouse: c.us,
    currency: "USD",
  } as Product;
});

// US-warehouse + margin first
const rank = (p: Product) => (p.usWarehouse === true ? 0 : p.usWarehouse === "unknown" ? 1 : 2);
products.sort((a, b) => rank(a) - rank(b) || b.margin - a.margin);

const capped = products.slice(0, 50);

await Bun.write(OUT, JSON.stringify(capped, null, 1) + "\n");

/* ---- stats ---- */
const margins = capped.map((p) => p.margin);
const stats = {
  count: capped.length,
  candidates: seen.size,
  apiCalls,
  apiErrors,
  avgWholesale: capped.length ? r2(capped.reduce((a, p) => a + p.wholesale, 0) / capped.length) : null,
  avgRetail: capped.length ? r2(capped.reduce((a, p) => a + p.retail, 0) / capped.length) : null,
  avgMargin: margins.length ? r2(margins.reduce((a, b) => a + b, 0) / margins.length) : null,
  usCount: capped.filter((p) => p.usWarehouse === true).length,
  unknownWarehouseCount: capped.filter((p) => p.usWarehouse === "unknown").length,
  nonUsCount: capped.filter((p) => p.usWarehouse === false).length,
  byCollection: {
    everyday: capped.filter((p) => p.collection === "everyday").length,
    lace: capped.filter((p) => p.collection === "lace").length,
    luxe: capped.filter((p) => p.collection === "luxe").length,
  },
  samples: capped.slice(0, 5).map((p) => ({ name: p.name, retail: p.retail, wholesale: p.wholesale, collection: p.collection, us: p.usWarehouse })),
};

console.log("STATS " + JSON.stringify(stats, null, 1));
console.log(`Wrote ${OUT} (${capped.length} products)`);
