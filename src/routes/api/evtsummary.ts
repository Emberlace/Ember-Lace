import { createFileRoute } from "@tanstack/react-router";
import { summarize } from "../../server/events";

/* GET /api/evtsummary — aggregate, counts-only analytics for the owner
   dashboard. Returns total pageviews, total conversions, total revenue (USD)
   and per-day rows for the last 14 days (UTC, zero-filled). Events store no
   PII by schema, so this endpoint is intentionally unauthenticated; it must
   never grow new fields without checking what /api/evt is allowed to write. */
export const Route = createFileRoute("/api/evtsummary")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const summary = await summarize();
          return Response.json({ ok: true, ...summary }, { status: 200 });
        } catch (err) {
          // Server-side only; a file-read failure, no secrets.
          console.error("[evtsummary] read failed:", err);
          return Response.json(
            { ok: false, error: "Could not read events — try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});