import { createFileRoute } from "@tanstack/react-router";

import { cjCreateOrder } from "../../server/cj";
import { buildCjPayload, validateOrderBody } from "../../server/order";

/* POST /api/order — route a paid order to the CJ US warehouse.
   Body: { name, email, address{line1,city,state,zip,country}, items[{cjPid,qty}], paidEmail }
   Flow: shopper pays via Stripe link first, then confirms here with the email
   they paid with. Server-side only: never exposes CJ_API_KEY or tokens. */

export const Route = createFileRoute("/api/order")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be JSON." },
            { status: 400 }
          );
        }
        const checked = validateOrderBody(body);
        if (!checked.ok) {
          return Response.json(
            { ok: false, error: checked.error },
            { status: 400 }
          );
        }
        const payload = buildCjPayload(checked.order);

        try {
          const cj = (await cjCreateOrder(payload)) as {
            code?: number;
            message?: string;
            data?: unknown;
          };
          // Server-side only: log CJ response code/message (never key/token).
          console.log(
            `[order] CJ createOrder code=${String(cj?.code)} message=${String(cj?.message ?? "").slice(0, 200)}`
          );
          if (cj?.code !== 200) {
            return Response.json(
              {
                ok: false,
                error:
                  "Our warehouse couldn't take this order just now — we'll confirm your payment email and follow up shortly.",
              },
              { status: 502 }
            );
          }
          const d = cj.data as
            | { orderId?: string; id?: string; orderNumber?: string }
            | string
            | undefined;
          const cjOrderId =
            typeof d === "string"
              ? d
              : (d?.orderId ?? d?.orderNumber ?? d?.id ?? payload.orderNumber);
          return Response.json(
            { ok: true, cjOrderId, orderRef: payload.orderNumber },
            { status: 200 }
          );
        } catch (err) {
          console.log(
            `[order] CJ createOrder threw: ${(err instanceof Error ? err.message : "unknown").slice(0, 200)}`
          );
          return Response.json(
            {
              ok: false,
              error:
                "Our warehouse couldn't take this order just now — we'll confirm your payment email and follow up shortly.",
            },
            { status: 502 }
          );
        }
      },
    },
  },
});
