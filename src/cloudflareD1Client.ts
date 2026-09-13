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

/**
 * Ensures all required D1 tables are created and seeded if missing.
 * Thread-safe for concurrent database requests.
 */
export async function ensureD1TablesExist(): Promise<void> {
  if (activeMigrationPromise) {
    console.log("⚙️ Another database migration is already in progress, joining existing promise...");
    return activeMigrationPromise;
  }

  activeMigrationPromise = (async () => {
    console.log("⚙️ Checking and creating missing Cloudflare D1 tables...");
    try {
      // 1. Create profiles
      try {
        console.log("Creating table 'profiles'...");
        await queryD1Direct(`
          CREATE TABLE IF NOT EXISTS profiles (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              full_name TEXT NOT NULL,
              role TEXT NOT NULL,
              branch TEXT NOT NULL,
              password TEXT DEFAULT 'password123',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          );
        `);
        console.log("Table 'profiles' created successfully.");
      } catch (e: any) {
        console.error("❌ Error creating table 'profiles':", e.message || e);
      }

      // Self-healing: Ensure password column exists in profiles for existing D1 databases
      try {
        await queryD1Direct(`ALTER TABLE profiles ADD COLUMN password TEXT DEFAULT 'password123';`);
      } catch (alterProfileErr: any) {
        // Column already exists, safe to ignore
      }

      // Seed default profiles if empty
      try {
        const profileCount = await queryD1Direct(`SELECT COUNT(*) as count FROM profiles;`);
        if (profileCount && profileCount[0] && profileCount[0].count === 0) {
          console.log("🌱 Seeding default profiles into D1 database...");
          await queryD1Direct(`
            INSERT INTO profiles (id, email, full_name, role, branch, created_at) VALUES 
            ('1', 'administrator@assa.id', 'ASSA', 'Administrator', 'Nasional', '2026-06-28T14:38:20.522057+00:00'),
            ('l8hovd', 'assa@assa.id', 'ASSA', 'Administrator', 'Nasional', '2026-06-30T12:26:14.358+00:00');
          `);
        }
      } catch (seedErr: any) {
        console.warn("⚠️ Warning during D1 profile seeding:", seedErr.message);
      }

      // 2. Create backcharges
      try {
        console.log("Creating table 'backcharges'...");
        await queryD1Direct(`
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
        `);
        console.log("Table 'backcharges' created successfully.");
      } catch (e: any) {
        console.error("❌ Error creating table 'backcharges':", e.message || e);
      }

      // Self-healing: Ensure all extended columns exist in backcharges for existing D1 databases
      const extraColumns = [
        "no_tilang TEXT DEFAULT '-'",
        "tanggal TEXT",
        "tanggal_handover TEXT",
        "nama_bro TEXT",
        "upload_dok_pendukung TEXT",
        "alasan TEXT",
        "payment_date TEXT",
        "status_approval TEXT",
        "approved_by TEXT",
        "approved_at TEXT",
        "approval_note TEXT",
        "approval_attachment_1_url TEXT",
        "approval_attachment_2_url TEXT",
        "approval_attachment_3_url TEXT",
        "regional_approval_status TEXT",
        "regional_approved_by TEXT",
        "regional_approved_at TEXT",
        "regional_approval_note TEXT",
        "division_approval_status TEXT",
        "division_approved_by TEXT",
        "division_approved_at TEXT",
        "division_approval_note TEXT"
      ];

      for (const colDef of extraColumns) {
        try {
          await queryD1Direct(`ALTER TABLE backcharges ADD COLUMN ${colDef};`);
          console.log(`Successfully ran self-healing: ADD COLUMN ${colDef} to backcharges.`);
        } catch (alterErr: any) {
          // Column already exists or table issue, safe to ignore
        }
      }

      // 3. Create activity_logs
      try {
        console.log("Creating table 'activity_logs'...");
        await queryD1Direct(`
          CREATE TABLE IF NOT EXISTS activity_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
              transaction_id TEXT NOT NULL,
              performed_by TEXT NOT NULL,
              action_description TEXT NOT NULL
          );
        `);
        console.log("Table 'activity_logs' created successfully.");
      } catch (e: any) {
        console.error("❌ Error creating table 'activity_logs':", e.message || e);
      }

      // 4. Create contact_inquiries
      try {
        console.log("Creating table 'contact_inquiries'...");
        await queryD1Direct(`
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
        `);
        console.log("Table 'contact_inquiries' created successfully.");
      } catch (e: any) {
        console.error("❌ Error creating table 'contact_inquiries':", e.message || e);
      }

      console.log("✅ Missing Cloudflare D1 tables successfully initialized!");
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
      await queryD1Direct(combinedSql);
      executedBatches++;
    } catch (err: any) {
      console.warn(`⚠️ Batch ${executedBatches + 1} had error, executing statements individually...`, err.message);
      for (const singleStmt of batch) {
        try {
          await queryD1Direct(singleStmt);
        } catch (singleErr: any) {
          // Ignore table drop / duplicate primary key warnings
        }
      }
      executedBatches++;
    }
  }

  console.log(`🎉 Full SQL Migration finished! Executed ${statements.length} statements.`);
  return { totalStatements: statements.length, executedBatches };
}

/**
 * Direct query execution without retry-safety guards.
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

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sql,
      params
    })
  });

  const data: any = await response.json();

  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "Gagal mengeksekusi kueri di Cloudflare D1.";
    throw new Error(errorMsg);
  }

  const queryResult: D1QueryResponse = data.result?.[0];
  return queryResult?.results || [];
}

/**
 * Execute a SQL query on your Cloudflare D1 database with self-healing retry guard for missing tables.
 */
export async function queryD1(sql: string, params: any[] = []): Promise<any[]> {
  try {
    return await queryD1Direct(sql, params);
  } catch (err: any) {
    const errText = String(err.message || err).toLowerCase();
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
    console.error("❌ [CLOUDFLARE D1 ERROR]:", err.message || err);
    throw err;
  }
}

/**
 * Convenience method for single record select or scalar outputs.
 */
export async function queryD1Single(sql: string, params: any[] = []): Promise<any | null> {
  const results = await queryD1(sql, params);
  return results.length > 0 ? results[0] : null;
}
