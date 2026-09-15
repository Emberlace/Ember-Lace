// scripts/add-largecup-luxe.ts — add ~30 real CJ products to live-catalog.json:
// ~18 large-cup bras (30A-44H+), ~9 luxe, ~3 mid lace/spice.
// Mirrors clean-and-backfill.ts pricing/collection exactly.
// Run: bun scripts/add-largecup-luxe.ts   (CJ_API_KEY from env)
import { cjProductList, cjProductQuery } from "../src/server/cj";
const CATALOG = "src/data/live-catalog.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r2 = (n: number) => Math.round(n * 100) / 100;
function priceAndCollection(wholesale: number) {
  const retail = wholesale >= 30 ? Math.round(wholesale * 2.5) : Math.max(18, Math.round(wholesale * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return { retail, collection };
}
function usWarehouse(raw: any): boolean | "unknown" {
  const codes = raw?.shippingCountryCodes;
  if (!Array.isArray(codes)) return "unknown";
  return codes.some((c: unknown) => typeof c === "string" && /(^|_)US$/.test(c) && c !== "US");
}
function parseWholesale(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
const JUNK = /\b(men|male|boy|kids|child|baby|toddler|dog|cat|pet|swimsuit|swimwear|costume|wig|hat|sock|shoe|bag|watch|jewel|necklace|lamp|phone|mattress|pillow|blanket|towel|sheet|curtain|rug|drone|toy|party|halloween|candle|mug|bottle)\b/i;
const BRA = /\bbra\b/i;
const BRALETTE = /\bbralette\b/i;
const LUXE_W = /\b(silk|satin|chemise|robe|slip|gown|velvet|cashmere|chiffon)\b/i;
const LACE = /\b(lace|lingerie|teddy|bodysuit|garter|set|bustier|corset)\b/i;
const catalog = JSON.parse(await Bun.file(CATALOG).text()) as any[];
const have = new Set(catalog.map((p) => String(p.cjPid)));
const QUERIES = ["bra", "plus size", "push up bra", "underwire", "silk", "satin", "chemise", "corset", "robe", "slip dress"];
type Cand = { pid: string; name: string; sku: string; image: string; wholesale: number; us: boolean | "unknown" };
const seen = new Map<string, Cand>();
for (const kw of QUERIES) {
  try {
    const json: any = await cjProductList({ pageNum: 1, pageSize: 50, keyWords: kw });
    const list: any[] = json?.data?.list ?? [];
    for (const c of list) {
      const name: string = String(c.productNameEn ?? "");
      const pid = String(c.pid ?? "");
      if (!pid || have.has(pid) || seen.has(pid)) continue;
      if (JUNK.test(name)) continue;
      const wholesale = parseWholesale(c.sellPrice);
      if (wholesale === null) continue;
      const image = String(c.productImage ?? "");
      if (!image) continue;
      seen.set(pid, { pid, name, sku: String(c.productSku ?? ""), image, wholesale, us: usWarehouse(c) });
    }
    console.log(`query "${kw}": +${seen.size} candidates`);
  } catch (e) {
    console.log(`query "${kw}" ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
  await sleep(1200);
}
console.log("total candidates:", seen.size);
// Bucket
const braCands: Cand[] = [];
const luxeCands: Cand[] = [];
const laceCands: Cand[] = [];
for (const c of seen.values()) {
  const { retail, collection } = priceAndCollection(c.wholesale);
  if (BRA.test(c.name) && !BRALETTE.test(c.name) && !/\b(sports bra|yoga|vest)\b/i.test(c.name)) braCands.push(c);
  else if (LUXE_W.test(c.name) && collection === "luxe") luxeCands.push(c);
  else if (LACE.test(c.name) && collection === "lace" && !BRA.test(c.name)) laceCands.push(c);
}
const margin = (c: Cand) => { const { retail } = priceAndCollection(c.wholesale); return r2(retail - c.wholesale); };
const rank = (c: Cand) => (c.us === true ? 0 : c.us === "unknown" ? 1 : 2);
const sorter = (a: Cand, b: Cand) => rank(a) - rank(b) || margin(b) - margin(a);
braCands.sort(sorter); luxeCands.sort(sorter); laceCands.sort(sorter);
console.log(`bra:${braCands.length} luxe:${luxeCands.length} lace:${laceCands.length}`);
const pickBra = braCands.slice(0, 18);
const pickLuxe = luxeCands.slice(0, 9);
const pickLace = laceCands.slice(0, 3);
for (const c of [...pickBra, ...pickLuxe, ...pickLace]) console.log(`  TARGET ${priceAndCollection(c.wholesale).collection} ws=${c.wholesale} us=${c.us} | ${c.name.slice(0, 72)}`);
// Fetch variants + write
const added: any[] = [];
let ok = 0, fail = 0;
for (const c of [...pickBra, ...pickLuxe, ...pickLace]) {
  let variants: any[] = [];
  for (let attempt = 1; attempt <= 3 && variants.length === 0; attempt++) {
    try {
      const json: any = await cjProductQuery(c.pid);
      if (json?.code === 200 && Array.isArray(json?.data?.variants)) {
        variants = (json.data.variants as any[])
          .filter((v) => v?.vid)
          .map((v) => {
            const vk = String(v.variantKey ?? "");
            const i = vk.lastIndexOf("-");
            return { size: (i >= 0 ? vk.slice(i + 1) : vk).trim(), variantKey: vk, vid: String(v.vid), variantSku: String(v.variantSku ?? "") };
          });
      } else if (attempt === 3) { fail++; console.log(`  FAIL ${c.pid} code=${json?.code}`); }
    } catch { /* retry */ }
    if (variants.length === 0) await sleep(3000);
  }
  if (variants.length === 0) continue;
  const { retail, collection } = priceAndCollection(c.wholesale);
  added.push({
    id: `cj-${c.pid}`, name: c.name, cjPid: c.pid, cjSku: c.sku,
    wholesale: r2(c.wholesale), retail,
    margin: r2(retail - c.wholesale),
    marginPct: r2(((retail - c.wholesale) / retail) * 100),
    collection, image: c.image,
    sizes: BRA.test(c.name) ? "30A–44H+" : "XS–4X",
    usWarehouse: c.us, currency: "USD", variants,
  });
  ok++;
  console.log(`  + ${c.pid} [${collection}] $${retail} v=${variants.length} | ${c.name.slice(0, 60)}`);
  await sleep(1200);
}
const merged = [...catalog, ...added];
await Bun.write(CATALOG, JSON.stringify(merged, null, 1) + "\n");
const byColl: Record<string, number> = {};
for (const p of merged) byColl[p.collection] = (byColl[p.collection] ?? 0) + 1;
const wss = merged.map((p) => p.wholesale), rts = merged.map((p) => p.retail);
const us = merged.filter((p) => p.usWarehouse === true).length;
const stats = {
  count: merged.length,
  braCount: merged.filter((p) => /\bbra\b/i.test(p.name)).length,
  avgWholesale: r2(wss.reduce((a, b) => a + b, 0) / wss.length),
  avgRetail: r2(rts.reduce((a, b) => a + b, 0) / rts.length),
  avgMargin: r2(rts.reduce((a, b) => a + b, 0) / rts.length - wss.reduce((a, b) => a + b, 0) / wss.length),
  usCount: us,
  unknownWarehouseCount: merged.filter((p) => p.usWarehouse === "unknown").length,
  nonUsCount: merged.filter((p) => p.usWarehouse === false).length,
  byCollection: byColl,
  source: "CJ catalog, +7.5% retail 2026-09-08 (add-largecup-luxe 2026-09-15: +18 large-cup bras +9 luxe +3 lace)",
};
await Bun.write("src/data/live-catalog-stats.json", JSON.stringify(stats, null, 1) + "\n");
console.log(JSON.stringify({ added: added.length, ok, fail, total: merged.length, stats }, null, 1));
