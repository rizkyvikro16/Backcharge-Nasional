import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import esbuild from "esbuild";
import { defineConfig, Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function cloudflarePagesWorkerPlugin(): Plugin {
  return {
    name: "cloudflare-pages-worker-builder",
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const workerSrc = path.resolve(__dirname, "cloudflare-api-worker.js");
      const workerOut = path.resolve(outDir, "_worker.js");

      if (fs.existsSync(workerSrc)) {
        try {
          await esbuild.build({
            entryPoints: [workerSrc],
            bundle: true,
            outfile: workerOut,
            format: "esm",
            target: "es2022",
            platform: "browser",
            conditions: ["worker", "browser", "import"],
            sourcemap: false,
            minify: false,
          });
          console.log("⚡ [Cloudflare Pages] Compiled dist/_worker.js successfully");

          const routesJson = {
            version: 1,
            include: ["/api/*", "/d1/*", "/health", "/healthz"],
            exclude: []
          };
          fs.writeFileSync(path.resolve(outDir, "_routes.json"), JSON.stringify(routesJson, null, 2), "utf8");
          console.log("⚡ [Cloudflare Pages] Created dist/_routes.json routing rule");

          const headersContent = `
/api/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token
  Access-Control-Max-Age: 86400

/d1/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token
  Access-Control-Max-Age: 86400
`.trim();
          fs.writeFileSync(path.resolve(outDir, "_headers"), headersContent, "utf8");
        } catch (err) {
          console.error("❌ [Cloudflare Pages] Failed to compile _worker.js:", err);
        }
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflarePagesWorkerPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        workbox: {
          importScripts: ["/sw-notification.js"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//, /^\/d1\//, /^\/uploads\//, /^\/health/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-drive-images",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
        manifest: {
          name: "Sistem Workflow Backcharge Nasional",
          short_name: "Backcharge",
          description: "Aplikasi workflow backcharge nasional responsif dengan caching statis.",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
        "/d1": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
      allowedHosts: [
        'backcharge-assa.ai.studio',
        'backcharge-nasional.pages.dev',
        '.run.app',
        'localhost',
        '127.0.0.1'
      ],
      hmr: false,
      watch: null,
    },
  };
});

