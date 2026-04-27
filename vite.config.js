import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/main.jsx",
        "src/firebase.js",
        "src/test/**",
        "src/**/*.test.{js,jsx}",
      ],
      thresholds: {
        // Reflects current coverage baseline (mostly UI pages, untested by design)
        // Increase these as you add tests for utils/hooks
        statements: 2,
        branches: 0.9,
        functions: 1,
        lines: 2,
      },
    },
  },
  build: {
    target: "es2020",
    cssMinify: "lightningcss",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/echarts")) {
            return "Chart";
          }
          if (
            id.includes("node_modules/firebase") ||
            id.includes("node_modules/@firebase")
          ) {
            return "firebase";
          }
          if (id.includes("node_modules/@dnd-kit")) {
            return "dndkit";
          }
          if (id.includes("node_modules/sonner")) {
            return "sonner";
          }
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }
        },
      },
    },
  },
});
