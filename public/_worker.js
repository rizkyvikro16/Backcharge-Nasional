// Helper function for automatic table creation & migration inside Worker
async function ensureD1SchemaWorker(db) {
  if (!db) return;
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL,
          branch TEXT NOT NULL,
          password TEXT DEFAULT 'password123',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `),
    db.prepare(`
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
          nama_bro TEXT DEFAULT '-',
          upload_dok_pendukung TEXT,
          alasan TEXT DEFAULT '-',
          status_approval TEXT DEFAULT 'Belum Approval',
          approved_by TEXT,
          approved_at TEXT,
          approval_note TEXT,
          approval_attachment_1_url TEXT,
          approval_attachment_2_url TEXT,
          approval_attachment_3_url TEXT,
          regional_approval_status TEXT DEFAULT 'Belum Approval',
          regional_approved_by TEXT,
          regional_approved_at TEXT,
          regional_approval_note TEXT,
          division_approval_status TEXT DEFAULT 'Belum Approval',
          division_approved_by TEXT,
          division_approved_at TEXT,
          division_approval_note TEXT
      );
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          transaction_id TEXT NOT NULL,
          performed_by TEXT NOT NULL,
          action_description TEXT NOT NULL
      );
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          branch TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'UNREAD',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_backcharges_created_at ON backcharges (created_at DESC);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_backcharges_branch ON backcharges (branch);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp DESC);`)
  ]);

  // Seed default admin profiles if empty
  try {
    const countRes = await db.prepare("SELECT COUNT(*) as count FROM profiles").first();
    if (!countRes || countRes.count === 0) {
      await db.batch([
        db.prepare(`
          INSERT INTO profiles (id, email, full_name, role, branch, created_at, password) VALUES 
          ('1', 'administrator@assa.id', 'ASSA', 'Administrator', 'Nasional', '2026-06-28T14:38:20.522057+00:00', 'password123'),
          ('l8hovd', 'assa@assa.id', 'ASSA', 'Administrator', 'Nasional', '2026-06-30T12:26:14.358+00:00', 'password123');
        `)
      ]);
    }
  } catch (e) {}
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "");

    // 1. Status Check Endpoint
    if (pathname === "/api/d1/status" && request.method === "GET") {
      const isDbAvailable = !!env.DB;
      return new Response(
        JSON.stringify({
          success: true,
          configured: isDbAvailable,
          authorized: true,
          active: isDbAvailable,
          database: "Cloudflare D1 Worker"
        }),
        { 
          headers: { 
            "Content-Type": "application/json", 
            "Cache-Control": "public, max-age=15, s-maxage=15",
            ...corsHeaders 
          } 
        }
      );
    }

    // 2. Schema Migration & Self-Healing Endpoint
    if (pathname === "/api/d1/migrate" && request.method === "POST") {
      try {
        if (!env.DB) {
          throw new Error("Database binding 'DB' tidak ditemukan.");
        }

        await ensureD1SchemaWorker(env.DB);

        return new Response(
          JSON.stringify({ success: true, message: "Tabel-tabel D1 berhasil dibuat & disiapkan!" }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 3. SQL Query Execution Endpoint with Self-Healing Auto-Migration
    if (pathname === "/api/d1/query" && request.method === "POST") {
      try {
        const { sql, params } = await request.json();

        if (!env.DB) {
          return new Response(
            JSON.stringify({ success: false, error: "Database binding 'DB' tidak ditemukan di Cloudflare Worker/Pages ini." }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Safety optimization: automatically append LIMIT 1000 if a SELECT on backcharges or activity_logs has no limit
        let optimizedSql = sql;
        if (sql && typeof sql === 'string') {
          const sqlUpper = sql.toUpperCase().trim();
          if (sqlUpper.startsWith("SELECT ") && !sqlUpper.includes(" LIMIT ")) {
            if (sqlUpper.includes(" FROM BACKCHARGES") || sqlUpper.includes(" FROM ACTIVITY_LOGS")) {
              optimizedSql = `${sql.trim()} LIMIT 1000`;
            }
          }
        }

        let stmt = env.DB.prepare(optimizedSql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }

        try {
          const result = await stmt.all();
          return new Response(
            JSON.stringify({ success: true, results: result.results || [] }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } catch (execErr) {
          const errText = String(execErr.message || execErr).toLowerCase();
          if (
            errText.includes("no such table") ||
            errText.includes("no such column") ||
            errText.includes("has no column")
          ) {
            console.warn("Auto-healing missing table/column in D1 worker...");
            await ensureD1SchemaWorker(env.DB);

            let retryStmt = env.DB.prepare(optimizedSql);
            if (params && params.length > 0) {
              retryStmt = retryStmt.bind(...params);
            }
            const retryResult = await retryStmt.all();
            return new Response(
              JSON.stringify({ success: true, results: retryResult.results || [] }),
              { headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
          throw execErr;
        }
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Serve static assets for Cloudflare Pages / Workers Sites
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return new Response(
      JSON.stringify({ message: "Backcharge Cloudflare D1 Worker & Pages API Running Successfully!" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};
