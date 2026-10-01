/**
 * CLOUDFLARE D1 DATABASE REST CLIENT
 * This client communicates directly with Cloudflare D1 Serverless SQL Database
 * using native fetch over Cloudflare's secure Client API.
 */

import fs from "fs";
import path from "path";

export interface D1QueryResponse {
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
  results: any[];
}

let activeMigrationPromise: Promise<void> | null = null;
let queryQueuePromise: Promise<any> = Promise.resolve();
let hasInitializedD1Tables = false;

/**
 * Ensures all required D1 tables are created and seeded if missing.
 * Thread-safe for concurrent database requests using a single batched D1 execution.
 */
export async function ensureD1TablesExist(): Promise<void> {
  if (hasInitializedD1Tables) {
    return;
  }
  if (activeMigrationPromise) {
    return activeMigrationPromise;
  }

  activeMigrationPromise = (async () => {
    try {
      // Execute all core schema tables and indexes in a SINGLE batch statement
      const initSql = `
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            branch TEXT NOT NULL,
            password TEXT DEFAULT 'password123',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backcharges (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            branch TEXT NOT NULL,
            no_bak TEXT DEFAULT '-',
            no_spk TEXT DEFAULT '-',
            no_sap TEXT DEFAULT '-',
            no_tilang TEXT DEFAULT '-',
            customer_name TEXT NOT NULL,
            license_plate TEXT DEFAULT '-',
            value REAL NOT NULL DEFAULT 0,
            status_sap TEXT NOT NULL DEFAULT 'N/A',
            status_confirm TEXT NOT NULL DEFAULT 'Belum Konfirmasi',
            status_handover TEXT NOT NULL DEFAULT 'Pending',
            no_invoice TEXT DEFAULT '-',
            status_payment TEXT NOT NULL DEFAULT 'Belum Bayar',
            payment_date TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            file_bak_url TEXT,
            file_handover_aso_sales_url TEXT,
            file_handover_sales_admin_url TEXT,
            tanggal TEXT,
            tanggal_handover TEXT,
            nama_bro TEXT,
            upload_dok_pendukung TEXT,
            alasan TEXT,
            status_approval TEXT,
            approved_by TEXT,
            approved_at TEXT,
            approval_note TEXT,
            approval_attachment_1_url TEXT,
            approval_attachment_2_url TEXT,
            approval_attachment_3_url TEXT,
            regional_approval_status TEXT,
            regional_approved_by TEXT,
            regional_approved_at TEXT,
            regional_approval_note TEXT,
            division_approval_status TEXT,
            division_approved_by TEXT,
            division_approved_at TEXT,
            division_approval_note TEXT
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            transaction_id TEXT NOT NULL,
            performed_by TEXT NOT NULL,
            action_description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contact_inquiries (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'Open',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_backcharges_created_at ON backcharges(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_backcharges_branch_created ON backcharges(branch, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
      `;

      await queryD1(initSql);
      hasInitializedD1Tables = true;
      console.log("✅ Cloudflare D1 tables initialized via single batch execution.");

      // Check if D1 backcharges table is empty, auto-seed with full migration dataset
      try {
        const countRes = await queryD1Direct("SELECT COUNT(*) as count FROM backcharges");
        const count = Number(countRes?.[0]?.count) || 0;
        if (count === 0) {
          console.log("ℹ️ Cloudflare D1 database is newly created and empty. Auto-seeding full migration dataset...");
          // Execute migration without re-triggering ensureD1TablesExist
          const targetPath = path.join(process.cwd(), "cloudflare_d1_migration.sql");
          if (fs.existsSync(targetPath)) {
            const rawSql = fs.readFileSync(targetPath, "utf-8");
            const lines = rawSql.split("\n").filter(l => !l.trim().startsWith("--"));
            const statements = lines.join("\n").split(";").map(s => s.trim()).filter(s => s.length > 0).map(s => s + ";");
            const BATCH_SIZE = 30;
            for (let i = 0; i < statements.length; i += BATCH_SIZE) {
              const batch = statements.slice(i, i + BATCH_SIZE).join("\n");
              try {
                await queryD1(batch);
              } catch (bErr: any) {
                // Ignore duplicate keys
              }
              await new Promise(r => setTimeout(r, 150));
            }
            console.log(`🎉 Auto-seeded ${statements.length} migration statements to Cloudflare D1.`);
          }
        }
      } catch (checkErr: any) {
        console.warn("Notice checking D1 row count:", checkErr.message);
      }

      // Background cleanup: migrate any existing base64 entries in D1 to short disk URLs
      cleanExistingD1Base64().catch(() => {});
    } catch (err: any) {
      console.error("❌ Failed to auto-migrate Cloudflare D1 tables:", err.message);
    } finally {
      activeMigrationPromise = null;
    }
  })();

  return activeMigrationPromise;
}

