import { createFileRoute } from "@tanstack/react-router";
import { pickEvent, recordEvents, type Evt } from "../../server/events";

/* POST /api/evt — first-party analytics ingest. Accepts a single event object
   or an array (batch, capped at 50) and appends each to data/events.jsonl.
   Fields are whitelisted to {evt, ts, ref, amount, src} (see pickEvent), so
   nothing beyond that schema is ever stored — no PII on disk. The client
   fires this with navigator.sendBeacon (fire-and-forget) from /src/lib/
   analytics.ts; the response is intentionally fast and tiny. */
const MAX_BATCH = 50;

export const Route = createFileRoute("/api/evt")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be JSON." },
            { status: 400 },
          );
        }
        const rawList = Array.isArray(body) ? body : [body];
        if (rawList.length === 0 || rawList.length > MAX_BATCH) {
          return Response.json(
            { ok: false, error: `Send between 1 and ${String(MAX_BATCH)} events.` },
            { status: 400 },
          );
        }
        const events: Evt[] = [];
        for (const raw of rawList) {
          const e = pickEvent(raw);
          if (!e) {
            return Response.json(
              { ok: false, error: 'Invalid event — evt must be "pageview" or "checkout_success".' },
              { status: 400 },
            );
          }
          events.push(e);
        }
        try {
          await recordEvents(events);
          return Response.json({ ok: true, accepted: events.length }, { status: 200 });
        } catch (err) {
          // Server-side only; the error is a file-write failure, no secrets.
          console.error("[evt] write failed:", err);
          return Response.json(
            { ok: false, error: "Could not store event — try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});