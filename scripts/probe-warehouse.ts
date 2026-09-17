// Probe CJ for real warehouse info on the 5 catalog products whose
// `usWarehouse` is still the string "unknown" (their /product/list row carried
// no `shippingCountryCodes`, which is the signal the sweep used).
//
// Honest signals probed, per product:
//   1. GET  /product/query?pid=...            -> product detail fields
//   2. GET  /product/stock/queryByVid?vid=... -> per-warehouse stock rows
//   3. POST /logistic/freightCalculate        -> quotable lanes, US->US and CN->US
//   4. GET  /product/list?productName=...     -> list row (shippingCountryCodes)
// Results are written incrementally to /tmp/wh-probe.json so partial runs survive.
//
// Usage: source /etc/profile.d/cto-env-vars.sh && bun run scripts/probe-warehouse.ts
import { getCjAccessToken } from "../src/server/cj";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const OUT = "/tmp/wh-probe.json";

const TARGETS = [
  { pid: "2096060170918871041", name: "Burgundy Corset Bodice Black Satin Ball-Gown Evening Dress" },
  { pid: "2091092166068985858", name: "Ruffled Cut-out Shirt& Lace And Satin Skirt Set" },
  { pid: "2095699260953493506", name: "Elegant Satin Waist-Cinching Halter Neck Sleeveless Dress" },
  { pid: "2083088313364418561", name: "Two-Tone Satin Lace Slip Maxi Dress" },
  { pid: "2089992415129919489", name: "Floral Satin Lace Trim Midi Mermaid Dress" },
];

const out: Record<string, any> = {};
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
  const json: any = await res.json().catch(() => ({ parseError: true }));
  return { status: res.status, json };
}

for (const t of TARGETS) {
  const rec: any = (out[t.pid] ??= { name: t.name });
  if (rec.done) {
    console.log(`${t.pid} cached`);
    continue;
  }
  // 1. detail
  try {
    const { json }: any = await cj(`/product/query?pid=${t.pid}`);
    const d: any = json?.data ?? {};
    rec.detailCode = json?.code;
    rec.detailKeys = Object.keys(d);
    rec.detailScalars = Object.fromEntries(
      Object.entries(d).filter(([, v]) => v === null || typeof v !== "object"),
    );
    rec.detailShippingCountryCodes = d?.shippingCountryCodes ?? null;
    rec.vids = (d?.variants ?? []).map((v: any) => String(v.vid)).filter(Boolean);
  } catch (e) {
    rec.detailErr = String(e);
  }
  await save();
  // 2. stock by vid
  const vid = rec.vids?.[0];
  if (vid) {
    try {
      const { status, json }: any = await cj(`/product/stock/queryByVid?vid=${vid}`);
      rec.stock = { status, code: json?.code, message: json?.message, data: json?.data };
    } catch (e) {
      rec.stock = { err: String(e) };
    }
  }
  await save();
  // 3. freight from US warehouse and from CN, to a US address
  rec.freight = {};
  if (vid) {
    for (const start of ["US", "CN"]) {
      try {
        const { status, json }: any = await cj(`/logistic/freightCalculate`, "POST", {
          startCountryCode: start,
          endCountryCode: "US",
          products: [{ quantity: 1, vid }],
        });
        const list = Array.isArray(json?.data) ? json.data : [];
        rec.freight[start] = {
          status,
          code: json?.code,
          message: json?.message,
          count: list.length,
          options: list.slice(0, 8).map((o: any) => ({
            logisticName: o.logisticName,
            logisticAging: o.logisticAging,
            logisticPrice: o.logisticPrice,
            totalPostageFee: o.totalPostageFee,
          })),
        };
      } catch (e) {
        rec.freight[start] = { err: String(e) };
      }
      await save();
      await sleep(800);
    }
  }
  // 4. list row by exact name
  try {
    const q = encodeURIComponent(t.name.replace(/&/g, " "));
    const { json }: any = await cj(`/product/list?pageNum=1&pageSize=50&productName=${q}`);
    const list: any[] = json?.data?.list ?? [];
    const hit = list.find((p) => String(p.pid) === t.pid);
    rec.listRow = {
      code: json?.code,
      total: json?.data?.total,
      exactHit: Boolean(hit),
      codes: hit ? hit.shippingCountryCodes ?? null : null,
      samples: list.slice(0, 5).map((p) => ({
        pid: p.pid,
        name: String(p.productNameEn ?? "").slice(0, 40),
        codes: p.shippingCountryCodes ?? null,
      })),
    };
  } catch (e) {
    rec.listErr = String(e);
  }
  rec.done = true;
  await save();
  console.log(`${t.pid} done`);
}

console.log("SUMMARY");
console.log(JSON.stringify(out, null, 1));
