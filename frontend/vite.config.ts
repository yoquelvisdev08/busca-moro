/// <reference types="vitest/config" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

const pkg = JSON.parse(
  JSON.stringify(require("./package.json")),
);

export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react()];

  // Bundle analysis: npm run build -- --mode analyze
  if (mode === "analyze") {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: "dist/stats.html",
      })
    );
  }

  return {
    plugins,
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version ?? "dev"),
    "import.meta.env.VITE_BUILD_TIMESTAMP": JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/screenshots": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          ui: [
            "lucide-react",
            "clsx",
            "tailwind-merge",
            "zustand",
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
          ],
        },
      },
    },
  },
  };
});
