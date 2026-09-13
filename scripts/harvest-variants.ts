// Harvest CJ variant IDs for every product in live-catalog.json.
// Usage: CJ_API_KEY=... bun scripts/harvest-variants.ts
// Writes: /tmp/variant-harvest.json (pid -> variants), then merges additive
// `variants` arrays into src/data/live-catalog.json (existing fields untouched).
// Brisk sequential queries (~2s apart); brief backoff on rate limits.

import { cjProductQuery } from "../src/server/cj";

const CATALOG = "src/data/live-catalog.json";
const OUT = "/tmp/variant-harvest.json";
const DELAY_MS = 2000;

type CatalogProduct = Record<string, unknown> & { cjPid: string };
type VariantOut = { size: string; variantKey: string; vid: string; variantSku: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseSize(variantKey: string): string {
  const i = variantKey.lastIndexOf("-");
  return (i >= 0 ? variantKey.slice(i + 1) : variantKey).trim();
}

const catalog = JSON.parse(await Bun.file(CATALOG).text()) as CatalogProduct[];
console.log(`products: ${catalog.length}`);

// Resume: keep prior results so re-runs only query missing pids.
let harvested: Record<string, VariantOut[]> = {};
try {
  harvested = JSON.parse(await Bun.file(OUT).text()) as Record<string, VariantOut[]>;
  console.log(`resuming with ${Object.keys(harvested).length} already harvested`);
} catch { /* fresh run */ }

let ok = 0, failed: string[] = [];
for (const p of catalog) {
  const pid = p.cjPid;
  if (harvested[pid]?.length) { ok++; continue; }
  let attempts = 0;
  for (;;) {
    attempts++;
    try {
      const json = (await cjProductQuery(pid)) as {
        code?: number; message?: string;
        data?: { variants?: Array<{ vid?: string; variantSku?: string; variantKey?: string }> };
      };
      if (json.code === 200 && Array.isArray(json.data?.variants)) {
        harvested[pid] = (json.data!.variants ?? [])
          .filter((v) => v.vid)
          .map((v) => ({
            size: parseSize(String(v.variantKey ?? "")),
            variantKey: String(v.variantKey ?? ""),
            vid: String(v.vid),
            variantSku: String(v.variantSku ?? ""),
          }));
        ok++;
        console.log(`${pid}: ${harvested[pid].length} variants`);
        break;
      }
      console.log(`${pid}: code=${json.code} msg=${json.message} (attempt ${attempts})`);
      if (attempts >= 3) { failed.push(pid); break; }
      await sleep(5000);
    } catch (e) {
      console.log(`${pid}: error ${(e as Error).message} (attempt ${attempts})`);
      if (attempts >= 3) { failed.push(pid); break; }
      await sleep(8000);
    }
  }
  await Bun.write(OUT, JSON.stringify(harvested));
  await sleep(DELAY_MS);
}

// Merge into catalog (additive only).
let merged = 0, totalVariants = 0;
for (const p of catalog) {
  const v = harvested[p.cjPid];
  if (v?.length && !Array.isArray(p.variants)) { p.variants = v; merged++; }
  if (Array.isArray(p.variants)) totalVariants += (p.variants as unknown[]).length;
}
await Bun.write(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
console.log(`\nDONE harvested=${ok}/${catalog.length} failed=${failed.length} merged=${merged} totalVariants=${totalVariants}`);
if (failed.length) console.log(`failed pids: ${failed.join(",")}`);
