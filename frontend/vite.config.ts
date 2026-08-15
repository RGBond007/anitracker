import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The backend serves this directory; see backend/Dockerfile.
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      // Dev only: the built image serves API and UI from the same origin.
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
