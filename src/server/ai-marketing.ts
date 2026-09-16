/* Server-only AI copy generator for the Marketing Studio.
   - No npm dependencies: plain fetch to Anthropic Messages or OpenAI Chat
     Completions, whichever key is present in the environment.
   - No key set is a NORMAL state, not an error: callers get ok:false,
     reason:"no-key" so the UI can show a friendly "connect a key" notice.
   - Honesty is enforced in the prompt AND in the fact sheet we send: the only
     product facts that ever leave this process are the name, collection tier,
     retail price and size range from src/data/live-catalog.json. Wholesale
     cost, margins, supplier SKUs and any invented fabric/construction claim are
     deliberately never passed to the model, so it cannot repeat them.
   Nothing here is imported by client code; the key stays server-side. */
import LIVE_CATALOG from "../data/live-catalog.json";

export type MarketingKind = "caption" | "ad" | "email" | "blurb";
export type MarketingCollection = "everyday" | "lace" | "luxe";

export type CopyResult =
  | { ok: true; kind: MarketingKind; items: string[] }
  | { ok: false; reason: "no-key" }
  | { ok: false; reason: "error"; message: string };

const KINDS: MarketingKind[] = ["caption", "ad", "email", "blurb"];
const COLLECTIONS: MarketingCollection[] = ["everyday", "lace", "luxe"];

export const MAX_COUNT = 4;
export const MAX_TOKENS = 500;

/* The catalog's own tier labels. "Everyday" is also the site's word for the
   accessible tier; "Lace & Spice" and "Luxe" match the storefront filters. */
const TIER_NAME: Record<MarketingCollection, string> = {
  everyday: "Everyday",
  lace: "Lace & Spice",
  luxe: "Luxe",
};

const TIER_NOTE: Record<MarketingCollection, string> = {
  everyday:
    "the accessible everyday-comfort tier: bras, briefs and bralettes at easy prices",
  lace: "the mid-range lace-and-spice tier: statement lace and strappy date-night pieces",
  luxe: "the premium luxe tier: the highest price points in the store",
};

type CatalogProduct = {
  id: string;
  name: string;
  collection: string;
  retail: number;
  sizes: string;
};

const CATALOG = LIVE_CATALOG as unknown as CatalogProduct[];

export function catalogProduct(id: string): CatalogProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}

/* Public (safe) shape for the picker in the Marketing Studio UI. */
export function catalogList(): { id: string; name: string; collection: string }[] {
  return CATALOG.map((p) => ({
    id: p.id,
    name: p.name,
    collection: p.collection,
  }));
}

/* Trim the long supplier titles to a tasteful length at a word boundary. */
function shortName(name: string, max = 70): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 40 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

const SYSTEM_PROMPT = `You write marketing copy for Ember & Lace, a size-inclusive lingerie and everyday-essentials store (sizes XS–4X, bras 30A–44H+; tiers: Everyday, Lace & Spice, Luxe).

BRAND VOICE
- Warm, confident, grown-up. Welcoming to every body and every size — never "flattering", "slimming", "hides your flaws" or any shame-based angle.
- Tasteful and confident, not vulgar or explicit. Suggestive mood is fine; graphic sexual language is not.
- Plain, concrete English. No corporate filler, no hype stacks, no emoji spam.

HARD RULES — a draft that breaks any of these is a failed draft:
1. Never name or imply a fabric, material, composition or construction detail that is not in the FACTS you are given (no "silk", "satin", "lace", "cotton", "wire-free", "hand-finished", "seamless" unless the facts say so).
2. Never mention or hint at wholesale cost, supplier cost, margins or markup. Never invent a discount, coupon, sale price or price comparison. Only the retail price in FACTS may be stated, and only if you quote it exactly.
3. No manufactured urgency or pressure: no "only 3 left", "act now", "final notice", "last chance", "before it's gone", "limited time", no fake deadlines or scarcity.
4. No unverifiable claims: no "best-selling", "award-winning", "clinically proven", "#1", "rated 5 stars", no shipping-time or return promises that are not in the facts.
5. Never invent sizes, colors, model names or product features. If a fact isn't given, don't write it.
6. No medical, body-transformation, weight-loss or sexual-performance claims.

Only use the FACTS block. If it is thin, write copy that is warm and atmospheric rather than specific.`;

type Brief = {
  product?: CatalogProduct;
  collection: MarketingCollection;
};

function factSheet(brief: Brief): string {
  const tier = TIER_NAME[brief.collection];
  const lines = [
    `STORE: Ember & Lace — size-inclusive lingerie & everyday essentials (XS–4X, bras 30A–44H+), discreet US shipping.`,
    `COLLECTION TIER: ${tier} — ${TIER_NOTE[brief.collection]}.`,
  ];
  if (brief.product) {
    lines.push(
      `PRODUCT NAME: ${brief.product.name}`,
      `RETAIL PRICE: $${brief.product.retail} USD`,
      `AVAILABLE SIZES: ${brief.product.sizes}`,
      `(No other product facts are available — do not add any.)`,
    );
  } else {
    lines.push(
      `PRODUCT: a collection-level draft — no single product. Keep it about the tier as a whole.`,
      `(No specific product facts are available — do not invent any.)`,
      `SIZE RANGE ACROSS THE STORE: XS–4X and bras 30A–44H+.`,
    );
  }
  return lines.join("\n");
}

