// scripts/discover-category.ts — READ-ONLY: sweeps CJ by CATEGORY (not keyword),
// which is how we surface fresh on-assortment bras/lingerie that keyword sweeps miss.
// Prints the relevant category tree, then lists vetted fresh candidates per category.
// Run: bun scripts/discover-category.ts    (CJ_API_KEY from env)
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const { getCjAccessToken } = await import("../src/server/cj");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const token = await getCjAccessToken();
async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

const cat: any = await get("/product/getCategory");
const tree: any[] = cat?.data ?? [];
// CJ returns a 3-level tree: categoryFirstList -> categorySecondList -> leaf
// ({categoryId, categoryName}). Leaf ids are what /product/list?categoryId wants.
function walk(node: any, depth: number, acc: Array<{ id: string; name: string; depth: number }>) {
  if (node?.categoryId && node?.categoryName) acc.push({ id: String(node.categoryId), name: String(node.categoryName), depth });
  for (const key of ["categoryFirstList", "categorySecondList", "categoryThirdList", "children"]) {
    const kids = node?.[key];
    if (Array.isArray(kids)) for (const k of kids) walk(k, depth + 1, acc);
  }
}
const flat: Array<{ id: string; name: string; depth: number }> = [];
for (const n of tree) walk(n, 0, flat);
console.log(`category nodes: ${flat.length}`);
const INTEREST = /(bra|lingerie|underwear|intimat|sleep|pajama|night|brief|panty|panties|corset|bustier|loungewear|robe|shapewear)/i;
const interesting = flat.filter((c) => INTEREST.test(c.name));
for (const c of interesting) console.log(`  cat ${c.id.padEnd(12)} d${c.depth} ${c.name}`);

const catalog = JSON.parse(await Bun.file("src/data/live-catalog.json").text()) as any[];
const havePid = new Set(catalog.map((p) => String(p.cjPid)));
const JUNK = /(men'?s|\bmale\b|\bboy\b|\bkid|\bchild|\bbaby|toddler|\brug\b|yoke|transmission|tuxedo|car |auto |lamp|furniture|\bchair|towel|blanket|pillow|mattress|curtain|\bdog\b|\bcat\b|pet |toy |school|party|candle|\bmug\b|bottle|necklace|earring|bracelet|watch |sock|shoe|boot|hat |cap |glove|scarf|sweater|hoodie|jeans|shirt|\btop\b|jacket|coat|swimsuit|swimwear|costume|\bwig\b|nursing|maternity|pregnan|shaper|waist trainer|slimming|sports bra|yoga|vest)/i;
const ALLOW = /(bra|bralette|bustier|corset|lingerie|underwear|panty|panties|brief|thong|teddy|chemise|babydoll|slip|robe|nightgown|nightdress|nightwear|sleepwear|pajama|pyjama|camisole|bodysuit|garter|stocking|hosiery|intimate)/i;

type Row = { pid: string; name: string; wholesale: number; us: boolean | "unknown"; cat: string; sku: string; image: string };
const rows = new Map<string, Row>();
for (const c of interesting) {
  for (const page of [1, 2, 3]) {
    let json: any = null;
    try {
      json = await get(
        `/product/list?pageNum=${page}&pageSize=100&categoryId=${encodeURIComponent(c.id)}`,
      );
    } catch (e) {
      console.log(`  ${c.name} p${page} ERR ${e instanceof Error ? e.message : e}`);
      break;
    }
    const list: any[] = json?.data?.list ?? [];
    if (list.length === 0) break;
    for (const p of list) {
      const pid = String(p.pid ?? "");
      const name = String(p.productNameEn ?? "");
      if (!pid || havePid.has(pid) || rows.has(pid)) continue;
      if (JUNK.test(name) || !ALLOW.test(name)) continue;
      const ws = parseFloat(String(p.sellPrice ?? "").match(/[\d.]+/)?.[0] ?? "");
      if (!Number.isFinite(ws) || ws <= 0) continue;
      const codes = p.shippingCountryCodes;
      const us = Array.isArray(codes)
        ? codes.some((x: unknown) => typeof x === "string" && /(^|_)US$/.test(x) && x !== "US")
        : "unknown";
      rows.set(pid, { pid, name, wholesale: ws, us, cat: c.name, sku: String(p.productSku ?? ""), image: String(p.productImage ?? "") });
    }
    await sleep(600);
  }
  console.log(`after ${c.name}: ${rows.size} fresh vetted candidates`);
}
const out = [...rows.values()].sort((a, b) => (a.us === true ? 0 : a.us === "unknown" ? 1 : 2) - (b.us === true ? 0 : b.us === "unknown" ? 1 : 2) || b.wholesale - a.wholesale);
await Bun.write("/tmp/cat-pool.json", JSON.stringify(out, null, 1));
console.log(`\nTOTAL fresh vetted candidates: ${out.length} -> /tmp/cat-pool.json`);
for (const r of out) console.log(`  ws=${String(r.wholesale).padStart(6)} us=${String(r.us).padEnd(7)} [${r.cat}] ${r.name.slice(0, 74)}`);
