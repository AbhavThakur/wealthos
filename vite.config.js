import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import process from "node:process";

/**
 * Local development middleware for /api/* serverless functions.
 * Allows testing Google Sheets sync, Quick Log, Market Data, etc. directly in `npm run dev`.
 */
function apiDevPlugin() {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const pathname = urlObj.pathname;

        // Parse query params into req.query
        req.query = Object.fromEntries(urlObj.searchParams.entries());

        // Parse JSON body if POST/PUT
        if (["POST", "PUT", "PATCH"].includes(req.method)) {
          let bodyStr = "";
          for await (const chunk of req) {
            bodyStr += chunk;
          }
          try {
            req.body = bodyStr ? JSON.parse(bodyStr) : {};
          } catch {
            req.body = {};
          }
        }

        // Mock express-like res.status().json()
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        const routeFile = pathname.replace(/^\/api\//, "").split("?")[0];
        const filePath = path.resolve(process.cwd(), "api", `${routeFile}.js`);

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: `API route ${routeFile} not found` }));
          return;
        }

        try {
          const fileUrl = pathToFileURL(filePath).href;
          const mod = await import(fileUrl);
          if (mod?.default) {
            await mod.default(req, res);
            return;
          }
        } catch (err) {
          console.warn(`[api-dev-server] Route error for ${pathname}:`, err.message);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: err.message }));
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevPlugin()],
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
  };
});
