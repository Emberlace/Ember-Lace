// scripts/sweep-fresh.ts — READ-ONLY keyword sweep (no catalog writes, no variant
// probes). CJ's /product/list only honours `productName` (categoryId and keyWords
// are silently ignored — verified 2026-09-16 via scripts/discover-category.ts),
// so discovery = many tight productName queries + strict name vetting.
// Run: bun scripts/sweep-fresh.ts   → /tmp/fresh-pool.json + stdout table
import { cjProductList } from "../src/server/cj";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALLOW = new Set([
  "bra", "bras", "bralette", "bralettes", "brassiere", "bustier", "bustiers",
  "brief", "briefs", "panty", "panties", "pantie", "underpants", "knickers",
  "lace", "silk", "satin", "teddy", "teddies", "chemise", "chemises", "robe", "robes",
  "thong", "thongs", "gstring", "g-string", "bodysuit", "bodysuits",
  "camisole", "cami", "camisoles", "underwear", "lingerie", "corset", "corsets",
  "garter", "garters", "nightgown", "nightgowns", "nightdress", "nightie", "nighties",
  "negligee", "babydoll", "babydolls", "sleepwear", "loungewear",
  "pajama", "pajamas", "pyjama", "pyjamas", "sleepdress", "peignoir",
  "velvet", "bridal", "stocking", "stockings", "hosiery", "mesh", "slip", "slips",
  "gown", "gowns", "intimates", "dressing",
]);
const JUNK = new Set([
  "men", "mens", "men's", "male", "boy", "boys", "kid", "kids", "child", "children",
  "baby", "babies", "toddler", "girls", "girl", "pet", "pets", "dog", "dogs", "cat", "cats",
  "lamp", "lamps", "lighting", "furniture", "sofa", "couch", "chair", "chairs",
  "table", "desk", "phone", "phones", "charger", "cable", "laptop", "tablet",
  "earphone", "headphone", "earbuds", "speaker", "shoe", "shoes", "sneaker",
  "sneakers", "boot", "boots", "sandal", "sandals", "bag", "bags", "handbag",
  "backpack", "wallet", "watch", "watches", "necklace", "necklaces", "earring",
  "earrings", "bracelet", "bracelets", "jewelry", "jewellery", "toy", "toys",
  "doll", "dolls", "led", "kitchen", "knife", "knives", "cook", "cooker", "car",
  "cars", "vehicle", "motor", "motorcycle", "moto", "yoke", "transmission",
  "brake", "auto", "automotive", "tire", "tires", "plant", "plants", "garden",
  "tent", "bike", "bicycle", "mower", "drill", "hammer", "wrench", "paint",
  "curtain", "curtains", "rug", "rugs", "carpet", "mattress", "pillow", "pillows",
  "blanket", "blankets", "towel", "towels", "quilt", "bedding", "sheet", "sheets",
  "comforter", "duvet", "umbrella", "jacket", "jackets", "coat", "coats",
  "sweater", "sweaters", "hoodie", "hoodies", "jeans", "tshirt", "tshirts",
  "t-shirt", "tuxedo", "tuxedos", "suit", "suits", "uniform", "uniforms",
  "costume", "costumes", "wig", "wigs", "hat", "hats", "cap", "caps", "glove",
  "gloves", "scarf", "scarves", "sock", "socks", "mug", "bottle", "lunch",
  "school", "office", "mouse", "keyboard", "drone", "camera", "projector",
  "microphone", "tripod", "humidifier", "fan", "heater", "vacuum", "kettle",
  "fryer", "blender", "mixer", "oven", "fridge", "freezer", "washer", "dryer",
  "candle", "candles", "clock", "mirror", "vase", "book", "books", "pen",
  "pencil", "notebook", "sticker", "balloon", "party", "christmas", "halloween",
  "helmet", "skateboard", "fishing", "camping", "hiking", "golf", "tennis",
  "soccer", "basketball", "football", "yoga", "dumbbell", "treadmill",
  "swimsuit", "swimwear", "swim", "bathing", "nursing", "pregnan", "pregnancy",
  "maternity", "postpartum", "shaper", "slimming", "sports", "sport", "vest",
  "vests", "storage", "braid", "braids",
]);
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
function vet(name: string) {
  const w = wordsOf(name);
  if (w.length === 0) return { ok: false, reason: "empty" };
  for (const x of w) if (JUNK.has(x)) return { ok: false, reason: `junk:${x}` };
  if (!w.some((x) => ALLOW.has(x))) return { ok: false, reason: "no-allow-hit" };
  return { ok: true };
}
const BRA_WORD = new Set(["bra", "bras", "bralette", "bralettes", "brassiere", "bustier", "bustiers"]);
const NON_BRA = new Set(["dress", "dresses", "gown", "gowns", "top", "tops", "tank", "shirt", "shirts", "blouse", "skirt", "skirts", "pants", "leggings", "jumpsuit", "romper", "robe", "robes", "set", "coat", "coats"]);
const isBra = (n: string) => {
  const w = wordsOf(n);
  return w.some((x) => BRA_WORD.has(x)) && !w.some((x) => NON_BRA.has(x));
};
const LUXE_W = /\b(silk|satin|chemise|robe|slip|gown|velvet|chiffon|peignoir|nightgown|nightdress|babydoll|corset|bustier|bridal)\b/i;

