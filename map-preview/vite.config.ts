import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/**
 * The prototype's own root, so it can be run and screenshotted beside the theme
 * without touching the theme's entry point or its build. `npm run dev` at the
 * repository root still serves the theme; this config is only used when the
 * server is pointed at this directory.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 5199, strictPort: true },
})
