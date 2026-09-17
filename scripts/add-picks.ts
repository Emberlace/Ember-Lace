// scripts/add-picks.ts — appends REAL CJ products from /tmp/fresh-pool.json to the
// live catalog. Pricing = the existing scheme (scripts/add-largecup-luxe.ts:
// wholesale >= 30 → 2.5×, else 2.2×, floor $18) — margins unchanged.
// Honest size strings: derived from each product's ACTUAL variants (cup sizes when
// CJ really ships band+cup, otherwise the real letter run), never an invented range.
//
// Usage:
//   bun scripts/add-picks.ts --picks /tmp/picks.json   # {pids:[...]} hand-picked
//   bun scripts/add-picks.ts --auto                     # rule-based fallback
// Out:  src/data/live-catalog.json + src/data/live-catalog-stats.json + /tmp/add-report.md
import { cjProductQuery } from "../src/server/cj";

const CATALOG = "src/data/live-catalog.json";
const STATS = "src/data/live-catalog-stats.json";
const POOL = "/tmp/fresh-pool.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r2 = (n: number) => Math.round(n * 100) / 100;
const args = process.argv.slice(2);
const picksIdx = args.indexOf("--picks");
const picksFile = picksIdx >= 0 ? args[picksIdx + 1] : null;

function priceAndCollection(ws: number) {
  const retail = ws >= 30 ? Math.round(ws * 2.5) : Math.max(18, Math.round(ws * 2.2));
  const collection = retail < 30 ? "everyday" : retail <= 70 ? "lace" : "luxe";
  return { retail, collection };
}
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const BRA_WORD = new Set(["bra", "bras", "bralette", "bralettes", "brassiere", "bustier", "bustiers"]);
const NON_BRA = new Set(["dress", "dresses", "gown", "gowns", "top", "tops", "tank", "shirt", "shirts", "blouse", "skirt", "skirts", "pants", "leggings", "jumpsuit", "romper", "robe", "robes", "set", "coat", "coats"]);
const isBra = (n: string) => {
  const w = wordsOf(n);
  return w.some((x) => BRA_WORD.has(x)) && !w.some((x) => NON_BRA.has(x));
};
const LUXE_W = /\b(silk|satin|chemise|robe|slip|gown|velvet|chiffon|peignoir|nightgown|nightdress|babydoll|corset|bustier|bridal)\b/i;
const CUP = /^(\d{2})\s*([A-H]{1,3})\+?$/i;
const LETTERS = ["XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "5XL", "6XL"];
const CUP_ORDER = ["A", "B", "C", "D", "DD", "DDD", "E", "F", "G", "H"];

type Pool = { rows: Array<{ pid: string; name: string; wholesale: number; us: boolean | "unknown"; sku: string; image: string; kind: string; retail: number; collection: string }> };
const pool: Pool = await Bun.file(POOL).json();
const catalog = JSON.parse(await Bun.file(CATALOG).text()) as any[];
const havePid = new Set(catalog.map((p) => String(p.cjPid)));

let chosen: Pool["rows"];
if (picksFile) {
  const picks = JSON.parse(await Bun.file(picksFile).text()) as { pids: string[] };
  const byPid = new Map(pool.rows.map((r) => [r.pid, r]));
  chosen = picks.pids.map((pid) => byPid.get(String(pid))).filter((r): r is Pool["rows"][number] => Boolean(r));
  const missing = picks.pids.filter((pid) => !byPid.has(String(pid)));
  if (missing.length) console.log(`WARN not in pool: ${missing.join(", ")}`);
} else {
  const us = pool.rows.filter((r) => r.us === true && !havePid.has(r.pid));
  const bras = us.filter((r) => isBra(r.name)).slice(0, 8);
  const luxe = us.filter((r) => !isBra(r.name) && LUXE_W.test(r.name) && r.retail >= 90).slice(0, 6);
  const lace = us.filter((r) => !isBra(r.name) && !luxe.includes(r) && LUXE_W.test(r.name)).slice(0, 4);
  const rest = us.filter((r) => !bras.includes(r) && !luxe.includes(r) && !lace.includes(r)).slice(0, 4);
  chosen = [...bras, ...luxe, ...lace, ...rest];
}
console.log(`probing variants for ${chosen.length} candidates…`);

const added: any[] = [];
const report: string[] = [];
for (const c of chosen) {
  if (havePid.has(c.pid)) { report.push(`SKIP dup ${c.name}`); continue; }
  let variants: Array<{ size: string; variantKey: string; vid: string; variantSku: string }> = [];
  for (let attempt = 1; attempt <= 3 && variants.length === 0; attempt++) {
    try {
      const json: any = await cjProductQuery(c.pid);
      if (json?.code === 200 && Array.isArray(json?.data?.variants)) {
        variants = (json.data.variants as any[])
          .filter((v) => v?.vid)
          .map((v) => {
            const vk = String(v.variantKey ?? "");
            const i = vk.lastIndexOf("-");
            return {
              size: (i >= 0 ? vk.slice(i + 1) : vk).trim(),
              variantKey: vk,
              vid: String(v.vid),
              variantSku: String(v.variantSku ?? ""),
            };
          });
      }
    } catch { /* retry */ }
    if (variants.length === 0) await sleep(2500);
  }
  if (variants.length === 0) { report.push(`DROP no-variants ${c.pid} ${c.name}`); await sleep(700); continue; }
  const allVids = variants.every((v) => v.vid && /^\d+$/.test(v.vid));
  if (!allVids) { report.push(`DROP bad-vid ${c.pid} ${c.name}`); await sleep(700); continue; }
  const uniq = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const cups = uniq
    .map((s) => { const m = s.match(CUP); return m ? { band: parseInt(m[1], 10), cup: m[2].toUpperCase() } : null; })
    .filter((x): x is { band: number; cup: string } => Boolean(x));
  const letters = uniq.filter((s) => LETTERS.includes(s.toUpperCase()));
  let sizesString: string;
  let largeCup = false;
  if (cups.length >= 2) {
    const bands = cups.map((x) => x.band);
    const sorted = cups.slice().sort((a, b) => CUP_ORDER.indexOf(a.cup) - CUP_ORDER.indexOf(b.cup));
    sizesString = `${Math.min(...bands)}${sorted[0].cup}–${Math.max(...bands)}${sorted[sorted.length - 1].cup}`;
    const deep = sorted[sorted.length - 1].cup;
    largeCup = Math.max(...bands) >= 42 && CUP_ORDER.indexOf(deep) >= CUP_ORDER.indexOf("DD");
  } else if (letters.length >= 2) {
    const sorted = letters.slice().sort((a, b) => LETTERS.indexOf(a.toUpperCase()) - LETTERS.indexOf(b.toUpperCase()));
    sizesString = `${sorted[0]}–${sorted[sorted.length - 1]}`;
  } else if (cups.length === 1) {
    sizesString = `${cups[0].band}${cups[0].cup}`;
  } else if (letters.length === 1) {
    sizesString = letters[0];
  } else {
    // Variants carry no size/letter token (colour-only variant keys) — we cannot
    // state a size range honestly, so don't ship it.
    report.push(`DROP no-size-info v=${variants.length} sizes=${uniq.slice(0, 6).join("/")} | ${c.name}`);
    await sleep(600);
    continue;
  }
  const { retail, collection } = priceAndCollection(c.wholesale);
  const entry = {
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
    sizes: sizesString,
    usWarehouse: c.us,
    currency: "USD",
    variants,
  };
  added.push(entry);
  report.push(`ADD [${collection}] ws=$${entry.wholesale} retail=$${retail} sizes=${sizesString}${largeCup ? " LARGECUP" : ""} v=${variants.length} ${c.us === true ? "US" : String(c.us)} | ${c.name}`);
  await sleep(800);
}
const merged = [...catalog, ...added];
await Bun.write(CATALOG, JSON.stringify(merged, null, 1) + "\n");
const byColl: Record<string, number> = {};
for (const p of merged) byColl[p.collection] = (byColl[p.collection] ?? 0) + 1;
const wss = merged.map((p) => p.wholesale);
const rts = merged.map((p) => p.retail);
const stats = {
  count: merged.length,
  braCount: merged.filter((p) => /\bbra\b/i.test(p.name)).length,
  avgWholesale: r2(wss.reduce((a, b) => a + b, 0) / wss.length),
  avgRetail: r2(rts.reduce((a, b) => a + b, 0) / rts.length),
  avgMargin: r2(rts.reduce((a, b) => a + b, 0) / rts.length - wss.reduce((a, b) => a + b, 0) / wss.length),
  usCount: merged.filter((p) => p.usWarehouse === true).length,
  unknownWarehouseCount: merged.filter((p) => p.usWarehouse === "unknown").length,
  nonUsCount: merged.filter((p) => p.usWarehouse === false).length,
  byCollection: byColl,
  source: `CJ catalog, markup unchanged (2.2×/2.5× as of 2026-09-15) — added ${added.length} real CJ products 2026-09-16 (large-cup bras + luxe + lace depth)`,
};
await Bun.write(STATS, JSON.stringify(stats, null, 1) + "\n");
await Bun.write("/tmp/add-report.md", `# add-picks report 2026-09-16\n\nadded: ${added.length} → total ${merged.length}\nby collection: ${JSON.stringify(byColl)}\n\n${report.join("\n")}\n`);
console.log(`added ${added.length} → total ${merged.length}`);
console.log(report.join("\n"));
console.log(JSON.stringify(stats, null, 1));
