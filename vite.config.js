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
        // Start low, increase as you add more tests
        // Current: ~3% → Target: 50%+
        statements: 3,
        branches: 1,
        functions: 1,
        lines: 3,
      },
    },
  },
  build: {
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
        },
      },
    },
  },
});