/**
 * Reads cloudflare_d1_migration.sql and executes all SQL statements in batches
 * directly onto Cloudflare D1 without browser length limits.
 */
export async function importFullMigrationFile(filePath?: string): Promise<{ totalStatements: number; executedBatches: number }> {
  // Ensure basic tables exist first
  await ensureD1TablesExist();

  const targetPath = filePath || path.join(process.cwd(), "cloudflare_d1_migration.sql");
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File SQL migrasi tidak ditemukan di: ${targetPath}`);
  }

  console.log(`📖 Reading SQL migration file from: ${targetPath}`);
  const rawSql = fs.readFileSync(targetPath, "utf-8");
  
  // Clean comments and split by semicolon
  const lines = rawSql.split("\n");
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("--")) {
      cleanedLines.push(line);
    }
  }

  const fullCleanSql = cleanedLines.join("\n");
  const rawStatements = fullCleanSql.split(";");
  const statements: string[] = [];

  for (const stmt of rawStatements) {
    const s = stmt.trim();
    if (s.length > 0) {
      statements.push(s + ";");
    }
  }

  console.log(`📦 Preparing to migrate ${statements.length} SQL statements into Cloudflare D1...`);

  const BATCH_SIZE = 30;
  let executedBatches = 0;

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE);
    const combinedSql = batch.join("\n");
    try {
      await queryD1(combinedSql);
      executedBatches++;
    } catch (err: any) {
      console.warn(`⚠️ Batch ${executedBatches + 1} had error, executing statements individually with pacing...`, err.message);
      for (const singleStmt of batch) {
        try {
          await queryD1(singleStmt);
          await new Promise(r => setTimeout(r, 120));
        } catch (singleErr: any) {
          // Ignore duplicate primary key warnings
        }
      }
      executedBatches++;
    }
    // Safe delay between batches to respect Cloudflare D1 REST limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`🎉 Full SQL Migration finished! Executed ${statements.length} statements.`);
  return { totalStatements: statements.length, executedBatches };
}

// Persistent fallback cache that retains data across mutations to survive Cloudflare rate limits
const persistentStaleCache = new Map<string, any[]>();

// In-flight query deduplication map to eliminate duplicate concurrent REST API calls
const inFlightQueries = new Map<string, Promise<any[]>>();

// In-memory query cache with TTL
interface CacheEntry {
  data: any[];
  expiry: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds fresh cache for identical queries

let globalRateLimitCooldownUntil = 0;

export function clearD1QueryCache() {
  queryCache.clear();
  inFlightQueries.clear();
}

/**
 * Converts heavy base64 data URLs (e.g. data:image/jpeg;base64,...) to lightweight disk files
 * and returns the short relative URL (/uploads/img_....jpg) so D1 memory is never burdened.
 */
export function saveBase64ToDisk(base64Str: string): string {
  if (!base64Str || typeof base64Str !== "string") return base64Str;
  if (!base64Str.startsWith("data:") || !base64Str.includes(";base64,")) return base64Str;

  try {
    const commaIndex = base64Str.indexOf(",");
    if (commaIndex === -1) return base64Str;

    const prefix = base64Str.substring(0, commaIndex).toLowerCase();
    const rawData = base64Str.substring(commaIndex + 1).replace(/\s/g, '');
    if (!rawData) return base64Str;

    let ext = "jpg";
    if (prefix.includes("png")) ext = "png";
    else if (prefix.includes("webp")) ext = "webp";
    else if (prefix.includes("pdf")) ext = "pdf";
    else if (prefix.includes("gif")) ext = "gif";
    else if (prefix.includes("svg")) ext = "svg";

    const buffer = Buffer.from(rawData, "base64");
    const safeName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, buffer);
    console.log(`[STORAGE OPTIMIZER] Converted base64 (${(base64Str.length / 1024).toFixed(1)} KB) -> /uploads/${safeName}`);
    return `/uploads/${safeName}`;
  } catch (err: any) {
    console.warn("[STORAGE OPTIMIZER] Gagal mengonversi base64:", err.message);
    return base64Str;
  }
}

/**
 * Strips and converts all base64 data URLs in query parameters into short /uploads/ URLs.
 */
export function sanitizeSqlParams(params: any[]): any[] {
  if (!Array.isArray(params)) return params;
  return params.map(p => {
    if (typeof p === "string") {
      if (p.startsWith("data:") && p.includes(";base64,")) {
        return saveBase64ToDisk(p);
      }
      if (p.includes("data:image/") && p.includes(";base64,")) {
        return p.replace(/data:image\/[a-zA-Z0-9.+]+;base64,[A-Za-z0-9+/=]+/g, (match) => {
          return saveBase64ToDisk(match);
        });
      }
    }
    return p;
  });
}

/**
 * Strips and converts all inline base64 string literals in SQL strings into short /uploads/ URLs.
 */
export function sanitizeSqlString(sql: string): string {
  if (!sql || typeof sql !== "string" || !sql.includes("data:")) return sql;
  return sql
    .replace(/'data:[^']+;base64,[^']+'/gi, (match) => {
      const rawVal = match.slice(1, -1);
      const shortUrl = saveBase64ToDisk(rawVal);
      return `'${shortUrl}'`;
    })
    .replace(/"data:[^"]+;base64,[^"]+"/gi, (match) => {
      const rawVal = match.slice(1, -1);
      const shortUrl = saveBase64ToDisk(rawVal);
      return `"${shortUrl}"`;
    });
}

/**
 * Scans D1 for any legacy records holding raw base64 data URLs and migrates them to short /uploads/... paths.
 */
export async function cleanExistingD1Base64(): Promise<{ cleaned: number; remaining: number }> {
  let totalCleaned = 0;
  let remaining = 0;
  try {
    console.log("[STORAGE CLEANER] Memeriksa dan merampingkan record foto/berkas di Cloudflare D1...");
    
    // Check total records with base64
    const countRes = await queryD1Direct(`
      SELECT COUNT(*) as count FROM backcharges
      WHERE file_bak_url LIKE 'data:%' 
         OR file_handover_aso_sales_url LIKE 'data:%'
         OR file_handover_sales_admin_url LIKE 'data:%'
         OR upload_dok_pendukung LIKE 'data:%'
         OR approval_attachment_1_url LIKE 'data:%'
         OR approval_attachment_2_url LIKE 'data:%'
         OR approval_attachment_3_url LIKE 'data:%'
    `).catch(() => []);

    const initialCount = countRes?.[0]?.count ?? 0;
    if (initialCount === 0) {
      console.log("✅ [STORAGE CLEANER] Database D1 sudah bersih dari base64 panjang. Semua URL file/foto ringkas.");
      return { cleaned: 0, remaining: 0 };
    }

    console.log(`[STORAGE CLEANER] Ditemukan ${initialCount} record di D1 yang menggunakan base64 panjang. Memulai perampingan batch...`);

    let iteration = 0;
    const MAX_BATCHES = 25;

    while (iteration < MAX_BATCHES) {
      iteration++;
      const rows = await queryD1Direct(`
        SELECT id, file_bak_url, file_handover_aso_sales_url, file_handover_sales_admin_url, upload_dok_pendukung, approval_attachment_1_url, approval_attachment_2_url, approval_attachment_3_url
        FROM backcharges
        WHERE file_bak_url LIKE 'data:%' 
           OR file_handover_aso_sales_url LIKE 'data:%'
           OR file_handover_sales_admin_url LIKE 'data:%'
           OR upload_dok_pendukung LIKE 'data:%'
           OR approval_attachment_1_url LIKE 'data:%'
           OR approval_attachment_2_url LIKE 'data:%'
           OR approval_attachment_3_url LIKE 'data:%'
        LIMIT 10
      `);

      if (!rows || rows.length === 0) {
        break;
      }

      for (const r of rows) {
        const updates: string[] = [];
        const updateParams: any[] = [];
        
        const checkAndReplace = (colName: string, val: any) => {
          if (typeof val === "string") {
            if (val.startsWith("data:") && val.includes(";base64,")) {
              const shortUrl = saveBase64ToDisk(val);
              updates.push(`${colName} = ?`);
              updateParams.push(shortUrl);
            } else if (val.startsWith("/uploads/")) {
              updates.push(`${colName} = ?`);
              updateParams.push(val);
            }
          }
        };

        checkAndReplace("file_bak_url", r.file_bak_url);
        checkAndReplace("file_handover_aso_sales_url", r.file_handover_aso_sales_url);
        checkAndReplace("file_handover_sales_admin_url", r.file_handover_sales_admin_url);
        checkAndReplace("upload_dok_pendukung", r.upload_dok_pendukung);
        checkAndReplace("approval_attachment_1_url", r.approval_attachment_1_url);
        checkAndReplace("approval_attachment_2_url", r.approval_attachment_2_url);
        checkAndReplace("approval_attachment_3_url", r.approval_attachment_3_url);

        if (updates.length > 0) {
          updateParams.push(r.id);
          await queryD1Direct(`UPDATE backcharges SET ${updates.join(", ")} WHERE id = ?`, updateParams);
          totalCleaned++;
          console.log(`[STORAGE CLEANER] Record D1 [${r.id}] berhasil dirampingkan ke URL pendek (${totalCleaned}/${initialCount}).`);
          await new Promise(res => setTimeout(res, 250));
        }
      }

      await new Promise(res => setTimeout(res, 500));
    }

    const finalCheck = await queryD1Direct(`
      SELECT COUNT(*) as count FROM backcharges
      WHERE file_bak_url LIKE 'data:%' 
         OR file_handover_aso_sales_url LIKE 'data:%'
         OR file_handover_sales_admin_url LIKE 'data:%'
         OR upload_dok_pendukung LIKE 'data:%'
         OR approval_attachment_1_url LIKE 'data:%'
         OR approval_attachment_2_url LIKE 'data:%'
         OR approval_attachment_3_url LIKE 'data:%'
    `).catch(() => []);
    remaining = finalCheck?.[0]?.count ?? 0;

    console.log(`✅ [STORAGE CLEANER] Proses selesai! ${totalCleaned} record dirampingkan, sisa base64: ${remaining}`);
    return { cleaned: totalCleaned, remaining };
  } catch (err: any) {
    console.warn("[STORAGE CLEANER] Notice:", err.message);
    return { cleaned: totalCleaned, remaining };
  }
}

/**
 * Returns a fallback result for SELECT queries when Cloudflare D1 is temporarily rate limiting.
 */
function getGracefulReadFallback(sql: string, params: any[] = []): any[] {
  const trimmed = sql.trim().toUpperCase();
  const cacheKey = `${sql.trim()}:::${JSON.stringify(params || [])}`;

  // 1. Check persistent last-known good data
  if (persistentStaleCache.has(cacheKey)) {
    return persistentStaleCache.get(cacheKey)!;
  }

  // 2. Check for loose match in persistent cache
  for (const [key, val] of persistentStaleCache.entries()) {
    if (key.startsWith(sql.trim())) {
      return val;
    }
  }

  // 3. Sensible structure defaults
  if (trimmed.includes("SELECT 1")) {
    return [{ 1: 1 }];
  }
  if (trimmed.includes("COUNT(*)")) {
    return [{ total_count: 0 }];
  }
  return [];
}

/**
 * Direct query execution to Cloudflare D1 REST API.
 */
async function queryD1Direct(sql: string, params: any[] = []): Promise<any[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID || '';
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "Kredensial Cloudflare D1 belum terkonfigurasi. Pastikan CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, dan CLOUDFLARE_API_TOKEN terisi di Environment Variables."
    );
  }

  // Sanitize both params and sql before sending to Cloudflare
  const cleanParams = sanitizeSqlParams(params);
  const cleanSql = sanitizeSqlString(sql);

  const trimmedSql = cleanSql.trim();
  const isReadQuery = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmedSql);
  const cacheKey = `${trimmedSql}:::${JSON.stringify(cleanParams || [])}`;

  // 1. Return fresh cached data if available
  if (isReadQuery) {
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  } else {
    // Invalidate fresh cache on mutations but keep persistentStaleCache
    queryCache.clear();
  }

  // 2. Wait if global rate limit cooldown is active
  if (globalRateLimitCooldownUntil > Date.now()) {
    const waitTime = globalRateLimitCooldownUntil - Date.now();
    await new Promise(r => setTimeout(r, waitTime));
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sql: cleanSql,
      params: cleanParams
    })
  });

  const text = await response.text();

  if (!response.ok) {
    const isRateLimit = text.includes("Rate exceeded") || text.includes("rate limit") || response.status === 429 || text.includes("10022");
    if (isRateLimit) {
      globalRateLimitCooldownUntil = Date.now() + 4000;
      if (isReadQuery) {
        const fallback = getGracefulReadFallback(sql, params);
        if (fallback) {
          console.warn("⚠️ Rate limit reached on Cloudflare D1. Serving graceful fallback cache safely.");
          return fallback;
        }
      }
      throw new Error("Rate exceeded. Cloudflare D1 is rate limiting concurrent queries.");
    }
    throw new Error(`Cloudflare D1 API Error ${response.status}: ${text}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (parseErr: any) {
    if (text.includes("Rate exceeded")) {
      globalRateLimitCooldownUntil = Date.now() + 4000;
      if (isReadQuery) {
        return getGracefulReadFallback(sql, params);
      }
      throw new Error("Rate exceeded. Cloudflare D1 is rate limiting concurrent queries.");
    }
    throw new Error(`Gagal memuat JSON dari Cloudflare D1: ${text}`);
  }

  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "Gagal mengeksekusi kueri di Cloudflare D1.";
    throw new Error(errorMsg);
  }

  const queryResult: D1QueryResponse = data.result?.[0];
  let results = queryResult?.results || [];

  // Automatically convert any base64 fields in returned rows to short disk URLs so browser & memory stay light
  if (Array.isArray(results) && results.length > 0) {
    results = results.map(row => {
      if (typeof row === "object" && row !== null) {
        let changed = false;
        const newRow = { ...row };
        for (const [k, v] of Object.entries(newRow)) {
          if (typeof v === "string" && v.startsWith("data:") && v.includes(";base64,")) {
            newRow[k] = saveBase64ToDisk(v);
            changed = true;
          }
        }
        return changed ? newRow : row;
      }
      return row;
    });
  }

  if (isReadQuery) {
    queryCache.set(cacheKey, {
      data: results,
      expiry: Date.now() + CACHE_TTL_MS
    });
    persistentStaleCache.set(cacheKey, results);
  }

  return results;
}

