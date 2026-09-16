import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import LIVE_CATALOG from "../data/live-catalog.json";
/* /marketing — Marketing Studio.
   Owner-facing drafting tool: pick a real catalog product (or a whole tier),
   pick a format, and generate on-brand copy. All drafting happens server-side
   in src/routes/api/ai-marketing.ts, which reads the provider key from the
   environment — the browser never sees it.
   With no key configured the page still works: it shows a "connect a key"
   notice instead of an error. Nothing here is ever auto-published; every card
   is a draft for the owner to review. */
type Collection = "everyday" | "lace" | "luxe";
type Kind = "caption" | "ad" | "email" | "blurb";

const TIER_LABEL: Record<Collection, string> = {
  everyday: "Everyday",
  lace: "Lace & Spice",
  luxe: "Luxe",
};
const TIER_ORDER: Collection[] = ["everyday", "lace", "luxe"];

const KINDS: { value: Kind; label: string }[] = [
  { value: "caption", label: "Social caption" },
  { value: "ad", label: "Ad copy" },
  { value: "email", label: "Email draft" },
  { value: "blurb", label: "Product blurb" },
];

type CatalogItem = {
  id: string;
  name: string;
  collection: Collection;
  retail: number;
  sizes: string;
};
const CATALOG = LIVE_CATALOG as unknown as CatalogItem[];

function shortName(name: string, max = 64): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 30 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "items"; items: string[]; kind: Kind }
  | { phase: "nokey" }
  | { phase: "error"; message: string };

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Studio — Ember & Lace" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MarketingStudio,
});

