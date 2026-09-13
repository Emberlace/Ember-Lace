import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";
/* First-party analytics bundle: fires a pageview beacon once per full page
   load (deferred, non-blocking). No-op during SSR. */
import "../lib/analytics";

const STORE_URL = "https://783aeabe91b1a4a10aee76a4357372c8.ctonew.app";

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ember & Lace",
  url: STORE_URL,
};

const SITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ember & Lace",
  url: STORE_URL,
};

/* Set VITE_META_PIXEL_ID at build time (owner's Meta pixel) — unset = pixel disabled. */
const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ?? "";
const META_PIXEL_CODE = META_PIXEL_ID
  ? `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`
  : "";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Ember & Lace — size-inclusive lingerie XS-4X, bras 30A-44H+. Everyday, Lace & Spice, Luxe. Discreet US shipping.",
      },
      { property: "og:title", content: "Ember & Lace" },
      {
        property: "og:description",
        content:
          "Ember & Lace — size-inclusive lingerie XS-4X, bras 30A-44H+. Everyday, Lace & Spice, Luxe. Discreet US shipping.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ember & Lace" },
      {
        name: "twitter:description",
        content:
          "Ember & Lace — size-inclusive lingerie XS-4X, bras 30A-44H+. Everyday, Lace & Spice, Luxe. Discreet US shipping.",
      },
      { title: "Ember & Lace — Comfort to Spice, Made for Every Body" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/rose.svg" },
      { rel: "apple-touch-icon", href: "/rose.svg" },
      { rel: "canonical", href: STORE_URL },
      {
        rel: "alternate",
        type: "application/json",
        title: "Ember & Lace product feed",
        href: "/products.json",
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {META_PIXEL_CODE && (
          <script dangerouslySetInnerHTML={{ __html: META_PIXEL_CODE }} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_SCHEMA) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
