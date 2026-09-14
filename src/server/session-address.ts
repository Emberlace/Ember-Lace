/* Ember & Lace — hosted-checkout session shipping/contact resolution.
   Pure function so the webhook handler and its regression test share the
   exact same extraction logic against real Stripe session objects. Verified
   live 2026-09-14 (order EL-MU1DGE82): hosted Checkout delivered the full
   customer-typed shipping address in session.collected_information.shipping_details
   while session.shipping_details was empty and session.customer_details.address
   was partial (line1/city/state null). Prefer whichever source has a usable
   street address (non-empty line1): shipping_details →
   collected_information.shipping_details → customer_details. Only fall
   through to the next source when the current one lacks a usable line1. */

export type SessionAddress = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type SessionShippingSource = {
  shipping_details?: {
    address?: SessionAddress | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  customer_details?: {
    address?: SessionAddress | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  collected_information?: {
    shipping_details?: {
      address?: SessionAddress | null;
      name?: string | null;
    } | null;
  } | null;
};

export type ResolvedSessionShipping = {
  addr: SessionAddress | null | undefined;
  name: string;
  phone: string | undefined;
};

export function resolveSessionShipping(
  session: SessionShippingSource
): ResolvedSessionShipping {
  const sd = session.shipping_details;
  const cd = session.customer_details;
  const ci = session.collected_information;
  const hasLine1 = (a: SessionAddress | null | undefined): boolean =>
    typeof a?.line1 === "string" && a.line1.trim().length > 0;
  const addr = hasLine1(sd?.address)
    ? sd?.address
    : hasLine1(ci?.shipping_details?.address)
      ? ci?.shipping_details?.address
      : cd?.address;
  const name =
    sd?.name?.trim() ||
    cd?.name?.trim() ||
    ci?.shipping_details?.name?.trim() ||
    "";
  const phone = sd?.phone?.trim() || cd?.phone?.trim() || undefined;
  return { addr, name, phone };
}