// scripts/discover-expansion.ts — READ-ONLY discovery pass (does NOT touch the catalog).
// Sweeps CJ for fresh women's lingerie/intimates/sleepwear candidates, vets each
// candidate's FULL name against an ALLOW whitelist + JUNK blacklist (same vetting
// style as sweep-bras-backfill.ts), fetches variants for the top-ranked pool and
// reports what it found — including whether each bra's REAL variants cover the
// large-cup range (band+cup sizes such as 38DD / 44H), not just S–XL.
//
// Run:  bun scripts/discover-expansion.ts        (CJ_API_KEY from env)
// Out:  /tmp/expansion-candidates.json  (+ human table on stdout)
import { cjProductList, cjProductQuery } from "../src/server/cj";

const CATALOG = "src/data/live-catalog.json";
const OUT = "/tmp/expansion-candidates.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---- pricing: IDENTICAL to scripts/add-largecup-luxe.ts (the 238a928 scheme) ----
function priceAndCollection(wholesale: number) {
  const retail =
    wholesale >= 30 ? Math.round(wholesale * 2.5) : Math.max(18, Math.round(wholesale * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return { retail, collection };
}

// ---- name vetting ----
const ALLOW = new Set([
  "bra", "bras", "bralette", "bralettes", "bustier", "bustiers",
  "brief", "briefs", "panty", "panties", "pantie", "underpants", "knickers",
  "lace", "silk", "satin", "teddy", "teddies", "chemise", "chemises", "robe", "robes",
  "thong", "thongs", "gstring", "g-string", "bodysuit", "bodysuits",
  "camisole", "cami", "camisoles", "underwear", "lingerie", "corset", "corsets",
  "garter", "garters", "nightgown", "nightgowns", "nightdress", "nightie", "nighties",
  "negligee", "babydoll", "babydolls", "sleepwear", "sleep", "loungewear",
  "pajama", "pajamas", "pyjama", "pyjamas", "hipster", "boyshort", "boyshorts",
  "velvet", "bridal", "stocking", "stockings", "hosiery", "mesh", "slip", "slips",
  "peignoir", "dressing", "gown", "gowns", "intimates",
]);
const JUNK = new Set([
  "men", "mens", "men's", "male", "boy", "boys", "kid", "kids", "child", "children",
  "baby", "babies", "toddler", "lamp", "lamps", "lighting", "furniture", "sofa",
  "couch", "chair", "chairs", "table", "desk", "phone", "phones", "charger", "cable",
  "laptop", "tablet", "earphone", "headphone", "earbuds", "speaker",
  "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals",
  "bag", "bags", "handbag", "backpack", "wallet", "watch", "watches",
  "necklace", "necklaces", "earring", "earrings", "bracelet", "bracelets",
  "jewelry", "jewellery", "toy", "toys", "doll", "dolls", "led",
  "kitchen", "knife", "knives", "cook", "cooker", "car", "cars", "vehicle",
  "motor", "moto", "yoke", "transmission", "auto", "automotive", "tire", "tires",
  "pet", "pets", "dog", "dogs", "cat", "cats", "plant", "plants", "garden",
  "tent", "bike", "bicycle", "mower", "drill", "hammer", "wrench", "paint",
  "curtain", "curtains", "rug", "rugs", "carpet", "mattress", "pillow", "pillows",
  "blanket", "blankets", "towel", "towels", "quilt", "bedding", "sheet", "sheets",
  "comforter", "duvet", "umbrella", "jacket", "jackets", "coat", "coats",
  "sweater", "sweaters", "hoodie", "hoodies", "jeans", "tshirt", "tshirts",
  "t-shirt", "tuxedo", "tuxedos", "suit", "suits", "uniform", "uniforms",
  "costume", "costumes", "wig", "wigs", "hat", "hats", "cap", "caps",
  "glove", "gloves", "scarf", "scarves", "sock", "socks",
  "mug", "bottle", "lunch", "school", "office", "mouse", "keyboard",
  "drone", "camera", "projector", "microphone", "tripod", "humidifier",
  "fan", "heater", "vacuum", "kettle", "fryer", "blender", "mixer", "oven",
  "fridge", "freezer", "washer", "dryer", "candle", "candles", "clock",
  "mirror", "vase", "book", "books", "pen", "pencil", "notebook", "sticker",
  "balloon", "party", "christmas", "halloween", "helmet", "skateboard",
  "fishing", "camping", "hiking", "golf", "tennis", "soccer", "basketball",
  "football", "yoga", "dumbbell", "treadmill", "swimsuit", "swimwear", "swim",
  "bathing", "nursing", "pregnan", "pregnancy", "maternity", "postpartum",
  "shaper", "waist", "trainer", "slimming", "sports", "sport", "vest", "vests",
]);
const BRA_WORD = new Set(["bra", "bras", "bralette", "bralettes", "bustier", "bustiers"]);
const NON_BRA = new Set([
  "dress", "dresses", "gown", "gowns", "top", "tops", "tank", "shirt", "shirts",
  "blouse", "skirt", "skirts", "pants", "leggings", "jumpsuit", "romper", "robe",
  "robes", "set",
]);
const LUXE_W = /\b(silk|satin|chemise|robe|slip|gown|velvet|chiffon|peignoir|nightgown|nightdress|babydoll|corset|bustier|bridal)\b/i;
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
function vet(name: string): { ok: boolean; reason?: string } {
  const words = wordsOf(name);
  if (words.length === 0) return { ok: false, reason: "empty" };
  for (const w of words) if (JUNK.has(w)) return { ok: false, reason: `junk:${w}` };
  if (!words.some((w) => ALLOW.has(w))) return { ok: false, reason: "no-allow-hit" };
  return { ok: true };
}
function usWarehouse(raw: any): boolean | "unknown" {
  const codes = raw?.shippingCountryCodes;
  if (!Array.isArray(codes)) return "unknown";
  return codes.some((c: unknown) => typeof c === "string" && /(^|_)US$/.test(c) && c !== "US");
}
function parseWholesale(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v.match(/[\d.]+/)?.[0] ?? "") : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();

// ---- sweep ----
const QUERIES: Array<[string, number]> = [
  ["large cup bra", 1], ["large cup bra", 2],
  ["minimizer bra", 1], ["full coverage bra", 1], ["underwire bra", 1],
  ["plus size bra", 1], ["plus size lingerie", 1], ["lace bra", 1],
  ["cotton bra", 1], ["bra set", 1], ["sexy bra", 1],
  ["satin robe", 1], ["silk robe", 1], ["satin pajama", 1], ["kimono", 1],
  ["nightgown", 1], ["nightdress", 1], ["babydoll", 1], ["chemise", 1],
  ["satin slip", 1], ["bridal lingerie", 1], ["corset", 1], ["bustier", 1],
  ["garter belt", 1], ["lace bodysuit", 1], ["teddy lingerie", 1],
  ["camisole", 1], ["plus size underwear", 1], ["satin gown", 1],
];
const catalog = JSON.parse(await Bun.file(CATALOG).text()) as any[];
const havePid = new Set(catalog.map((p) => String(p.cjPid)));
const haveName = new Set(catalog.map((p) => norm(String(p.name))));
type Cand = { pid: string; name: string; sku: string; image: string; wholesale: number; us: boolean | "unknown"; cat: string };
const seen = new Map<string, Cand>();
const dropped: Array<{ name: string; reason: string }> = [];
for (const [kw, page] of QUERIES) {
  try {
    const json: any = await cjProductList({ pageNum: page, pageSize: 50, keyWords: kw });
    const list: any[] = json?.data?.list ?? [];
    for (const c of list) {
      const name = String(c.productNameEn ?? "");
      const pid = String(c.pid ?? "");
      if (!pid || havePid.has(pid) || seen.has(pid)) continue;
      const v = vet(name);
      if (!v.ok) { dropped.push({ name, reason: v.reason! }); continue; }
      if (haveName.has(norm(name))) { dropped.push({ name, reason: "dup-name" }); continue; }
      const wholesale = parseWholesale(c.sellPrice);
      if (wholesale === null) { dropped.push({ name, reason: "no-price" }); continue; }
      const image = String(c.productImage ?? "");
      if (!image) continue;
      seen.set(pid, {
        pid, name, sku: String(c.productSku ?? ""), image, wholesale,
        us: usWarehouse(c), cat: String(c.categoryName ?? ""),
      });
    }
  } catch (e) {
    console.log(`query "${kw}" p${page} ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
  await sleep(900);
}
console.log(`sweep: ${seen.size} vetted candidates (dropped ${dropped.length})`);

// ---- bucket ----
const isBra = (n: string) => wordsOf(n).some((w) => BRA_WORD.has(w)) && !wordsOf(n).some((w) => NON_BRA.has(w));
const bras: Cand[] = [], luxes: Cand[] = [], laces: Cand[] = [], other: Cand[] = [];
for (const c of seen.values()) {
  const { collection } = priceAndCollection(c.wholesale);
  if (isBra(c.name)) bras.push(c);
  else if (LUXE_W.test(c.name) && (collection === "luxe" || collection === "lace")) luxes.push(c);
  else if (collection === "lace" || collection === "luxe") laces.push(c);
  else other.push(c);
}
const rank = (c: Cand) => (c.us === true ? 0 : c.us === "unknown" ? 1 : 2);
const { retail } = { retail: 0 };
void retail;
const marginOf = (c: Cand) => priceAndCollection(c.wholesale).retail - c.wholesale;
const sorter = (a: Cand, b: Cand) => rank(a) - rank(b) || marginOf(b) - marginOf(a);
for (const arr of [bras, luxes, laces, other]) arr.sort(sorter);
console.log(`buckets  bra:${bras.length} luxeFab:${luxes.length} lace:${laces.length} other:${other.length}`);
console.log(`  bra names: ${bras.map((c) => c.name.slice(0, 46)).join(" | ")}`);

// ---- variants for the pool ----
const pool = [
  ...bras.slice(0, 26),
  ...luxes.slice(0, 18),
  ...laces.slice(0, 8),
];
const CUP = /^(2[6-9]|3\d|4\d|4[0-9]|5\d)\s*([A-H]{1,3})\+?$/i;
const LETTER = /^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|4XL|6XL)$/i;
type Detail = Cand & {
  retail: number; collection: string; nvar: number; sizes: string[]; variantOk: boolean;
  bandRange: string | null; maxCup: string | null; largeCup: boolean;
  sizesString: string; dupSizes: boolean;
};
const details: Detail[] = [];
for (const c of pool) {
  let variants: Array<{ size: string }> = [];
  for (let attempt = 1; attempt <= 3 && variants.length === 0; attempt++) {
    try {
      const json: any = await cjProductQuery(c.pid);
      if (json?.code === 200 && Array.isArray(json?.data?.variants)) {
        variants = (json.data.variants as any[])
          .filter((v) => v?.vid)
          .map((v) => {
            const vk = String(v.variantKey ?? "");
            const i = vk.lastIndexOf("-");
            return { size: (i >= 0 ? vk.slice(i + 1) : vk).trim() };
          });
        if (variants.length === 0) break;
      }
    } catch { /* retry */ }
    if (variants.length === 0) await sleep(2500);
  }
  const { retail, collection } = priceAndCollection(c.wholesale);
  const uniq = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const cups: Array<{ band: number; cup: string }> = [];
  for (const s of uniq) {
    const m = s.match(CUP);
    if (m) cups.push({ band: parseInt(m[1], 10), cup: m[2].toUpperCase() });
  }
  const letters = uniq.filter((s) => LETTER.test(s));
  let bandRange: string | null = null;
  let maxCup: string | null = null;
  let largeCup = false;
  if (cups.length > 0) {
    const bands = cups.map((x) => x.band);
    const cupOrder = ["A", "B", "C", "D", "DD", "DDD", "E", "F", "G", "H"];
    const deepest = cups.slice().sort((a, b) => cupOrder.indexOf(b.cup) - cupOrder.indexOf(a.cup))[0];
    bandRange = `${Math.min(...bands)}–${Math.max(...bands)}`;
    maxCup = deepest.cup;
    largeCup = Math.max(...bands) >= 44 && cupOrder.indexOf(deepest.cup) >= cupOrder.indexOf("DD");
  }
  const alphaOrder = ["XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "5XL", "6XL"];
  const sortedLetters = letters.slice().sort((a, b) => alphaOrder.indexOf(a.toUpperCase()) - alphaOrder.indexOf(b.toUpperCase()));
  let sizesString = "XS–4X";
  if (cups.length > 0) {
    const bands = cups.map((x) => x.band);
    const cupOrder = ["A", "B", "C", "D", "DD", "DDD", "E", "F", "G", "H"];
    const deepest = cups.slice().sort((a, b) => cupOrder.indexOf(b.cup) - cupOrder.indexOf(a.cup))[0];
    sizesString = `${Math.min(...bands)}${cups.slice().sort((a, b) => cupOrder.indexOf(a.cup) - cupOrder.indexOf(b.cup))[0].cup}–${Math.max(...bands)}${deepest.cup}`;
  } else if (sortedLetters.length > 1) {
    sizesString = `${sortedLetters[0]}–${sortedLetters[sortedLetters.length - 1]}`;
  } else if (sortedLetters.length === 1) {
    sizesString = sortedLetters[0];
  }
  details.push({
    ...c, retail, collection, nvar: variants.length, sizes: uniq, variantOk: variants.length > 0,
    bandRange, maxCup, largeCup, sizesString, dupSizes: uniq.length !== variants.length,
  });
  await sleep(800);
}
const KIND = (c: Detail) => (isBra(c.name) ? "BRA" : LUXE_W.test(c.name) ? "LUXEFAB" : "LACE");
for (const d of details) {
  console.log(
    `${KIND(d).padEnd(8)} ${d.collection.padEnd(9)} ws=${String(d.wholesale).padStart(6)} retail=$${String(d.retail).padStart(4)} us=${String(d.us).padEnd(7)} v=${String(d.nvar).padStart(3)} ${d.largeCup ? "LARGECUP" : "        "} sizes=${d.sizesString.padEnd(12)} | ${d.name.slice(0, 66)}`,
  );
}
const kept = details.filter((d) => d.variantOk);
await Bun.write(OUT, JSON.stringify({ generated: new Date().toISOString(), details: kept }, null, 1));
console.log(`\nwrote ${OUT}: ${kept.length} candidates with variants (of ${pool.length} probed)`);
console.log(`dropped-by-vetting sample: ${dropped.slice(0, 25).map((d) => `${d.reason}:${d.name.slice(0, 34)}`).join(" | ")}`);
