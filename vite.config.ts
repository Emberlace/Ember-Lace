import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/* Boot hook for the watcher chain self-heal (see src/server/watcher-heal.ts).
   This dev server is the platform-managed process on port 3000 and the only
   thing here that auto-restarts after a machine recycle, so its boot is where
   we notice that supervise.sh (keepalive / cj-watch / cj-pay-sweep) has died.
   `apply: "serve"` makes it dev-server-only: a `vite build` never runs it, and
   nothing is spawned at build time. The dynamic import keeps the heal module
   off the config-load path. Failures are swallowed — a heal problem must never
   stop the dev server from serving. */
function watcherHeal(): Plugin {
  return {
    name: "watcher-heal",
    apply: "serve",
    configureServer() {
      void import("./src/server/watcher-heal.ts")
        .then(({ startWatcherHeal }) => {
          startWatcherHeal("vite-dev");
        })
        .catch(() => {
          /* never break the dev server over the self-heal */
        });
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
    // The dev server is reachable through the TLS proxy, so the HMR websocket
    // must dial back on 443, not the dev port. If the socket can't connect,
    // pages still serve — hot reload degrades, never breaks.
    hmr: { clientPort: 443 },
    // The dev server can serve source files; never let it serve local secrets,
    // and never let it serve anything outside the site dir. Gotchas this list
    // encodes: a custom `deny` REPLACES Vite's defaults (so .git must be
    // restated), patterns containing "/" match the ABSOLUTE path (so dir
    // patterns need a leading **/), and `allow` left to its default widens to
    // the nearest workspace root — a stray .git or workspaces package.json in
    // /home/team/shared would expose the whole shared dir.
    fs: {
      strict: true,
      allow: [import.meta.dirname],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.run/**", "**/.git/**"],
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    watcherHeal(),
    tanstackStart(),
    viteReact(),
  ],
});
