import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

import CHECKOUT_LINKS from "../data/checkout-links.json";
import LIVE_CATALOG from "../data/live-catalog.json";
import type { Collection } from "../data/products";
import {
  BULK_THRESHOLD,
  cartDiscount,
  cartSubtotal,
  cartTotal,
  money,
  moneyExact,
} from "../lib/cart";
import type { CartLine } from "../lib/cart-store";
import {
  addToCart,
  clearCart,
  lineKey,
  removeLine,
  setCartOpen,
  setCheckoutOpen,
  setLineQty,
  useCart,
  useCartOpen,
  useCheckoutOpen,
} from "../lib/cart-store";

const LIVE_CHECKOUT_URL = "https://buy.stripe.com/6oU00j06k6Pc3GS8tZ4Vy07";

/* Live CJ catalog: 50 real products (id, name, wholesale, retail, image,
   sizes, usWarehouse, cjPid, cjSku). Wholesale/margin never render. */
type LiveProduct = {
  id: string;
  name: string;
  wholesale: number;
  retail: number;
  image: string;
  sizes: string;
  collection: Collection;
  cjPid: string;
  cjSku: string;
  usWarehouse: boolean;
  variants?: { size: string; variantKey: string; vid: string; variantSku: string }[];
};

const CATALOG = LIVE_CATALOG as unknown as LiveProduct[];

/* Checkout links map: { cjId: Stripe paymentUrl }. The lead fills in more
   URLs over time — code reads the map at build, no code change per link. */
const LINKS: Record<string, string> = CHECKOUT_LINKS;

/* Trim absurdly-long supplier names to a tasteful length at a word boundary. */
function trimName(name: string, max = 72): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function tagFor(p: LiveProduct): string {
  return p.collection === "luxe"
    ? "Luxe"
    : p.collection === "lace"
      ? "Lace & Spice"
      : "Everyday";
}

const COLLECTIONS = [
  {
    title: "Everyday Essentials",
    blurb:
      "Buttery-soft bras, briefs, and bralettes you'll reach for on repeat. Breathable, wire-free options included.",
    cta: "Shop everyday comfort",
    gradient: "linear-gradient(150deg,#0f1f1a 0%,#2f5d50 70%,#c9a24b 160%)",
    icon: "◍",
    image:
      "https://cf.cjdropshipping.com/174fdc27-8357-436d-9cf4-69befc3a33a0.png",
    alt: "Everyday wireless bra in nude tones",
  },
  {
    title: "Lace & Spice",
    blurb:
      "Statement lace, strappy details, and date-night pieces — designed to celebrate, never to squeeze. Mid-range prices, maximum mood.",
    cta: "Turn up the heat",
    gradient: "linear-gradient(150deg,#2a0f18 0%,#a31621 65%,#4a0d14 100%)",
    icon: "✦",
    image:
      "https://cf.cjdropshipping.com/81b59fb0-5503-4b49-92d0-24769e0b6b84.png",
    alt: "Black lace bodysuit with floral detailing",
  },
  {
    title: "The Luxe Collection",
    blurb:
      "Pure silk, couture lace, and hand-finished details — heirloom pieces made to be treasured, from $128.",
    cta: "Indulge in luxe",
    gradient:
      "linear-gradient(150deg,#100b0e 0%,#7f1d2d 55%,#c9a24b 150%)",
    icon: "◆",
    image:
      "https://cf.cjdropshipping.com/5652c8a1-ce01-4f5f-98bb-cc2db381441f.jpg",
    alt: "Luxe satin and lace robe in deep romantic tones",
  },
  {
    title: "All Sizes · Fit Promise",
    blurb:
      "Every style in XS–4X and bras 30A–44H+. Free fit help, easy exchanges, and honest size charts.",
    cta: "Find your fit",
    gradient: "linear-gradient(150deg,#1c0f22 0%,#5b2a6e 70%,#c9a24b 170%)",
    icon: "♡",
  },
];

const FIT_POINTS = [
  {
    title: "Free fit help",
    text: "Real humans, real answers — get fitted over chat or email before you buy.",
    icon: "✉",
  },
  {
    title: "Truly size-inclusive",
    text: "XS–4X and bras 30A–44H+ from day one. No capsule, no afterthought.",
    icon: "◍",
  },
  {
    title: "Discreet shipping",
    text: "Plain, unmarked packaging on every order. Your business stays yours.",
    icon: "▣",
  },
  {
    title: "Plain-box delivery",
    text: "Every order ships in plain, unmarked packaging with tracking — typically 5–11 days to your door.",
    icon: "📦",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* --------------------------------- page ----------------------------------- */

function Home() {
  return (
    <div className="min-h-dvh bg-noir text-ivory">
      <LaunchDropBanner />
      <AnnouncementBar />
      <Nav />
      <main>
        <Hero />
        <ShareRow />
        <TrustStrip />
        <SocialProof />
        <Collections />
        <FitStrip />
        <FitGuide />
        <Bestsellers />
        <ConfidenceFaq />
        <EmailCapture />
        <TrackOrder />
      </main>
      <Footer />
      <CartDrawer />
      <CheckoutModal />
    </div>
  );
}

function LaunchDropBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div
      role="note"
      aria-label="Launch drop offer"
      className="flex items-center justify-center gap-3 bg-gold px-4 py-2 text-center text-[13px] font-semibold tracking-wide text-noir"
    >
      <span>
        LAUNCH DROP — first 50 orders get a free discreet-packaging upgrade ·
        10% off $250+ auto-applied
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss launch drop banner"
        className="rounded-full border border-noir/30 px-2 py-0.5 text-xs font-bold leading-none transition hover:bg-noir/10"
      >
        ✕
      </button>
    </div>
  );
}

function AnnouncementBar() {
  return (
    <div className="lace-dots bg-noir px-4 py-2 text-center text-[13px] font-medium tracking-wide text-goldlight">
      Early shoppers get 15% off launch day — join the list below ♡ · 10% off
      orders over $250, applied at checkout
    </div>
  );
}

