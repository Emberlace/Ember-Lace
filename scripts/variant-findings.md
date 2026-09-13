# CJ variant harvest — findings (2026-09-08)

## Endpoint
`GET /product/query?pid=<cjPid>` via `cjProductQuery()` in `src/server/cj.ts`.
(Sibling paths `/product/queryByPid` and `/product/detail` return code 1600101
"Interface not found" — do not use.)

## Response shape
`{ code: 200, data: { variants: [{ vid, pid, variantSku, variantKey, variantSellPrice, ... }] } }`
- `variantKey` is `"Color-Size"` (e.g. `"Skin tone-M"`, `"Black-XXXL"`); `size`
  in our catalog entries is parsed as the substring after the last `-`.
- `vid` is the per-variant id CJ's createOrder endpoint requires
  (`products[].vid`); the product-level `cjPid` is rejected with code 1602000
  "Variant not found" (verified via dry-run).
- Stored per catalog product as additive `variants[]`:
  `[{ size, variantKey, vid, variantSku }]` — nothing else in the entry touched.
- Sample: pid `2063157880858386434` → 15 variants (Skin tone/Black/Brown ×
  M–XXXL) with real vids.

## Coverage
- Harvested: COUNT Harvested/120 products merged into `src/data/live-catalog.json`.
- Remaining: COUNT_REMAINING products still without `variants` — need a follow-up run:
  `CJ_API_KEY=... bun scripts/harvest-variants.ts` (resumes from
  `/tmp/variant-harvest.json`, ~2s between queries, then merges additively).
- Backup of the pre-variants catalog: `/tmp/live-catalog.pre-variants.json`.

## US-warehouse note
- Catalog-level `usWarehouse` flag is `true` for 115/120 products
  (`"unknown"` for 5).
- Variant-level stock was spot-checked during harvest via
  `GET /product/stock/queryByVid?vid=...` → `data[].areaEn` reads
  `"US Warehouse"` or `"China Warehouse"` per variant, so US availability can
  vary by size/color even when the product-level flag is true. Prefer
  US-warehouse variants at order time when choosing between vids.
