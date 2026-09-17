// scripts/probe-categories.ts — read-only probe of CJ category endpoints.
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const { getCjAccessToken } = await import("../src/server/cj");
const token = await getCjAccessToken();
const out: Record<string, unknown> = {};
for (const p of [
  "/product/getCategory",
  "/product/getCategoryList",
  "/product/category/list",
  "/product/getCategories",
]) {
  try {
    const res = await fetch(`${BASE}${p}`, {
      headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    out[p] = { status: res.status, body: text.slice(0, 1200) };
  } catch (e) {
    out[p] = { error: e instanceof Error ? e.message : String(e) };
  }
}
await Bun.write("/tmp/cat-raw.json", JSON.stringify(out, null, 1));
console.log("wrote /tmp/cat-raw.json");
