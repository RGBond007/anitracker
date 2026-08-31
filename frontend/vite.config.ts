import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** One source of truth for the version the UI reports. */
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    // The backend serves this directory; see backend/Dockerfile.
    outDir: "dist",
    sourcemap: false,
  },
  // Vitest returns an empty string for a stylesheet unless it is told to process
  // one, which made `focus.test.ts` pass against CSS it could not actually read.
  // The focus indicator is a rule rather than a component, so the test that guards
  // it has to be able to see the rule.
  test: { css: true },
  server: {
    port: 5173,
    proxy: {
      // Dev only: the built image serves API and UI from the same origin.
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
