/* Ember & Lace — client-side Stripe.js setup (publishable key only).
   Never import the `stripe` SDK here: this module runs in the browser,
   and the secret key never leaves the server. */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/* The publishable key is VITE_-exposed at build time. Read the conventional
   name first, then the legacy platform-injected spelling (VITE_STRIPE_
   PUBLIHABLE_KEY — a known typo from the platform env for the dev server)
   so the Elements iframe works in every environment the site runs in. */
const env = import.meta.env as Record<string, string | undefined>;
export const STRIPE_PK: string =
  env.VITE_STRIPE_PUBLISHABLE_KEY ?? env.VITE_STRIPE_PUBLIHABLE_KEY ?? "";

export const stripePkConfigured = STRIPE_PK.length > 0;

/** Promise passed to <Elements>. Null when no publishable key is configured —
 *  callers must fall back to the link-based flow in that case. */
export const stripePromise: Promise<Stripe | null> | null = stripePkConfigured
  ? loadStripe(STRIPE_PK)
  : null;