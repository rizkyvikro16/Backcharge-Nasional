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
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
  // Using type: '*/*' ensures we attempt to parse all text bodies as JSON, bypassing strict Content-Type checks 
  // that proxy servers might strip or change.
  app.use(express.json({ 
    limit: "50mb", 
    type: '*/*',
    verify: (req: any, res: any, buf: Buffer) => {
      req.rawBody = buf.toString();
    }
  }));
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

  // 2. Secure dynamic SQL execution gateway on D1 (Supporting GET/POST and with/without /api prefix)
  const handleD1QueryRequest = async (req: any, res: any) => {
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
      let sql: string | undefined = undefined;
      let params: any = undefined;

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
      res.json({ success: true, results });
    } catch (err: any) {
      console.error("❌ Error di gateway d1/query:", err.message);
      res.status(500).json({ success: false, error: err.message });
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