function MarketingStudio() {
  const [productId, setProductId] = useState("");
  const [collection, setCollection] = useState<Collection>("everyday");
  const [kind, setKind] = useState<Kind>("caption");
  const [count, setCount] = useState(2);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [copied, setCopied] = useState<number | null>(null);

  const grouping = TIER_ORDER.map((tier) => ({
    tier,
    items: CATALOG.filter((p) => p.collection === tier),
  })).filter((g) => g.items.length > 0);

  async function generate() {
    setState({ phase: "loading" });
    setCopied(null);
    try {
      const res = await fetch("/api/ai-marketing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          productId: productId || undefined,
          collection,
          count: kind === "email" ? 1 : count,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: Kind; items: string[] }
        | { ok: false; reason?: string; message?: string };
      if (data.ok) {
        setState({ phase: "items", items: data.items, kind: data.kind });
      } else if (data.reason === "no-key") {
        setState({ phase: "nokey" });
      } else {
        setState({
          phase: "error",
          message: data.message || "Drafting failed — try again.",
        });
      }
    } catch {
      setState({
        phase: "error",
        message: "Could not reach the drafting service — check your connection and try again.",
      });
    }
  }

  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
    } catch {
      /* Clipboard blocked (insecure context / permissions): select the text so
         the owner can copy it by hand. */
      const el = document.getElementById(`draft-${index}`) as
        | HTMLTextAreaElement
        | null;
      if (el) {
        el.focus();
        el.select();
        try {
          document.execCommand("copy");
          setCopied(index);
        } catch {
          setCopied(null);
        }
      }
    }
  }

  const selected = CATALOG.find((p) => p.id === productId);

  return (
    <div className="min-h-screen bg-noir">
      <header className="border-b border-gold/25 bg-noir/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href="/"
            className="font-display flex items-center gap-2 text-xl tracking-wide text-ivory"
          >
            <img
              src="/rose.svg"
              alt="Ember and Lace red rose logo"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            Ember <span className="text-gold">&amp;</span> Lace
          </a>
          <a
            href="/"
            className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10"
          >
            ← Back to store
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          In-house tool
        </p>
        <h1 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
          Marketing <span className="text-goldlight italic">Studio</span>
        </h1>
        <p className="mt-2 text-sm text-rosetaupe">
          Draft copy — always review before posting.
        </p>

        <section className="mt-8 rounded-2xl border border-gold/25 bg-card/60 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ivory">Product</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="rounded-lg border border-gold/30 bg-noir px-3 py-2 text-ivory focus:border-goldlight focus:ring-2 focus:ring-gold/40 focus:outline-none"
              >
                <option value="">Any (collection-level draft)</option>
                {grouping.map((g) => (
                  <optgroup key={g.tier} label={TIER_LABEL[g.tier]}>
                    {g.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {shortName(p.name)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ivory">Collection</span>
              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value as Collection)}
                className="rounded-lg border border-gold/30 bg-noir px-3 py-2 text-ivory focus:border-goldlight focus:ring-2 focus:ring-gold/40 focus:outline-none"
              >
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <span className="text-xs text-rosetaupe/80">
                {selected
                  ? `Using “${TIER_LABEL[selected.collection]}” from the selected product.`
                  : "Used when no single product is selected."}
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ivory">Format</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="rounded-lg border border-gold/30 bg-noir px-3 py-2 text-ivory focus:border-goldlight focus:ring-2 focus:ring-gold/40 focus:outline-none"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ivory">How many</span>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={kind === "email"}
                className="rounded-lg border border-gold/30 bg-noir px-3 py-2 text-ivory focus:border-goldlight focus:ring-2 focus:ring-gold/40 focus:outline-none disabled:opacity-50"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={state.phase === "loading"}
            className="mt-6 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow transition hover:bg-goldlight disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {state.phase === "loading" ? "Drafting…" : "Generate copy"}
          </button>
          {selected && (
            <p className="mt-3 text-xs text-rosetaupe/80">
              Drafting for: {shortName(selected.name, 90)} · $
              {Math.round(selected.retail)} · sizes {selected.sizes}
            </p>
          )}
        </section>

        <section className="mt-8">
          {state.phase === "idle" && (
            <p className="rounded-2xl border border-gold/20 border-dashed bg-noir/40 p-6 text-center text-sm text-rosetaupe">
              Choose a product and a format, then hit Generate.
            </p>
          )}

          {state.phase === "loading" && (
            <p className="rounded-2xl border border-gold/20 bg-noir/40 p-6 text-center text-sm text-rosetaupe">
              Writing a fresh draft…
            </p>
          )}

          {state.phase === "nokey" && (
            <div className="rounded-2xl border border-gold/40 bg-card/60 p-5 sm:p-6">
              <h2 className="font-display text-xl text-goldlight">
                Connect an API key to enable AI copy
              </h2>
              <p className="mt-2 text-sm text-ivory/90">
                Add <code className="text-goldlight">ANTHROPIC_API_KEY</code> (or{" "}
                <code className="text-goldlight">OPENAI_API_KEY</code>) in
                Settings → Secrets. Nothing else is needed — the key is read on
                the server, so it never needs to be shared with anyone else, and
                it is never sent to the browser.
              </p>
              <p className="mt-3 text-xs text-rosetaupe/90">
                Until then the store keeps working exactly as it does now; this
                studio just can&apos;t draft.
              </p>
            </div>
          )}

          {state.phase === "error" && (
            <div className="rounded-2xl border border-crimson/50 bg-card/60 p-5 sm:p-6">
              <h2 className="font-display text-xl text-ivory">
                That draft didn&apos;t come through
              </h2>
              <p className="mt-2 text-sm text-ivory/90">{state.message}</p>
            </div>
          )}

          {state.phase === "items" && (
            <div className="space-y-4">
              {state.items.map((item, i) => (
                <article
                  key={i}
                  className="rounded-2xl border border-gold/25 bg-card/60 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold tracking-[0.15em] text-gold uppercase">
                      Draft {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(item, i)}
                      className="rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10"
                    >
                      {copied === i ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <textarea
                    id={`draft-${i}`}
                    readOnly
                    value={item}
                    rows={Math.min(12, item.split("\n").length + 1)}
                    className="mt-3 w-full resize-y rounded-lg border border-gold/20 bg-noir px-3 py-2 text-sm leading-relaxed text-ivory focus:border-goldlight focus:outline-none"
                  />
                </article>
              ))}
              <p className="text-xs text-rosetaupe/80">
                Draft copy — review for accuracy and voice before posting.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
