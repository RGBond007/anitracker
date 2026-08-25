import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Static, browser-local demo published below the repository's Pages site.
 *
 * The base path is where the demo will be served from, which differs per host:
 * GitHub Pages serves it from /anitracker/demo/, while GitLab Pages derives its
 * own path (which varies with the project's unique-domain setting) and passes it
 * in as DEMO_BASE. The default keeps `npm run build:demo` producing the GitHub
 * build with no environment set.
 */
const base = process.env.DEMO_BASE || "/anitracker/demo/";

/** One source of truth for the version the UI reports. */
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_DEMO": JSON.stringify("true"),
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: "../docs/demo",
    emptyOutDir: true,
    sourcemap: false,
  },
});
