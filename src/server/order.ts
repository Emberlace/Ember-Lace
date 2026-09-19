/* Ember & Lace — order validation + CJ payload builder (server-side).
   Pure functions in their own module so they can be unit-tested without
   booting the server. Never logs or returns keys/tokens. */

export type OrderItem = { cjPid: string; qty: number; cjVid?: string };

export type ValidatedOrder = {
  name: string;
  email: string;
  paidEmail: string;
  phone?: string;
  address: { line1: string; city: string; state: string; zip: string; country: string };
  items: OrderItem[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrderBody(
  body: unknown
): { ok: true; order: ValidatedOrder } | { ok: false; error: string } {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Request body must be JSON." };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const paidEmail = typeof b.paidEmail === "string" ? b.paidEmail.trim() : "";
  const addr = b.address as Partial<ValidatedOrder["address"]> | undefined;
  const items = b.items as unknown;
  const phone =
    typeof b.phone === "string" && b.phone.trim().length > 0
      ? b.phone.trim().slice(0, 30)
      : undefined;

  if (name.length < 2 || name.length > 120)
    return { ok: false, error: "Please provide your full name." };
  if (!EMAIL_RE.test(email))
    return { ok: false, error: "Contact email looks invalid." };
  if (!EMAIL_RE.test(paidEmail))
    return { ok: false, error: "Stripe payment email looks invalid." };
  if (!addr || typeof addr !== "object")
    return { ok: false, error: "Shipping address is required." };
  for (const k of ["line1", "city", "state", "zip", "country"] as const) {
    const v = addr[k];
    if (typeof v !== "string" || v.trim().length === 0)
      return { ok: false, error: `Shipping address ${k} is required.` };
  }
  const line1 = addr.line1!.trim();
  const city = addr.city!.trim();
  const state = addr.state!.trim();
  const zip = addr.zip!.trim();
  const country = addr.country!.trim();
  if (line1.length > 200 || zip.length > 20)
    return { ok: false, error: "Shipping address looks invalid." };
  if (!Array.isArray(items) || items.length === 0 || items.length > 50)
    return { ok: false, error: "Cart must contain 1–50 line items." };
  const clean: OrderItem[] = [];
  for (const it of items) {
    const o = it as Partial<OrderItem> | null;
    const pid = typeof o?.cjPid === "string" ? o.cjPid.trim() : "";
    // Optional CJ variant id (harvested 2026-09-08 via GET /product/query into
    // live-catalog.json `variants[]`). Validated loosely: digits-only like pids.
    const rawVid = typeof o?.cjVid === "string" ? o.cjVid.trim() : "";
    const cjVid =
      rawVid.length > 0 && rawVid.length <= 40 && /^[0-9]+$/.test(rawVid)
        ? rawVid
        : undefined;
    const qty = o?.qty;
    if (
      pid.length === 0 ||
      pid.length > 40 ||
      !/^[0-9]+$/.test(pid) ||
      !Number.isInteger(qty) ||
      (qty as number) < 1 ||
      (qty as number) > 999
    )
      return {
        ok: false,
        error: "Each item needs a valid CJ product id and quantity 1–999.",
      };
    clean.push(cjVid ? { cjPid: pid, qty: qty as number, cjVid } : { cjPid: pid, qty: qty as number });
  }
  return {
    ok: true,
    order: { name, email, paidEmail, phone, address: { line1, city, state, zip, country }, items: clean },
  };
}

/* Items-only validation, shared by the Stripe PaymentIntent route (which has
   no order form: name/email/address are optional there) and the webhook.
   Same per-item rules as validateOrderBody above.
   `requireVid`: when true (card checkout), every line MUST carry a real CJ
   variant id — a product-level cjPid is NOT a valid vid (CJ createOrder:
   code 1602000 "Variant not found"), so a vid-less item can never be
   fulfilled. Requiring it at PaymentIntent creation is what guarantees the
   PI metadata always carries `v`; without it a charged PI would fail at CJ
   order time. Default false keeps the legacy /api/order path lenient. */
export function validateItems(
  bodyItems: unknown,
  opts: { requireVid?: boolean } = {}
): { ok: true; items: OrderItem[] } | { ok: false; error: string } {
  if (!Array.isArray(bodyItems) || bodyItems.length === 0 || bodyItems.length > 50)
    return { ok: false, error: "Cart must contain 1–50 line items." };
  const clean: OrderItem[] = [];
  for (const it of bodyItems) {
    const o = it as Partial<OrderItem> | null;
    const pid = typeof o?.cjPid === "string" ? o.cjPid.trim() : "";
    const rawVid = typeof o?.cjVid === "string" ? o.cjVid.trim() : "";
    const cjVid =
      rawVid.length > 0 && rawVid.length <= 40 && /^[0-9]+$/.test(rawVid)
        ? rawVid
        : undefined;
    const qty = o?.qty;
    if (
      pid.length === 0 ||
      pid.length > 40 ||
      !/^[0-9]+$/.test(pid) ||
      !Number.isInteger(qty) ||
      (qty as number) < 1 ||
      (qty as number) > 999
    )
      return {
        ok: false,
        error: "Each item needs a valid CJ product id and quantity 1–999.",
      };
    if (opts.requireVid && !cjVid)
      return {
        ok: false,
        error:
          "One of your cart items doesn't have a selectable size yet — please remove it and try again.",
      };
    clean.push(cjVid ? { cjPid: pid, qty: qty as number, cjVid } : { cjPid: pid, qty: qty as number });
  }
  return { ok: true, items: clean };
}

/* Best-effort CJ createOrder payload, aligned to the official CJ API docs
   (developers.cjdropshipping.com → 05. Shopping → 1.1 Create Order V2 /
   1.2 Create Order V3, verified 2026-09-08):
   - orderNumber (NOT externalOrderNumber): "Order number", string, required.
     The legacy v1-style `externalOrderNumber` name appears nowhere in the
     current docs; past live test got a duplicate-ref rejection on v1, so the
     v1 endpoint reads a ref field — V2/V3 name it `orderNumber`.
   - Callers MAY pass opts.orderNumber (e.g. the store's customer-facing
     orderRef from checkout-session metadata). When it passes the light sanity
     check it becomes the CJ orderNumber, so /api/track?ref=<confirmation ref>
     resolves; when absent/unsafe we fall back to the unique EL-<stamp> below
     (the legacy PaymentIntent path has no store ref and must stay
     unique-per-attempt so a Stripe retry can never collide).
   - Flattened shipping info: shippingZip, shippingCountry(+Code, two-letter),
     shippingProvince, shippingCity, shippingAddress, shippingCustomerName,
     shippingPhone — same names as docs.
   - fromCountryCode: two-letter warehouse country. Verified live 2026-09-12:
     the US-warehouse path (fromCountryCode=US, logistic "GOFO+" per
     freightCalculate) is REJECTED at createOrder (code 1605001 "Logistic
     invalid, please reference freight calculate") — this account's US
     warehouse is not orderable via API. fromCountryCode=CN + logistic
     "CJPacket Sensitive Pro" is ACCEPTED (createOrder code 200, freight
     5-11 days). Non-US destinations may expose different channels; per-order
     freight lookup is a follow-up if non-US destinations start ordering.
   - products[{quantity}]: docs identify lines by vid (variant id) or sku
     (variant sku) — verified 2026-09-08 dry-run: `pid` returns code 1600300
     "vid or variantSku must be not empty"; `vid` returns code 1602000
     "Variant not found" for a product-level id, proving the endpoint reads
     `vid`. Variant ids were harvested 2026-09-08 via GET /product/query into
     live-catalog.json `variants[]` (most products; any remaining ones
     need a follow-up harvest run). validateOrderBody accepts an optional
     cjVid per item and buildCjPayload prefers it, falling back to the
     product-level cjPid — which CJ rejects with 1602000, so items without a
     harvested variant cannot order yet. Do NOT invent a vid mapping here.
   - payType (2026-09-19, sandbox-validated): CJ "1/omitted" = page payment (the
     order waits for a human), "2" = balance payment. Free sandbox evidence
     (isSandbox:1, createOrderV2): payType:2 returns code 200 and the order is
     created with paymentDate null while the balance is $0.00 — i.e. creation is
     NOT blocked by an empty balance, the order simply stays unpaid. Because
     that evidence is sandbox-only (a real order cannot be tested without
     spending), payType:2 is wired but OFF by default: the caller must pass
     opts.payType explicitly, and the webhook only does that when the env flag
     CJ_PAY_FROM_BALANCE=1 is set (owner sign-off + funded balance). With the
     flag unset, behaviour is byte-for-byte what it was — orders are created
     unpaid and the supervised sweeper (cj-pay-sweep.sh) pays them later, and
     only when the ref is provably tied to a captured Stripe charge.
   Exact schema varies by app version; CJ returns code/message which the route
   logs server-side only. */
export function buildCjPayload(
  order: ValidatedOrder,
  opts?: { orderNumber?: string; payType?: number },
): Record<string, unknown> {
  // Light sanity check for a caller-supplied orderNumber (2-40 chars, safe
  // charset): only then do we trust it to become the CJ orderNumber.
  const providedRef = opts?.orderNumber;
  const orderNumber =
    typeof providedRef === "string" &&
    providedRef.length >= 2 &&
    providedRef.length <= 40 &&
    /^[A-Za-z0-9_-]+$/.test(providedRef)
      ? providedRef
      : `EL-${Date.now().toString(36).toUpperCase()}`;
  return {
    orderNumber,
    shippingCustomerName: order.name,
    shippingAddress: order.address.line1,
    shippingCity: order.address.city,
    shippingProvince: order.address.state,
    shippingZip: order.address.zip,
    shippingCountry: order.address.country,
    shippingCountryCode: order.address.country.toUpperCase().slice(0, 2),
    // CJ rejects empty shippingPhone ("shippingPhone must be not empty",
    // code 1600300, verified 2026-09-08 dry-run). Optional shopper phone is
    // used when provided; otherwise a clearly-fake placeholder that passes
    // shape validation and is replaced with the real number at checkout.
    shippingPhone: (order.phone && order.phone.trim()) || "1000000000",
    fromCountryCode: "CN",
    logisticName: "CJPacket Sensitive Pro",
    remark: `paidEmail=${order.paidEmail} contact=${order.email}`,
    products: order.items.map((it) => ({
      // Prefer the harvested variant id when the caller supplies one; the
      // product-level cjPid is NOT a valid vid (CJ: code 1602000
      // "Variant not found") and is kept only as a pending fallback until the
      // frontend passes cjVid/size selection through.
      vid: it.cjVid ?? it.cjPid,
      quantity: it.qty,
    })),
    // Balance payment at creation — only when the caller explicitly asks
    // (webhook: env CJ_PAY_FROM_BALANCE=1). Omitted ⇒ CJ's default page
    // payment, i.e. exactly the previous behaviour.
    ...(opts?.payType ? { payType: opts.payType } : {}),
  };
}
