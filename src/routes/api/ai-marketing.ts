import { createFileRoute } from "@tanstack/react-router";
import { generateCopy, MAX_COUNT } from "../../server/ai-marketing";
/* POST /api/ai-marketing — Marketing Studio copy drafting.
   Public route, but it never returns or accepts a secret: the key is read from
   the server environment only, and the response is plain generated text. It is
   still a route that can spend the owner's provider credits, so it is capped
   (count <= 4, max_tokens 500 in the provider call) and lightly rate-limited
   per caller. Every failure path answers 200 with ok:false so the UI can show
   a friendly notice instead of an error page. */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_BODY_BYTES = 4_000;

const recent = new Map<string, { n: number; resetAt: number }>();

function callerKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  return ip || "unknown";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (recent.size > 500) {
    for (const [k, v] of recent) if (v.resetAt <= now) recent.delete(k);
  }
  const entry = recent.get(key);
  if (!entry || entry.resetAt <= now) {
    recent.set(key, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.n += 1;
  return entry.n > MAX_REQUESTS_PER_WINDOW;
}

export const Route = createFileRoute("/api/ai-marketing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (rateLimited(callerKey(request))) {
          return Response.json(
            {
              ok: false,
              reason: "error",
              message:
                "That's a lot of drafts in a short time — wait a minute and try again.",
            },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }

        let body: Record<string, unknown>;
        try {
          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) {
            return Response.json(
              { ok: false, reason: "error", message: "That request was too large." },
              { status: 200, headers: { "cache-control": "no-store" } },
            );
          }
          const parsed: unknown = text ? JSON.parse(text) : {};
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return Response.json(
            {
              ok: false,
              reason: "error",
              message: "Could not read that request — send JSON like { kind: \"caption\" }.",
            },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }

        const count = Number(body.count);
        if (Number.isFinite(count) && count > MAX_COUNT) {
          body.count = MAX_COUNT;
        }

        const result = await generateCopy(body);
        return Response.json(result, {
          status: 200,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