function Nav() {
  const lines = useCart();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const [navQuery, setNavQuery] = useState("");
  const submitNavSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = navQuery.trim();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("el:search", { detail: q }));
      document
        .getElementById("bestsellers")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return (
    <header className="sticky top-0 z-20 border-b border-gold/25 bg-noir/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#top"
          className="font-display flex items-center gap-2 text-xl tracking-wide text-ivory sm:text-2xl"
        >
          <img
            src="/rose.svg"
            alt="Ember and Lace red rose logo"
            width={30}
            height={30}
            className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
          />
          Ember <span className="text-gold">&amp;</span> Lace
        </a>
        <form
          onSubmit={submitNavSearch}
          role="search"
          aria-label="Site search"
          className="order-3 flex w-full min-w-0 items-center gap-1.5 sm:order-2 sm:w-auto sm:flex-1 sm:max-w-xs"
        >
          <label htmlFor="nav-search" className="sr-only">
            Search styles
          </label>
          <input
            id="nav-search"
            type="search"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Search lace, silk, bras…"
            className="min-w-0 flex-1 rounded-full border border-gold/30 bg-noir px-4 py-1.5 text-sm text-ivory placeholder:text-rosetaupe/60 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="shrink-0 rounded-full border border-gold/50 px-3 py-1.5 text-sm font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10"
          >
            🔍
          </button>
        </form>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ivory/85 md:flex">
          <a href="#collections" className="transition hover:text-goldlight">
            Collections
          </a>
          <a href="#fit" className="transition hover:text-goldlight">
            Fit Promise
          </a>
          <a href="#fit-guide" className="transition hover:text-goldlight">
            Fit Guide
          </a>
          <a href="#bestsellers" className="transition hover:text-goldlight">
            Bestsellers
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:order-3">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${count} items`}
            className="relative rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10"
          >
            🛍 Cart{count > 0 ? ` (${count})` : ""}
          </button>
          <a
            href="#join"
            className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-noir shadow transition hover:bg-goldlight"
          >
            Get 15% off
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="lace-dots relative overflow-hidden bg-noir text-ivory"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 85% -10%, rgba(163,22,33,.45), transparent 60%), radial-gradient(40rem 24rem at 10% 110%, rgba(201,162,75,.18), transparent 60%), linear-gradient(180deg, rgba(44,20,28,.5), transparent 55%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-goldlight uppercase">
            ● Size-inclusive from day one
          </p>
          <h1 className="font-display flex items-center gap-3 text-4xl leading-[1.05] text-ivory sm:text-6xl">
            <img
              src="/rose.svg"
              alt=""
              aria-hidden
              width={52}
              height={52}
              className="h-11 w-11 shrink-0 sm:h-14 sm:w-14"
            />
            Ember <span className="text-gold">&amp;</span> Lace
          </h1>
          <p className="font-display mt-3 text-xl text-goldlight italic sm:text-2xl">
            From soft Sunday mornings to full-spice Saturday nights.
          </p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ivory/85 sm:text-base">
            Lingerie and everyday essentials designed for real bodies —{" "}
            <strong className="font-semibold text-ivory">
              XS–4X and bras 30A–44H+
            </strong>
            . Buttery comfort for every day, beautiful lace for every mood, and
            a fit that celebrates you exactly as you are.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-rosetaupe">
            Every woman finds her fit and her price here — easy everyday
            essentials from $18 to heirloom luxe silk and lace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#bestsellers"
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight"
            >
              Shop Bestsellers
            </a>
            <a
              href="#fit-guide"
              className="rounded-full border border-gold/50 px-6 py-3 text-sm font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10"
            >
              Find Your Fit
            </a>
          </div>
          <p className="mt-5 text-xs tracking-wide text-rosetaupe">
            ♡ Body-positive · Wire-free options · Discreet, unmarked packaging ·
            📦 Ships in plain, unmarked packaging
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden>
          {[
            { label: "Everyday", style: "linear-gradient(150deg,#0f1f1a,#2f5d50)" },
            { label: "Lace", style: "linear-gradient(150deg,#1c0f22,#5b2a6e)" },
            { label: "Spice", style: "linear-gradient(150deg,#2a0f18,#a31621)" },
            { label: "XS–4X", style: "linear-gradient(150deg,#100b0e,#6b551f 130%)" },
          ].map((t) => (
            <div
              key={t.label}
              className="lace-dots flex aspect-[3/4] items-end rounded-2xl p-4 shadow-xl ring-1 ring-gold/40"
              style={{ background: t.style }}
            >
              <span className="font-display text-lg text-ivory italic">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ share row ----------------------------------- */

const STORE_URL = "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app";
const SHARE_TEXT = "Ember & Lace — size-inclusive lingerie XS-4X, bras 30A-44H+";
const BRA_AD_URL =
  "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app#bestsellers?utm_source=share&utm_medium=referral&utm_campaign=bra19";

function ShareRow() {
  const [copied, setCopied] = useState(false);
  const [braCopied, setBraCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(STORE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const copyBraAdLink = async () => {
    try {
      await navigator.clipboard.writeText(BRA_AD_URL);
      setBraCopied(true);
      setTimeout(() => setBraCopied(false), 2000);
    } catch {
      setBraCopied(false);
    }
  };
  const btn =
    "rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold text-goldlight transition hover:border-goldlight hover:bg-gold/10";
  return (
    <div className="border-b border-gold/20 bg-noir">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-4 sm:px-6">
        <span className="mr-1 text-xs font-semibold tracking-[0.18em] text-rosetaupe uppercase">
          Share the drop
        </span>
        <button type="button" onClick={copyLink} className={btn} aria-live="polite">
          {copied ? "✓ Link copied" : "⧉ Copy Link"}
        </button>
        <button
          type="button"
          onClick={copyBraAdLink}
          className={btn}
          aria-live="polite"
          title="Copy a referral link to our bestselling bras"
        >
          {braCopied ? "✓ Bra ad link copied" : "⧉ Copy $19 bra ad link"}
        </button>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(STORE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          Share on X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(STORE_URL)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          Share on Facebook
        </a>
        <a
          href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(STORE_URL)}&description=${encodeURIComponent(SHARE_TEXT)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          Share on Pinterest
        </a>
      </div>
    </div>
  );
}

/* ------------------------------ trust strip --------------------------------- */
function TrustStrip() {
  const items = [
    "🔒 Secure Stripe checkout",
    "📦 Discreet plain-box packaging",
    "↩ 60-day exchanges",
    "🔍 Track your order by ref",
  ];
  return (
    <div className="border-b border-gold/20 bg-noir">
      <ul
        aria-label="Checkout trust"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 py-3 text-xs font-semibold text-gold sm:px-6 sm:text-[13px]"
      >
        {items.map((t) => (
          <li key={t} className="whitespace-nowrap">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
/* ------------------------------ social proof -------------------------------- */

const FIT_COUNT_KEY = "el-fit-finds";
const FIT_BASE = 1200;

function readFitFinds(): number {
  try {
    const n = parseInt(localStorage.getItem(FIT_COUNT_KEY) ?? "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

const TESTER_NOTES = [
  {
    quote:
      "The Fit Finder put me in a 36DD and it actually fit — first time I've ordered bras online without tears.",
    name: "Maya",
    detail: "Early fit-tester · wears 36DD",
  },
  {
    quote:
      "Soft waistband, no digging, and the plain box meant my roommates had no clue what arrived.",
    name: "Jess",
    detail: "Early fit-tester · wears 2X",
  },
  {
    quote:
      "I live between sizes and the sister-size tip saved me. One free exchange and it was sorted.",
    name: "Priya",
    detail: "Early fit-tester · wears 34G",
  },
];

function TrustBadges({ className = "" }: { className?: string }) {
  const badges = [
    { icon: "📦", label: "Ships in plain, unmarked packaging" },
    { icon: "▣", label: "Discreet plain-box shipping" },
    { icon: "♡", label: "Free 60-day exchanges" },
    { icon: "🔒", label: "Secure Stripe checkout" },
  ];
  return (
    <ul
      aria-label="Shop with confidence"
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {badges.map((b) => (
        <li
          key={b.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-noir/60 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ivory/90"
        >
          <span aria-hidden className="text-goldlight">
            {b.icon}
          </span>
          {b.label}
        </li>
      ))}
    </ul>
  );
}

function SocialProof() {
  const [total, setTotal] = useState(FIT_BASE);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const sync = () => setTotal(FIT_BASE + readFitFinds());
    sync();
    window.addEventListener("el:fit-found", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("el:fit-found", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(total * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <section
      aria-label="Fit tester notes and community fits"
      className="border-b border-gold/20 bg-noir"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-gold/25 bg-card">
          <div className="lace-dots px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-center text-xs font-bold tracking-[0.22em] text-gold uppercase">
              Fit tester notes
            </p>
            <p
              aria-label="Rated 5 out of 5 stars"
              className="mt-2 text-center text-lg tracking-[0.25em] text-gold"
            >
              ★★★★★
            </p>
            <h2 className="font-display mt-2 text-center text-2xl text-ivory sm:text-3xl">
              Real fits, from our early fit-testers
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-rosetaupe">
              Honest notes from our early fit panel — not paid reviews, not
              customers (yet). Just real bodies testing our size range.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {TESTER_NOTES.map((t) => (
                <figure
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-gold/20 bg-noir/60 p-5"
                >
                  <p aria-hidden className="text-sm tracking-[0.2em] text-gold">
                    ★★★★★
                  </p>
                  <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-ivory/90">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-3 text-xs font-semibold text-goldlight">
                    {t.name}{" "}
                    <span className="font-normal text-rosetaupe">
                      — {t.detail}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p
                aria-live="polite"
                className="font-display text-4xl text-goldlight tabular-nums sm:text-5xl"
              >
                {shown.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-sm font-semibold text-ivory">
                shoppers fitted so far
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-rosetaupe">
                Community counter — starts at 1,200 early community fits, plus
                every Fit Finder result completed in this browser.
              </p>
              <a
                href="#fit-guide"
                className="mt-5 inline-block rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight"
              >
                Take the fit quiz →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Collections() {
  return (
    <section id="collections" className="scroll-mt-20 bg-coal">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">
          Collections
        </p>
        <h2 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
          Comfort to spice, every body welcome
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-rosetaupe">
          Four ways to shop — easy everyday staples from $18, mid-range
          statement lace, heirloom luxe silk, or get fitted first. Every piece
          is cut for real curves, soft bellies, and all the in-betweens, at a
          price that fits you too.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <article
              key={c.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-crimson/20"
            >
              <div
                className="lace-dots relative flex h-44 items-center justify-center overflow-hidden ring-1 ring-inset ring-gold/25"
                style={{ background: c.gradient }}
              >
                <span className="font-display text-4xl text-ivory/95">
                  {c.icon}
                </span>
                {"image" in c && c.image ? (
                  <img
                    src={(c as { image: string }).image}
                    alt={
                      "alt" in c && typeof c.alt === "string"
                        ? (c.alt as string)
                        : c.title
                    }
                    loading="lazy"
                    className="absolute inset-0 h-44 w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-xl text-ivory">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-rosetaupe">
                  {c.blurb}
                </p>
                <a
                  href="#bestsellers"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold transition group-hover:gap-2 hover:text-goldlight"
                >
                  {c.cta} →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FitStrip() {
  return (
    <section
      id="fit"
      className="scroll-mt-20 border-y border-gold/20 bg-noir"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-center text-2xl text-ivory sm:text-3xl">
          Our fit promise
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-rosetaupe">
          Shopping lingerie online should feel exciting, not stressful. Here is
          how we take care of you.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIT_POINTS.map((f) => (
            <div
              key={f.title}
              className="lace-dots rounded-2xl border border-gold/20 bg-card p-5 text-center shadow-sm"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-xl text-goldlight">
                {f.icon}
              </div>
              <h3 className="mt-3 font-semibold text-ivory">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-rosetaupe">
                {f.text}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm font-medium text-ivory/85">
          Bras <strong className="text-goldlight">30A–44H+</strong> · Bottoms
          &amp; apparel <strong className="text-goldlight">XS–4X</strong> ·
          Free exchanges within 60 days
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- fit guide -------------------------------- */

const BAND_ROWS = [
  { band: "30", underbust: "27–29" },
  { band: "32", underbust: "29–31" },
  { band: "34", underbust: "31–33" },
  { band: "36", underbust: "33–35" },
  { band: "38", underbust: "35–37" },
  { band: "40", underbust: "37–39" },
  { band: "42", underbust: "39–41" },
  { band: "44", underbust: "41–43" },
];

const CUP_ROWS = [
  { cup: "A", diff: "1″" },
  { cup: "B", diff: "2″" },
  { cup: "C", diff: "3″" },
  { cup: "D", diff: "4″" },
  { cup: "DD / E", diff: "5″" },
  { cup: "DDD / F", diff: "6″" },
  { cup: "G", diff: "7″" },
  { cup: "H", diff: "8″" },
  { cup: "H+", diff: "9″ and up" },
];

const BRIEF_ROWS = [
  { size: "XS", waist: "24–26", hip: "34–36" },
  { size: "S", waist: "26–28", hip: "36–38" },
  { size: "M", waist: "28–30", hip: "38–40" },
  { size: "L", waist: "30–33", hip: "40–43" },
  { size: "XL", waist: "33–36", hip: "43–46" },
  { size: "2X", waist: "36–39", hip: "46–49" },
  { size: "3X", waist: "39–42", hip: "49–52" },
  { size: "4X", waist: "42–45", hip: "52–55" },
];

const TOP_SIZES = ["XS", "S", "M", "L", "XL", "2X", "3X", "4X"] as const;
const CUP_ORDER = ["A", "B", "C", "D", "DD", "DDD", "G", "H", "H+"] as const;

function FitGuide() {
  return (
    <section id="fit-guide" className="scroll-mt-20 bg-noir">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">
          Fit guide
        </p>
        <h2 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
          Find your fit, love your fit
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-rosetaupe">
          Every Ember &amp; Lace style runs XS–4X with bras 30A–44H+. Start with
          the charts, or let our beta Fit Finder do the math for you.
        </p>

        <SizeCharts />
        <FitFinder />
      </div>
    </section>
  );
}

function chartTableClass() {
  return "w-full border-collapse text-sm";
}

function SizeCharts() {
  return (
    <div className="mt-10">
      <h3 className="font-display text-2xl text-ivory">Regular size chart</h3>
      <p className="mt-1 text-sm text-rosetaupe">
        All measurements in inches. Tape snug, not tight — and breathe.
      </p>

      {/* How to measure */}
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            n: "1",
            title: "Underbust",
            text: "Wrap the tape right under your bust, level all around. This sets your band.",
          },
          {
            n: "2",
            title: "Overbust",
            text: "Wrap around the fullest part of your bust, wearing a soft unpadded bra.",
          },
          {
            n: "3",
            title: "Waist & hips",
            text: "Waist at the narrowest point, hips at the fullest — for briefs and slips.",
          },
        ].map((s) => (
          <li
            key={s.n}
            className="lace-dots rounded-2xl border border-gold/20 bg-card p-5"
          >
            <p className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-goldlight">
              {s.n}
            </p>
            <h4 className="mt-3 font-semibold text-ivory">
              {s.title} — how to measure
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-rosetaupe">
              {s.text}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* Band table */}
        <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card">
          <h4 className="border-b border-gold/15 px-5 py-3 text-sm font-bold tracking-wide text-goldlight uppercase">
            Bra bands · underbust
          </h4>
          <div className="overflow-x-auto">
            <table className={chartTableClass()}>
              <thead>
                <tr className="text-left text-xs tracking-wide text-rosetaupe uppercase">
                  <th className="px-5 py-2.5 font-semibold">Band</th>
                  <th className="px-5 py-2.5 font-semibold">Underbust (in)</th>
                </tr>
              </thead>
              <tbody>
                {BAND_ROWS.map((r) => (
                  <tr key={r.band} className="border-t border-gold/10">
                    <td className="px-5 py-2 font-semibold text-ivory">
                      {r.band}
                    </td>
                    <td className="px-5 py-2 text-ivory/85">{r.underbust}″</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cup table */}
        <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card">
          <h4 className="border-b border-gold/15 px-5 py-3 text-sm font-bold tracking-wide text-goldlight uppercase">
            Cups · overbust minus underbust
          </h4>
          <div className="overflow-x-auto">
            <table className={chartTableClass()}>
              <thead>
                <tr className="text-left text-xs tracking-wide text-rosetaupe uppercase">
                  <th className="px-5 py-2.5 font-semibold">Cup</th>
                  <th className="px-5 py-2.5 font-semibold">Difference (in)</th>
                </tr>
              </thead>
              <tbody>
                {CUP_ROWS.map((r) => (
                  <tr key={r.cup} className="border-t border-gold/10">
                    <td className="px-5 py-2 font-semibold text-ivory">
                      {r.cup}
                    </td>
                    <td className="px-5 py-2 text-ivory/85">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Brief table */}
        <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card">
          <h4 className="border-b border-gold/15 px-5 py-3 text-sm font-bold tracking-wide text-goldlight uppercase">
            Briefs / panties · XS–4X
          </h4>
          <div className="overflow-x-auto">
            <table className={chartTableClass()}>
              <thead>
                <tr className="text-left text-xs tracking-wide text-rosetaupe uppercase">
                  <th className="px-5 py-2.5 font-semibold">Size</th>
                  <th className="px-5 py-2.5 font-semibold">Waist (in)</th>
                  <th className="px-5 py-2.5 font-semibold">Hip (in)</th>
                </tr>
              </thead>
              <tbody>
                {BRIEF_ROWS.map((r) => (
                  <tr key={r.size} className="border-t border-gold/10">
                    <td className="px-5 py-2 font-semibold text-ivory">
                      {r.size}
                    </td>
                    <td className="px-5 py-2 text-ivory/85">{r.waist}″</td>
                    <td className="px-5 py-2 text-ivory/85">{r.hip}″</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type FitPref = "snug" | "comfortable" | "relaxed";

function FitFinder() {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const [underbust, setUnderbust] = useState("");
  const [overbust, setOverbust] = useState("");
  const [topSize, setTopSize] =
    useState<(typeof TOP_SIZES)[number]>("M");
  const [pref, setPref] = useState<FitPref>("comfortable");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    bra: string;
    brief: string;
    sister: string;
    why: string;
    between: boolean;
  } | null>(null);

  const unitLabel = unit === "in" ? "in" : "cm";

  const compute = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const rawUnder = parseFloat(underbust);
    const rawOver = parseFloat(overbust);
    if (!Number.isFinite(rawUnder) || !Number.isFinite(rawOver)) {
      setError("Enter both your underbust and overbust to get a suggestion.");
      return;
    }
    const toIn = (v: number) => (unit === "cm" ? v / 2.54 : v);
    const underIn = toIn(rawUnder);
    const overIn = toIn(rawOver);
    if (underIn < 20 || underIn > 60 || overIn < 20 || overIn > 70) {
      setError(
        `Those numbers look off — check your ${unitLabel} values and try again.`
      );
      return;
    }
    if (overIn < underIn) {
      setError("Overbust should be larger than underbust — swap them and retry? ♡");
      return;
    }

    // Band: nearest even, adjusted by preference; min 30, max 44.
    const evenDown = Math.floor(underIn / 2) * 2;
    const evenUp = Math.ceil(underIn / 2) * 2;
    let band =
      pref === "snug"
        ? evenDown
        : pref === "relaxed"
          ? evenUp
          : Math.abs(underIn - evenDown) <= Math.abs(evenUp - underIn)
            ? evenDown
            : evenUp;
    band = Math.min(44, Math.max(30, band));

    // Cup from overbust-minus-underbust difference (matches the chart above).
    const diff = overIn - underIn;
    const cupIdx = Math.min(
      CUP_ORDER.length - 1,
      Math.max(0, Math.round(diff) - 1)
    );
    const cup = CUP_ORDER[cupIdx];
    const cupLabel =
      cup === "DD" ? "DD/E" : cup === "DDD" ? "DDD/F" : cup;

    // Sister size: up a band, down a cup (and vice versa).
    const sisBandUp = Math.min(44, band + 2);
    const sisCupDown = CUP_ORDER[Math.max(0, cupIdx - 1)];
    const sisBandDown = Math.max(30, band - 2);
    const sisCupUp = CUP_ORDER[Math.min(CUP_ORDER.length - 1, cupIdx + 1)];
    const sister =
      band >= 44
        ? `also try ${sisBandDown}${sisCupUp === "DD" ? "DD" : sisCupUp === "DDD" ? "DDD" : sisCupUp}`
        : `also try ${sisBandUp}${sisCupDown === "DD" ? "DD" : sisCupDown === "DDD" ? "DDD" : sisCupDown} if the band feels snug`;

    // Brief size: start from usual top size; relaxed goes one up.
    const idx = TOP_SIZES.indexOf(topSize);
    const brief =
      pref === "relaxed"
        ? TOP_SIZES[Math.min(TOP_SIZES.length - 1, idx + 1)]
        : TOP_SIZES[idx];

    const frac = diff - Math.floor(diff);
    const between = frac >= 0.35 && frac <= 0.65;
    const why =
      `Your underbust (~${underIn.toFixed(1)}″) rounds to a ${band} band, ` +
      `and a ~${diff.toFixed(1)}″ difference gives a ${cupLabel} cup — ` +
      `with a ${pref} fit preference and briefs from your usual ${topSize} top size.`;

    setResult({ bra: `${band}${cup}`, brief, sister, why, between });
    try {
      const prev = parseInt(localStorage.getItem(FIT_COUNT_KEY) ?? "0", 10);
      const next = (Number.isFinite(prev) && prev > 0 ? prev : 0) + 1;
      localStorage.setItem(FIT_COUNT_KEY, String(next));
      window.dispatchEvent(new CustomEvent("el:fit-found", { detail: next }));
    } catch {
      /* storage unavailable — counter just won't persist */
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gold/30 bg-noir px-4 py-2.5 text-sm text-ivory placeholder:text-rosetaupe/60 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none";

  return (
    <div className="mt-12 overflow-hidden rounded-3xl border border-gold/25 bg-card">
      <div className="lace-dots border-b border-gold/15 px-6 py-6 sm:px-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-goldlight uppercase">
          ✦ AI Fit Finder (beta)
        </p>
        <h3 className="font-display mt-3 text-2xl text-ivory sm:text-3xl">
          Answer three numbers, get a starting size
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rosetaupe">
          Simple rule-based guidance that runs entirely in your browser — nothing
          you type ever leaves this page.
        </p>
      </div>

      <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={compute} noValidate>
          {/* Unit toggle */}
          <div
            role="group"
            aria-label="Measurement units"
            className="inline-flex rounded-full border border-gold/30 p-1"
          >
            {(["in", "cm"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase transition ${
                  unit === u
                    ? "bg-gold text-noir"
                    : "text-rosetaupe hover:text-ivory"
                }`}
              >
                {u === "in" ? "Inches" : "CM"}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ff-underbust"
                className="mb-1.5 block text-sm font-semibold text-ivory"
              >
                Underbust ({unitLabel})
              </label>
              <input
                id="ff-underbust"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder={unit === "in" ? "e.g. 34" : "e.g. 86"}
                value={underbust}
                onChange={(e) => setUnderbust(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label
                htmlFor="ff-overbust"
                className="mb-1.5 block text-sm font-semibold text-ivory"
              >
                Overbust ({unitLabel})
              </label>
              <input
                id="ff-overbust"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder={unit === "in" ? "e.g. 38" : "e.g. 96"}
                value={overbust}
                onChange={(e) => setOverbust(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ff-topsize"
                className="mb-1.5 block text-sm font-semibold text-ivory"
              >
                Usual top size
              </label>
              <select
                id="ff-topsize"
                value={topSize}
                onChange={(e) =>
                  setTopSize(e.target.value as (typeof TOP_SIZES)[number])
                }
                className={inputCls}
              >
                {TOP_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="ff-pref"
                className="mb-1.5 block text-sm font-semibold text-ivory"
              >
                Fit preference
              </label>
              <select
                id="ff-pref"
                value={pref}
                onChange={(e) => setPref(e.target.value as FitPref)}
                className={inputCls}
              >
                <option value="snug">Snug — locked-in support</option>
                <option value="comfortable">Comfortable — everyday</option>
                <option value="relaxed">Relaxed — soft &amp; easy</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight sm:w-auto"
          >
            Find my size ✦
          </button>

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-goldlight">
              {error}
            </p>
          )}

          {/* Privacy-safe photo measuring guide — text only, no camera/upload */}
          <details className="mt-6 rounded-2xl border border-gold/20 bg-noir/60 px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-goldlight">
              Photo measuring guide (optional) — no upload, stays on your
              device ♡
            </summary>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-rosetaupe">
              <p>
                Prefer a visual reference? Take a mirror photo{" "}
                <strong className="text-ivory">
                  for your own eyes only
                </strong>{" "}
                — wearing what makes you comfortable — so you can check tape
                placement against the 3 steps above.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Stand sideways to a mirror, tape level, relaxed posture.</li>
                <li>Check the tape sits flat — no twisting, one finger of ease.</li>
                <li>Jot the numbers into the boxes above for your suggestion.</li>
              </ul>
              <p className="font-medium text-ivory/85">
                Nothing is uploaded or stored: this page has no camera access
                and no image upload — everything stays on her device.
              </p>
            </div>
          </details>
        </form>

        {/* Result */}
        <div aria-live="polite">
          {result ? (
            <div className="lace-dots rounded-2xl border-2 border-gold bg-noir p-6 shadow-lg shadow-gold/10">
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase">
                Your starting size
              </p>
              <p className="font-display mt-2 text-3xl text-goldlight">
                Bra {result.bra} · Brief {result.brief}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ivory/90">
                {result.why}
              </p>
              <p className="mt-2 text-sm text-ivory/85">
                Sister size: {result.sister}.
              </p>
              <p className="mt-3 rounded-xl bg-gold/10 px-4 py-2.5 text-sm font-medium text-goldlight ring-1 ring-gold/30">
                Start here — exchange free if between sizes.
                {result.between
                  ? " You're right on a cup boundary, so try both."
                  : ""}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-noir/60 p-6 text-center">
              <p className="font-display text-xl text-ivory italic">
                Your suggestion appears here ♡
              </p>
              <p className="mt-2 max-w-xs text-sm text-rosetaupe">
                Enter your two measurements above and tap “Find my size”.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-rosetaupe">
            Guidance only, not medical advice. Bodies are beautifully
            three-dimensional — if anything doesn't feel dreamy, exchanges are
            free within 60 days.
          </p>
        </div>
      </div>
    </div>
  );
}

type Filter = "all" | Collection;
type Sort = "featured" | "low" | "high";

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "everyday", label: "Everyday" },
  { value: "lace", label: "Lace & Spice" },
  { value: "luxe", label: "Luxe" },
];

function Bestsellers() {
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("el-wishlist") ?? "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("el-wishlist", JSON.stringify(wishlist));
    } catch {
      /* storage unavailable — wishlist just won't persist */
    }
  }, [wishlist]);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  /* Per-card chosen variant index (size selector). Defaults to first variant. */
  const [sizeSel, setSizeSel] = useState<Record<string, number>>({});

  /* Header search (Nav) broadcasts `el:search`; sync the catalog query. */
  useEffect(() => {
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      setQuery(typeof detail === "string" ? detail : "");
    };
    window.addEventListener("el:search", onSearch);
    return () => window.removeEventListener("el:search", onSearch);
  }, []);

  const toggle = (id: string) =>
    setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  const q = query.trim().toLowerCase();
  const visible = CATALOG.filter(
    (p) =>
      (filter === "all" || p.collection === filter) &&
      (q === "" || p.name.toLowerCase().includes(q))
  ).sort((a, b) =>
    sort === "low" ? a.retail - b.retail : sort === "high" ? b.retail - a.retail : 0
  );

  return (
    <section id="bestsellers" className="scroll-mt-20 bg-coal">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">
              Shop all
            </p>
            <h2 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
              The full catalog
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-rosetaupe">
              {`${CATALOG.length} styles, from easy everyday picks to statement lace. Prices in USD. Tap ♡ to save favorites, 🛍 to add to cart — 10% off orders over $250, applied automatically.`}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4">
            <p className="text-sm font-semibold text-goldlight">
              ● LIVE first drop — Lace-Panel Collar Top, $18 · 10% off orders
              over $250 at checkout
            </p>
            <a
              href={LIVE_CHECKOUT_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Buy Lace-Panel Collar Top securely via Stripe"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-noir shadow transition hover:bg-goldlight"
            >
              Buy Securely
            </a>
            <span className="text-xs text-rosetaupe">
              Discreet packaging · Free 60-day exchanges
            </span>
          </div>
        </div>
        <TrustBadges className="mt-4 justify-start" />

        {/* Filter tabs */}
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by collection">
          {FILTER_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(t.value)}
              aria-pressed={filter === t.value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === t.value
                  ? "bg-gold text-noir"
                  : "bg-gold/10 text-goldlight ring-1 ring-gold/30 hover:bg-gold/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + sort */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="catalog-search" className="sr-only">
              Search styles
            </label>
            <input
              id="catalog-search"
              type="search"
              placeholder="Search styles — try “silk”, “garter”, “bralette”…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-gold/30 bg-noir px-5 py-2.5 text-sm text-ivory placeholder:text-rosetaupe/60 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-rosetaupe">
            <span className="whitespace-nowrap">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort by price"
              className="rounded-full border border-gold/30 bg-noir px-4 py-2.5 text-sm text-ivory focus:border-goldlight focus:outline-none"
            >
              <option value="featured">Featured</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-sm font-medium text-ivory/85" role="status">
          {visible.length} {visible.length === 1 ? "style" : "styles"}
          {filter !== "all"
            ? ` in ${FILTER_TABS.find((t) => t.value === filter)?.label}`
            : ""}
          {q !== "" ? ` matching “${query.trim()}”` : ""}
        </p>

        {visible.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-gold/30 bg-noir/60 p-8 text-center text-sm text-rosetaupe">
            Nothing matches that search yet — try “lace”, “silk”, or “bra”. ♡
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {visible.map((p) => {
              const saved = wishlist.includes(p.id);
              const isLuxe = p.collection === "luxe";
              const title = trimName(p.name);
              const payUrl = LINKS[p.id] ?? (p.id === "cj-2609070735461630000" ? LIVE_CHECKOUT_URL : undefined);
              const variants = Array.isArray(p.variants) ? p.variants : [];
              const selIdx = Math.min(sizeSel[p.id] ?? 0, Math.max(0, variants.length - 1));
              const selVariant = variants.length > 0 ? variants[selIdx] : undefined;
              return (
              <article
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-crimson/20"
              >
                <div className="relative">
                  <img
                    src={p.image}
                    alt={title}
                    loading="lazy"
                    className="aspect-square w-full bg-noir object-cover"
                  />
                  <span
                    className={`absolute top-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isLuxe
                        ? "bg-gold text-noir"
                        : "bg-crimson text-ivory"
                    }`}
                  >
                    {tagFor(p)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
                    aria-pressed={saved}
                    className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-base shadow transition ${
                      saved
                        ? "bg-gold text-noir"
                        : "bg-noir/80 text-ivory ring-1 ring-gold/40 hover:bg-noir"
                    }`}
                  >
                    {saved ? "♥" : "♡"}
                  </button>
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm leading-snug font-semibold text-ivory" title={p.name}>
                    {title}
                  </h3>
                  <p className="mt-1 text-xs text-rosetaupe">{p.sizes}</p>
                  {variants.length > 0 ? (
                    <label className="mt-2 flex items-center gap-2 text-xs text-rosetaupe">
                      <span className="shrink-0 font-semibold tracking-wide uppercase">Size</span>
                      <select
                        value={String(selIdx)}
                        onChange={(e) =>
                          setSizeSel((s) => ({ ...s, [p.id]: parseInt(e.target.value, 10) || 0 }))
                        }
                        aria-label={`Choose size for ${title}`}
                        className="min-w-0 flex-1 rounded-full border border-gold/30 bg-noir px-2.5 py-1.5 text-xs font-semibold text-ivory focus:border-goldlight focus:outline-none"
                      >
                        {variants.map((v, i) => (
                          <option key={v.vid || `${v.variantKey}-${i}`} value={String(i)}>
                            {v.variantKey || v.size}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-display text-lg text-goldlight">
                      {money(p.retail)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(
                          p.id,
                          1,
                          selVariant?.vid
                            ? { cjVid: selVariant.vid, size: selVariant.variantKey || selVariant.size }
                            : undefined
                        );
                        setCartOpen(true);
                      }}
                      aria-label={`Add ${title} to cart${selVariant ? ` in size ${selVariant.variantKey || selVariant.size}` : ""}`}
                      className="flex-1 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-noir transition hover:bg-goldlight"
                    >
                      Add to cart 🛍
                    </button>
                    {payUrl ? (
                      <a
                        href={payUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Buy ${title} securely via Stripe`}
                        className="flex-1 rounded-full border border-gold/40 px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-goldlight transition hover:bg-gold/10"
                      >
                        Buy Securely
                      </a>
                    ) : (
                      <a
                        href="#join"
                        className="flex-1 rounded-full border border-gold/40 px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-goldlight transition hover:bg-gold/10"
                      >
                        Notify me
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
            })}
            </div>
            )}
            <p className="mt-6 text-center text-xs text-rosetaupe/80">
          Prices in USD. 10% off orders over $250, applied automatically at checkout.
          Pay via Stripe link first, then confirm — your order is placed with our warehouse.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ cart drawer -------------------------------- */

function CartDrawer() {
  const open = useCartOpen();
  const lines = useCart();
  const joined = lines.flatMap((l) => {
    const product = CATALOG.find((p) => p.id === l.id);
    return product ? [{ line: l, product }] : [];
  });
  const subtotal = cartSubtotal(
    joined.map((j) => ({ price: j.product.retail, qty: j.line.qty }))
  );
  const earlyAccess = hasEarlyAccess();
  const discount = cartDiscount(subtotal, earlyAccess);
  const total = cartTotal(subtotal, earlyAccess);

  return (
    <div
      className={open ? "fixed inset-0 z-40" : "pointer-events-none fixed inset-0 z-40"}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={() => setCartOpen(false)}
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Shopping cart"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-gold/25 bg-noir shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <h2 className="font-display text-xl text-ivory">
            Your cart {joined.length > 0 ? `(${joined.reduce((n, j) => n + j.line.qty, 0)})` : ""}
          </h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="rounded-full border border-gold/40 px-3 py-1.5 text-sm font-semibold text-goldlight transition hover:bg-gold/10"
          >
            ✕ Close
          </button>
        </div>

        {joined.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-2xl text-ivory italic">Your cart is empty ♡</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-rosetaupe">
              Every body deserves something beautiful — go find a piece that
              makes you feel amazing.
            </p>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="mt-6 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-noir transition hover:bg-goldlight"
            >
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-gold/10 overflow-y-auto px-5">
              {joined.map(({ line, product }) => (
                <li key={lineKey(line)} className="flex gap-3 py-4">
                  <img
                    src={product.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl bg-coal object-cover ring-1 ring-gold/20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-semibold text-ivory" title={product.name}>
                      {trimName(product.name, 64)}
                      {line.size ? (
                        <span className="ml-1.5 rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-goldlight">
                          {line.size}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-rosetaupe">
                      {money(product.retail)} each · {moneyExact(product.retail * line.qty)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLineQty(line.id, line.qty - 1, line.cjVid)}
                        aria-label={`Decrease quantity of ${trimName(product.name, 40)}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/40 text-sm font-bold text-goldlight transition hover:bg-gold/10"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold text-ivory" aria-live="polite">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLineQty(line.id, line.qty + 1, line.cjVid)}
                        aria-label={`Increase quantity of ${trimName(product.name, 40)}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/40 text-sm font-bold text-goldlight transition hover:bg-gold/10"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id, line.cjVid)}
                        className="ml-2 text-xs font-medium text-rosetaupe underline underline-offset-2 transition hover:text-ivory"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gold/15 px-5 py-4">
              <div className="flex justify-between text-sm text-ivory/85">
                <span>Subtotal</span>
                <span className="font-semibold text-ivory">{moneyExact(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="mt-1 flex justify-between text-sm font-medium text-goldlight">
                  <span>{earlyAccess ? "15% early-shopper discount — applied" : "10% bulk discount — applied automatically"}</span>
                  <span>−{moneyExact(discount)}</span>
                </div>
              )}
              {!earlyAccess && discount === 0 && subtotal < BULK_THRESHOLD && (
                <p className="mt-1 text-xs text-rosetaupe">
                  Add {moneyExact(BULK_THRESHOLD - subtotal)} more for automatic 10% off ♡
                </p>
              )}
              <div className="mt-2 flex justify-between text-base font-bold text-ivory">
                <span>Total</span>
                <span className="font-display text-goldlight">{moneyExact(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="mt-4 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight"
              >
                Checkout · {moneyExact(total)}
              </button>
              <button
                type="button"
                onClick={() => clearCart()}
                className="mt-2 w-full rounded-full border border-gold/30 px-6 py-2.5 text-sm font-semibold text-rosetaupe transition hover:text-ivory"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ----------------------------- checkout modal ------------------------------ */

/* Cart lines → {cjPid, qty, cjVid?} payloads shared by the PaymentIntent
   fetch and the legacy /api/order confirm submit. */
function cartItemsFor(
  lines: CartLine[]
): { cjPid: string; qty: number; cjVid?: string }[] {
  return lines.flatMap((l) => {
    const product = CATALOG.find((p) => p.id === l.id);
    if (!product?.cjPid) return [];
    const cjVid = l.cjVid && /^[0-9]{1,40}$/.test(l.cjVid) ? l.cjVid : undefined;
    return cjVid
      ? [{ cjPid: product.cjPid, qty: l.qty, cjVid }]
      : [{ cjPid: product.cjPid, qty: l.qty }];
  });
}

function CheckoutModal() {
  const open = useCheckoutOpen();
  const lines = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paidEmail, setPaidEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ cjOrderId: string; orderRef: string } | null>(null);
  /* Stripe Hosted Checkout state — no client secret, no Elements iframe: we
     POST the cart to /api/stripe-checkout and redirect to the hosted page. */
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /* Create a Stripe Checkout Session for the current cart and send the
     customer to Stripe's hosted page. The amount is recomputed server-side,
     so the client total is never trusted. */
  const payWithStripe = async () => {
    const items = cartItemsFor(lines);
    if (items.length === 0) {
      setCheckoutError("Your cart is empty — add a piece you love first. ♡");
      return;
    }
    setCheckoutStarting(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          earlyAccess: hasEarlyAccess(),
          ...(email.trim() ? { email: email.trim() } : {}),
          /* Public origin for Stripe's success/cancel URLs — the platform
             rewrites Host server-side, so the client tells the server which
             site it's on and the server whitelists it. */
          returnOrigin: window.location.origin,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        url?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.url) {
        setCheckoutError(
          data?.error ?? "We couldn't start secure checkout — please use the payment links below for now. ♡"
        );
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError("We couldn't reach our payment desk — please use the payment links below for now. ♡");
    } finally {
      setCheckoutStarting(false);
    }
  };

  const joined = lines.flatMap((l) => {
    const product = CATALOG.find((p) => p.id === l.id);
    return product ? [{ line: l, product }] : [];
  });
  const subtotal = cartSubtotal(
    joined.map((j) => ({ price: j.product.retail, qty: j.line.qty }))
  );
  const earlyAccess = hasEarlyAccess();
  const discount = cartDiscount(subtotal, earlyAccess);
  const total = cartTotal(subtotal, earlyAccess);

  if (!open) return null;

  const payUrlFor = (id: string): string | undefined =>
    LINKS[id] ?? (id === "cj-2609070735461630000" ? LIVE_CHECKOUT_URL : undefined);

  const close = () => {
    setCheckoutOpen(false);
    setError(null);
    if (success) setSuccess(null);
    setCheckoutError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = cartItemsFor(lines);
    if (items.length === 0) {
      setError("Your cart is empty — add a piece you love first. ♡");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          paidEmail: paidEmail.trim(),
          address: {
            line1: line1.trim(),
            city: city.trim(),
            state: state.trim(),
            zip: zip.trim(),
            country: country.trim(),
          },
          items,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        cjOrderId?: string;
        orderRef?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(
          (data?.error as string) ||
            "Something went wrong confirming your order — please try again."
        );
        return;
      }
      setSuccess({
        cjOrderId: String(data.cjOrderId ?? ""),
        orderRef: String(data.orderRef ?? ""),
      });
      clearCart();
    } catch {
      setError("Couldn't reach our order desk — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gold/30 bg-noir px-4 py-2.5 text-sm text-ivory placeholder:text-rosetaupe/60 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gold/25 bg-noir p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">Checkout</p>
            <p className="mt-1 text-xs text-goldlight">🔒 Secure checkout powered by Stripe</p>
            <h2 className="font-display mt-1 text-2xl text-ivory sm:text-3xl">
              Almost yours ♡
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close checkout"
            className="rounded-full border border-gold/40 px-3 py-1.5 text-sm font-semibold text-goldlight transition hover:bg-gold/10"
          >
            ✕ Close
          </button>
        </div>
        <TrustBadges className="mt-4 justify-start" />

        {success ? (
          <div className="lace-dots mt-6 rounded-2xl border-2 border-gold bg-card p-6 text-center">
            <p className="font-display text-3xl text-goldlight">Thank you ♡</p>
            <p className="mt-2 text-sm leading-relaxed text-ivory/90">
              Your order is on its way in discreet, unmarked packaging.
            </p>
            <p className="mt-4 rounded-xl bg-noir/60 px-4 py-3 text-sm text-ivory/85 ring-1 ring-gold/20">
              Order ref: <strong className="text-goldlight">{success.orderRef}</strong>
              {success.cjOrderId ? (
                <>
                  {" · "}Warehouse id: <strong className="text-goldlight">{success.cjOrderId}</strong>
                </>
              ) : null}
            </p>
            <p className="mt-3 text-xs text-rosetaupe">
              ✎ Save your ref to track your order — you'll need it for order status and exchanges.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir transition hover:bg-goldlight"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            {/* Order summary */}
            <div className="mt-6 rounded-2xl border border-gold/20 bg-card p-5">
              <h3 className="text-sm font-bold tracking-wide text-goldlight uppercase">
                Order summary
              </h3>
              {joined.length === 0 ? (
                <p className="mt-2 text-sm text-rosetaupe">
                  Your cart is empty — add a piece you love first. ♡
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-gold/10">
                  {joined.map(({ line, product }) => (
                    <li key={lineKey(line)} className="flex items-center gap-3 py-2">
                      <img
                        src={product.image}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg bg-noir object-cover ring-1 ring-gold/20"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm text-ivory/90">
                        {trimName(product.name, 56)}{line.size ? ` · ${line.size}` : ""} <span className="text-rosetaupe">× {line.qty}</span>
                      </p>
                      <p className="text-sm font-semibold text-ivory">
                        {moneyExact(product.retail * line.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-between border-t border-gold/10 pt-3 text-sm text-ivory/85">
                <span>Subtotal</span>
                <span className="font-semibold text-ivory">{moneyExact(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="mt-1 flex justify-between text-sm font-medium text-goldlight">
                  <span>{earlyAccess ? "15% early-shopper discount — applied" : "10% bulk discount — applied automatically"}</span>
                  <span>−{moneyExact(discount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-base font-bold text-ivory">
                <span>Total</span>
                <span className="font-display text-goldlight">{moneyExact(total)}</span>
              </div>
            </div>

            {/* Pay by card — Stripe Hosted Checkout (no embedded form) */}
            <div className="mt-5 rounded-2xl border border-gold/20 bg-card p-5">
              <h3 className="text-sm font-bold tracking-wide text-goldlight uppercase">
                Pay by card · secure
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-rosetaupe">
                🔒 You'll finish payment on Stripe's secure page — your card details go straight to
                Stripe and never touch our servers.
              </p>
              {checkoutError && (
                <p role="alert" className="mt-3 rounded-xl bg-crimson/15 px-4 py-2.5 text-sm font-medium text-goldlight ring-1 ring-crimson/40">
                  {checkoutError}
                </p>
              )}
              <button
                type="button"
                onClick={payWithStripe}
                disabled={checkoutStarting || joined.length === 0}
                className="mt-4 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkoutStarting ? "Opening secure checkout…" : `Pay ${moneyExact(total)} with Stripe →`}
              </button>
              <p className="mt-3 text-center text-xs text-rosetaupe">
                Discreet, unmarked packaging · Free 60-day exchanges · 5–11 day delivery
              </p>
            </div>

            {/* Pay step (fallback) */}
            <div className="mt-5 rounded-2xl border border-gold/20 bg-card p-5">
              <h3 className="text-sm font-bold tracking-wide text-goldlight uppercase">
                Prefer paying by link? (fallback)
              </h3>
              {joined.length === 0 ? (
                <p className="mt-2 text-sm text-rosetaupe">Nothing to pay for yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {joined.map(({ line, product }) => {
                    const payUrl = payUrlFor(product.id);
                    return (
                      <li
                        key={lineKey(line)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-noir/60 px-4 py-2.5 ring-1 ring-gold/15"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-ivory/90">
                          {trimName(product.name, 48)}{line.size ? ` · ${line.size}` : ""} <span className="text-rosetaupe">× {line.qty}</span>
                        </span>
                        {payUrl ? (
                          <a
                            href={payUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold whitespace-nowrap text-noir transition hover:bg-goldlight"
                          >
                            Pay {moneyExact(product.retail * line.qty)} →
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-rosetaupe">
                            Notify me — pay link coming
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs leading-relaxed text-rosetaupe">
                Pay each item with its Stripe link (opens in a new tab), using the same
                payment email for all items — then confirm below so we can route your order.
              </p>
            </div>

            {/* Confirm form */}
            <form onSubmit={submit} noValidate className="mt-5 rounded-2xl border border-gold/20 bg-card p-5">
              <h3 className="text-sm font-bold tracking-wide text-goldlight uppercase">
                Paid by link? Confirm your order (fallback)
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="co-name" className="mb-1.5 block text-sm font-semibold text-ivory">
                    Full name
                  </label>
                  <input
                    id="co-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="co-email" className="mb-1.5 block text-sm font-semibold text-ivory">
                    Contact email
                  </label>
                  <input
                    id="co-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="co-paid" className="mb-1.5 block text-sm font-semibold text-ivory">
                    Stripe payment email
                  </label>
                  <input
                    id="co-paid"
                    type="email"
                    autoComplete="email"
                    placeholder="The email you paid with"
                    value={paidEmail}
                    onChange={(e) => setPaidEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-line1" className="mb-1.5 block text-sm font-semibold text-ivory">
                    Street address
                  </label>
                  <input
                    id="co-line1"
                    type="text"
                    autoComplete="street-address"
                    placeholder="123 Main St, Apt 4"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="co-city" className="mb-1.5 block text-sm font-semibold text-ivory">
                    City
                  </label>
                  <input
                    id="co-city"
                    type="text"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="co-state" className="mb-1.5 block text-sm font-semibold text-ivory">
                      State
                    </label>
                    <input
                      id="co-state"
                      type="text"
                      autoComplete="address-level1"
                      placeholder="CA"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="co-zip" className="mb-1.5 block text-sm font-semibold text-ivory">
                      ZIP
                    </label>
                    <input
                      id="co-zip"
                      type="text"
                      autoComplete="postal-code"
                      placeholder="90210"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-country" className="mb-1.5 block text-sm font-semibold text-ivory">
                    Country
                  </label>
                  <input
                    id="co-country"
                    type="text"
                    autoComplete="country-name"
                    placeholder="US"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-crimson/15 px-4 py-2.5 text-sm font-medium text-goldlight ring-1 ring-crimson/40">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || joined.length === 0}
                className="mt-5 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-noir shadow-lg transition hover:bg-goldlight disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Confirming…" : `I've paid — confirm order · ${moneyExact(total)}`}
              </button>
              <p className="mt-3 text-center text-xs text-rosetaupe">
                Discreet, unmarked packaging · Free 60-day exchanges · 5–11 day delivery
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- confidence FAQ --------------------------------- */
function ConfidenceFaq() {
  const faqs = [
    {
      q: "Is my payment secure?",
      a: "Yes — Stripe processes your card on their secure pages. We never see or store your card number.",
    },
    {
      q: "Why do I go to a Stripe page?",
      a: "Stripe is our certified payment processor. Look for stripe.com in the address bar and the lock icon — that's how you know it's us.",
    },
    {
      q: "Where does my order ship from?",
      a: "Every order ships in a plain, unmarked box — typically 5–11 days. Your business stays yours.",
    },
    {
      q: "What about exchanges?",
      a: "Easy 60-day exchanges — just email us with your order ref and we'll sort you out.",
    },
    {
      q: "How do I track my order?",
      a: "Save your order ref after you pay, then use it with our order-status lookup to check where things stand.",
    },
  ];
  return (
    <section aria-labelledby="confidence-heading" className="border-t border-gold/15 bg-noir">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-center text-xs font-bold tracking-[0.22em] text-gold uppercase">
          Good to know
        </p>
        <h2 id="confidence-heading" className="font-display mt-2 text-center text-3xl text-ivory sm:text-4xl">
          Shop with confidence
        </h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-gold/25 bg-card px-5 py-4"
            >
              <summary className="cursor-pointer text-[15px] font-semibold text-ivory transition group-hover:text-goldlight">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ivory/80">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
const EMAIL_KEY = "el-early-list";

/** True when the visitor joined the early list ("el-early-list" in
    localStorage) — entitles them to the 15% early-shopper discount instead
    of the 10%-over-$250 bulk rule. SSR-safe, storage-unavailable-safe. */
function hasEarlyAccess(): boolean {
  try {
    return typeof localStorage !== "undefined" && !!localStorage.getItem(EMAIL_KEY);
  } catch {
    return false;
  }
}

function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "done">("idle");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const prev = localStorage.getItem(EMAIL_KEY);
      if (prev) {
        setSavedEmail(prev);
        setStatus("done");
      }
    } catch {
      /* storage unavailable — form still works for the session */
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      return;
    }
    try {
      localStorage.setItem(EMAIL_KEY, value);
    } catch {
      /* storage unavailable — still show success for the session */
    }
    setSavedEmail(value);
    setStatus("done");
  };

  const reset = () => {
    try {
      localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* ignore */
    }
    setEmail("");
    setSavedEmail(null);
    setStatus("idle");
  };

  return (
    <section
      id="join"
      className="lace-dots scroll-mt-20 bg-noir text-ivory"
      style={{
        backgroundImage:
          "radial-gradient(50rem 22rem at 50% 0%, rgba(163,22,33,.35), transparent 65%)",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">
          Early shoppers
        </p>
        <h2 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
          Get 15% off launch day
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">
          Be first through the door: early access to the full size run, fit
          guides before anyone else, and a launch-day treat. One welcome email,
          then only the good stuff — unsubscribe anytime.
        </p>
        {status === "done" ? (
          <div
            role="status"
            className="mx-auto mt-8 max-w-md rounded-2xl border border-gold/40 bg-card p-6"
          >
            <p className="font-display text-2xl text-goldlight">You're in ♡</p>
            <p className="mt-2 text-sm text-ivory/85">
              Welcome to the Ember &amp; Lace early list
              {savedEmail ? (
                <>
                  {" — "}we'll write to{" "}
                  <strong className="font-semibold">{savedEmail}</strong>
                </>
              ) : null}{" "}
              when the doors open.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 text-xs font-medium text-rosetaupe underline underline-offset-2 transition hover:text-ivory"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="early-email" className="sr-only">
              Email address
            </label>
            <input
              id="early-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="min-w-0 flex-1 rounded-full border border-gold/30 bg-card px-5 py-3 text-sm text-ivory placeholder:text-rosetaupe/70 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold whitespace-nowrap text-noir shadow-lg transition hover:bg-goldlight"
            >
              Claim 15% off
            </button>
          </form>
        )}
        {status === "error" && (
          <p role="alert" className="mt-3 text-sm font-medium text-goldlight">
            Hmm — that email doesn't look quite right. Mind checking it?
          </p>
        )}
        <p className="mt-4 text-xs text-rosetaupe">
          No spam, no sharing your address, ever. Discreet sender name on every
          email.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ track order -------------------------------- */

function TrackOrder() {
  const [ref, setRef] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: string;
    trackingNumber: string | null;
    carrier: string | null;
  } | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const value = ref.trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(value)) {
      setError("Enter the order ref from your confirmation (e.g. EL-XXXXXX).");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/track?ref=${encodeURIComponent(value)}`);
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        status?: string;
        trackingNumber?: string | null;
        carrier?: string | null;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(
          (data?.error as string) ||
            "We couldn't find that order ref — check the code and try again."
        );
        return;
      }
      setResult({
        status: String(data.status ?? "Looking into it"),
        trackingNumber: (data.trackingNumber as string | null) ?? null,
        carrier: (data.carrier as string | null) ?? null,
      });
    } catch {
      setError("Couldn't reach our order desk — check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section id="track" className="scroll-mt-20 border-t border-gold/20 bg-coal">
      <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6">
        <p className="text-xs font-bold tracking-[0.22em] text-gold uppercase">
          Track your order
        </p>
        <h2 className="font-display mt-2 text-3xl text-ivory sm:text-4xl">
          Where's my parcel? ♡
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-rosetaupe">
          Paste the order ref from your confirmation email (looks like{" "}
          <strong className="text-ivory">EL-XXXXXX</strong>) and we'll check its
          status with our warehouse.
        </p>
        <form
          onSubmit={lookup}
          noValidate
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="track-ref" className="sr-only">
            Order reference
          </label>
          <input
            id="track-ref"
            type="text"
            autoComplete="off"
            placeholder="EL-XXXXXX"
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              if (error) setError(null);
            }}
            maxLength={40}
            className="min-w-0 flex-1 rounded-full border border-gold/30 bg-noir px-5 py-3 text-sm tracking-wide text-ivory placeholder:text-rosetaupe/70 focus:border-goldlight focus:ring-2 focus:ring-gold/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={checking}
            className="rounded-full bg-gold px-6 py-3 text-sm font-semibold whitespace-nowrap text-noir shadow-lg transition hover:bg-goldlight disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "Checking…" : "Track order"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-md text-sm font-medium text-goldlight">
            {error}
          </p>
        )}
        {result && (
          <div
            role="status"
            className="lace-dots mx-auto mt-6 max-w-md rounded-2xl border border-gold/40 bg-noir p-6"
          >
            <p className="font-display text-2xl text-goldlight">{result.status}</p>
            {result.trackingNumber ? (
              <p className="mt-3 rounded-xl bg-card px-4 py-2.5 text-sm text-ivory/90 ring-1 ring-gold/20">
                Tracking:{" "}
                <strong className="text-goldlight">{result.trackingNumber}</strong>
                {result.carrier ? (
                  <span className="text-rosetaupe"> · {result.carrier}</span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-rosetaupe">
                No tracking number yet — it appears once your parcel ships.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gold/25 bg-noir text-rosetaupe">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display flex items-center gap-2 text-xl text-ivory">
              <img
                src="/rose.svg"
                alt="Ember and Lace red rose logo"
                width={26}
                height={26}
                className="h-6 w-6 shrink-0"
                loading="lazy"
              />
              Ember <span className="text-gold">&amp;</span> Lace
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed">
              Size-inclusive lingerie &amp; everyday essentials, XS–4X and bras
              30A–44H+. Made to celebrate every body.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium">
            <a href="#collections" className="transition hover:text-goldlight">
              Collections
            </a>
            <a href="#fit" className="transition hover:text-goldlight">
              Fit Promise
            </a>
            <a href="#fit-guide" className="transition hover:text-goldlight">
              Fit Guide
            </a>
            <a href="#bestsellers" className="transition hover:text-goldlight">
              Bestsellers
            </a>
            <a href="#join" className="transition hover:text-goldlight">
              Early List
            </a>
            <a href="#track" className="transition hover:text-goldlight">
              Track your order
            </a>
            <a href="/products.json" className="transition hover:text-goldlight">
              Product feed
            </a>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-gold/15 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Ember &amp; Lace. All bodies welcome here. ♡</p>
          <p>
            ▣ Every order ships in plain, unmarked, discreet packaging — always.
          </p>
        </div>
      </div>
    </footer>
  );
}
