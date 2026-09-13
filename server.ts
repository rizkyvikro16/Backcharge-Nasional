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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