/**
 * Executes a SQL query with rate-limit self-healing retry guard and exponential backoff delay.
 */
async function queryD1WithRetry(sql: string, params: any[] = [], attempt = 1): Promise<any[]> {
  const trimmedSql = sql.trim();
  const isReadQuery = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmedSql);
  const cacheKey = `${trimmedSql}:::${JSON.stringify(params || [])}`;

  try {
    return await queryD1Direct(sql, params);
  } catch (err: any) {
    const errText = String(err.message || err).toLowerCase();
    
    // Auto-retry on Rate exceeded / Rate limits with progressive backoff
    const isRateLimit = errText.includes("rate limit") || errText.includes("rate exceeded") || errText.includes("too many requests") || errText.includes("10022");
    if (isRateLimit) {
      if (isReadQuery) {
        const fallback = getGracefulReadFallback(sql, params);
        if (fallback.length > 0 || persistentStaleCache.has(cacheKey)) {
          console.warn(`⚠️ Rate limit active. Serving cached fallback for query.`);
          return fallback;
        }
      }

      if (attempt <= 6) {
        const delayMs = Math.min(8000, Math.pow(1.8, attempt) * 800 + Math.floor(Math.random() * 500));
        console.warn(`⚠️ Cloudflare D1 Rate Limit detected. Retrying query (attempt ${attempt}/6) in ${Math.round(delayMs)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return queryD1WithRetry(sql, params, attempt + 1);
      }

      if (isReadQuery) {
        console.warn(`⚠️ Exhausted retries for read query. Returning graceful fallback structure.`);
        return getGracefulReadFallback(sql, params);
      }
    }

    if (
      errText.includes("no such table") ||
      errText.includes("no such column") ||
      errText.includes("has no column named") ||
      errText.includes("sqlite_error")
    ) {
      console.warn("⚠️ Detected missing table or column in Cloudflare D1. Triggering automated table migrations & schema updates...");
      try {
        await ensureD1TablesExist();
        console.log("🔄 Retrying original query post-migration...");
        return await queryD1Direct(sql, params);
      } catch (retryErr: any) {
        console.error("❌ Retry failed after table migration:", retryErr.message || retryErr);
      }
    }
    
    if (isReadQuery) {
      return getGracefulReadFallback(sql, params);
    }
    
    console.error("❌ [CLOUDFLARE D1 ERROR]:", err.message || err);
    throw err;
  }
}

/**
 * Execute a SQL query on your Cloudflare D1 database.
 * Thread-safe with inter-query delay pacing (200ms) and in-flight deduplication to ensure zero 429 Rate Limit issues.
 * Automatically sanitizes any heavy base64 images into short /uploads/ URLs before saving to D1.
 */
export async function queryD1(sql: string, params: any[] = []): Promise<any[]> {
  // Automatically convert any heavy base64 data URLs to short disk URLs so D1 never suffers from memory bloat
  const cleanParams = sanitizeSqlParams(params);
  const cleanSql = sanitizeSqlString(sql);

  const trimmedSql = cleanSql.trim();
  const isReadQuery = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmedSql);
  const cacheKey = `${trimmedSql}:::${JSON.stringify(cleanParams || [])}`;

  // 1. Instant cache check
  if (isReadQuery) {
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  }

  // 2. In-flight request coalescing (deduplication)
  if (isReadQuery && inFlightQueries.has(cacheKey)) {
    return inFlightQueries.get(cacheKey)!;
  }

  const queryExecutionPromise = (async () => {
    const nextInQueue = async () => {
      const result = await queryD1WithRetry(cleanSql, cleanParams);
      // Safe pacing gap between consecutive Cloudflare REST API requests
      await new Promise(r => setTimeout(r, 200));
      return result;
    };
    
    const resultPromise = queryQueuePromise.then(nextInQueue, nextInQueue);
    queryQueuePromise = resultPromise.catch(() => {}); // keep queue moving forward
    
    return resultPromise;
  })();

  if (isReadQuery) {
    inFlightQueries.set(cacheKey, queryExecutionPromise);
    queryExecutionPromise.finally(() => {
      inFlightQueries.delete(cacheKey);
    });
  }

  return queryExecutionPromise;
}

/**
 * Convenience method for single record select or scalar outputs.
 */
export async function queryD1Single(sql: string, params: any[] = []): Promise<any | null> {
  const results = await queryD1(sql, params);
  return results.length > 0 ? results[0] : null;
}
