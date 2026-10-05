import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      // apps/web consumes the shared UI kit straight from its TS source
      // via this alias, rather than through npm workspace package
      // resolution + a build step — simpler for a project this size, at
      // the cost of not exercising packages/ui's own built output. A
      // real multi-team setup would publish @lps/ui as a built package
      // instead (see ARCHITECTURE.md).
      "@lps/ui": path.resolve(import.meta.dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
