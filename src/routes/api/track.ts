import { createFileRoute } from "@tanstack/react-router";

import { cjTrackOrder } from "../../server/cj";

/* GET /api/track?ref=EL-XXX — order status + tracking lookup by our orderRef
   (or CJ warehouse id). Server-side only: calls CJ getOrderDetail and returns
   sanitized { ok, status, trackingNumber, carrier }. Never exposes CJ_API_KEY
   or access tokens — error paths redact token-like strings. */

const REF_RE = /^[A-Za-z0-9_-]{1,40}$/;

type CjDetail = Record<string, unknown>;

function firstString(d: CjDetail, keys: string[]): string | null {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function friendly(status: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "SHIPPED":
      return "Shipped — on its way to you ♡";
    case "DELIVERED":
      return "Delivered — enjoy ♡";
    case "PROCESSING":
    case "PENDING":
      return "Being prepared at our US warehouse";
    case "UNSHIPPED":
    case "PAID":
      return "Paid — packing it up in discreet packaging";
    case "UNPAID":
    case "IN_CART":
    case "CREATED":
      return "Order received — awaiting payment confirmation";
    case "CANCELLED":
    case "CANCELED":
      return "Cancelled — contact us if this looks wrong";
    default:
      return status ?? "Looking into it";
  }
}

export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const raw = (url.searchParams.get("ref") ?? "").trim();
        if (!REF_RE.test(raw)) {
          return Response.json(
            {
              ok: false,
              error:
                "Please enter a valid order ref (letters, numbers, dash — up to 40 characters).",
            },
            { status: 400 },
          );
        }
        try {
          const cj = (await cjTrackOrder(raw)) as {
            code?: number;
            message?: string;
            data?: CjDetail | CjDetail[] | null;
          };
          // Server-side only: log CJ response code/message (never key/token).
          console.log(
            `[track] CJ getOrderDetail code=${String(cj?.code)} message=${String(cj?.message ?? "").slice(0, 200)}`,
          );
          if (cj?.code !== 200) {
            const notFound =
              cj?.code === 1600300 ||
              /not\s*found|not\s*exist|no\s+such|no\s+order/i.test(
                String(cj?.message ?? ""),
              );
            return Response.json(
              {
                ok: false,
                status: null,
                trackingNumber: null,
                carrier: null,
                cjCode: cj?.code ?? null,
                cjMessage: String(cj?.message ?? "").slice(0, 200),
                error: notFound
                  ? "We couldn't find that order ref — check the code from your confirmation and try again."
                  : "Our warehouse couldn't be reached just now — please try again in a moment.",
              },
              { status: notFound ? 404 : 502 },
            );
          }
          const container = cj?.data;
          const d: CjDetail = Array.isArray(container)
            ? ((container[0] as CjDetail) ?? {})
            : ((container as CjDetail) ?? {});
          const status = firstString(d, [
            "orderStatus",
            "status",
            "orderState",
            "state",
          ]);
          const trackingNumber = firstString(d, [
            "trackNumber",
            "trackingNumber",
            "logisticTrackNumber",
            "logisticsTrackNumber",
            "waybillNumber",
          ]);
          const carrier = firstString(d, [
            "trackingProvider",
            "logisticName",
            "logisticsName",
            "carrier",
            "shippingMethod",
          ]);
          return Response.json(
            {
              ok: true,
              status: friendly(status),
              trackingNumber,
              carrier,
              cjCode: cj?.code ?? null,
              cjMessage: String(cj?.message ?? "").slice(0, 200),
            },
            { status: 200 },
          );
        } catch (err) {
          console.log(
            `[track] CJ getOrderDetail threw: ${(err instanceof Error ? err.message : "unknown").slice(0, 200)}`,
          );
          return Response.json(
            {
              ok: false,
              error:
                "Our warehouse couldn't be reached just now — please try again in a moment.",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
