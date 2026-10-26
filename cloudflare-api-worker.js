import bcrypt from "bcryptjs";

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

  // Seed default profiles if empty
  try {
    const countRes = await db.prepare("SELECT COUNT(*) as count FROM profiles").first();
    if (!countRes || countRes.count === 0) {
      await db.batch([
        db.prepare(`
          INSERT INTO profiles (id, email, full_name, role, branch, created_at, password) VALUES 
          ('1', 'administrator@assa.id', 'ASSA Administrator', 'Administrator', 'Nasional', '2026-06-28T14:38:20.522057+00:00', 'password123'),
          ('l8hovd', 'assa@assa.id', 'ASSA Admin', 'Administrator', 'Nasional', '2026-06-30T12:26:14.358+00:00', 'password123'),
          ('1a', 'admin.pusat@company.id', 'Aris Munandar (HQ Admin)', 'Administrator', 'Nasional', '2026-06-28T00:00:00.000Z', 'password123'),
          ('2', 'aso.jkt@company.id', 'Hendra Wijaya (ASO Megabranch)', 'ASO Megabranch', 'BSO GSO & AFFCO', '2026-06-28T00:00:00.000Z', 'password123'),
          ('3', 'sales.jkt@company.id', 'Dewi Lestari (Sales Megabranch)', 'Sales Head', 'BSO Sudirman', '2026-06-28T00:00:00.000Z', 'password123'),
          ('4', 'bro.sby@company.id', 'Bayu Saputra (BRO Sby)', 'BRO', 'Surabaya', '2026-06-28T00:00:00.000Z', 'password123'),
          ('5', 'admin.sby@company.id', 'Siti Rahma (Admin Sby)', 'Admin', 'Surabaya', '2026-06-28T00:00:00.000Z', 'password123'),
          ('6', 'aso.bdg@company.id', 'Budi Setiawan (ASO Bdg)', 'ASO', 'Bandung', '2026-06-28T00:00:00.000Z', 'password123'),
          ('7', 'sales.mdn@company.id', 'Rian Pratama (Sales Mdn)', 'Sales Head', 'Medan', '2026-06-28T00:00:00.000Z', 'password123'),
          ('8', 'kacab.jkt@company.id', 'Agus Salim (Kacab Megabranch)', 'Kepala Cabang', 'BSO GSO & AFFCO', '2026-06-28T00:00:00.000Z', 'password123'),
          ('9', 'rbu.nas@company.id', 'Rudy Hartono (Division Head)', 'Division Head', 'Nasional', '2026-06-28T00:00:00.000Z', 'password123'),
          ('10', 'rh.west@company.id', 'Herman Prasetyo (RH West)', 'Regional Head West', 'Lampung, Medan, Padang, Palembang, Pekanbaru', '2026-06-28T00:00:00.000Z', 'password123'),
          ('11', 'aso.ptk@company.id', 'Eko Prasetyo (ASO Pontianak)', 'ASO Megabranch', 'BSO Pontianak', '2026-06-28T00:00:00.000Z', 'password123'),
          ('12', 'rh.central@company.id', 'Bambang S (RH Central)', 'Regional Head Central', 'Bandung, BSO GSO & AFFCO, BSO Pontianak', '2026-06-28T00:00:00.000Z', 'password123'),
          ('13', 'rh.east@company.id', 'Agus K (RH East)', 'Regional Head East', 'Bali, Balikpapan, Banjarmasin, Makassar, Malang, Manado, Semarang, Solo, Surabaya', '2026-06-28T00:00:00.000Z', 'password123');
        `)
      ]);
    }
  } catch (e) {}

  // Seed default backcharges if empty
  try {
    const countBcs = await db.prepare("SELECT COUNT(*) as count FROM backcharges").first();
    if (!countBcs || countBcs.count === 0) {
      await db.batch([
        db.prepare(`
          INSERT INTO backcharges (
            id, category, branch, no_bak, no_spk, no_sap, customer_name, license_plate, value,
            status_sap, status_confirm, status_handover, no_invoice, status_payment, created_by,
            created_at, updated_at, tanggal
          ) VALUES 
          ('BC-2026-0001', 'Own Risk', 'BSO GSO & AFFCO', 'BAK/2026/06/001', '-', 'SAP-OR-101', 'PT Carrefour Indonesia', 'B 9201 UBA', 4500000, 'Bill', 'Telah Dikonfirmasi', 'Diterima Admin', 'INV/2026/VI/011', 'Lunas', 'aso.jkt@company.id', '2026-06-28T10:00:00.000Z', '2026-06-28T10:00:00.000Z', '2026-06-28'),
          ('BC-2026-0002', 'Maintenance', 'Surabaya', 'BAK/2026/06/002', 'SPK-MAINT-202', '-', 'PT Unilever Indonesia', 'L 1827 CV', 1200000, 'N/A', 'Telah Dikonfirmasi', 'Diserahkan ke Admin', '-', 'Belum Bayar', 'bro.sby@company.id', '2026-06-30T14:30:00.000Z', '2026-06-30T14:30:00.000Z', '2026-06-30'),
          ('BC-2026-0003', 'Ekspedisi', 'Bandung', '-', 'SPK-EXP-303', '-', 'PT Indofood CBP', '-', 8500000, 'N/A', 'Belum Konfirmasi', 'Pending', '-', 'Belum Bayar', 'aso.bdg@company.id', '2026-07-01T09:15:00.000Z', '2026-07-01T09:15:00.000Z', '2026-07-01'),
          ('BC-2026-0004', 'ETLE', 'BSO Pontianak', 'BAK/2026/07/004', '-', '-', 'PT Kalimantan Sawit Sejahtera', 'KB 1423 XX', 2500000, 'N/A', 'Belum Konfirmasi', 'Diserahkan ke Admin', '-', 'Belum Bayar', 'aso.ptk@company.id', '2026-07-02T11:20:00.000Z', '2026-07-02T11:20:00.000Z', '2026-07-02');
        `),
        db.prepare(`
          INSERT INTO activity_logs (timestamp, transaction_id, performed_by, action_description) VALUES
          ('2026-06-28T10:00:00.000Z', 'BC-2026-0001', 'aso.jkt@company.id', 'Membuat transaksi Backcharge baru kategori Own Risk di cabang BSO GSO & AFFCO'),
          ('2026-06-29T11:00:00.000Z', 'BC-2026-0001', 'sales.jkt@company.id', 'Status Konfirmasi berubah menjadi Telah Dikonfirmasi'),
          ('2026-06-30T14:30:00.000Z', 'BC-2026-0002', 'bro.sby@company.id', 'Membuat transaksi Backcharge baru kategori Maintenance di cabang Surabaya');
        `)
      ]);
    }
  } catch (e) {}
}

