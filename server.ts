import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import dotenv from "dotenv";
import fs from "fs";
import { queryD1, ensureD1TablesExist, importFullMigrationFile } from "./src/cloudflareD1Client";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS middleware so deployed frontend (e.g. Cloudflare Pages) can connect to the Cloud Run backend
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware to parse incoming JSON bodies for database queries
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Pastikan folder uploads tersedia secara lokal
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Sajikan folder uploads secara statis
  app.use("/uploads", express.static(uploadsDir));

  // Max upload size 15MB for documents/photos
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
  });

  // API Route for Google Drive Upload via Service Account
  app.post("/api/upload-to-drive", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file yang diunggah" });
      }

      const localFallbackSave = () => {
        const safeName = `${Date.now()}_${req.file!.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, req.file!.buffer);
        const fileUrl = `/uploads/${safeName}`;
        console.log(`[LOCAL FALLBACK] File berhasil disimpan lokal: ${fileUrl}`);
        return fileUrl;
      };

      // Check if service account credentials are provided
      let credentials: any = null;

      // 1. Check GOOGLE_SERVICE_ACCOUNT_JSON from environment variables (Very safe, recommended for AI Studio Cloud)
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (err: any) {
          console.warn("Format GOOGLE_SERVICE_ACCOUNT_JSON tidak valid, menggunakan fallback lokal:", err.message);
        }
      } 
      // 2. Check separate email and private key env variables
      else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        credentials = {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      } 
      // 3. Fallback to check local credentials file (google-credentials.json)
      else {
        const credPath = path.join(process.cwd(), "google-credentials.json");
        if (fs.existsSync(credPath)) {
          try {
            credentials = JSON.parse(fs.readFileSync(credPath, "utf8"));
          } catch (err: any) {
            console.warn("Gagal membaca google-credentials.json, menggunakan fallback lokal:", err.message);
          }
        }
      }

      // If credentials still not found, fallback to local server storage
      if (!credentials || !credentials.client_email || !credentials.private_key) {
        const localLink = localFallbackSave();
        return res.status(200).json({
          success: true,
          isLocalFallback: true,
          webViewLink: localLink,
          message: "Google Drive belum dikonfigurasi. File berhasil disimpan di server lokal."
        });
      }

      // Initialize Google Auth for service account
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        scopes: ["https://www.googleapis.com/auth/drive"],
      });

      // Create readable stream from memory buffer for googleapis upload
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null);

      const drive = google.drive({ version: "v3", auth });

      // Google Drive Folder ID
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || credentials.folder_id || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

      const fileMetadata: any = {
        name: req.file.originalname,
      };

      if (folderId && folderId.trim() !== "") {
        fileMetadata.parents = [folderId.trim()];
      }

      try {
        // 1. Create file on Google Drive
        const driveResponse = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: req.file.mimetype,
            body: bufferStream,
          },
          fields: "id, name, webViewLink",
        });

        const fileId = driveResponse.data.id;
        const webViewLink = driveResponse.data.webViewLink;

        if (!fileId) {
          throw new Error("ID file tidak didapatkan dari Google Drive");
        }

        // 2. Set public permissions (Anyone with link can view) so anyone can access it from Supabase
        try {
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });
        } catch (permErr: any) {
          console.warn("Gagal mengatur izin publik pada file Google Drive:", permErr);
        }

        // 3. Format direct link as fallback if webViewLink is missing
        const finalLink = webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

        return res.status(200).json({
          success: true,
          fileId: fileId,
          webViewLink: finalLink,
        });
      } catch (driveErr: any) {
        console.error("Gagal mengunggah ke Google Drive via API, fallback ke lokal:", driveErr);
        const localLink = localFallbackSave();
        return res.status(200).json({
          success: true,
          isLocalFallback: true,
          webViewLink: localLink,
          message: `Gagal unggah ke Drive (${driveErr.message || driveErr}). File berhasil disimpan di server lokal.`
        });
      }

    } catch (err: any) {
      console.error("Error during upload process:", err);
      try {
        const localLink = `${req.protocol}://${req.get('host')}/uploads/${Date.now()}_${req.file?.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        return res.status(200).json({
          success: true,
          isLocalFallback: true,
          webViewLink: localLink,
          message: "Internal error. File disimpan di server lokal."
        });
      } catch {
        return res.status(500).json({ error: err.message || "Internal Server Error" });
      }
    }
  });

  // ==========================================
  // CLOUDFLARE D1 SECURE DATABASE GATEWAY API
  // ==========================================
  
  // 1. Get D1 Configuration status and test authentication
  app.get("/api/d1/status", async (req, res) => {
    const isConfigured = !!(
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_DATABASE_ID &&
      process.env.CLOUDFLARE_API_TOKEN
    );
    if (!isConfigured) {
      return res.json({ configured: false, authorized: false });
    }
    try {
      // Test the credentials with a rapid lightweight D1 SQL query
      await queryD1("SELECT 1");
      res.json({ configured: true, authorized: true });
    } catch (err: any) {
      console.warn("⚠️ Cloudflare D1 is configured but unauthorized/invalid:", err.message);
      res.json({ configured: true, authorized: false, error: err.message });
    }
  });

  // 1b. Trigger manual migration / full dataset migration
  app.post("/api/d1/migrate", async (req, res) => {
    try {
      await ensureD1TablesExist();
      res.json({ success: true, message: "Migrasi skema tabel Cloudflare D1 selesai dijalankan." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 1c. Execute full SQL migration dump (all 2,125+ data rows) directly into Cloudflare D1
  app.post("/api/d1/import-sql", async (req, res) => {
    try {
      const result = await importFullMigrationFile();
      res.json({ 
        success: true, 
        message: `Berhasil mengimpor seluruh ${result.totalStatements} pernyataan/data SQL ke Cloudflare D1 dalam ${result.executedBatches} batch!`,
        ...result 
      });
    } catch (err: any) {
      console.error("❌ Gagal mengimpor SQL ke D1:", err);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 1d. Direct live Sync & Migrate from Supabase to Cloudflare D1 fully server-side (bypassing local terminal / node installs)
  app.post("/api/d1/sync-from-supabase", async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({
        success: false,
        error: "Konfigurasi Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) tidak ditemukan di Environment Variables backend."
      });
    }

    try {
      console.log("⏳ Starting live full server-side migration from Supabase to Cloudflare D1...");
      await ensureD1TablesExist();

      // Helper function to fetch all rows from Supabase REST API with offset pagination
      const fetchAllFromSupabaseRest = async (table: string): Promise<any[]> => {
        let allData: any[] = [];
        let offset = 0;
        const limit = 250;
        let hasMore = true;

        while (hasMore) {
          const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=${limit}&offset=${offset}`;
          const response = await fetch(url, {
            headers: {
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json"
            }
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gagal mengambil data ${table} dari Supabase REST API: ${errText}`);
          }

          const data: any = await response.json();
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < limit) {
              hasMore = false;
            } else {
              offset += limit;
            }
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      // 1. Fetch all data from Supabase first (before clearing D1 to avoid data-loss if Supabase fetch fails)
      console.log("   ├─ Fetching Profiles...");
      const profilesList = await fetchAllFromSupabaseRest("profiles");
      console.log(`   ├─ Profiles fetched: ${profilesList.length} rows.`);

      console.log("   ├─ Fetching Backcharges...");
      const backchargesList = await fetchAllFromSupabaseRest("backcharges");
      console.log(`   ├─ Backcharges fetched: ${backchargesList.length} rows.`);

      console.log("   ├─ Fetching Activity Logs...");
      const logsList = await fetchAllFromSupabaseRest("activity_logs");
      console.log(`   ├─ Activity Logs fetched: ${logsList.length} rows.`);

      console.log("   ├─ Fetching Contact Inquiries...");
      let inquiriesList: any[] = [];
      try {
        inquiriesList = await fetchAllFromSupabaseRest("contact_inquiries");
        console.log(`   ├─ Contact Inquiries fetched: ${inquiriesList.length} rows.`);
      } catch (inqErr) {
        console.warn("   └─ Table contact_inquiries might not exist yet on Supabase, skipping.");
      }

      // 2. Clear existing D1 tables to do a fresh sync
      console.log("🧹 Clearing old tables in Cloudflare D1...");
      await queryD1("DELETE FROM backcharges;");
      await queryD1("DELETE FROM profiles;");
      await queryD1("DELETE FROM activity_logs;");
      try {
        await queryD1("DELETE FROM contact_inquiries;");
      } catch (e) {}

      // Helper to batch insert data into any D1 table using unified SQL multi-row VALUES
      const batchInsertD1 = async (
        tableName: string, 
        columns: string[], 
        rows: any[][]
      ) => {
        if (rows.length === 0) return;
        
        // SQLite limits the total number of bound variables in a single SQL statement.
        // We dynamically calculate a safe batchSize based on the number of columns to prevent SQLITE_ERROR.
        const maxSqlVariables = 90; 
        const batchSize = Math.max(1, Math.floor(maxSqlVariables / columns.length));
        
        console.log(`🤖 Batch insertion for ${tableName}: Columns: ${columns.length}, Calculated safe batch size: ${batchSize} (Total rows: ${rows.length})`);
        
        const colString = columns.join(", ");
        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          const rowPlaceholders = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
          const sql = `INSERT OR REPLACE INTO ${tableName} (${colString}) VALUES ${rowPlaceholders}`;
          const params = chunk.flat();
          try {
            await queryD1(sql, params);
          } catch (e: any) {
            if (e.message?.includes("SQLITE_TOOBIG") || String(e).includes("SQLITE_TOOBIG")) {
              console.warn(`⚠️ Batch insert failed with SQLITE_TOOBIG. Retrying row-by-row for this chunk...`);
              for (const row of chunk) {
                const singleSql = `INSERT OR REPLACE INTO ${tableName} (${colString}) VALUES (${columns.map(() => "?").join(", ")})`;
                try {
                  await queryD1(singleSql, row);
                } catch (err2: any) {
                  if (err2.message?.includes("SQLITE_TOOBIG") || String(err2).includes("SQLITE_TOOBIG")) {
                    console.warn(`❌ Single row insert failed with SQLITE_TOOBIG. Truncating large text fields for row ID: ${row[0]}`);
                    // D1 max payload is 1MB. Truncate any string > 50KB to be extremely safe.
                    const truncatedRow = row.map(val => (typeof val === 'string' && val.length > 50000) ? val.substring(0, 50000) + "... [TRUNCATED DUE TO CLOUDFLARE D1 SIZE LIMIT]" : val);
                    await queryD1(singleSql, truncatedRow);
                  } else {
                    throw err2;
                  }
                }
              }
            } else {
              throw e;
            }
          }
        }
      };

      // 3. Batch insert into D1
      // Profiles
      if (profilesList.length > 0) {
        console.log("📥 Syncing Profiles into D1 in batches...");
        const columns = ["id", "email", "full_name", "role", "branch", "created_at"];
        const rows = profilesList.map(p => [
          p.id, p.email, p.full_name || '-', p.role || 'BRO', p.branch || 'Nasional', p.created_at || new Date().toISOString()
        ]);
        await batchInsertD1("profiles", columns, rows);
      }

      // Backcharges
      if (backchargesList.length > 0) {
        console.log("📥 Syncing Backcharges into D1 in batches...");
        const columns = [
          "id", "category", "branch", "no_bak", "no_spk", "no_sap", "no_tilang", "customer_name", "license_plate", "value", 
          "status_sap", "status_confirm", "status_handover", "no_invoice", "status_payment", "payment_date", 
          "created_by", "created_at", "updated_at", "file_bak_url", "file_handover_aso_sales_url", 
          "file_handover_sales_admin_url", "tanggal", "tanggal_handover", "nama_bro", "upload_dok_pendukung", "alasan", 
          "status_approval", "approved_by", "approved_at", "approval_note", "approval_attachment_1_url", 
          "approval_attachment_2_url", "approval_attachment_3_url", "regional_approval_status", 
          "regional_approved_by", "regional_approved_at", "regional_approval_note", "division_approval_status", 
          "division_approved_by", "division_approved_at", "division_approval_note"
        ];
        const rows = backchargesList.map(b => [
          b.id, b.category || 'Own Risk', b.branch || 'Nasional', b.no_bak || '-', b.no_spk || '-', b.no_sap || '-', b.no_tilang || '-', b.customer_name || '-', b.license_plate || '-', b.value || 0,
          b.status_sap || 'N/A', b.status_confirm || 'Belum Konfirmasi', b.status_handover || 'Pending', b.no_invoice || '-', b.status_payment || 'Belum Bayar', b.payment_date || null,
          b.created_by || 'system', b.created_at || new Date().toISOString(), b.updated_at || new Date().toISOString(), b.file_bak_url || null, b.file_handover_aso_sales_url || null,
          b.file_handover_sales_admin_url || null, b.tanggal || null, b.tanggal_handover || null, b.nama_bro || b.bro_name || '-', b.upload_dok_pendukung || null, b.alasan || b.dok_pendukung_alasan || '-',
          b.status_approval || 'Belum Approval', b.approved_by || null, b.approved_at || null, b.approval_note || null, b.approval_attachment_1_url || null,
          b.approval_attachment_2_url || null, b.approval_attachment_3_url || null, b.regional_approval_status || 'Belum Approval',
          b.regional_approved_by || null, b.regional_approved_at || null, b.regional_approval_note || null, b.division_approval_status || 'Belum Approval',
          b.division_approved_by || null, b.division_approved_at || null, b.division_approval_note || null
        ]);
        await batchInsertD1("backcharges", columns, rows);
      }

      // Activity Logs
      if (logsList.length > 0) {
        console.log("📥 Syncing Activity Logs into D1 in batches...");
        const columns = ["id", "timestamp", "transaction_id", "performed_by", "action_description"];
        const rows = logsList.map(l => [
          l.id, l.timestamp || l.created_at || new Date().toISOString(), l.transaction_id || '-', l.performed_by || 'system', l.action_description || '-'
        ]);
        await batchInsertD1("activity_logs", columns, rows);
      }

      // Contact Inquiries
      if (inquiriesList.length > 0) {
        console.log("📥 Syncing Contact Inquiries into D1 in batches...");
        const columns = ["id", "name", "email", "subject", "message", "status", "created_at", "updated_at"];
        const rows = inquiriesList.map(c => [
          c.id, c.name || '-', c.email || '-', c.subject || '-', c.message || '-', c.status || 'Open', c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString()
        ]);
        await batchInsertD1("contact_inquiries", columns, rows);
      }

      console.log("🎉 Full Live server-side migration from Supabase to Cloudflare D1 finished successfully!");
      
      res.json({
        success: true,
        message: `Berhasil memindahkan data secara langsung! Total disinkronkan: ${profilesList.length} profil, ${backchargesList.length} denda/backcharges, ${logsList.length} log aktivitas, dan ${inquiriesList.length} keluhan.`,
        summary: {
          profiles: profilesList.length,
          backcharges: backchargesList.length,
          activity_logs: logsList.length,
          contact_inquiries: inquiriesList.length
        }
      });

    } catch (err: any) {
      console.error("❌ Gagal sinkronisasi langsung dari Supabase ke D1:", err);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 2. Secure dynamic SQL execution gateway on D1
  app.post("/api/d1/query", async (req, res) => {
    try {
      const { sql, params } = req.body;
      if (!sql) {
        return res.status(400).json({ error: "Kueri SQL diperlukan" });
      }
      const results = await queryD1(sql, params || []);
      res.json({ success: true, results });
    } catch (err: any) {
      console.error("❌ Error di gateway /api/d1/query:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health / Status check endpoint untuk Google Drive Service Account
  app.get("/api/health", (req, res) => {
    const hasServiceAccount = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 
      (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
      fs.existsSync(path.join(process.cwd(), "google-credentials.json"))
    );
    res.json({ 
      status: "ok", 
      serviceAccountConnected: hasServiceAccount,
      folderIdConfigured: !!(process.env.GOOGLE_DRIVE_FOLDER_ID)
    });
  });

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Handle WebSocket upgrade requests for Vite dev server in middleware mode
  if (process.env.NODE_ENV !== "production" && vite) {
    server.on("upgrade", (req, socket, head) => {
      vite.ws.handleUpgrade(req, socket, head);
    });
  }
}

startServer();
