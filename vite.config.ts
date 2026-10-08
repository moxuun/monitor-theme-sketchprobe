import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

import { mockApi } from "./dev/mock-api.ts"

// MONITOR_MOCK=1 serves a fabricated hub on the same paths the real one uses, so
// the theme can be developed and screenshotted with no hub running. It is a dev
// server middleware only: `apply: "serve"` keeps it out of the build, and the
// plugin is not even loaded unless the variable is set.
export default defineConfig({
  plugins: [react(), ...(process.env.MONITOR_MOCK ? [mockApi()] : [])],
  // import.meta.dirname rather than new URL(...).pathname: the latter is
  // URL-encoded, so a checkout under a path containing a space or a non-ASCII
  // name resolves to %20 and the alias silently points nowhere.
  resolve: { alias: { "@": import.meta.dirname + "/src" } },
  build: {
    chunkSizeWarningLimit: 900,
    // Flags stay files. Vite would inline every one under 4 KiB -- all of them --
    // as a data URL, and because the page imports the whole set, all of them
    // would ship in the entry chunk whichever flags a hub's nodes need.
    assetsInlineLimit: (file) => (file.includes("/country-flag-icons/") ? false : undefined),
  },
  // A theme reads public data only, so any hub with its status page open can
  // serve as the source: MONITOR_HUB=https://hub.example.com npm run dev.
  // changeOrigin sends that hub its own name as Host, which the proxy or CDN in
  // front of it routes by.
  //
  // Off entirely under MONITOR_MOCK: the plugin answers every path, but the
  // proxy is not a middleware the plugin can get in front of -- it takes the
  // upgrade first and the live socket goes to a hub that is not there. Preview
  // inherits this block, so one switch covers both servers.
  server: {
    proxy: process.env.MONITOR_MOCK
      ? undefined
      : { "/api": { target: process.env.MONITOR_HUB || "http://127.0.0.1:9911", changeOrigin: true, ws: true } },
  },
})
