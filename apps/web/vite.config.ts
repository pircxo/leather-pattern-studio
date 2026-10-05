import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // apps/web consumes the shared UI kit straight from its TS source
      // via this alias, rather than through npm workspace package
      // resolution + a build step — simpler for a project this size, at
      // the cost of not exercising packages/ui's own built output. A
      // real multi-team setup would publish @lps/ui as a built package
      // instead (see ARCHITECTURE.md).
      "@lps/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000",
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