const QUERIES: Array<[string, number]> = [
  ["brassiere", 1], ["women bra", 1], ["bra underwear", 1], ["underwire bra", 2],
  ["minimizer", 1], ["full cup", 1], ["large cup", 1], ["push up bra", 2],
  ["seamless bra", 1], ["lace bra", 2], ["plus size bra", 2], ["bra set", 2],
  ["lingerie set", 1], ["sexy lingerie", 1], ["lace lingerie", 1],
  ["satin pajama", 2], ["silk pajama", 1], ["dressing gown", 1], ["peignoir", 1],
  ["nightgown", 2], ["nightdress", 2], ["chemise", 2], ["babydoll", 2],
  ["corset", 2], ["bustier", 2], ["garter belt", 1], ["stockings", 1],
  ["bodysuit lingerie", 1], ["camisole", 2], ["satin slip", 2], ["silk slip", 1],
  ["women underwear", 1], ["lace panties", 1], ["plus size lingerie", 2],
  ["satin robe", 2], ["kimono robe", 1], ["bridal lingerie", 1],
  ["teddy", 1], ["valentine lingerie", 1], ["evening gown satin", 1],
];
const catalog = JSON.parse(await Bun.file("src/data/live-catalog.json").text()) as any[];
const havePid = new Set(catalog.map((p) => String(p.cjPid)));
const haveName = new Set(catalog.map((p) => wordsOf(String(p.name)).join(" ")));
type Row = { pid: string; name: string; wholesale: number; us: boolean | "unknown"; sku: string; image: string; kind: string; retail: number; collection: string; q: string };
const rows = new Map<string, Row>();
const dropped: string[] = [];
for (const [kw, page] of QUERIES) {
  try {
    const json: any = await cjProductList({ pageNum: page, pageSize: 50, keyWords: kw });
    const list: any[] = json?.data?.list ?? [];
    for (const p of list) {
      const pid = String(p.pid ?? "");
      const name = String(p.productNameEn ?? "");
      if (!pid || havePid.has(pid) || rows.has(pid)) continue;
      const v = vet(name);
      if (!v.ok) { if (dropped.length < 400) dropped.push(`${v.reason} :: ${name}`); continue; }
      if (haveName.has(wordsOf(name).join(" "))) continue;
      const ws = parseFloat(String(p.sellPrice ?? "").match(/[\d.]+/)?.[0] ?? "");
      if (!Number.isFinite(ws) || ws <= 0) continue;
      const image = String(p.productImage ?? "");
      if (!image) continue;
      const codes = p.shippingCountryCodes;
      const us = Array.isArray(codes)
        ? codes.some((x: unknown) => typeof x === "string" && /(^|_)US$/.test(x) && x !== "US")
        : "unknown";
      const retail = ws >= 30 ? Math.round(ws * 2.5) : Math.max(18, Math.round(ws * 2.2));
      const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
      const kind = isBra(name) ? "BRA" : LUXE_W.test(name) ? "LUXEFAB" : "OTHER";
      rows.set(pid, { pid, name, wholesale: ws, us, sku: String(p.productSku ?? ""), image, kind, retail, collection, q: kw });
    }
  } catch (e) {
    console.log(`"${kw}" p${page} ERR ${e instanceof Error ? e.message : e}`);
  }
  await sleep(700);
}
const all = [...rows.values()];
const rank = (r: Row) => (r.us === true ? 0 : r.us === "unknown" ? 1 : 2);
const byKind: Record<string, Row[]> = { BRA: [], LUXEFAB: [], OTHER: [] };
for (const r of all) byKind[r.kind].push(r);
for (const k of Object.keys(byKind)) byKind[k].sort((a, b) => rank(a) - rank(b) || b.wholesale - a.wholesale);
await Bun.write("/tmp/fresh-pool.json", JSON.stringify({ counts: { all: all.length, BRA: byKind.BRA.length, LUXEFAB: byKind.LUXEFAB.length, OTHER: byKind.OTHER.length }, dropped: dropped.slice(0, 200), rows: all }, null, 1));
console.log(`fresh vetted: ${all.length}  BRA ${byKind.BRA.length}  LUXEFAB ${byKind.LUXEFAB.length}  OTHER ${byKind.OTHER.length}`);
for (const k of ["BRA", "LUXEFAB"]) {
  console.log(`--- ${k} ---`);
  for (const r of byKind[k]) console.log(`  ws=${String(r.wholesale).padStart(6)} $${String(r.retail).padStart(4)} ${r.collection.padEnd(8)} us=${String(r.us).padEnd(7)} | ${r.name.slice(0, 78)}`);
}
console.log(`--- OTHER (top 40 of ${byKind.OTHER.length}) ---`);
for (const r of byKind.OTHER.slice(0, 40)) console.log(`  ws=${String(r.wholesale).padStart(6)} $${String(r.retail).padStart(4)} ${r.collection.padEnd(8)} us=${String(r.us).padEnd(7)} | ${r.name.slice(0, 74)}`);
