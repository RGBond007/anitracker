import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Static, browser-local demo published below the repository's Pages site. */
export default defineConfig({
  base: "/anitracker/demo/",
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_DEMO": JSON.stringify("true"),
  },
  build: {
    outDir: "../docs/demo",
    emptyOutDir: true,
    sourcemap: false,
  },
});
