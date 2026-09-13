// scripts/map-cj.ts — server-side only (bun). NOT bundled to client.
// Maps each Ember & Lace mock style (154) to the best real CJ Dropshipping
// product. Never logs CJ_API_KEY or tokens (length only).
//
// Run:  bun scripts/map-cj.ts
// Out:  src/data/cj-mapping.json + src/data/cj-mapping-stats.json

import { PRODUCTS } from "../src/data/products.ts";
import { cjProductList } from "../src/server/cj.ts";

const OUT = new URL("../src/data/cj-mapping.json", import.meta.url);
const STATS_OUT = new URL("../src/data/cj-mapping-stats.json", import.meta.url);

console.log(`CJ_API_KEY length: ${(process.env.CJ_API_KEY ?? "").length}`);
console.log(`Products to map: ${PRODUCTS.length}`);

// MAP_LIMIT env (or --limit=N arg) caps products for smoke tests.
// e.g. MAP_LIMIT=10 bun scripts/map-cj.ts
const argLimit = process.argv.find((a) => a.startsWith("--limit="));
const MAP_LIMIT = Math.max(
  0,
  parseInt(process.env.MAP_LIMIT ?? argLimit?.split("=")[1] ?? "0", 10) || 0,
);
const TARGETS = MAP_LIMIT > 0 ? PRODUCTS.slice(0, MAP_LIMIT) : PRODUCTS;
if (MAP_LIMIT > 0) console.log(`MAP_LIMIT=${MAP_LIMIT} → mapping ${TARGETS.length} products`);

/* ---------------- keyword derivation ---------------- */

function keywordsFor(name: string): string[] {
  const n = name.toLowerCase();
  const q: string[] = [];
  const push = (...s: string[]) => {
    for (const x of s) if (!q.includes(x)) q.push(x);
  };
  if (n.includes("corset")) push("corset lingerie set", "boned corset top");
  else if (n.includes("garter")) push("garter lingerie set", "garter belt stockings");
  else if (n.includes("teddy")) push("lace teddy lingerie", "satin teddy bodysuit");
  else if (n.includes("bodysuit")) push("lace bodysuit women", "mesh bodysuit");
  else if (n.includes("chemise")) push("satin chemise nightgown", "lace chemise lingerie");
  else if (n.includes("robe")) push("silk robe women", "satin kimono robe");
  else if (n.includes("slip")) push("satin slip dress nightgown", "silk slip dress");
  else if (n.includes("pajama")) push("silk pajama set women", "satin pajamas women");
  else if (n.includes("balconette")) push("balconette lace bra", "balconette bra");
  else if (n.includes("bralette")) push("lace bralette", "bralette wireless comfort");
  else if (n.includes("longline")) push("longline lace bra", "longline bra set");
  else if (/\bbra\b/.test(n)) {
    if (n.includes("nursing") || n.includes("maternity")) push("nursing bra", "maternity nursing bra");
    else if (n.includes("sport")) push("sports bra women", "wireless sports bra");
    else if (n.includes("strapless")) push("strapless bra", "strapless push up bra");
    else push("lace bra women", "wireless comfort bra");
  } else if (n.includes("thong")) push("lace thong panties", "women thong g-string");
  else if (n.includes("brief")) push("cotton brief panties women", "lace brief panties");
  else if (n.includes("boyshort")) push("boyshort panties women", "cotton boyshort brief");
  else if (n.includes("hipster") || n.includes("bikini")) push("cotton panties women", "seamless hipster panties");
  else if (n.includes("cami")) push("satin camisole women", "lace cami top");
  else if (n.includes("short")) push("pajama shorts women", "cotton sleep shorts");
  else if (n.includes("cashmere") || n.includes("lounge set") || n.includes("lounge cami"))
    push("knit lounge set women", "loungewear set women");
  else if (n.includes("set") || n.includes("ensemble") || n.includes("strappy") || n.includes("peekaboo"))
    push("lace lingerie set", "bra panty set women");
  // Pack-aware bonus query for multipacks of bottoms
  if (/thong|brief|panty|panties|hipster|bikini|boyshort/.test(n)) {
    if (/3-pack|trio/.test(n)) push("panties 3 pack women");
    else if (/duo|2-pack/.test(n)) push("panties 2 pack women");
  }
  push("women lace lingerie", "women underwear set");
  return q.slice(0, 3);
}

/* ---------------- candidate filtering ---------------- */

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

function scoreCandidate(nameEn: string): number {
  // -1 = junk / no good, else allow-hit count
  const words = wordsOf(nameEn);
  if (words.length === 0) return -1;
  for (const w of words) if (JUNK.has(w)) return -1;
  let hits = 0;
  for (const w of words) if (ALLOW.has(w)) hits++;
  return hits > 0 ? hits : -1;
}

