import { createFileRoute } from "@tanstack/react-router";

import { cjProductList } from "../../server/cj";

// Parallel proof route only — the mock 154-product catalog UI is untouched.
// Server-side: calls the live CJ catalog with the cached token and returns
// sanitized JSON. Never exposes CJ_API_KEY or the access token.

interface CjItem {
  [key: string]: unknown;
}

function firstString(item: CjItem, keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function firstValue(item: CjItem, keys: string[]): unknown {
  for (const k of keys) {
    const v = item[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function sanitize(item: CjItem) {
  const sizesRaw = firstValue(item, [
    "sizeList",
    "sizes",
    "size",
    "variantList",
    "variants",
    "skuList",
  ]);
  const sizes = Array.isArray(sizesRaw)
    ? sizesRaw
        .map((s) =>
          typeof s === "string"
            ? s
            : typeof s === "object" && s !== null
              ? String(
                  (s as Record<string, unknown>).size ??
                    (s as Record<string, unknown>).name ??
                    JSON.stringify(s),
                )
              : String(s),
        )
        .slice(0, 25)
    : typeof sizesRaw === "string"
      ? [sizesRaw]
      : null;
  return {
    cjId: firstValue(item, ["pid", "id", "productId"]),
    name: firstString(item, [
      "nameEn",
      "productNameEn",
      "name",
      "title",
      "productName",
    ]),
    price: firstValue(item, [
      "sellPrice",
      "nowPrice",
      "price",
      "salePrice",
      "productPrice",
    ]),
    listPrice: firstValue(item, ["listPrice", "originalPrice", "marketPrice"]),
    currency: firstString(item, ["currency", "currencyCode"]) ?? "USD",
    image: firstString(item, [
      "bigImage",
      "image",
      "productImage",
      "smallImage",
      "mainImage",
    ]),
    sizes,
  };
}

export const Route = createFileRoute("/api/cj-test")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = (await cjProductList({
            keyWords: "lace bra",
            pageNum: 1,
            pageSize: 10,
          })) as {
            code?: number;
            message?: string;
            data?: { list?: CjItem[]; total?: number } | CjItem[];
          };
          const container = data?.data;
          const list = Array.isArray(container)
            ? container
            : Array.isArray(container?.list)
              ? container!.list!
              : [];
          return Response.json(
            {
              ok: data?.code === 200,
              source: "cj-live",
              query: "lace bra",
              cjCode: data?.code ?? null,
              cjMessage: data?.message ?? null,
              total: Array.isArray(container)
                ? container.length
                : (container?.total ?? list.length),
              count: list.length,
              items: list.slice(0, 10).map(sanitize),
            },
            { status: 200 },
          );
        } catch (err) {
          return Response.json(
            {
              ok: false,
              source: "cj-live",
              query: "lace bra",
              count: 0,
              items: [],
              error:
                err instanceof Error
                  ? err.message.replace(/[A-Za-z0-9._-]{20,}/g, "[redacted]")
                  : "unknown error",
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
