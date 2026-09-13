/* Server-side first-party analytics store: an append-only JSONL file under
   <project-root>/data/events.jsonl. No database, no third-party services.
   Event payloads are whitelisted to {evt, ts, ref, amount, src} by pickEvent —
   names, emails, addresses and IPs can never be stored — so /api/evtsummary
   can serve aggregate counts to anyone without leaking PII.

   The data dir is runtime state, NOT build input: unlike src/data/*.json
   (which are imported at build time), <root>/data is created on first write,
   is gitignored, and is resolved from the project root at runtime. `vite dev`
   and `bun run serve.ts` both run with CWD = the site dir; the import.meta
   fallback covers the built server, whose bundle lives in dist/server. */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EvtName = "pageview" | "checkout_success";
export type EvtSrc = "referrer" | "utm" | "direct";
export type Evt = {
  evt: EvtName;
  ts: string; // ISO 8601
  ref?: string; // order ref, checkout_success only
  amount?: number; // USD, checkout_success only
  src?: EvtSrc;
};

const MAX_REF_LEN = 64;
const REF_RE = /^[A-Za-z0-9_-]+$/;
const MAX_AMOUNT = 100_000;

function projectRoot(): string {
  if (existsSync(path.join(process.cwd(), "package.json"))) return process.cwd();
  // dist/server/server.js → walk up to the dir that owns package.json.
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export const EVENTS_DIR = path.join(projectRoot(), "data");
export const EVENTS_FILE = path.join(EVENTS_DIR, "events.jsonl");

/* Validate and whitelist one raw event. Returns null when `evt` is missing or
   not a known name (the caller rejects the request); optional fields that fail
   validation are simply dropped, keeping the stored line minimal. */
export function pickEvent(raw: unknown): Evt | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (b.evt !== "pageview" && b.evt !== "checkout_success") return null;
  let ts = typeof b.ts === "string" ? b.ts.trim() : "";
  if (!ts || Number.isNaN(Date.parse(ts))) ts = new Date().toISOString();
  const out: Evt = { evt: b.evt, ts };
  if (typeof b.ref === "string") {
    const ref = b.ref.trim().slice(0, MAX_REF_LEN);
    if (ref.length > 0 && REF_RE.test(ref)) out.ref = ref;
  }
  if (
    typeof b.amount === "number" &&
    Number.isFinite(b.amount) &&
    b.amount >= 0 &&
    b.amount <= MAX_AMOUNT
  ) {
    out.amount = Math.round(b.amount * 100) / 100;
  }
  if (b.src === "referrer" || b.src === "utm" || b.src === "direct") out.src = b.src;
  return out;
}

/* Appends are serialized through an in-process promise chain so concurrent
   beacons can never interleave mid-line; O_APPEND (appendFile) covers
   cross-process writers. An error in one write doesn't wedge the chain. */
let writer: Promise<void> = Promise.resolve();
export function recordEvents(events: Evt[]): Promise<void> {
  if (events.length === 0) return Promise.resolve();
  const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const run = writer.then(async () => {
    await mkdir(EVENTS_DIR, { recursive: true });
    await appendFile(EVENTS_FILE, body, "utf8");
  });
  writer = run.catch(() => {});
  return run;
}

export type DayCounts = {
  date: string; // YYYY-MM-DD (UTC)
  pageviews: number;
  conversions: number;
  revenue: number; // USD
};

export type EvtSummary = {
  totals: { pageviews: number; conversions: number; revenue: number };
  days: DayCounts[]; // last 14 days, oldest → newest, zero-filled
};

export async function summarize(): Promise<EvtSummary> {
  const totals = { pageviews: 0, conversions: 0, revenue: 0 };
  const byDay = new Map<string, DayCounts>();
  const raw = await readFile(EVENTS_FILE, "utf8").catch(() => "");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: { evt?: unknown; ts?: unknown; amount?: unknown };
    try {
      e = JSON.parse(t) as typeof e;
    } catch {
      continue; // skip torn/corrupt lines rather than failing the whole read
    }
    if (e.evt !== "pageview" && e.evt !== "checkout_success") continue;
    const date = typeof e.ts === "string" ? e.ts.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    let day = byDay.get(date);
    if (!day) {
      day = { date, pageviews: 0, conversions: 0, revenue: 0 };
      byDay.set(date, day);
    }
    if (e.evt === "pageview") {
      totals.pageviews++;
      day.pageviews++;
    } else {
      totals.conversions++;
      day.conversions++;
      if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
        totals.revenue += e.amount;
        day.revenue += e.amount;
      }
    }
  }
  // Two-decimal money for every aggregate.
  totals.revenue = Math.round(totals.revenue * 100) / 100;
  for (const d of byDay.values()) d.revenue = Math.round(d.revenue * 100) / 100;
  // Zero-filled rolling window so the dashboard shape is always the same.
  const days: DayCounts[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const key = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    ).toISOString().slice(0, 10);
    days.push(byDay.get(key) ?? { date: key, pageviews: 0, conversions: 0, revenue: 0 });
  }
  return { totals, days };
}