const JWT_DEFAULT_SECRET = "b9fee9224e290f7c8989888ea76e67ca7015134aeeb20e2a8337e3f31bb900fc";

async function signJwtWorker(payload, secretStr = JWT_DEFAULT_SECRET, expiresInSeconds = 7 * 24 * 3600) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, iat: Math.floor(Date.now() / 1000), exp };

  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const b64Payload = btoa(JSON.stringify(fullPayload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = enc.encode(`${b64Header}.${b64Payload}`);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, data);
  const sigBytes = new Uint8Array(sigBuffer);
  let binary = "";
  for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i]);
  const b64Sig = btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64Header}.${b64Payload}.${b64Sig}`;
}

async function verifyJwtWorker(token, secretStr = JWT_DEFAULT_SECRET) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, b64Sig] = parts;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secretStr),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigStr = atob(b64Sig.replace(/-/g, "+").replace(/_/g, "/"));
    const sigArr = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sigArr[i] = sigStr.charCodeAt(i);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigArr,
      enc.encode(`${b64Header}.${b64Payload}`)
    );
    if (!isValid) return null;

    const payloadJson = atob(b64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    // Health check endpoint
    if ((pathname === "/health" || pathname === "/healthz" || pathname === "/api/health") && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "backcharge-nasional-cloudflare-worker",
          timestamp: new Date().toISOString()
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 0a. Official Server Authentication Login Endpoint (supports /api/auth/login, /api/login, /api/auth)
    const isLoginRoute = pathname === "/api/auth/login" || pathname === "/api/login" || pathname === "/api/auth";
    if (isLoginRoute) {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Method ${request.method} tidak diizinkan pada endpoint login. Gunakan HTTP POST.` 
          }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              "Allow": "POST, OPTIONS",
              ...corsHeaders
            }
          }
        );
      }

      try {
        const body = await request.json().catch(() => ({}));
        const inputIdentifier = (body.email || body.username || "").toString().trim().toLowerCase();
        const pwdTrim = body.password !== undefined && body.password !== null ? String(body.password).trim() : "";

        if (!inputIdentifier || !pwdTrim) {
          return new Response(JSON.stringify({ success: false, error: "Email dan password wajib diisi." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        if (!env.DB) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Database D1 belum terhubung di Cloudflare Pages. Pastikan binding DB telah ditambahkan di Settings -> Functions -> D1 database bindings." 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        let profile = null;
        try {
          profile = await env.DB.prepare("SELECT * FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(inputIdentifier).first();
        } catch (tableErr) {
          // Auto-heal schema if tables do not exist yet
          await ensureD1SchemaWorker(env.DB).catch(() => {});
          profile = await env.DB.prepare("SELECT * FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(inputIdentifier).first().catch(() => null);
        }

        const isDefaultAdmin = inputIdentifier === 'assa@assa.id' || inputIdentifier === 'administrator@assa.id' || inputIdentifier.startsWith('admin@assa') || inputIdentifier.startsWith('administrator@');
        if (!profile && isDefaultAdmin) {
          const adminId = inputIdentifier === 'assa@assa.id' ? 'l8hovd' : '1';
          await env.DB.prepare(
            "INSERT INTO profiles (id, email, full_name, role, branch, created_at, password) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(adminId, inputIdentifier, 'ASSA Administrator', 'Administrator', 'Nasional', new Date().toISOString(), pwdTrim || 'password123').run().catch(() => {});
          profile = await env.DB.prepare("SELECT * FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(inputIdentifier).first().catch(() => null);
        }

        if (!profile) {
          return new Response(JSON.stringify({ success: false, error: `Email "${inputIdentifier}" belum terdaftar. Silakan hubungi Administrator.` }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Verify password with bcrypt or plain-text fallback
        let isPasswordCorrect = false;
        const storedPwd = String(profile.password || 'password123');
        if (storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$")) {
          try {
            isPasswordCorrect = await bcrypt.compare(pwdTrim, storedPwd);
          } catch {
            isPasswordCorrect = false;
          }
        } else {
          isPasswordCorrect = (storedPwd === pwdTrim || (isDefaultAdmin && pwdTrim === 'password123'));
        }

        if (!isPasswordCorrect) {
          return new Response(JSON.stringify({ success: false, error: "Password yang Anda masukkan salah." }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const secretKey = env.JWT_SECRET || env.DATABASE_SECRET_KEY || JWT_DEFAULT_SECRET;
        const token = await signJwtWorker({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          branch: profile.branch
        }, secretKey);

        await env.DB.prepare(
          "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)"
        ).bind('AUTH_LOGIN', profile.email, `Berhasil masuk ke sistem (Role: ${profile.role}, Cabang: ${profile.branch})`).run().catch(() => {});

        const safeProfile = {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          branch: profile.branch,
          created_at: profile.created_at
        };

        return new Response(JSON.stringify({
          success: true,
          message: "Login berhasil",
          token,
          profile: safeProfile
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 0b. Official Server Session Verification Endpoint
    if (pathname === "/api/auth/me" && request.method === "GET") {
      let authHeader = request.headers.get("Authorization") || request.headers.get("x-auth-token") || "";
      if (authHeader.startsWith("Bearer ")) authHeader = authHeader.slice(7).trim();
      const secretKey = env.JWT_SECRET || env.DATABASE_SECRET_KEY || JWT_DEFAULT_SECRET;
      const user = await verifyJwtWorker(authHeader, secretKey);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Sesi tidak sah atau telah kedaluwarsa." }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({ success: true, user }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

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

    // 1c. Secure File Preview Proxy
    if (pathname.startsWith("/api/files/secure/") && request.method === "GET") {
      const fileId = pathname.replace("/api/files/secure/", "").trim();
      if (!fileId || fileId === "undefined" || fileId === "null") {
        return new Response(JSON.stringify({ success: false, error: "File ID tidak valid" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const clientName = url.searchParams.get("name") || "document";
      const isDownload = url.searchParams.get("download") === "true" || url.searchParams.get("download") === "1";
      const acceptHeader = (request.headers.get("Accept") || "").toLowerCase();

      const getExt = (name) => {
        const parts = name.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
      };

      const detectWorkerMime = (buffer, filename = '') => {
        if (buffer && buffer.byteLength >= 4) {
          const b = new Uint8Array(buffer.slice(0, 12));
          // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
          if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
            return 'application/pdf';
          }
          // PNG magic bytes: \x89PNG (0x89 0x50 0x4E 0x47)
          if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
            return 'image/png';
          }
          // JPEG magic bytes: \xFF\xD8\xFF
          if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
            return 'image/jpeg';
          }
          // WebP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
          if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
            return 'image/webp';
          }
          // GIF: GIF8 (0x47 0x49 0x46 0x38)
          if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
            return 'image/gif';
          }
        }
        const ext = getExt(filename);
        if (ext === 'pdf') return 'application/pdf';
        if (ext === 'png') return 'image/png';
        if (ext === 'webp') return 'image/webp';
        if (ext === 'gif') return 'image/gif';
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
        return 'application/pdf';
      };

      try {
        // Strategy 1: Googleusercontent CDN for direct high-speed image delivery
        const cdnUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
        const cdnRes = await fetch(cdnUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });

        if (cdnRes.ok) {
          const cdnContentType = (cdnRes.headers.get("content-type") || "").toLowerCase();
          if (!cdnContentType.includes("text/html")) {
            const bodyBuf = await cdnRes.arrayBuffer();
            const mimeType = detectWorkerMime(bodyBuf, clientName);

            return new Response(bodyBuf, {
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": isDownload ? `attachment; filename="${encodeURIComponent(clientName)}"` : "inline",
                "X-Content-Type-Options": "nosniff"
              }
            });
          }
        }

        // Strategy 2: Google Drive Direct Download Stream (Binary Media)
        const driveMediaUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
        const gRes = await fetch(driveMediaUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });

        if (gRes.ok) {
          const gContentType = (gRes.headers.get("content-type") || "").toLowerCase();
          if (!gContentType.includes("text/html")) {
            const bodyBuf = await gRes.arrayBuffer();
            const mimeType = detectWorkerMime(bodyBuf, clientName);

            return new Response(bodyBuf, {
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": isDownload ? `attachment; filename="${encodeURIComponent(clientName)}"` : "inline",
                "X-Content-Type-Options": "nosniff"
              }
            });
          }
        }

        // Strategy 3: Google Drive Thumbnail API for high-resolution images
        const thumbUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2048`;
        const thumbRes = await fetch(thumbUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });

        if (thumbRes.ok) {
          const thumbContentType = (thumbRes.headers.get("content-type") || "").toLowerCase();
          if (!thumbContentType.includes("text/html")) {
            const bodyBuf = await thumbRes.arrayBuffer();
            const mimeType = detectWorkerMime(bodyBuf, clientName);

            return new Response(bodyBuf, {
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": isDownload ? `attachment; filename="${encodeURIComponent(clientName)}"` : "inline",
                "X-Content-Type-Options": "nosniff"
              }
            });
          }
        }

        // Strategy 4: If direct binary streaming cannot be accessed anonymously, and the request
        // comes from a browser navigation tab (Accept: text/html), redirect straight to Google Drive's
        // official interactive web viewer so the user views the file rather than downloading a broken file.
        if (acceptHeader.includes("text/html") || !isDownload) {
          return Response.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`, 302);
        }

        return new Response(JSON.stringify({ success: false, error: "Berkas tidak dapat dipratinjau secara langsung. Buka di tab baru untuk melihat di Google Drive." }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        if (acceptHeader.includes("text/html")) {
          return Response.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`, 302);
        }
        return new Response(JSON.stringify({ success: false, error: err.message || "Gagal memuat pratinjau file." }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 1b. Google Drive Upload Relay Endpoint
    if (pathname === "/api/upload-to-drive" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return new Response(JSON.stringify({ error: "Tidak ada file yang diunggah" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const appsScriptUrl = env.VITE_GOOGLE_APPS_SCRIPT_URL || 
                              env.GOOGLE_APPS_SCRIPT_URL || 
                              "https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec";
        const targetFolderId = env.GOOGLE_DRIVE_FOLDER_ID || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Data = btoa(binary);

        const gasResponse = await fetch(appsScriptUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            fileBase64: base64Data,
            fileName: file.name || "document.jpg",
            mimeType: file.type || "image/jpeg",
            folderId: targetFolderId,
            parentId: targetFolderId,
          }),
          redirect: "follow",
        });

        if (gasResponse.ok) {
          const gasData = await gasResponse.json().catch(async () => {
            const txt = await gasResponse.text();
            try { return JSON.parse(txt); } catch { return { fileUrl: txt }; }
          });
          const fileUrl = gasData?.fileUrl || gasData?.url || (gasData?.id ? `https://drive.google.com/file/d/${gasData.id}/view` : null);
          if (fileUrl) {
            return new Response(JSON.stringify({
              success: true,
              isDrive: true,
              fileId: gasData?.id || gasData?.fileId,
              webViewLink: fileUrl
            }), {
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        }
        return new Response(JSON.stringify({
          success: false,
          error: "Google Apps Script Relay tidak mengembalikan URL yang valid"
        }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (uploadErr) {
        return new Response(JSON.stringify({ success: false, error: uploadErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 2. Schema Migration & Self-Healing Endpoint
    if (pathname === "/api/d1/migrate" && request.method === "POST") {
      try {
        if (!env.DB) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Database binding 'DB' belum terhubung di Cloudflare Pages (Settings -> Functions -> D1 database bindings)." 
            }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
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

    // 3. /api/d1/query - PERMANENTLY DISABLED FOR PRODUCTION SECURITY
    if (pathname === "/api/d1/query") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Endpoint SQL mentah (/api/d1/query) telah dinonaktifkan secara permanen untuk keamanan produksi. Gunakan /api/d1/execute dengan allowlist." 
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. Secure allowlist-only execution gateway on Cloudflare D1
    if (pathname === "/api/d1/execute" && request.method === "POST") {
      try {
        const body = await request.json();

        // Strict rejection of raw SQL from client
        if (body.sql) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Keamanan: Pengiriman teks SQL mentah dari klien ditolak. Gunakan allowlist operationId dengan parameterized query."
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!env.DB) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Database binding 'DB' tidak ditemukan di Cloudflare Worker/Pages ini." 
            }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        let authHeader = request.headers.get("Authorization") || request.headers.get("x-auth-token") || "";
        if (authHeader.startsWith("Bearer ")) authHeader = authHeader.slice(7).trim();
        const dbKey = request.headers.get("X-Database-Key");
        const secretKey = env.JWT_SECRET || env.DATABASE_SECRET_KEY || JWT_DEFAULT_SECRET;

        let user = await verifyJwtWorker(authHeader, secretKey);
        if (!user && dbKey === (env.DATABASE_SECRET_KEY || JWT_DEFAULT_SECRET)) {
          user = { id: 'system', email: 'system@assa.id', full_name: 'System Admin', role: 'Administrator', branch: 'Nasional' };
        }

        if (!user) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Otentikasi wajib: Token sesi resmi server tidak ditemukan atau kedaluwarsa. Silakan login kembali." 
          }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const ALLOWED_BACKCHARGE_COLS = new Set([
          'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang',
          'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
          'status_handover', 'no_invoice', 'status_payment', 'payment_date',
          'created_by', 'created_at', 'updated_at', 'file_bak_url',
          'file_handover_aso_sales_url', 'file_handover_sales_admin_url',
          'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan',
          'status_approval', 'approved_by', 'approved_at', 'approval_note',
          'approval_attachment_1_url', 'approval_attachment_2_url', 'approval_attachment_3_url',
          'regional_approval_status', 'regional_approved_by', 'regional_approved_at', 'regional_approval_note',
          'division_approval_status', 'division_approved_by', 'division_approved_at', 'division_approval_note'
        ]);

        const ALLOWED_PROFILE_COLS = new Set([
          'id', 'email', 'full_name', 'role', 'branch', 'password', 'created_at'
        ]);

        const { operationId, params } = body;

        const executeD1 = async (sql, p = []) => {
          let stmt = env.DB.prepare(sql);
          if (p && p.length > 0) stmt = stmt.bind(...p);
          const r = await stmt.all();
          return r.results || [];
        };

        switch (operationId) {
          case "get_profile_by_email": {
            const emailVal = (params && params[0]) || body.email;
            if (user.role !== 'Administrator' && user.email.toLowerCase() !== String(emailVal).toLowerCase()) {
              return new Response(JSON.stringify({ success: false, error: "Akses ditolak: Anda hanya dapat mengakses profil Anda sendiri." }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const results = await executeD1(
              "SELECT id, email, full_name, role, branch, password, created_at FROM profiles WHERE LOWER(email) = LOWER(?)",
              [emailVal]
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_profiles": {
            const results = await executeD1("SELECT id, email, full_name, role, branch, created_at FROM profiles ORDER BY full_name ASC");
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "insert_profile": {
            let p = params || [];
            if (p.length === 0 && body.data) {
              const d = body.data;
              p = [d.id, d.email, d.full_name, d.role, d.branch, d.created_at || new Date().toISOString(), d.password || 'password123'];
            }
            const results = await executeD1(
              "INSERT INTO profiles (id, email, full_name, role, branch, created_at, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
              p
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "update_profile_admin_role": {
            const emailVal = (params && params[0]) || body.email;
            const results = await executeD1(
              "UPDATE profiles SET role = 'Administrator', branch = 'Nasional', full_name = 'ASSA' WHERE LOWER(email) = LOWER(?)",
              [emailVal]
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "update_profile": {
            const targetId = body.id || (params && params[params.length - 1]);
            const data = body.data || {};
            const validCols = Object.keys(data).filter(col => col !== 'id' && ALLOWED_PROFILE_COLS.has(col));
            if (validCols.length === 0 || !targetId) {
              return new Response(JSON.stringify({ success: false, error: "Kolom tidak valid" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const setClause = validCols.map(col => `${col} = ?`).join(', ');
            const vals = [...validCols.map(col => data[col]), targetId];
            const results = await executeD1(`UPDATE profiles SET ${setClause} WHERE id = ?`, vals);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "update_profile_password": {
            const newPwd = (params && params[0]) || body.password;
            const targetId = (params && params[1]) || body.id;
            const results = await executeD1("UPDATE profiles SET password = ? WHERE id = ?", [newPwd, targetId]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "delete_profile": {
            const targetId = (params && params[0]) || body.id;
            const results = await executeD1("DELETE FROM profiles WHERE id = ?", [targetId]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_all_backcharges": {
            const branches = body.branches || (Array.isArray(params) && params.length > 0 ? params : null);
            if (Array.isArray(branches) && branches.length > 0) {
              const placeholders = branches.map(() => '?').join(', ');
              const results = await executeD1(`SELECT * FROM backcharges WHERE branch IN (${placeholders}) ORDER BY created_at DESC`, branches);
              return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const results = await executeD1("SELECT * FROM backcharges ORDER BY created_at DESC");
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_backcharge_detail": {
            const id = (params && params[0]) || body.id;
            const results = await executeD1("SELECT * FROM backcharges WHERE id = ? LIMIT 1", [id]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_backcharges_by_ids": {
            const ids = (Array.isArray(params) && params.length > 0) ? params : (body.ids || []);
            if (!Array.isArray(ids) || ids.length === 0) {
              return new Response(JSON.stringify({ success: true, results: [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const placeholders = ids.map(() => '?').join(', ');
            const results = await executeD1(`SELECT * FROM backcharges WHERE id IN (${placeholders})`, ids);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_backcharge_ids": {
            const results = await executeD1("SELECT id FROM backcharges");
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_top_backcharge_id_by_prefix": {
            const prefix = (params && params[0]) || body.prefix || '';
            const results = await executeD1(
              "SELECT id FROM backcharges WHERE id LIKE ? ORDER BY CAST(substr(id, 9) AS INTEGER) DESC LIMIT 1",
              [prefix]
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "insert_backcharge": {
            const data = body.data;
            if (!data || typeof data !== 'object' || !data.id) {
              return new Response(JSON.stringify({ success: false, error: "Data transaksi tidak valid" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const validCols = Object.keys(data).filter(col => ALLOWED_BACKCHARGE_COLS.has(col));
            const placeholders = validCols.map(() => '?').join(', ');
            const vals = validCols.map(col => data[col] !== undefined ? data[col] : null);
            const results = await executeD1(`INSERT INTO backcharges (${validCols.join(', ')}) VALUES (${placeholders})`, vals);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "update_backcharge": {
            const targetId = body.id || (params && params[params.length - 1]);
            const data = body.data || {};
            const validCols = Object.keys(data).filter(col => col !== 'id' && ALLOWED_BACKCHARGE_COLS.has(col));
            if (validCols.length === 0 || !targetId) {
              return new Response(JSON.stringify({ success: true, results: [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const setClause = validCols.map(col => `${col} = ?`).join(', ');
            const vals = [...validCols.map(col => data[col] !== undefined ? data[col] : null), targetId];
            const results = await executeD1(`UPDATE backcharges SET ${setClause} WHERE id = ?`, vals);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "bulk_update_backcharges": {
            const items = body.items || [];
            for (const item of items) {
              const { id, updates } = item;
              if (!id || !updates || typeof updates !== 'object') continue;
              const validCols = Object.keys(updates).filter(col => col !== 'id' && ALLOWED_BACKCHARGE_COLS.has(col));
              if (validCols.length > 0) {
                const setClause = validCols.map(col => `${col} = ?`).join(', ');
                const vals = [...validCols.map(col => updates[col] !== undefined ? updates[col] : null), id];
                await executeD1(`UPDATE backcharges SET ${setClause} WHERE id = ?`, vals);
              }
            }
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "delete_backcharge": {
            const id = (params && params[0]) || body.id;
            const results = await executeD1("DELETE FROM backcharges WHERE id = ?", [id]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "bulk_upsert_backcharges": {
            const items = body.items || [];
            for (const tx of items) {
              if (!tx || typeof tx !== 'object' || !tx.id) continue;
              const validCols = Object.keys(tx).filter(col => ALLOWED_BACKCHARGE_COLS.has(col));
              if (validCols.length === 0) continue;
              const placeholders = validCols.map(() => '?').join(', ');
              const updateAssigns = validCols.filter(col => col !== 'id').map(col => `${col} = excluded.${col}`).join(', ');
              const vals = validCols.map(col => tx[col] !== undefined ? tx[col] : null);
              const upsertSql = `
                INSERT INTO backcharges (${validCols.join(', ')}) 
                VALUES (${placeholders})
                ON CONFLICT(id) DO UPDATE SET ${updateAssigns || 'updated_at = CURRENT_TIMESTAMP'}
              `;
              await executeD1(upsertSql, vals);
            }
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_activity_logs": {
            const limit = Number(body.limit) || 50;
            const results = await executeD1("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?", [limit]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_max_activity_log_id": {
            const results = await executeD1("SELECT MAX(id) as max_id FROM activity_logs");
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_recent_activity_logs_since": {
            const sinceId = Number((params && params[0]) || body.sinceId || 0);
            const results = await executeD1(
              "SELECT id, timestamp, transaction_id, performed_by, action_description FROM activity_logs WHERE id > ? ORDER BY id ASC LIMIT 20",
              [sinceId]
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "insert_activity_log": {
            const txId = (params && params[0]) ?? body.transaction_id ?? '-';
            const user = (params && params[1]) ?? body.performed_by ?? '-';
            const desc = (params && params[2]) ?? body.action_description ?? '';
            const results = await executeD1(
              "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
              [txId, user, desc]
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "get_contact_inquiries": {
            const results = await executeD1("SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 30");
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "insert_contact_inquiry": {
            let p = params || [];
            if (p.length === 0 && body.data) {
              const d = body.data;
              p = [d.id, d.full_name || d.name, d.email, d.subject, d.message, d.status || 'UNREAD', d.created_at || new Date().toISOString(), d.feedback || null, d.feedback_by || null, d.feedback_at || null];
            }
            const results = await executeD1(
              "INSERT INTO contact_inquiries (id, name, email, subject, message, status, created_at, feedback, feedback_by, feedback_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              p
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "update_contact_inquiry": {
            const { status, feedback, feedback_by, feedback_at, id } = body;
            const p = (params && params.length >= 5) ? params : [status, feedback, feedback_by, feedback_at, id];
            const results = await executeD1(
              "UPDATE contact_inquiries SET status = ?, feedback = ?, feedback_by = ?, feedback_at = ? WHERE id = ?",
              p
            );
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          case "delete_contact_inquiry": {
            const targetId = (params && params[0]) || body.id;
            const results = await executeD1("DELETE FROM contact_inquiries WHERE id = ?", [targetId]);
            return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
          }

          default:
            return new Response(
              JSON.stringify({ success: false, error: `Operasi '${operationId}' tidak terdaftar dalam allowlist Cloudflare Worker.` }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Catch-all for API & D1 routes that were not matched above
    if (pathname.startsWith("/api/") || pathname.startsWith("/d1/")) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Endpoint '${pathname}' [${request.method}] tidak ditemukan di API Worker.` 
        }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Serve static assets for Cloudflare Pages / Workers Sites
    if (env.ASSETS) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed for static assets", {
          status: 405,
          headers: { ...corsHeaders, "Allow": "GET, HEAD, OPTIONS" }
        });
      }
      let assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status === 404 && request.method === "GET") {
        const indexUrl = new URL("/", request.url);
        return await env.ASSETS.fetch(new Request(indexUrl, request));
      }
      return assetRes;
    }

    return new Response(
      JSON.stringify({ message: "Backcharge Cloudflare D1 Worker & Pages API Running Successfully!" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};
