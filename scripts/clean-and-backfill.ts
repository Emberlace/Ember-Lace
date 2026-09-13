// scripts/clean-and-backfill.ts — server-side only (bun). NOT bundled to client.
// 1. Removes explicit-banned non-intimates from live-catalog.json (schema unchanged).
// 2. Runs targeted CJ luxe queries to backfill 3+ real luxe intimates.
// Never logs CJ_API_KEY or tokens.
//
// Run: bun scripts/clean-and-backfill.ts
import { cjProductList } from "../src/server/cj.ts";
const OUT = new URL("../src/data/live-catalog.json", import.meta.url);
const STATS_OUT = new URL("../src/data/live-catalog-stats.json", import.meta.url);

// id (without cj- prefix ok — we match cjPid) -> reason
const BANNED: Record<string, string> = {
  "2089528903441698818": "jewelry: moissanite bridal ring, not apparel",
  "2047859458242560002": "non-wearable: 3D-printer PLA filament ('silk' false positive)",
  "2608050306481611700": "non-wearable: skincare toner",
  "2084120407258542081": "non-wearable: silk soap",
  "2083024860292427778": "non-wearable: silk soap (dup variant)",
  "2080842301091504129": "non-wearable: silk soap (dup variant)",
  "2075097837402173442": "non-wearable: collagen ampoule",
  "2074703659635953666": "non-wearable: collagen ampoule (dup)",
  "2072940890266722305": "non-wearable: collagen ampoule (dup)",
  "2068932545139417089": "non-wearable: collagen ampoule (dup)",
  "2058810604098990082": "non-wearable: collagen ampoule (dup)",
  "2088174874523107329": "non-wearable: body essential oil",
  "2088108092205944834": "non-wearable: body essential oil (dup)",
  "2085645011317841921": "non-wearable: body essential oil (dup)",
  "2089160745539895298": "non-apparel: cycling face mask (sports PPE)",
  "2088438263734255618": "non-apparel: cycling face mask (dup)",
  "2088088012680187906": "non-apparel: cycling face mask (dup)",
  "2046180047441719297": "non-intimate apparel: bib",
  "2046803295742484481": "non-intimate apparel: arm sleeves",
  "1410116371920064512": "menswear: Aloha Chemise Homme shirt",
  "2090731673505677313": "footwear outside slippers: stiletto wedding pumps",
  "2080486903673806849": "footwear outside slippers: satin ballet flats",
  "2051847317673308162": "footwear outside slippers: stiletto high-heel slides",
  "2096113849894793218": "pure evening gown, no lingerie character (high-neck/long-sleeve)",
  "2095813724408475650": "carried ban: wig (from prior pass)",
};
const QUERIES: Array<[string, number]> = [
  ["satin chemise", 1],
  ["silk slip", 1],
  ["lace corset", 1],
];
const PAGE_SIZE = 50;
const SLEEP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
  "slip", "slips", "teddy",
]);
const JUNK = new Set([
  "lamp", "lamps", "lighting", "furniture", "sofa", "couch", "chair", "chairs",
  "table", "desk", "phone", "phones", "charger", "chargers", "cable", "cables",
  "laptop", "tablet", "earphone", "headphone", "earbuds", "speaker",
  "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals",
  "bag", "bags", "handbag", "backpack", "wallet", "watch", "watches",
  "necklace", "necklaces", "earring", "earrings", "bracelet", "bracelets",
  "jewelry", "jewellery", "ring", "rings", "toy", "toys", "doll", "dolls", "led",
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
  "football", "yoga", "dumbbell", "treadmill", "hair", "headband", "headbands",
  "filament", "printer", "printing", "pla", "spool", "toner", "soap", "soaps",
  "ampoule", "serum", "cream", "mask", "masks", "bib", "sleeping",
]);
type Product = {
  id: string; name: string; cjPid: string; cjSku: string;
  wholesale: number; retail: number; margin: number; marginPct: number;
  collection: "everyday" | "lace" | "luxe"; image: string;
  sizes: string; usWarehouse: boolean | "unknown"; currency: string;
};
type Raw = { pid: string; name: string; sku: string; image: string; wholesale: number; us: boolean | "unknown" };
const r2 = (n: number) => Math.round(n * 100) / 100;
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
function isIntimates(nameEn: string): { ok: boolean; reason?: string } {
  const words = wordsOf(nameEn);
  if (words.length === 0) return { ok: false, reason: "empty-name" };
  for (const w of words) if (JUNK.has(w)) return { ok: false, reason: `junk:${w}` };
  return words.some((w) => ALLOW.has(w)) ? { ok: true } : { ok: false, reason: "no-allow-hit" };
}
function parseWholesale(sellPrice: unknown): number | null {
  if (typeof sellPrice !== "string") return null;
  const m = sellPrice.match(/[\d.]+/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function usWarehouse(raw: any): boolean | "unknown" {
  try {
    const inv: any[] = raw?.inventory ?? raw?.stockList ?? [];
    if (Array.isArray(inv) && inv.length) {
      const areas = inv.map((i: any) => String(i?.areaName ?? i?.warehouseName ?? i?.warehouse ?? "").toLowerCase());
      if (areas.some((a) => a.includes("us") || a.includes("united states") || a.includes("los angeles") || a.includes("new jersey"))) return true;
      return false;
    }
  } catch { /* fall through */ }
  return "unknown";
}
function priceAndCollection(wholesale: number): { retail: number; collection: Product["collection"] } {
  const retail = wholesale >= 30 ? Math.round(wholesale * 2.5) : Math.max(18, Math.round(wholesale * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return { retail, collection };
}
function toProduct(c: Raw): Product {
  const { retail, collection } = priceAndCollection(c.wholesale);
  return {
    id: `cj-${c.pid}`, name: c.name, cjPid: c.pid, cjSku: c.sku,
    wholesale: r2(c.wholesale), retail, margin: r2(retail - c.wholesale),
    marginPct: r2(((retail - c.wholesale) / retail) * 100),
    collection, image: c.image, sizes: "XS–4X", usWarehouse: c.us, currency: "USD",
  };
}

/* ---- 1. load + clean ---- */
const existing: Product[] = await Bun.file(new URL("../src/data/live-catalog.json", import.meta.url)).json();
const removed: Array<{ id: string; name: string; reason: string }> = [];
const cleaned = existing.filter((p) => {
  if (BANNED[p.cjPid]) { removed.push({ id: p.id, name: p.name.slice(0, 80), reason: BANNED[p.cjPid] }); return false; }
  return true;
});
console.log(`clean: ${existing.length} -> ${cleaned.length} (removed ${removed.length})`);
for (const r of removed) console.log(`  REMOVED ${r.id} | ${r.reason} | ${r.name}`);

const seen = new Map<string, Raw>();
for (const p of cleaned) {
  seen.set(p.cjPid, { pid: p.cjPid, name: p.name, sku: p.cjSku, image: p.image, wholesale: p.wholesale, us: p.usWarehouse });
}

/* ---- 2. luxe backfill queries ---- */
let apiCalls = 0, apiErrors = 0;
for (const [kw, page] of QUERIES) {
  const t0 = Date.now();
  try {
    const json: any = await cjProductList({ pageNum: page, pageSize: PAGE_SIZE, keyWords: kw });
    apiCalls++;
    const list: any[] = json?.data?.list ?? [];
    console.log(`query "${kw}" p${page} -> ${list.length} results ms=${Date.now() - t0}`);
    const rej: Record<string, number> = {};
    for (const c of list) {
      const name: string = c.productNameEn ?? "";
      const pid = String(c.pid ?? "");
      if (!pid || seen.has(pid) || BANNED[pid]) { rej.dup = (rej.dup ?? 0) + 1; continue; }
      const check = isIntimates(name);
      if (!check.ok) { const r = check.reason ?? "?"; rej[r] = (rej[r] ?? 0) + 1; continue; }
      const image = String(c.productImage ?? "");
      if (!image) { rej["no-image"] = (rej["no-image"] ?? 0) + 1; continue; }
      const wholesale = parseWholesale(c.sellPrice);
      if (wholesale === null) { rej["no-price"] = (rej["no-price"] ?? 0) + 1; continue; }
      seen.set(pid, { pid, name, sku: String(c.productSku ?? ""), image, wholesale, us: usWarehouse(c) });
    }
    console.log(`  reject "${kw}": ${JSON.stringify(rej)}`);
  } catch (e) {
    apiErrors++;
    console.log(`query "${kw}" p${page} ERROR: ${e instanceof Error ? e.message : String(e)} (skip)`);
  }
  await sleep(SLEEP_MS);
}

/* ---- 3. merge: cleaned first, new luxe first, cap 115 ---- */
const existingIds = new Set(cleaned.map((p) => p.cjPid));
const fresh: Product[] = [...seen.values()].filter((c) => !existingIds.has(c.pid)).map(toProduct);
const rank = (p: Product) => (p.collection === "luxe" ? 0 : 100) + (p.usWarehouse === true ? 0 : p.usWarehouse === "unknown" ? 1 : 2);
fresh.sort((a, b) => rank(a) - rank(b) || b.margin - a.margin);
console.log(`fresh candidates: ${fresh.length} (luxe: ${fresh.filter((p) => p.collection === "luxe").length})`);
for (const p of fresh.slice(0, 12)) console.log(`  + ${p.id} [${p.collection}] $${p.retail} us=${p.usWarehouse} | ${p.name.slice(0, 80)}`);
const merged = [...cleaned, ...fresh].slice(0, 115);
await Bun.write(OUT, JSON.stringify(merged, null, 1) + "\n");
const stats = {
  count: merged.length,
  removed: removed.map((r) => ({ id: r.id, reason: r.reason })),
  removedCount: removed.length,
  newAdded: merged.length - cleaned.length,
  apiCalls, apiErrors,
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
  source: "clean-and-backfill 2026-09-08: banned-junk removal + luxe queries (satin chemise / silk slip / lace corset)",
};
await Bun.write(STATS_OUT, JSON.stringify(stats, null, 1) + "\n");
console.log("STATS " + JSON.stringify(stats.byCollection) + ` count=${stats.count} luxe=${stats.byCollection.luxe}`);
console.log(`Wrote ${OUT} (${merged.length} products) + stats`);