function taskFor(kind: MarketingKind, count: number, brief: Brief): string {
  const subject = brief.product
    ? `the product "${shortName(brief.product.name)}" (${TIER_NAME[brief.collection]})`
    : `the ${TIER_NAME[brief.collection]} collection as a whole`;
  const stop =
    count > 1
      ? `Write ${count} clearly different options, separated by a line containing only --- (three dashes). No numbering, no labels, no preamble, no closing remarks.`
      : `Write exactly one option. No numbering, labels, preamble or closing remarks.`;
  switch (kind) {
    case "caption":
      return `TASK: social captions for ${subject}.
Each option: one or two short sentences (under 240 characters) written for Instagram/Facebook, then on a new line 2–4 relevant hashtags (lowercase, no #-spam).
${stop}`;
    case "ad":
      return `TASK: paid-ad copy for ${subject}.
Each option, exactly three lines:
Line 1 — a short headline (under 60 characters).
Line 2 — one or two sentences of body copy.
Line 3 — a call to action starting with "CTA: ".
${stop}`;
    case "email":
      return `TASK: a welcome email draft for ${subject} for someone who just joined the early-access list.
Each option, exactly this shape:
Line 1 — "Subject: " followed by a subject line under 70 characters.
Then a blank line.
Then two or three warm sentences of body copy welcoming them to early access and referencing ${subject}. Sign off as "— The Ember & Lace team".
${stop}`;
    case "blurb":
      return `TASK: a product blurb for ${subject}, to sit in the quick-view panel next to the photos.
Each option: one or two sentences, under 220 characters, evocative but strictly factual.
${stop}`;
  }
}

/* ---------- provider calls ---------- */

type Provider = { name: "anthropic" | "openai"; key: string; model: string };

function pickProvider(): Provider | undefined {
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) {
    return {
      name: "anthropic",
      key: anthropic,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      name: "openai",
      key: openai,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  return undefined;
}

class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callAnthropic(
  provider: Provider,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: MAX_TOKENS,
      temperature: 0.9,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new ProviderError(res.status, `anthropic ${res.status}`);
  }
  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  return (data.content ?? [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

async function callOpenAI(
  provider: Provider,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: MAX_TOKENS,
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new ProviderError(res.status, `openai ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/* ---------- response parsing ---------- */

const MAX_ITEM_LEN = 900;
const MAX_ITEMS = MAX_COUNT;

/* One returned item: drop code fences, "1."/"*"/"--" lead-ins and stray
   wrapping quotes, collapse runaway blank lines. */
function cleanItem(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  s = s.replace(/^(?:option\s*\d+\s*[:.-]\s*)/i, "");
  s = s.replace(/^(?:\d{1,2}\s*[.)]\s+|[*•·]\s+|-\s+)/, "");
  if (
    s.length > 1 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("“") && s.endsWith("”")))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > MAX_ITEM_LEN) {
    s = s.slice(0, MAX_ITEM_LEN).trimEnd() + "…";
  }
  return s;
}

export function splitItems(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const parts = cleaned.includes("---")
    ? cleaned.split(/^[ \t]*_{0,3}-{3,}_{0,3}[ \t]*$/m)
    : [cleaned];
  const items: string[] = [];
  for (const part of parts) {
    const item = cleanItem(part);
    if (item) items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  if (items.length === 0) {
    const whole = cleanItem(cleaned);
    if (whole) items.push(whole);
  }
  return items;
}

function messageFor(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.status === 401 || err.status === 403) {
      return "The copy provider rejected the API key — check ANTHROPIC_API_KEY (or OPENAI_API_KEY) in Settings → Secrets.";
    }
    if (err.status === 429) {
      return "The copy provider is rate-limiting right now — try again in a moment.";
    }
    return `The copy provider returned an error (HTTP ${err.status}). Try again.`;
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return "The copy provider took too long to answer — try again.";
  }
  return "Drafting failed — try again.";
}

/* ---------- entry point ---------- */

export type CopyRequest = {
  kind?: unknown;
  productId?: unknown;
  collection?: unknown;
  count?: unknown;
};

export async function generateCopy(body: CopyRequest): Promise<CopyResult> {
  const kind = KINDS.includes(body.kind as MarketingKind)
    ? (body.kind as MarketingKind)
    : "caption";
  const rawCount = Number(body.count);
  const count =
    Number.isFinite(rawCount) && rawCount >= 1
      ? Math.min(Math.floor(rawCount), MAX_COUNT)
      : 1;

  const productId =
    typeof body.productId === "string" && body.productId.trim()
      ? body.productId.trim()
      : undefined;
  const product = productId ? catalogProduct(productId) : undefined;

  const fromBody = COLLECTIONS.includes(body.collection as MarketingCollection)
    ? (body.collection as MarketingCollection)
    : undefined;
  const collection: MarketingCollection =
    fromBody ??
    (product && COLLECTIONS.includes(product.collection as MarketingCollection)
      ? (product.collection as MarketingCollection)
      : "everyday");

  /* An unknown productId is not fatal — fall back to a collection draft
     rather than making the owner debug a 400. */
  const brief: Brief = { product, collection };

  const provider = pickProvider();
  if (!provider) {
    return { ok: false, reason: "no-key" };
  }

  const user = `FACTS\n${factSheet(brief)}\n\n${taskFor(kind, count, brief)}`;

  try {
    const text =
      provider.name === "anthropic"
        ? await callAnthropic(provider, SYSTEM_PROMPT, user)
        : await callOpenAI(provider, SYSTEM_PROMPT, user);
    const items = splitItems(text);
    if (items.length === 0) {
      return {
        ok: false,
        reason: "error",
        message: "The copy provider returned an empty draft — try again.",
      };
    }
    return { ok: true, kind, items };
  } catch (err) {
    const message = messageFor(err);
    /* Server-side log only: provider status, never the key. */
    console.error("[ai-marketing] provider call failed:", message, err);
    return { ok: false, reason: "error", message };
  }
}
