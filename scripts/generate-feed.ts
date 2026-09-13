// Generates public/products.json (organic/shopping-surface product feed)
// from src/data/live-catalog.json. Run: bun run scripts/generate-feed.ts
// Re-run whenever live-catalog.json changes (e.g. before publish).
import catalog from "../src/data/live-catalog.json";

const STORE_URL = "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app";

type CatalogItem = {
  id: string;
  name: string;
  retail: number;
  image: string;
  sizes: string;
  collection: string;
};

const items = (catalog as unknown as CatalogItem[]).map((p) => ({
  id: p.id,
  name: p.name,
  price: p.retail,
  priceDisplay: `$${p.retail.toFixed(2)}`,
  currency: "USD",
  image_link: p.image,
  link: `${STORE_URL}/#bestsellers?utm_source=organic&utm_medium=product-feed&utm_campaign=${encodeURIComponent(p.id)}`,
  availability: "in_stock",
  condition: "new",
  brand: "Ember & Lace",
  sizes: p.sizes,
  collection: p.collection,
}));

const feed = {
  brand: "Ember & Lace",
  store: STORE_URL,
  generatedAt: new Date().toISOString().split("T")[0],
  count: items.length,
  items,
};

await Bun.write(
  new URL("../public/products.json", import.meta.url),
  JSON.stringify(feed, null, 2) + "\n"
);

console.log(`products.json: wrote ${items.length} items`);
