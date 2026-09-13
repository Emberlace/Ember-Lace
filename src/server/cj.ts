// CJ Dropshipping API v2 helper (server-side only).
//
// Auth: POST https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken
// with JSON { email, apiKey } — NOTE: the field is `apiKey` (capital K), NOT
// `apiApikey`. The `apiApikey` spelling returns code 1600300
// ("password must be not empty"). Verified 2026-09-08 against the live API.
// Credentials come from the CJ_API_KEY env secret; never log the key/token.
//
// Token caching: access token is cached in memory and re-used; re-auth at
// most once per 300s (min interval guard) and on 401/invalid-token responses.
//
// Search param: GET /product/list silently ignores `keyWords` and
// `keyword` (both return the full generic catalog, total=1519560 — verified
// 2026-09-08 via /tmp/probe-cj.ts: keyWords="lace bra" returned mens suits
// and lamps). Two params actually filter: `productNameEn` (total=39824,
// loose OR-match — top hit was socks) and `productName` (total=1375, top
// hit a lifting bra in category Bras — tightest match). cjProductList maps
// its keyWords argument to `productName`.

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_EMAIL = "ash461165@gmail.com";

// Min seconds between login calls (re-auth max 1 per 300s).
const MIN_REAUTH_INTERVAL_S = 300;

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  fetchedAt: number; // ms epoch
  lastAuthAt: number; // ms epoch, for the 300s re-auth guard
}

let cache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

function getApiKey(): string {
  const key = process.env.CJ_API_KEY;
  if (!key) throw new Error("CJ_API_KEY env secret is not set");
  return key;
}

// Per-request timeout so callers never hang forever (CJ can take 5-10s+).
const REQ_TIMEOUT_MS = 25000;

async function login(): Promise<TokenCache> {
  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CJ_EMAIL, apiKey: getApiKey() }),
    signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
    data?: { accessToken?: string; refreshToken?: string };
  };
  if (json.code !== 200 || !json.data?.accessToken) {
    throw new Error(
      `CJ auth failed (HTTP ${res.status}, code ${json.code}): ${json.message ?? "unknown error"}`,
    );
  }
  const now = Date.now();
  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken ?? "",
    fetchedAt: now,
    lastAuthAt: now,
  };
}

/** Get a valid access token, re-authenticating at most once per 300s. */
export async function getCjAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cache?.accessToken) {
    const sinceAuth = (Date.now() - cache.lastAuthAt) / 1000;
    if (sinceAuth < MIN_REAUTH_INTERVAL_S) return cache.accessToken;
    // Past the guard window but token may still be valid (CJ tokens live
    // ~15 days); try it — callers retry with forceRefresh on 401.
    return cache.accessToken;
  }
  if (!inflight) {
    inflight = login()
      .then((c) => {
        cache = c;
        return c.accessToken;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function cjFetch(path: string, init?: RequestInit, retry = true): Promise<Response> {
  const token = await getCjAccessToken();
  const res = await fetch(`${CJ_BASE}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQ_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && retry) {
    // Token expired/invalid — force one re-auth and retry once.
    cache = null;
    const fresh = await getCjAccessToken(true);
    return fetch(`${CJ_BASE}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQ_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "CJ-Access-Token": fresh,
        ...(init?.headers ?? {}),
      },
    });
  }
  return res;
}

/** Stub: paginated product list (GET /product/list). Wire params as needed. */
export async function cjProductList(params: {
  pageNum?: number;
  pageSize?: number;
  keyWords?: string;
} = {}) {
  const q = new URLSearchParams({
    pageNum: String(params.pageNum ?? 1),
    pageSize: String(params.pageSize ?? 20),
    // NOTE: keyWords/keyword are silently ignored by /product/list; the
    // working search param is productName (tightest match — verified
    // 2026-09-08 via /tmp/probe-cj.ts).
    ...(params.keyWords ? { productName: params.keyWords } : {}),
  });
  const res = await cjFetch(`/product/list?${q.toString()}`, { method: "GET" });
  return res.json();
}

/** Product detail incl. variants array (GET /product/query?pid=...).
 *  Verified 2026-09-08: returns code 200 with `data.variants[]` =
 *  [{vid, pid, variantSku, variantKey ("Color-Size"), variantSellPrice, ...}].
 *  (Sibling paths /product/queryByPid and /product/detail return
 *  code 1600101 "Interface not found".) */
export async function cjProductQuery(pid: string) {
  const res = await cjFetch(`/product/query?pid=${encodeURIComponent(pid)}`, {
    method: "GET",
  });
  return res.json();
}

/** Stub: inventory query by variant. Wire exact endpoint params as needed. */
export async function cjInventory(vid: string) {
  const res = await cjFetch(`/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`, {
    method: "GET",
  });
  return res.json();
}

/** Order status + tracking lookup (GET /shopping/order/getOrderDetail).
 *  Docs: developers.cjdropshipping.com → 05. Shopping → 1.7 Query Order
 *  (verified 2026-09-08): `orderId` accepts EITHER our custom orderNumber
 *  (the EL- refs we send at createOrder) OR the CJ order id. Returns
 *  orderStatus (CREATED/IN_CART/UNPAID/PENDING/PROCESSING/UNSHIPPED/SHIPPED/
 *  DELIVERED/CANCELLED) plus trackNumber/trackingProvider/trackingUrl once
 *  shipped. Not-found: code 1600300 "order not found". */
export async function cjTrackOrder(orderIdOrRef: string) {
  const ref = String(orderIdOrRef ?? "").trim();
  if (!ref || ref.length > 40) {
    throw new Error("cjTrackOrder: ref must be 1-40 chars");
  }
  const res = await cjFetch(
    `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(ref)}`,
    { method: "GET" },
  );
  return res.json();
}

/** Stub: create a dropship order (POST /shopping/order/createOrder). */
export async function cjCreateOrder(orderPayload: Record<string, unknown>) {
  const res = await cjFetch(`/shopping/order/createOrder`, {
    method: "POST",
    body: JSON.stringify(orderPayload),
  });
  return res.json();
}
