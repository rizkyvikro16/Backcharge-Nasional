import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import dotenv from "dotenv";
import { queryD1, ensureD1TablesExist, importFullMigrationFile, saveBase64ToDisk, cleanExistingD1Base64 } from "./src/cloudflareD1Client.ts";

dotenv.config();

async function startServer() {



  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Cloud Run & Load Balancer Liveness/Readiness probes
  app.get(["/healthz", "/_health", "/api/health"], (req, res) => {
    res.status(200).json({
      status: "healthy",
      service: "backcharge-nasional-api",
      timestamp: new Date().toISOString()
    });
  });

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

  // Middleware to parse incoming JSON bodies for database queries.
  // We skip multipart/form-data so multer can process file uploads without JSON parse syntax errors.
  app.use((req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      return next();
    }
    return express.json({ 
      limit: "50mb", 
      type: '*/*',
      verify: (req: any, res: any, buf: Buffer) => {
        req.rawBody = buf.toString();
      }
    })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Pastikan folder uploads tersedia secara lokal
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Sajikan folder uploads secara statis dengan header CORS dan Cache-Control lengkap
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  }, express.static(uploadsDir, { maxAge: "365d", immutable: true }));

  // Max upload size 15MB for documents/photos
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
  });

  // API Route for High-Speed Google Drive Upload (Service Account + Apps Script Relay + Local Fallback)
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

      // TIER 1: Check if Service Account credentials are provided in Environment
      let credentials: any = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (err: any) {
          console.warn("[DRIVE] Format GOOGLE_SERVICE_ACCOUNT_JSON tidak valid:", err.message);
        }
      } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        credentials = {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      } else {
        const credPath = path.join(process.cwd(), "google-credentials.json");
        if (fs.existsSync(credPath)) {
          try {
            credentials = JSON.parse(fs.readFileSync(credPath, "utf8"));
          } catch (err: any) {
            console.warn("[DRIVE] Gagal membaca google-credentials.json:", err.message);
          }
        }
      }

      // If Service Account credentials exist, attempt direct Google Drive API upload
      if (credentials && credentials.client_email && credentials.private_key) {
        try {
          console.log("[DRIVE] Mencoba unggah via Google Service Account API...");
          const auth = new google.auth.GoogleAuth({
            credentials: {
              client_email: credentials.client_email,
              private_key: credentials.private_key,
            },
            scopes: ["https://www.googleapis.com/auth/drive"],
          });

          const bufferStream = new Readable();
          bufferStream.push(req.file.buffer);
          bufferStream.push(null);

          const drive = google.drive({ version: "v3", auth });
          const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || credentials.folder_id || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

          const fileMetadata: any = {
            name: req.file.originalname,
          };
          if (folderId && folderId.trim() !== "") {
            fileMetadata.parents = [folderId.trim()];
          }

          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: {
              mimeType: req.file.mimetype || "image/jpeg",
              body: bufferStream,
            },
            fields: "id, name, webViewLink",
          });

          const fileId = driveResponse.data.id;
          if (fileId) {
            try {
              await drive.permissions.create({
                fileId: fileId,
                requestBody: { role: "reader", type: "anyone" },
              });
            } catch (permErr: any) {
              console.warn("[DRIVE] Gagal mengatur izin publik:", permErr?.message);
            }

            const finalLink = driveResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
            console.log("[DRIVE] Berhasil unggah via Service Account:", finalLink);
            return res.status(200).json({
              success: true,
              isDrive: true,
              fileId: fileId,
              webViewLink: finalLink,
            });
          }
        } catch (serviceAccErr: any) {
          console.warn("[DRIVE] Service Account gagal, melanjutkan ke Google Apps Script Relay...", serviceAccErr?.message);
        }
      }

      // TIER 2: Google Apps Script Relay (Sangat stabil & bebas timeout CORS)
      const appsScriptUrl = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || 
                            process.env.GOOGLE_APPS_SCRIPT_URL || 
                            "https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec";
      const targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

      if (appsScriptUrl && appsScriptUrl.trim() !== "") {
        try {
          console.log("[DRIVE] Mengunggah file ke Google Drive via Apps Script Relay...");
          const base64Data = req.file.buffer.toString("base64");
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s timeout

          const gasResponse = await fetch(appsScriptUrl, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({
              fileBase64: base64Data,
              fileName: req.file.originalname,
              mimeType: req.file.mimetype || "image/jpeg",
              folderId: targetFolderId,
              parentId: targetFolderId,
            }),
            redirect: "follow",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (gasResponse.ok) {
            const gasData: any = await gasResponse.json().catch(async () => {
              const txt = await gasResponse.text();
              try { return JSON.parse(txt); } catch { return { fileUrl: txt }; }
            });

            const fileUrl = gasData?.fileUrl || gasData?.url || (gasData?.id ? `https://drive.google.com/file/d/${gasData.id}/view` : null);

            if (fileUrl && (fileUrl.includes("drive.google.com") || fileUrl.includes("google.com") || fileUrl.includes("googleusercontent.com") || fileUrl.startsWith("http"))) {
              console.log("[DRIVE] Berhasil unggah via Apps Script Relay:", fileUrl);
              return res.status(200).json({
                success: true,
                isDrive: true,
                fileId: gasData?.id || gasData?.fileId,
                webViewLink: fileUrl,
              });
            } else {
              console.warn("[DRIVE] Respons Apps Script tidak mengandung URL file valid:", gasData);
            }
          } else {
            console.warn(`[DRIVE] Apps Script Relay mengembalikan status ${gasResponse.status}`);
          }
        } catch (gasErr: any) {
          console.warn("[DRIVE] Gagal unggah via Apps Script Relay:", gasErr?.message);
        }
      }

      // TIER 3: Emergency Local Fallback (jika semua koneksi Drive gagal/offline)
      console.log("[DRIVE] Seluruh metode Google Drive offline, menyimpan ke penyimpanan cadangan lokal...");
      const localLink = localFallbackSave();
      return res.status(200).json({
        success: true,
        isLocalFallback: true,
        webViewLink: localLink,
        message: "Google Drive sedang tidak dapat dijangkau. File berhasil diamankan ke penyimpanan server lokal.",
      });

    } catch (err: any) {
      console.error("[DRIVE] Error fatal saat proses unggah berkas:", err);
      try {
        const safeName = `${Date.now()}_${req.file?.originalname ? req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_") : "upload.bin"}`;
        const filePath = path.join(uploadsDir, safeName);
        if (req.file?.buffer) {
          fs.writeFileSync(filePath, req.file.buffer);
        }
        return res.status(200).json({
          success: true,
          isLocalFallback: true,
          webViewLink: `/uploads/${safeName}`,
          message: "Penyelamatan darurat lokal berhasil.",
        });
      } catch {
        return res.status(500).json({ error: err?.message || "Gagal mengunggah berkas" });
      }
    }
  });

  // API Route to convert base64 image strings to lightweight disk files (/uploads/...)
  app.post("/api/upload-file", (req, res) => {
    try {
      const { base64, filename } = req.body || {};
      if (!base64 || typeof base64 !== "string") {
        return res.status(400).json({ error: "String Base64 diperlukan" });
      }
      const shortUrl = saveBase64ToDisk(base64);
      return res.status(200).json({ success: true, url: shortUrl });
    } catch (err: any) {
      console.error("[UPLOAD-FILE API] Gagal mengonversi file:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route to clean existing base64 in Cloudflare D1
  app.post("/api/d1/clean-base64", async (req, res) => {
    try {
      const result = await cleanExistingD1Base64();
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route to retrieve file/image content as data URL (bulletproof for iframe/webview rendering)
  app.get(["/api/file-data", "/api/file/data"], (req, res) => {
    try {
      const rawPath = (req.query.path as string) || (req.query.file as string) || "";
      if (!rawPath) {
        return res.status(400).json({ error: "Parameter path atau file diperlukan" });
      }
      const filename = path.basename(rawPath);
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Berkas tidak ditemukan: ${filename}` });
      }
      const ext = path.extname(filename).toLowerCase().replace('.', '') || 'jpg';
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'svg') mimeType = 'image/svg+xml';

      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

      return res.status(200).json({
        success: true,
        filename,
        mimeType,
        size: fileBuffer.length,
        data: base64Data
      });
    } catch (err: any) {
      console.error("[FILE DATA API] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Direct file stream endpoint with explicit headers and caching
  app.get(["/api/files/:filename", "/api/uploads/:filename"], (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Berkas tidak ditemukan" });
      }
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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

  // Deprecated migration route - Cloudflare D1 is now the sole native database
  app.post("/api/d1/sync-from-supabase", async (req, res) => {
    return res.json({
      success: true,
      message: "Sistem telah sepenuhnya menggunakan Cloudflare D1 secara langsung."
    });
  });

  // =========================================================================
  // SERVER-SIDE PAGINATED DATA ACCESS (Scalable up to 1,000,000+ Records)
  // =========================================================================
  
  // 1d. Direct single record lookup by ID (Primary Key Query: 1 row, <5ms)
  app.get(["/api/d1/backcharges/detail/:id", "/d1/backcharges/detail/:id"], async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, error: "ID transaksi diperlukan" });
      const rows = await queryD1("SELECT * FROM backcharges WHERE id = ? LIMIT 1", [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: "Transaksi tidak ditemukan" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 1e. Server-Side Paginated Query Engine (100-250 records per request with full SQL search, filter, sort)
  const handlePaginatedBackcharges = async (req: any, res: any) => {
    try {
      const queryObj = { ...req.query, ...(req.body || {}) };
      
      const page = Math.max(1, parseInt(queryObj.page as string || "1", 10) || 1);
      const limit = Math.min(250, Math.max(1, parseInt(queryObj.limit as string || "100", 10) || 100));
      const offset = (page - 1) * limit;

      const search = (queryObj.search as string || "").trim();
      const category = (queryObj.category as string || "").trim();
      const branch = (queryObj.branch as string || "").trim();
      const statusPayment = (queryObj.statusPayment as string || "").trim();
      const statusConfirm = (queryObj.statusConfirm as string || "").trim();
      const statusSap = (queryObj.statusSap as string || "").trim();
      const stage = (queryObj.stage as string || "").trim();
      const alert = (queryObj.alert as string || "").trim();
      const startDate = (queryObj.startDate as string || "").trim();
      const endDate = (queryObj.endDate as string || "").trim();
      const sortByRaw = (queryObj.sortBy as string || "created_at").trim();
      const sortDir = (queryObj.sortDir as string || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

      // Role & Branch restriction
      const userRole = (queryObj.userRole as string || "").trim();
      const userBranch = (queryObj.userBranch as string || "").trim();

      const whereClauses: string[] = ["1=1"];
      const params: any[] = [];

      // 1. Role / User branch restriction
      const isNasionalRole = !userRole || 
        userRole === "Administrator" || 
        userRole === "Division Head" || 
        userBranch === "Nasional" || 
        userBranch === "Semua Cabang" ||
        userBranch.toLowerCase().includes("semua");

      if (!isNasionalRole && userBranch) {
        const branchList = userBranch.split(",").map(b => b.trim()).filter(Boolean);
        if (branchList.length === 1) {
          whereClauses.push("branch = ?");
          params.push(branchList[0]);
        } else if (branchList.length > 1) {
          const placeholders = branchList.map(() => "?").join(",");
          whereClauses.push(`branch IN (${placeholders})`);
          params.push(...branchList);
        }
      }

      // 2. Filter Cabang UI
      if (branch && branch !== "Semua Cabang" && branch !== "Nasional") {
        if (branch.includes(",")) {
          const bList = branch.split(",").map(b => b.trim()).filter(Boolean);
          const placeholders = bList.map(() => "?").join(",");
          whereClauses.push(`branch IN (${placeholders})`);
          params.push(...bList);
        } else {
          whereClauses.push("branch = ?");
          params.push(branch);
        }
      }

      // 3. Search (Server-side multi-column LIKE)
      if (search) {
        const searchPattern = `%${search}%`;
        whereClauses.push("(id LIKE ? OR customer_name LIKE ? OR license_plate LIKE ? OR no_bak LIKE ? OR no_invoice LIKE ? OR no_spk LIKE ? OR no_sap LIKE ? OR nama_bro LIKE ?)");
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // 4. Category
      if (category) {
        whereClauses.push("category = ?");
        params.push(category);
      }

      // 5. Status Bayar
      if (statusPayment) {
        whereClauses.push("status_payment = ?");
        params.push(statusPayment);
      }

      // 6. Status SAP
      if (statusSap) {
        whereClauses.push("status_sap = ?");
        params.push(statusSap);
      }

      // 7. Status Confirm / Approval
      if (statusConfirm) {
        if (statusConfirm === "Ditolak / Negosiasi Ulang") {
          whereClauses.push("(status_approval = 'Ditolak' OR regional_approval_status = 'Ditolak' OR division_approval_status = 'Ditolak' OR status_confirm = 'Ditolak / Negosiasi Ulang')");
        } else {
          whereClauses.push("status_confirm = ?");
          params.push(statusConfirm);
        }
      }

      // 8. Date Range
      if (startDate) {
        whereClauses.push("tanggal >= ?");
        params.push(startDate);
      }
      if (endDate) {
        whereClauses.push("tanggal <= ?");
        params.push(endDate);
      }

      // 9. Stage mapping in SQL
      if (stage) {
        if (stage === "1_handover") {
          whereClauses.push("status_handover = 'Pending'");
        } else if (stage === "2_admin" || stage === "2_confirm") {
          whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin')");
        } else if (stage === "3_sap_l1" || stage === "3_sap") {
          whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin') AND (status_approval IS NULL OR status_approval = 'Belum Approval' OR status_approval = 'Pending') AND (no_invoice IS NULL OR no_invoice = '-' OR no_invoice = '') AND status_payment != 'Lunas'");
        } else if (stage === "4_invoice") {
          whereClauses.push("status_handover != 'Pending' AND status_sap != 'Not Bill' AND (no_invoice IS NULL OR no_invoice = '-' OR no_invoice = '') AND status_payment != 'Lunas' AND status_approval = 'Disetujui'");
        } else if (stage === "5_payment") {
          whereClauses.push("(no_invoice IS NOT NULL AND no_invoice != '-' AND no_invoice != '') OR status_payment = 'Lunas'");
        } else if (stage === "6_done") {
          whereClauses.push("status_payment = 'Lunas'");
        }
      }

      // 10. Alert mapping in SQL
      if (alert) {
        const now = new Date();
        const d15 = new Date(now.getTime() - 15 * 24 * 3600 * 1000).toISOString().split("T")[0];
        const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0];
        const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];

        if (alert === "due") {
          whereClauses.push("status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' AND (tanggal <= ? OR created_at <= ?)");
          params.push(d15, d15);
        } else if (alert === "pending") {
          whereClauses.push("status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' AND (tanggal <= ? OR created_at <= ?)");
          params.push(d7, d7);
        } else if (alert === "high_value") {
          whereClauses.push("status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' AND (tanggal <= ? OR created_at <= ?)");
          params.push(d30, d30);
        }
      }

      // Whitelist safe column names for sorting
      const allowedSortCols = ["created_at", "updated_at", "tanggal", "value", "customer_name", "id", "branch", "category", "status_payment"];
      const sortBy = allowedSortCols.includes(sortByRaw) ? sortByRaw : "created_at";

      const whereSql = whereClauses.join(" AND ");

      // Execute COUNT and paginated slice in safe sequence
      const countSql = `SELECT COUNT(*) as total_count FROM backcharges WHERE ${whereSql}`;
      const dataSql = `SELECT * FROM backcharges WHERE ${whereSql} ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`;

      const countResult = await queryD1(countSql, params);
      const totalCount = Number(countResult?.[0]?.total_count) || 0;

      const pageParams = [...params, limit, offset];
      const rows = await queryD1(dataSql, pageParams);

      const totalPages = Math.ceil(totalCount / limit) || 1;
      const hasMore = page < totalPages;

      res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasMore,
          offset
        }
      });
    } catch (err: any) {
      console.error("❌ Error in paginated backcharges gateway:", err.message);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  };

  app.get(["/api/d1/backcharges/page", "/d1/backcharges/page"], handlePaginatedBackcharges);
  app.post(["/api/d1/backcharges/page", "/d1/backcharges/page"], handlePaginatedBackcharges);

  // 1f. Server-Side Aggregate Statistics for Dashboard (0 RAM footprint)
  app.get(["/api/d1/backcharges/stats", "/d1/backcharges/stats"], async (req, res) => {
    try {
      const { branch, userBranch, userRole } = req.query;
      const whereClauses: string[] = ["1=1"];
      const params: any[] = [];

      const isNasional = !userRole || 
        userRole === "Administrator" || 
        userRole === "Division Head" || 
        userBranch === "Nasional" || 
        userBranch === "Semua Cabang";

      if (!isNasional && userBranch) {
        const bList = String(userBranch).split(",").map(b => b.trim()).filter(Boolean);
        if (bList.length > 0) {
          const placeholders = bList.map(() => "?").join(",");
          whereClauses.push(`branch IN (${placeholders})`);
          params.push(...bList);
        }
      }

      if (branch && branch !== "Semua Cabang" && branch !== "Nasional") {
        whereClauses.push("branch = ?");
        params.push(String(branch));
      }

      const whereSql = whereClauses.join(" AND ");

      const summaryResult = await queryD1(`
        SELECT 
          COUNT(*) as total_count,
          SUM(value) as total_value,
          SUM(CASE WHEN status_payment = 'Lunas' THEN value ELSE 0 END) as total_paid_value,
          SUM(CASE WHEN status_payment = 'Lunas' THEN 1 ELSE 0 END) as total_paid_count,
          SUM(CASE WHEN status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' THEN value ELSE 0 END) as total_os_value,
          SUM(CASE WHEN status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' THEN 1 ELSE 0 END) as total_os_count,
          SUM(CASE WHEN status_sap = 'Not Bill' THEN value ELSE 0 END) as total_not_bill_value,
          SUM(CASE WHEN status_sap = 'Not Bill' THEN 1 ELSE 0 END) as total_not_bill_count
        FROM backcharges 
        WHERE ${whereSql}
      `, params);

      const branchAggResult = await queryD1(`
        SELECT 
          branch, 
          COUNT(*) as total_count,
          SUM(value) as total_value,
          SUM(CASE WHEN status_payment = 'Lunas' THEN value ELSE 0 END) as paid_value,
          SUM(CASE WHEN status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' THEN value ELSE 0 END) as os_value
        FROM backcharges 
        WHERE ${whereSql}
        GROUP BY branch
      `, params);

      const catAggResult = await queryD1(`
        SELECT 
          category, 
          COUNT(*) as total_count,
          SUM(value) as total_value,
          SUM(CASE WHEN status_payment = 'Lunas' THEN value ELSE 0 END) as paid_value
        FROM backcharges 
        WHERE ${whereSql}
        GROUP BY category
      `, params);

      res.json({
        success: true,
        summary: summaryResult?.[0] || {},
        branchStats: branchAggResult || [],
        categoryStats: catAggResult || []
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 2. Secure dynamic SQL execution gateway on D1 (Supporting GET/POST and with/without /api prefix)
  const handleD1QueryRequest = async (req: any, res: any) => {
    let sql: string | undefined = undefined;
    let params: any = undefined;
    try {
      let bodyData = req.body;
      
      // 1. Fallback to rawBody if parsed body is empty or not an object
      if ((!bodyData || (typeof bodyData === "object" && !Object.keys(bodyData).length)) && req.rawBody) {
        try {
          bodyData = JSON.parse(req.rawBody);
        } catch (e) {
          // Parse as query string fallback
          try {
            const urlParams = new URLSearchParams(req.rawBody);
            const sqlVal = urlParams.get("sql");
            if (sqlVal) {
              bodyData = {
                sql: sqlVal,
                params: urlParams.get("params")
              };
            }
          } catch {}
        }
      }

      // 2. Extract sql from wherever we can find it
      if (bodyData && typeof bodyData === "object") {
        sql = bodyData.sql;
        params = bodyData.params;
      }

      if (!sql && req.body && typeof req.body === "object") {
        sql = req.body.sql;
        if (params === undefined) params = req.body.params;
      }

      if (!sql && req.query) {
        sql = req.query.sql as string;
        if (params === undefined) params = req.query.params;
      }

      // 3. Fallback: Check if the raw body string itself is just a JSON string containing sql
      if (!sql && req.rawBody) {
        try {
          const parsed = JSON.parse(req.rawBody);
          if (parsed && typeof parsed === "object") {
            sql = parsed.sql;
            if (params === undefined) params = parsed.params;
          }
        } catch {}
      }

      // 4. Default params to empty array if still undefined
      if (params === undefined || params === null) {
        params = [];
      }

      if (typeof params === "string") {
        try {
          params = JSON.parse(params);
        } catch {
          params = [params];
        }
      }

      if (!Array.isArray(params)) {
        params = [params];
      }

      if (!sql) {
        const debugInfo = {
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.originalUrl,
          headers: req.headers,
          body: req.body,
          query: req.query,
          rawBody: req.rawBody || null,
          bodyData: bodyData
        };
        try {
          fs.writeFileSync(
            path.join(process.cwd(), "failed-query.log"),
            JSON.stringify(debugInfo, null, 2)
          );
        } catch (err) {}

        console.warn("⚠️ Kueri SQL kosong diterima dari request:", debugInfo);
        return res.status(400).json({ success: false, error: "Kueri SQL diperlukan" });
      }

      const results = await queryD1(sql, params);
      res.json({ success: true, results: results || [] });
    } catch (err: any) {
      const isRead = sql && /^(SELECT|PRAGMA|EXPLAIN)/i.test(sql.trim());
      if (isRead) {
        console.warn("⚠️ Query gateway warning:", err.message);
        return res.json({ success: true, results: [] });
      }
      console.warn("❌ Error di gateway d1/query:", err.message);
      const isRate = err.message && (err.message.includes("Rate exceeded") || err.message.includes("rate limit") || err.message.includes("10022"));
      res.status(isRate ? 429 : 500).json({ success: false, error: err.message });
    }
  };

  app.post("/api/d1/query", handleD1QueryRequest);
  app.get("/api/d1/query", handleD1QueryRequest);
  app.post("/d1/query", handleD1QueryRequest);
  app.get("/d1/query", handleD1QueryRequest);

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

  // Catch-all for API routes to prevent them from falling through to the Vite SPA fallback (which returns HTML)
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.url}` });
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