function parseWholesale(sellPrice: unknown): number | null {
  if (typeof sellPrice !== "string") return null;
  const m = sellPrice.match(/[\d.]+/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- main ---------------- */

type Entry = {
  ourId: string;
  ourName: string;
  retail: number;
  collection: string;
  cjId: string | null;
  cjName: string | null;
  cjSku: string | null;
  wholesale: number | null;
  currency: string | null;
  image: string | null;
  margin: number | null;
  matched: boolean;
  reason?: string;
};

const results: Entry[] = [];
let apiCalls = 0;

// Incremental checkpoint: partial progress survives kills/hangs.
async function checkpoint(n: number) {
  try {
    await Bun.write(OUT, JSON.stringify(results, null, 1) + "\n");
    if ((n + 1) % 25 === 0) console.log(`checkpoint wrote ${n + 1} entries`);
  } catch (e) {
    console.log(`checkpoint write failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const RATE_SLEEP_MS = 350; // CJ tolerated far less than feared; keep a small guard

for (let i = 0; i < TARGETS.length; i++) {
  const p = TARGETS[i];
  const queries = keywordsFor(p.name);
  let best: {
    pid: string;
    name: string;
    sku: string;
    price: number;
    image: string;
    score: number;
  } | null = null;
  let lastError: string | null = null;

  for (const kw of queries) {
    let json: any = null;
    try {
      const t0 = Date.now();
      json = await cjProductList({ pageNum: 1, pageSize: 10, keyWords: kw });
      apiCalls++;
      console.log(`  [${i + 1}/${TARGETS.length}] "${p.name}" kw="${kw}" ok ms=${Date.now() - t0}`);
    } catch (e) {
      // Timeout / network error → record and move on, never hang.
      const msg = e instanceof Error ? e.message : String(e);
      lastError = `API error on "${kw}": ${msg}`;
      console.log(`  [${i + 1}/${TARGETS.length}] "${p.name}" kw="${kw}" ERROR: ${msg} (skip)`);
      await sleep(RATE_SLEEP_MS);
      continue;
    }
    await sleep(RATE_SLEEP_MS); // rate-limit guard
    const list: any[] = json?.data?.list ?? [];
    for (const c of list) {
      const nameEn: string = c.productNameEn ?? "";
      const score = scoreCandidate(nameEn);
      if (score < 0) continue;
      const price = parseWholesale(c.sellPrice);
      if (price === null) continue;
      if (!best || score > best.score) {
        best = {
          pid: String(c.pid ?? ""),
          name: nameEn,
          sku: String(c.productSku ?? ""),
          price,
          image: String(c.productImage ?? ""),
          score,
        };
      }
    }
    if (best && best.score >= 2) break; // strong match — stop early
    if (best) break; // any intimates match on targeted query is enough; save calls
  }

  if (best) {
    results.push({
      ourId: p.id,
      ourName: p.name,
      retail: p.price,
      collection: p.collection,
      cjId: best.pid,
      cjName: best.name,
      cjSku: best.sku,
      wholesale: best.price,
      currency: "USD",
      image: best.image,
      margin: r2(p.price - best.price),
      matched: true,
    });
  } else {
    results.push({
      ourId: p.id,
      ourName: p.name,
      retail: p.price,
      collection: p.collection,
      cjId: null,
      cjName: null,
      cjSku: null,
      wholesale: null,
      currency: null,
      image: null,
      margin: null,
      matched: false,
      reason: lastError ?? `no intimates match for queries: ${queries.join(" | ")}`,
    });
  }
  if ((i + 1) % 10 === 0 || i + 1 === TARGETS.length) {
    const m = results.filter((r) => r.matched).length;
    console.log(`progress ${i + 1}/${TARGETS.length} matched=${m} apiCalls=${apiCalls}`);
  }
  await checkpoint(i); // partial JSON on disk survives any later hang/kill
}

await Bun.write(OUT, JSON.stringify(results, null, 1) + "\n");

/* ---------------- stats ---------------- */

const matched = results.filter((r) => r.matched);
const byCol = (c: string) => results.filter((r) => r.collection === c);
const avg = (xs: number[]) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const margins = (c: string) =>
  byCol(c).filter((r) => r.margin !== null).map((r) => r.margin as number);

const stats = {
  total: results.length,
  matched: matched.length,
  unmatched: results.length - matched.length,
  apiCalls,
  matchedPerCollection: {
    everyday: byCol("everyday").filter((r) => r.matched).length,
    lace: byCol("lace").filter((r) => r.matched).length,
    luxe: byCol("luxe").filter((r) => r.matched).length,
  },
  totalPerCollection: {
    everyday: byCol("everyday").length,
    lace: byCol("lace").length,
    luxe: byCol("luxe").length,
  },
  avgMarginPerCollection: {
    everyday: avg(margins("everyday")),
    lace: avg(margins("lace")),
    luxe: avg(margins("luxe")),
  },
  avgMarginOverall: avg(matched.map((r) => r.margin as number)),
  cheapestWholesale: matched.length
    ? matched.reduce((a, b) => (a.wholesale! < b.wholesale! ? a : b))
    : null,
  mostExpensiveWholesale: matched.length
    ? matched.reduce((a, b) => (a.wholesale! > b.wholesale! ? a : b))
    : null,
  unmatchedIds: results.filter((r) => !r.matched).map((r) => r.ourId),
};

await Bun.write(STATS_OUT, JSON.stringify(stats, null, 1) + "\n");
console.log("STATS " + JSON.stringify(stats, null, 1));
console.log(`Wrote ${OUT} + ${STATS_OUT}`);
