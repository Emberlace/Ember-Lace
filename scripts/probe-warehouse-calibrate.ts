// Calibration probe: does CJ's stock API surface US warehouses, and what do
// the 5 `usWarehouse: "unknown"` products look like next to known `true` ones?
//
// For every pid: detail -> first vid -> /product/stock/queryByVid (per-warehouse
// stock rows), plus a /product/list lookup with the pid to see if a list row
// (with shippingCountryCodes) can be retrieved directly.
//
// Usage: source /etc/profile.d/cto-env-vars.sh && bun run scripts/probe-warehouse-calibrate.ts
import { getCjAccessToken } from "../src/server/cj";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const OUT = "/tmp/wh-calib.json";

// known usWarehouse: true (sample across the catalog) + the 5 unknowns
const PIDS: string[] = [
  "2063168226677981185", "2063157880858386434", "2063152969293742082",
  "2043695179342602242", "1990685216225153026", "1893861172387098625",
  "1572137912819527680", "2607200441561600500",
  "2096060170918871041", "2091092166068985858", "2095699260953493506",
  "2083088313364418561", "2089992415129919489",
];

const out: Record<string, unknown> = {};
async function save() {
  await Bun.write(OUT, JSON.stringify(out, null, 1));
}
async function cj(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const token = await getCjAccessToken();
  const res = await fetch(`${CJ_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  return res.json().catch(() => ({ parseError: true })) as any;
}

for (const pid of PIDS) {
  const rec: any = (out[pid] ??= {});
  if (rec.done) continue;
  try {
    const d = await cj(`/product/query?pid=${pid}`);
    const vid = String((d?.data?.variants ?? [])[0]?.vid ?? "");
    rec.name = String(d?.data?.productNameEn ?? "").slice(0, 60);
    rec.vid = vid;
    if (vid) {
      await sleep(1100);
      const s = await cj(`/product/stock/queryByVid?vid=${vid}`);
      rec.stockCode = s?.code;
      rec.areas = (Array.isArray(s?.data) ? s.data : []).map((a: any) => ({
        areaEn: a.areaEn,
        countryCode: a.countryCode,
        storageNum: a.storageNum,
        cjInventoryNum: a.cjInventoryNum,
        factoryInventoryNum: a.factoryInventoryNum,
      }));
      rec.hasUsArea = (rec.areas as any[]).some(
        (a) => /united states|u\.?s\.?/i.test(String(a.areaEn)) || a.countryCode === "US",
      );
    }
    await sleep(1100);
    const l = await cj(`/product/list?pageNum=1&pageSize=10&pid=${pid}`);
    const rows: any[] = l?.data?.list ?? [];
    const hit = rows.find((r) => String(r.pid) === pid);
    rec.listByPid = { code: l?.code, n: rows.length, hit: Boolean(hit), codes: hit?.shippingCountryCodes ?? null };
    if (!hit && rows.length) {
      rec.listByPid.sampleCodes = rows.slice(0, 3).map((r) => ({ pid: r.pid, codes: r.shippingCountryCodes ?? null }));
    }
  } catch (e) {
    rec.err = String(e);
  }
  rec.done = true;
  await save();
  console.log(`${pid} done`);
}
console.log(JSON.stringify(out, null, 1));
