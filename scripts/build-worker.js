import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist");

async function buildWorker() {
  console.log("⚡ Building Cloudflare Pages Worker (_worker.js)...");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle cloudflare-api-worker.js into dist/_worker.js
  const workerSrc = path.resolve(rootDir, "cloudflare-api-worker.js");
  const workerOut = path.resolve(distDir, "_worker.js");

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

  console.log(`✅ Compiled Cloudflare Pages Worker -> ${workerOut}`);

  // 2. Generate Cloudflare Pages _routes.json
  // Ensures /api/* and /d1/* are never served as static files, but routed to _worker.js
  const routesJson = {
    version: 1,
    include: ["/api/*", "/d1/*", "/health", "/healthz"],
    exclude: []
  };

  const routesOut = path.resolve(distDir, "_routes.json");
  fs.writeFileSync(routesOut, JSON.stringify(routesJson, null, 2), "utf8");
  console.log(`✅ Created Cloudflare Pages routing rule -> ${routesOut}`);

  // 3. Generate Cloudflare Pages _headers file for CORS & API security
  const headersContent = `
/api/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token
  Access-Control-Max-Age: 86400
  X-Content-Type-Options: nosniff

/d1/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token
  Access-Control-Max-Age: 86400
  X-Content-Type-Options: nosniff
`.trim();

  const headersOut = path.resolve(distDir, "_headers");
  fs.writeFileSync(headersOut, headersContent, "utf8");
  console.log(`✅ Created Cloudflare Pages _headers -> ${headersOut}`);
}

buildWorker().catch((err) => {
  console.error("❌ Failed to build Cloudflare Pages Worker:", err);
  process.exit(1);
});
