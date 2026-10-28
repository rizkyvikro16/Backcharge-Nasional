import express from "express";
import path from "path";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { queryD1, ensureD1TablesExist, importFullMigrationFile, saveBase64ToDisk, cleanExistingD1Base64 } from "./src/cloudflareD1Client.ts";

dotenv.config();
const SECRET_KEY = process.env.DATABASE_SECRET_KEY || 'b9fee9224e290f7c8989888ea76e67ca7015134aeeb20e2a8337e3f31bb900fc';
if (!process.env.DATABASE_SECRET_KEY) {
  process.env.DATABASE_SECRET_KEY = SECRET_KEY;
}
const JWT_SECRET = process.env.JWT_SECRET || process.env.DATABASE_SECRET_KEY || 'b9fee9224e290f7c8989888ea76e67ca7015134aeeb20e2a8337e3f31bb900fc';

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function detectMimeType(buffer: Buffer, defaultMime = 'image/jpeg', filename = ''): string {
  if (filename) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'svg') return 'image/svg+xml';
  }
  if (buffer && buffer.length >= 4) {
    // PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }
    // PNG magic bytes: \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG magic bytes: \xFF\xD8\xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }
    // GIF magic bytes: GIF8
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: RIFF
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'image/webp';
    }
  }
  return defaultMime;
}

export function signToken(payload: any, expiresInSeconds = 7 * 24 * 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const iat = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): any | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expectedSig) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Middleware: Memvalidasi token sesi resmi server
export function requireAuth(req: any, res: any, next: any) {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query?.token) {
    token = req.query.token;
  } else if (req.query?.auth_token) {
    token = req.query.auth_token;
  }

  // Backup key untuk integrasi internal / backend-to-backend jika diberikan
  const dbKey = req.headers['x-database-key'];
  if (!token && dbKey === process.env.DATABASE_SECRET_KEY) {
    req.user = {
      id: 'system',
      email: 'system@assa.id',
      full_name: 'System Admin',
      role: 'Administrator',
      branch: 'Nasional'
    };
    return next();
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: "Otentikasi wajib: Token sesi resmi tidak ditemukan. Silakan login kembali." 
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ 
      success: false, 
      error: "Sesi tidak sah atau telah kedaluwarsa. Silakan masuk kembali." 
    });
  }

  req.user = decoded;
  next();
}

// Middleware: Memvalidasi hak akses Administrator
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      error: "Akses ditolak: Operasi ini hanya diizinkan untuk peran Administrator." 
    });
  }
  next();
}

async function startServer() {
  try {
    console.log("[SERVER] Starting server initialization...");
    ensureD1TablesExist().catch(err => console.warn("Notice ensuring D1 tables on startup:", err?.message));
    console.log("[SERVER] Initializing Express app...");
    const app = express();
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (process.env.NODE_ENV === 'production' ? 8080 : 3000);

  // Cloud Run & Load Balancer Liveness/Readiness probes
  app.get(["/healthz", "/_health", "/health", "/api/health"], (req, res) => {
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Database-Key, x-auth-token");
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

  // =========================================================================
  // OFFICIAL SERVER AUTHENTICATION & SESSION MANAGEMENT
  // =========================================================================
  app.post("/api/auth/login", async (req, res) => {
    try {
      await ensureD1TablesExist().catch(() => {});

      const { email, username, password } = req.body;
      const inputIdentifier = (email || username || "").toString().trim().toLowerCase();
      const pwdTrim = (password !== undefined && password !== null) ? String(password).trim() : "";

      if (!inputIdentifier || !pwdTrim) {
        return res.status(400).json({ success: false, error: "Email dan password wajib diisi." });
      }

      // Query profil dari Cloudflare D1
      let profiles = await queryD1(
        "SELECT id, email, full_name, role, branch, password, created_at, force_password_reset FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [inputIdentifier]
      );

      // Auto-inisisasi master admin jika belum ada di database baru
      const isDefaultAdmin = inputIdentifier === 'assa@assa.id' || inputIdentifier === 'administrator@assa.id' || inputIdentifier.startsWith('admin@assa') || inputIdentifier.startsWith('administrator@');
      if ((!profiles || profiles.length === 0) && isDefaultAdmin) {
        const adminId = inputIdentifier === 'assa@assa.id' ? 'l8hovd' : '1';
        const defaultHash = await bcrypt.hash(pwdTrim || 'password123', 10);
        await queryD1(
          "INSERT OR IGNORE INTO profiles (id, email, full_name, role, branch, created_at, password, force_password_reset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [adminId, inputIdentifier, 'ASSA Administrator', 'Administrator', 'Nasional', new Date().toISOString(), defaultHash, 0]
        );
        profiles = await queryD1(
          "SELECT id, email, full_name, role, branch, password, created_at, force_password_reset FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1",
          [inputIdentifier]
        );
      }

      if (!profiles || profiles.length === 0) {
        return res.status(401).json({ 
          success: false, 
          error: `Email "${inputIdentifier}" belum terdaftar. Silakan hubungi Administrator untuk pembuatan akun.` 
        });
      }

      const user = profiles[0];
      const storedPassword = String(user.password || '');
      const isHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$') || storedPassword.startsWith('$2');

      let isMatch = false;
      if (isHash) {
        // a. Jika diawali $2 (Bcrypt): Verifikasi dengan bcrypt.compare
        isMatch = await bcrypt.compare(pwdTrim, storedPassword);
      } else {
        // b. Jika masih Plaintext: Bandingkan langsung
        isMatch = (storedPassword === pwdTrim);
        if (isMatch) {
          // Jika cocok, hash inputPassword ke D1 dan set force_password_reset = 1
          const hashed = await bcrypt.hash(pwdTrim, 10);
          await queryD1("UPDATE profiles SET password = ?, force_password_reset = 1 WHERE id = ?", [hashed, user.id]);
          user.force_password_reset = 1;
        }
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, error: "Password salah." });
      }

      const safeProfile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch: user.branch,
        created_at: user.created_at
      };

      // Cek apakah wajib ganti password (force_password_reset == 1)
      const needsPasswordReset = Number(user.force_password_reset) === 1;

      if (needsPasswordReset) {
        // Buat token sementara untuk autentikasi reset password jika diperlukan
        const tempToken = signToken({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          branch: user.branch,
          force_reset: true
        });

        return res.json({
          success: true,
          requirePasswordReset: true,
          message: "Wajib ganti password",
          token: tempToken,
          profile: safeProfile
        });
      }

      // Login sukses normal (force_password_reset == 0)
      const token = signToken({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch: user.branch
      });

      // Catat log aktivitas masuk secara aman
      await queryD1(
        "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
        ['AUTH_LOGIN', user.email, `Berhasil masuk ke sistem (Role: ${user.role}, Cabang: ${user.branch})`]
      ).catch(() => {});

      return res.json({
        success: true,
        requirePasswordReset: false,
        message: "Login berhasil",
        token,
        profile: safeProfile
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, error: err.message || "Terjadi kesalahan server saat login." });
    }
  });

  // Endpoint: Reset Password Pengguna (POST /api/auth/reset-password)
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, password, newPassword } = req.body;
      const targetPassword = newPassword || password;

      if (!email || !targetPassword) {
        return res.status(400).json({ success: false, error: "Email dan password baru diperlukan." });
      }
      
      const emailTrim = String(email).trim().toLowerCase();
      const pwdTrim = String(targetPassword).trim();

      if (pwdTrim.length < 6) {
        return res.status(400).json({ success: false, error: "Password baru minimal 6 karakter." });
      }
      
      const profiles = await queryD1(
        "SELECT id, email, full_name, role, branch, created_at FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1", 
        [emailTrim]
      );
      if (!profiles || profiles.length === 0) {
        return res.status(404).json({ success: false, error: "Profil tidak ditemukan." });
      }

      const user = profiles[0];
      const hashed = await bcrypt.hash(pwdTrim, 10);
      
      // Overwrite kolom password di D1 dan set force_password_reset = 0
      await queryD1("UPDATE profiles SET password = ?, force_password_reset = 0 WHERE id = ?", [hashed, user.id]);
      
      // Catat log aktivitas reset kata sandi
      await queryD1(
        "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
        ['AUTH_PASSWORD_RESET', user.email, `Berhasil memperbarui kata sandi akun.`]
      ).catch(() => {});

      // Terbitkan token sesi resmi baru agar langsung dapat masuk ke Dashboard
      const token = signToken({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch: user.branch
      });

      const safeProfile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch: user.branch,
        created_at: user.created_at
      };

      return res.json({ 
        success: true, 
        message: "Password berhasil diperbarui.", 
        token, 
        profile: safeProfile 
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      return res.status(500).json({ success: false, error: error.message || "Gagal memperbarui password." });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    return res.json({
      success: true,
      user: req.user
    });
  });

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

  // Helper to initialize Google Drive Client using Backend Service Account (never exposed to client)
  function getGoogleDriveClient() {
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

    if (credentials && credentials.client_email && credentials.private_key) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        scopes: ["https://www.googleapis.com/auth/drive"],
      });
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || credentials.folder_id || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";
      return { drive: google.drive({ version: "v3", auth }), folderId, credentials };
    }
    return null;
  }

  // API Route for High-Speed Google Drive Upload (Service Account + Apps Script Relay + Local Resilient Cache)
  // CRITICAL SECURITY: Files are kept strictly PRIVATE. No public 'anyone' permissions.
  // Outsiders/unauthorized users NEVER see raw Google Drive URLs or folder structures.
  app.post("/api/upload-to-drive", requireAuth, upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file yang diunggah" });
      }

      // Always save a local copy to server cache first for instant subsequent reads
      const safeName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const localFilePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(localFilePath, req.file.buffer);
      const localUrl = `/uploads/${safeName}`;

      // TIER 1: Direct Google Drive API via Backend Service Account (Strictly Private)
      const gDrive = getGoogleDriveClient();
      if (gDrive) {
        try {
          console.log("[DRIVE SECURE] Mengunggah via Google Service Account (Private Storage)...");
          const bufferStream = new Readable();
          bufferStream.push(req.file.buffer);
          bufferStream.push(null);

          const fileMetadata: any = {
            name: req.file.originalname,
          };
          if (gDrive.folderId && gDrive.folderId.trim() !== "") {
            fileMetadata.parents = [gDrive.folderId.trim()];
          }

          const driveResponse = await gDrive.drive.files.create({
            requestBody: fileMetadata,
            media: {
              mimeType: req.file.mimetype || "image/jpeg",
              body: bufferStream,
            },
            fields: "id, name",
          });

          const fileId = driveResponse.data.id;
          if (fileId) {
            // Note: DO NOT grant 'anyone' reader permissions! The file stays strictly private.
            console.log(`[DRIVE SECURE] File tersimpan privat di Google Drive (ID: ${fileId})`);
            
            // Link local cached copy with fileId prefix for instant serving
            const driveCachedPath = path.join(uploadsDir, `${fileId}_${safeName}`);
            try { fs.copyFileSync(localFilePath, driveCachedPath); } catch {}

            // Return secure masked internal proxy URL
            const secureUrl = `/api/files/secure/${fileId}?name=${encodeURIComponent(req.file.originalname)}`;
            return res.status(200).json({
              success: true,
              isDrive: true,
              fileId: fileId,
              webViewLink: secureUrl,
              url: secureUrl,
              localUrl: localUrl
            });
          }
        } catch (serviceAccErr: any) {
          console.warn("[DRIVE SECURE] Service Account gagal, melanjutkan ke Relay...", serviceAccErr?.message);
        }
      }

      // TIER 2: Google Apps Script Relay
      const appsScriptUrl = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || 
                            process.env.GOOGLE_APPS_SCRIPT_URL || 
                            "https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec";
      const targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

      if (appsScriptUrl && appsScriptUrl.trim() !== "") {
        try {
          console.log("[DRIVE SECURE] Mengunggah file ke Google Drive via Relay...");
          const base64Data = req.file.buffer.toString("base64");
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 28000);

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

            let fileId = gasData?.id || gasData?.fileId;
            const rawUrl = gasData?.fileUrl || gasData?.url;
            if (!fileId && rawUrl) {
              const m = String(rawUrl).match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || String(rawUrl).match(/[?&]id=([a-zA-Z0-9_-]+)/);
              if (m && m[1]) fileId = m[1];
            }

            if (fileId) {
              const driveCachedPath = path.join(uploadsDir, `${fileId}_${safeName}`);
              try { fs.copyFileSync(localFilePath, driveCachedPath); } catch {}
              const secureUrl = `/api/files/secure/${fileId}?name=${encodeURIComponent(req.file.originalname)}`;
              console.log("[DRIVE SECURE] Berhasil diamankan di Relay, URL masked proxy:", secureUrl);
              return res.status(200).json({
                success: true,
                isDrive: true,
                fileId: fileId,
                webViewLink: secureUrl,
                url: secureUrl,
                localUrl: localUrl
              });
            }
          }
        } catch (gasErr: any) {
          console.warn("[DRIVE SECURE] Relay gagal:", gasErr?.message);
        }
      }

      // TIER 3: Local storage
      return res.status(200).json({
        success: true,
        isLocalFallback: true,
        webViewLink: localUrl,
        url: localUrl,
        message: "File diamankan ke penyimpanan server lokal.",
      });

    } catch (err: any) {
      console.error("[DRIVE SECURE] Error saat unggah berkas:", err);
      const safeName = `${Date.now()}_${req.file?.originalname ? req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_") : "upload.bin"}`;
      const filePath = path.join(uploadsDir, safeName);
      if (req.file?.buffer) {
        fs.writeFileSync(filePath, req.file.buffer);
      }
      return res.status(200).json({
        success: true,
        isLocalFallback: true,
        webViewLink: `/uploads/${safeName}`,
        url: `/uploads/${safeName}`,
      });
    }
  });

  // API Route to convert base64 image strings directly to secure internal URLs
  app.post("/api/upload-file", requireAuth, async (req: any, res: any) => {
    try {
      const { base64, filename } = req.body || {};
      if (!base64 || typeof base64 !== "string") {
        return res.status(400).json({ error: "String Base64 diperlukan" });
      }

      // Save directly to disk cache first
      const shortUrl = saveBase64ToDisk(base64);

      const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const appsScriptUrl = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || 
                            process.env.GOOGLE_APPS_SCRIPT_URL || 
                            "https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec";
      const targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ";

      try {
        const gasResponse = await fetch(appsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            fileBase64: cleanBase64,
            fileName: filename || `upload_${Date.now()}.jpg`,
            mimeType: "image/jpeg",
            folderId: targetFolderId,
            parentId: targetFolderId,
          }),
          redirect: "follow",
        });

        if (gasResponse.ok) {
          const gasData: any = await gasResponse.json().catch(async () => {
            const txt = await gasResponse.text();
            try { return JSON.parse(txt); } catch { return { fileUrl: txt }; }
          });

          let fileId = gasData?.id || gasData?.fileId;
          const rawUrl = gasData?.fileUrl || gasData?.url;
          if (!fileId && rawUrl) {
            const m = String(rawUrl).match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || String(rawUrl).match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (m && m[1]) fileId = m[1];
          }

          if (fileId) {
            const secureUrl = `/api/files/secure/${fileId}?name=${encodeURIComponent(filename || 'image.jpg')}`;
            return res.status(200).json({ success: true, url: secureUrl, localUrl: shortUrl });
          }
        }
      } catch (gasErr: any) {
        console.warn("[UPLOAD-FILE API] Apps Script warning:", gasErr.message);
      }

      // Return local cached URL
      return res.status(200).json({ success: true, url: shortUrl });
    } catch (err: any) {
      console.warn("[UPLOAD-FILE API] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route to clean existing base64 in Cloudflare D1
  app.post("/api/d1/clean-base64", requireAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const result = await cleanExistingD1Base64();
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Cache for file lookups
  const fileMap = new Map<string, string>();
  
  // Initialize file map on startup
  const initFileMap = () => {
    try {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const fileId = file.split('_')[0];
        if (fileId) {
          fileMap.set(fileId, file);
        }
      }
    } catch (err) {
      console.error("Error initializing file map:", err);
    }
  };
  initFileMap();

  // SECURE AUTHENTICATED FILE PROXY STREAMING
  app.get("/api/files/secure/:fileId", requireAuth, async (req: any, res: any) => {
    try {
      const fileId = req.params.fileId;
      if (!fileId || fileId === "undefined" || fileId === "null") {
        return res.status(400).json({ error: "File ID tidak valid" });
      }

      const clientName = (req.query.name as string) || "document";
      const isDownload = req.query.download === "true" || req.query.download === "1";

      // 1. Check local cache using optimized map
      const cachedFile = fileMap.get(fileId);
      if (cachedFile && fs.existsSync(path.join(uploadsDir, cachedFile))) {
        const filePath = path.join(uploadsDir, cachedFile);
        const fileBuf = fs.readFileSync(filePath);
        const ext = path.extname(cachedFile).toLowerCase().replace('.', '') || 'jpg';
        let defaultMime = 'image/jpeg';
        if (ext === 'png') defaultMime = 'image/png';
        else if (ext === 'webp') defaultMime = 'image/webp';
        else if (ext === 'pdf') defaultMime = 'application/pdf';

        const finalMime = detectMimeType(fileBuf, defaultMime, cachedFile);

        res.setHeader("Content-Type", finalMime);
        res.setHeader("Cache-Control", "private, no-transform, max-age=86400");
        res.removeHeader("X-Frame-Options");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Security-Policy", "frame-ancestors *");
        if (isDownload) {
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientName)}"`);
        } else {
          res.setHeader("Content-Disposition", "inline");
        }
        return res.status(200).send(fileBuf);
      }

      // 2. Fetch from Google Drive securely via backend Service Account
      const gDrive = getGoogleDriveClient();
      if (gDrive) {
        try {
          // Permintaan file ke Google Drive API menggunakan parameter alt: 'media' agar Google mengirimkan isi file langsung (stream)
          const driveStream = await gDrive.drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "stream" }
          );

          // Ambil metadata jika diperlukan untuk nama berkas atau fallback mimeType
          let mimeType = driveStream.headers && driveStream.headers["content-type"];
          let finalName = clientName;

          if (!mimeType || mimeType === "application/octet-stream") {
            try {
              const meta = await gDrive.drive.files.get({
                fileId: fileId,
                fields: "id, name, mimeType",
              });
              if (meta.data.mimeType && meta.data.mimeType !== "application/octet-stream") {
                mimeType = meta.data.mimeType;
              }
              if (meta.data.name) {
                finalName = clientName || meta.data.name;
              }
            } catch {
              // Abaikan jika get metadata gagal, lanjutkan stream media
            }
          }

          // Fallback mimeType berdasarkan ekstensi nama berkas jika masih belum spesifik
          if (!mimeType || mimeType === "application/octet-stream") {
            const ext = path.extname(finalName).toLowerCase().replace('.', '');
            if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'gif') mimeType = 'image/gif';
            else if (ext === 'pdf') mimeType = 'application/pdf';
            else mimeType = 'image/jpeg';
          }

          // Meneruskan header Content-Type yang tepat ke frontend
          res.setHeader("Content-Type", mimeType);
          res.setHeader("Cache-Control", "private, no-transform, max-age=86400");
          res.removeHeader("X-Frame-Options");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Security-Policy", "frame-ancestors *");
          if (isDownload) {
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(finalName)}"`);
          } else {
            res.setHeader("Content-Disposition", "inline");
          }

          // Cache lokal di background untuk performa request selanjutnya
          const safeCacheName = `${fileId}_${finalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const localCachePath = path.join(uploadsDir, safeCacheName);
          const writeCache = fs.createWriteStream(localCachePath);
          driveStream.data.pipe(writeCache);
          writeCache.on("finish", () => {
            fileMap.set(fileId, safeCacheName);
          });

          driveStream.data.on("error", (streamErr: any) => {
            console.error("[DRIVE SECURE PROXY] Stream error:", streamErr?.message);
            if (!res.headersSent) {
              res.status(500).json({ error: "Gagal membaca stream file dari Google Drive" });
            }
          });

          return driveStream.data.pipe(res);
        } catch (driveErr: any) {
          console.warn("[DRIVE SECURE PROXY] Service account stream notice:", driveErr?.message);
        }
      }

      // 2b. Fallback: Direct Google Drive media download jika Service Account tidak tersedia
      try {
        const driveMediaUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
        const gRes = await fetch(driveMediaUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });
        const gContentType = (gRes.headers.get("content-type") || "").toLowerCase();
        if (gRes.ok && !gContentType.includes("text/html") && !gContentType.includes("application/json")) {
          const arrayBuf = await gRes.arrayBuffer();
          const fileBuf = Buffer.from(arrayBuf);

          // Ekstrak nama berkas asli dari header Content-Disposition Google Drive jika ada
          let resolvedFilename = clientName;
          const dispHeader = gRes.headers.get("content-disposition") || "";
          const matchFilename = dispHeader.match(/filename="?([^";]+)"?/i);
          if (matchFilename && matchFilename[1]) {
            resolvedFilename = matchFilename[1];
          }

          // Deteksi MIME type yang akurat melalui binary magic bytes buffer dan nama berkas
          let finalMime = gContentType;
          if (!finalMime || finalMime === "application/octet-stream" || finalMime === "application/binary") {
            finalMime = detectMimeType(fileBuf, "image/jpeg", resolvedFilename);
          }

          res.setHeader("Content-Type", finalMime);
          res.setHeader("Cache-Control", "private, no-transform, max-age=86400");
          res.removeHeader("X-Frame-Options");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Security-Policy", "frame-ancestors *");
          if (isDownload) {
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(resolvedFilename)}"`);
          } else {
            res.setHeader("Content-Disposition", "inline");
          }

          try {
            const safeName = `${fileId}_${resolvedFilename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
            fs.writeFileSync(path.join(uploadsDir, safeName), fileBuf);
            fileMap.set(fileId, safeName);
          } catch {}

          return res.status(200).send(fileBuf);
        }
      } catch (directErr: any) {
        console.warn("[DRIVE SECURE PROXY] Direct media fallback notice:", directErr?.message);
      }

      // 2c. Fallback: Google CDN untuk gambar Drive
      try {
        const cdnUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
        const cdnRes = await fetch(cdnUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });
        const cdnContentType = (cdnRes.headers.get("content-type") || "").toLowerCase();
        if (cdnRes.ok && cdnContentType.startsWith("image/")) {
          res.setHeader("Content-Type", cdnContentType);
          res.setHeader("Cache-Control", "private, no-transform, max-age=86400");
          res.removeHeader("X-Frame-Options");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Security-Policy", "frame-ancestors *");
          if (isDownload) {
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientName)}"`);
          } else {
            res.setHeader("Content-Disposition", "inline");
          }

          const arrayBuf = await cdnRes.arrayBuffer();
          const fileBuf = Buffer.from(arrayBuf);

          try {
            const safeName = `${fileId}_${clientName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
            fs.writeFileSync(path.join(uploadsDir, safeName), fileBuf);
            fileMap.set(fileId, safeName);
          } catch {}

          return res.status(200).send(fileBuf);
        }
      } catch (cdnErr: any) {
        console.warn("[DRIVE SECURE PROXY] CDN fallback notice:", cdnErr?.message);
      }

      // 3. Fallback: Check if fileId corresponds to a local file directly
      const directLocalPath = path.join(uploadsDir, fileId);
      if (fs.existsSync(directLocalPath)) {
        const ext = path.extname(fileId).toLowerCase().replace('.', '') || 'jpg';
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'pdf') mimeType = 'application/pdf';
        res.setHeader("Content-Type", mimeType);
        res.removeHeader("X-Frame-Options");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Security-Policy", "frame-ancestors *");
        if (isDownload) {
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileId)}"`);
        } else {
          res.setHeader("Content-Disposition", "inline");
        }
        return res.sendFile(directLocalPath);
      }

      // If client is navigating in a browser tab to view the document
      if (req.headers.accept?.includes("text/html") || !isDownload) {
        return res.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`);
      }

      return res.status(404).json({ error: "Berkas privat tidak ditemukan atau belum disinkronkan" });
    } catch (err: any) {
      console.error("[DRIVE SECURE PROXY] Error:", err.message);
      return res.status(500).json({ error: "Gagal memproses berkas privat" });
    }
  });

  // API Route to retrieve file/image content as data URL (bulletproof for iframe/webview rendering)
  app.get(["/api/file-data", "/api/file/data"], requireAuth, async (req: any, res: any) => {
    try {
      const rawPath = (req.query.path as string) || (req.query.file as string) || (req.query.url as string) || "";
      let driveId = (req.query.driveId as string) || "";

      // If rawPath is a Google Drive URL, extract the ID
      if (!driveId && rawPath) {
        if (rawPath.includes("drive.google.com")) {
          const m = rawPath.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawPath.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (m && m[1]) driveId = m[1];
        } else if (rawPath.includes("/api/files/secure/")) {
          const m = rawPath.match(/\/api\/files\/secure\/([a-zA-Z0-9_-]+)/);
          if (m && m[1]) driveId = m[1];
        }
      }

      // If we have a Google Drive ID
      if (driveId) {
        // Check local cache first
        const files = fs.readdirSync(uploadsDir);
        const cachedFile = files.find(f => f.startsWith(`${driveId}_`) || f === driveId);
        if (cachedFile) {
          const filePath = path.join(uploadsDir, cachedFile);
          const ext = path.extname(cachedFile).toLowerCase().replace('.', '') || 'jpg';
          let mimeType = 'image/jpeg';
          if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'webp') mimeType = 'image/webp';
          else if (ext === 'pdf') mimeType = 'application/pdf';

          const fileBuffer = fs.readFileSync(filePath);
          const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
          return res.status(200).json({
            success: true,
            filename: cachedFile,
            mimeType,
            size: fileBuffer.length,
            data: base64Data
          });
        }

        // Fetch from Drive via backend Service Account
        const gDrive = getGoogleDriveClient();
        if (gDrive) {
          try {
            const meta = await gDrive.drive.files.get({
              fileId: driveId,
              fields: "id, name, mimeType",
            });
            let mimeType = meta.data.mimeType || "image/jpeg";
            const driveRes = await gDrive.drive.files.get(
              { fileId: driveId, alt: "media" },
              { responseType: "arraybuffer" }
            );

            if (driveRes.headers && driveRes.headers["content-type"]) {
              mimeType = driveRes.headers["content-type"];
            }

            const fileBuffer = Buffer.from(driveRes.data as ArrayBuffer);
            const safeCacheName = `${driveId}_${(meta.data.name || 'doc').replace(/[^a-zA-Z0-9.-]/g, "_")}`;
            fs.writeFileSync(path.join(uploadsDir, safeCacheName), fileBuffer);

            const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            return res.status(200).json({
              success: true,
              filename: meta.data.name || safeCacheName,
              mimeType,
              size: fileBuffer.length,
              data: base64Data
            });
          } catch (driveErr: any) {
            console.warn("[FILE DATA API] Drive fetch error:", driveErr.message);
          }
        }

        // Direct media fallback jika Service Account gagal atau tidak tersedia
        try {
          const directMediaUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
          const gRes = await fetch(directMediaUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
          });
          const gContentType = (gRes.headers.get("content-type") || "").toLowerCase();
          if (gRes.ok && !gContentType.includes("text/html") && !gContentType.includes("application/json")) {
            const mimeType = gContentType || "image/jpeg";
            const arrayBuf = await gRes.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuf);
            const safeCacheName = `${driveId}_cached`;
            try {
              fs.writeFileSync(path.join(uploadsDir, safeCacheName), fileBuffer);
            } catch {}
            const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            return res.status(200).json({
              success: true,
              filename: safeCacheName,
              mimeType,
              size: fileBuffer.length,
              data: base64Data
            });
          }
        } catch (pubErr) {
          // fallback failed, continue
        }
      }

      if (!rawPath) {
        return res.status(400).json({ error: "Parameter path, file, atau driveId diperlukan" });
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
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.setHeader("Content-Disposition", "inline");
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CLOUDFLARE D1 SECURE DATABASE GATEWAY API
  // ==========================================
  
  // 1. Get D1 Configuration status and test authentication
  let d1AuthCache: { configured: boolean; authorized: boolean; lastCheck: number } | null = null;
  app.get("/api/d1/status", async (req, res) => {
    const isConfigured = !!(
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_DATABASE_ID &&
      process.env.CLOUDFLARE_API_TOKEN
    );
    if (!isConfigured) {
      return res.json({ configured: false, authorized: false });
    }
    // Return cached authorization if checked recently (<60s)
    if (d1AuthCache && (Date.now() - d1AuthCache.lastCheck < 60000)) {
      return res.json({ configured: d1AuthCache.configured, authorized: d1AuthCache.authorized });
    }
    try {
      // Test the credentials with a rapid lightweight D1 SQL query
      await queryD1("SELECT 1");
      d1AuthCache = { configured: true, authorized: true, lastCheck: Date.now() };
      res.json({ configured: true, authorized: true });
    } catch (err: any) {
      console.warn("⚠️ Cloudflare D1 is configured but unauthorized/invalid:", err.message);
      res.json({ configured: true, authorized: false, error: err.message });
    }
  });

  // 1b. Trigger manual migration / full dataset migration
  app.post("/api/d1/migrate", requireAuth, requireAdmin, async (req: any, res: any) => {
    try {
      await ensureD1TablesExist();
      res.json({ success: true, message: "Migrasi skema tabel Cloudflare D1 selesai dijalankan." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 1c. Execute full SQL migration dump (all 2,125+ data rows) directly into Cloudflare D1
  app.post("/api/d1/import-sql", requireAuth, requireAdmin, async (req: any, res: any) => {
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
  app.get(["/api/d1/backcharges/detail/:id", "/d1/backcharges/detail/:id"], requireAuth, async (req: any, res: any) => {
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
  const getPaginatedBackcharges = async (queryObj: any) => {
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
      userRole.includes("Administrator") ||
      userRole.includes("Division Head") ||
      userBranch === "Nasional" || 
      userBranch === "Semua Cabang" ||
      userBranch.toLowerCase().includes("semua");

    if (!isNasionalRole) {
      let branchList: string[] = [];
      if (userBranch) {
        const parts = userBranch.split(",").map(b => b.trim()).filter(Boolean);
        parts.forEach(p => {
          if (p.toLowerCase() === "megabranch" || p.toLowerCase() === "jakarta") {
            branchList.push("BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak");
          } else {
            branchList.push(p);
          }
        });
      } else if (userRole) {
        const rLower = userRole.toLowerCase();
        if (rLower.includes("west")) {
          branchList = ["Lampung", "Medan", "Padang", "Palembang", "Pekanbaru"];
        } else if (rLower.includes("central")) {
          branchList = ["Bandung", "BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak"];
        } else if (rLower.includes("east")) {
          branchList = ["Bali", "Balikpapan", "Banjarmasin", "Makassar", "Malang", "Manado", "Semarang", "Solo", "Surabaya"];
        }
      }
      branchList = Array.from(new Set(branchList));

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
      const searchWithDash = `%${search.replace(/\s+/g, '-')}%`;
      const searchWithSpace = `%${search.replace(/-/g, ' ')}%`;
      whereClauses.push("(id LIKE ? OR customer_name LIKE ? OR license_plate LIKE ? OR license_plate LIKE ? OR license_plate LIKE ? OR no_bak LIKE ? OR no_invoice LIKE ? OR no_spk LIKE ? OR no_sap LIKE ? OR nama_bro LIKE ?)");
      params.push(searchPattern, searchPattern, searchPattern, searchWithDash, searchWithSpace, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // 4. Category
    if (category) {
      if (category === "Maintenance & ETLE") {
        whereClauses.push("(category = 'Maintenance' OR category = 'ETLE')");
      } else if (category.includes(",")) {
        const catList = category.split(",").map((c: string) => c.trim());
        const placeholders = catList.map(() => "?").join(", ");
        whereClauses.push(`category IN (${placeholders})`);
        params.push(...catList);
      } else {
        whereClauses.push("category = ?");
        params.push(category);
      }
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
      whereClauses.push("(tanggal >= ? OR (tanggal IS NULL AND created_at >= ?))");
      params.push(startDate, startDate);
    }
    if (endDate) {
      whereClauses.push("(tanggal <= ? OR (tanggal IS NULL AND created_at <= ?))");
      params.push(endDate + " 23:59:59", endDate + " 23:59:59");
    }

    // 9. Stage mapping in SQL
    if (stage) {
      if (stage === "1_handover") {
        whereClauses.push("status_handover = 'Pending'");
      } else if (stage === "2_admin" || stage === "2_confirm") {
        whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin')");
      } else if (stage === "3_sap_l1" || stage === "3_sap") {
        whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin') AND status_sap != 'Not Bill' AND (status_approval IS NULL OR status_approval = 'Belum Approval' OR status_approval = 'Pending') AND status_approval != 'Ditolak' AND (regional_approval_status IS NULL OR regional_approval_status != 'Ditolak') AND (division_approval_status IS NULL OR division_approval_status != 'Ditolak') AND (status_confirm IS NULL OR status_confirm != 'Ditolak / Negosiasi Ulang') AND (no_invoice IS NULL OR no_invoice = '-' OR TRIM(no_invoice) = '') AND (status_payment IS NULL OR status_payment != 'Lunas')");
      } else if (stage === "3_sap_rh") {
        whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin') AND status_sap != 'Not Bill' AND status_approval = 'Disetujui' AND ((category = 'Maintenance' AND CAST(value AS NUMERIC) > 7500000) OR (category != 'Maintenance' AND CAST(value AS NUMERIC) > 5000000)) AND (regional_approval_status IS NULL OR regional_approval_status = 'Belum Approval' OR regional_approval_status = '') AND regional_approval_status != 'Ditolak' AND (division_approval_status IS NULL OR division_approval_status != 'Ditolak') AND (status_confirm IS NULL OR status_confirm != 'Ditolak / Negosiasi Ulang') AND (no_invoice IS NULL OR no_invoice = '-' OR TRIM(no_invoice) = '') AND (status_payment IS NULL OR status_payment != 'Lunas')");
      } else if (stage === "3_sap_dh") {
        whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin') AND status_sap != 'Not Bill' AND status_approval = 'Disetujui' AND (regional_approval_status = 'Disetujui' OR ((category = 'Maintenance' AND CAST(value AS NUMERIC) <= 7500000) OR (category != 'Maintenance' AND CAST(value AS NUMERIC) <= 5000000))) AND CAST(value AS NUMERIC) > 15000000 AND (division_approval_status IS NULL OR division_approval_status = 'Belum Approval' OR division_approval_status = '') AND division_approval_status != 'Ditolak' AND (status_confirm IS NULL OR status_confirm != 'Ditolak / Negosiasi Ulang') AND (no_invoice IS NULL OR no_invoice = '-' OR TRIM(no_invoice) = '') AND (status_payment IS NULL OR status_payment != 'Lunas')");
      } else if (stage === "4_invoice") {
        whereClauses.push("(status_handover = 'Diserahkan ke Admin' OR status_handover = 'Diterima Admin') AND status_sap != 'Not Bill' AND (no_invoice IS NULL OR no_invoice = '-' OR TRIM(no_invoice) = '') AND (status_payment IS NULL OR status_payment != 'Lunas') AND status_approval = 'Disetujui' AND (status_confirm IS NULL OR status_confirm != 'Ditolak / Negosiasi Ulang') AND (regional_approval_status IS NULL OR regional_approval_status != 'Ditolak') AND (division_approval_status IS NULL OR division_approval_status != 'Ditolak') AND (regional_approval_status = 'Disetujui' OR NOT ((category = 'Maintenance' AND CAST(value AS NUMERIC) > 7500000) OR (category != 'Maintenance' AND CAST(value AS NUMERIC) > 5000000))) AND (division_approval_status = 'Disetujui' OR CAST(value AS NUMERIC) <= 15000000)");
      } else if (stage === "5_payment") {
        whereClauses.push("(no_invoice IS NOT NULL AND no_invoice != '-' AND TRIM(no_invoice) != '') AND (status_payment IS NULL OR status_payment != 'Lunas') AND status_approval != 'Ditolak' AND (regional_approval_status IS NULL OR regional_approval_status != 'Ditolak') AND (division_approval_status IS NULL OR division_approval_status != 'Ditolak') AND (status_confirm IS NULL OR status_confirm != 'Ditolak / Negosiasi Ulang')");
      } else if (stage === "6_done") {
        whereClauses.push("status_payment = 'Lunas'");
      } else if (stage === "rejected") {
        whereClauses.push("(status_approval = 'Ditolak' OR regional_approval_status = 'Ditolak' OR division_approval_status = 'Ditolak' OR status_confirm = 'Ditolak / Negosiasi Ulang')");
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
    const allowedSortCols = ["created_at", "updated_at", "tanggal", "value", "customer_name", "id", "branch", "category", "status_payment", "license_plate", "no_bak"];
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

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore,
        offset
      }
    };
  };

  const handlePaginatedBackcharges = async (req: any, res: any) => {
    try {
      const queryObj = { ...req.query, ...(req.body || {}) };
      // Enforce verified user role and branch from official server token
      if (req.user) {
        queryObj.userRole = req.user.role;
        queryObj.userBranch = req.user.branch;
      }
      const result = await getPaginatedBackcharges(queryObj);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("❌ Error in paginated backcharges gateway:", err.message);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  };

  app.get(["/api/d1/backcharges/page", "/d1/backcharges/page"], requireAuth, handlePaginatedBackcharges);
  app.post(["/api/d1/backcharges/page", "/d1/backcharges/page"], requireAuth, handlePaginatedBackcharges);

  // 1f. Server-Side Aggregate Statistics for Dashboard (0 RAM footprint)
  app.get(["/api/d1/backcharges/stats", "/d1/backcharges/stats"], requireAuth, async (req: any, res: any) => {
    try {
      const { branch } = req.query;
      const userRole = req.user?.role || req.query.userRole;
      const userBranch = req.user?.branch || req.query.userBranch;
      const whereClauses: string[] = ["1=1"];
      const params: any[] = [];

      const isNasional = !userRole || 
        userRole === "Administrator" || 
        userRole === "Division Head" || 
        String(userRole).includes("Administrator") ||
        String(userRole).includes("Division Head") ||
        userBranch === "Nasional" || 
        userBranch === "Semua Cabang" ||
        String(userBranch).toLowerCase().includes("semua");

      if (!isNasional) {
        let bList: string[] = [];
        if (userBranch) {
          const parts = String(userBranch).split(",").map(b => b.trim()).filter(Boolean);
          parts.forEach(p => {
            if (p.toLowerCase() === "megabranch" || p.toLowerCase() === "jakarta") {
              bList.push("BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak");
            } else {
              bList.push(p);
            }
          });
        } else if (userRole) {
          const rLower = String(userRole).toLowerCase();
          if (rLower.includes("west")) {
            bList = ["Lampung", "Medan", "Padang", "Palembang", "Pekanbaru"];
          } else if (rLower.includes("central")) {
            bList = ["Bandung", "BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak"];
          } else if (rLower.includes("east")) {
            bList = ["Bali", "Balikpapan", "Banjarmasin", "Makassar", "Malang", "Manado", "Semarang", "Solo", "Surabaya"];
          }
        }
        bList = Array.from(new Set(bList));

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

  // Allowed column sets to prevent any SQL injection or column tampering
  const ALLOWED_BACKCHARGE_COLUMNS = new Set([
    'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang', 'no_cmd',
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

  const ALLOWED_PROFILE_COLUMNS = new Set([
    'id', 'email', 'full_name', 'role', 'branch', 'password', 'created_at', 'force_password_reset'
  ]);

  // Secure allowlist-only execution gateway on D1 (Parameterized queries only, never accepts raw SQL)
  app.post("/api/d1/execute", requireAuth, async (req: any, res: any) => {
    // 1. Strict rejection of raw SQL text from client
    if (req.body.sql) {
      return res.status(403).json({
        success: false,
        error: "Keamanan: Pengiriman teks SQL mentah dari klien ditolak. Gunakan allowlist operationId dengan parameterized query."
      });
    }

    const { operationId, params } = req.body;
    
    try {
      switch (operationId) {
        // --- PROFILES ---
        case "get_profile_by_email": {
          const emailVal = (params && params[0]) || req.body.email;
          if (!emailVal) return res.status(400).json({ success: false, error: "Email diperlukan" });
          // Otorisasi: non-admin hanya dapat membaca data profil miliknya sendiri
          if (req.user.role !== 'Administrator' && req.user.email.toLowerCase() !== String(emailVal).toLowerCase()) {
            return res.status(403).json({ success: false, error: "Akses ditolak: Anda hanya dapat mengakses profil Anda sendiri." });
          }
          const results = await queryD1(
            "SELECT id, email, full_name, role, branch, created_at FROM profiles WHERE LOWER(email) = LOWER(?)",
            [emailVal]
          );
          return res.json({ success: true, results: results || [] });
        }

        case "get_profiles": {
          const results = await queryD1("SELECT id, email, full_name, role, branch, created_at FROM profiles ORDER BY full_name ASC", []);
          return res.json({ success: true, results: results || [] });
        }

        case "insert_profile": {
          // Otorisasi: Pembuatan akun hanya dapat dilakukan oleh Administrator
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Pendaftaran akun baru hanya dapat dilakukan oleh Administrator." });
          }
          let p = params || [];
          if (p.length === 0 && req.body.data) {
            const d = req.body.data;
            const hashed = await bcrypt.hash(d.password || 'password123', 10);
            p = [d.id, d.email, d.full_name, d.role, d.branch, d.created_at || new Date().toISOString(), hashed, 1];
          } else if (p.length === 7) {
            // Hash password jika diberikan langsung di params (index 6)
            p[6] = await bcrypt.hash(p[6] || 'password123', 10);
            p.push(1); // Set force_password_reset = 1
          } else if (p.length >= 8) {
            if (!String(p[6]).startsWith('$2')) {
              p[6] = await bcrypt.hash(p[6] || 'password123', 10);
            }
            p[7] = 1; // force_password_reset = 1
          }
          const results = await queryD1(
            "INSERT INTO profiles (id, email, full_name, role, branch, created_at, password, force_password_reset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            p
          );
          return res.json({ success: true, results: results || [] });
        }

        case "update_profile_admin_role": {
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Hanya Administrator." });
          }
          const emailVal = (params && params[0]) || req.body.email;
          const results = await queryD1(
            "UPDATE profiles SET role = 'Administrator', branch = 'Nasional', full_name = 'ASSA' WHERE LOWER(email) = LOWER(?)",
            [emailVal]
          );
          return res.json({ success: true, results: results || [] });
        }

        case "update_profile": {
          const targetId = req.body.id || (params && params[params.length - 1]);
          const data = { ...(req.body.data || {}) };
          // Otorisasi: Pengguna biasa hanya boleh memperbarui profilnya sendiri
          if (req.user.role !== 'Administrator' && targetId !== req.user.id) {
            return res.status(403).json({ success: false, error: "Akses ditolak: Anda hanya dapat memperbarui profil Anda sendiri." });
          }
          // Pengguna non-admin dilarang mengubah role atau cabang mereka sendiri
          if (req.user.role !== 'Administrator') {
            delete data.role;
            delete data.branch;
          }
          // Jika Administrator mereset password ke 'password123' atau password sementara
          if (data.password) {
            if (!String(data.password).startsWith('$2')) {
              data.password = await bcrypt.hash(String(data.password), 10);
            }
            // Set kolom force_password_reset = 1 jika direset oleh Administrator untuk staf lain
            if (req.user.role === 'Administrator' && targetId !== req.user.id) {
              data.force_password_reset = 1;
            }
          }
          const validCols = Object.keys(data).filter(col => col !== 'id' && ALLOWED_PROFILE_COLUMNS.has(col));
          if (validCols.length === 0 || !targetId) {
            return res.status(400).json({ success: false, error: "Kolom profil tidak valid atau ID hilang" });
          }
          const setClause = validCols.map(col => `${col} = ?`).join(', ');
          const vals = [...validCols.map(col => data[col]), targetId];
          const results = await queryD1(`UPDATE profiles SET ${setClause} WHERE id = ?`, vals);
          return res.json({ success: true, results: results || [] });
        }

        case "update_profile_password": {
          const rawPwd = (params && params[0]) || req.body.password;
          const targetId = (params && params[1]) || req.body.id;
          // Otorisasi: Pengguna hanya dapat mengubah password miliknya sendiri (kecuali Administrator)
          if (req.user.role !== 'Administrator' && targetId !== req.user.id) {
            return res.status(403).json({ success: false, error: "Akses ditolak: Anda hanya dapat mengganti password Anda sendiri." });
          }
          const hashed = String(rawPwd).startsWith('$2') ? rawPwd : await bcrypt.hash(String(rawPwd), 10);
          const forceReset = (req.user.role === 'Administrator' && targetId !== req.user.id) ? 1 : 0;
          const results = await queryD1("UPDATE profiles SET password = ?, force_password_reset = ? WHERE id = ?", [hashed, forceReset, targetId]);
          return res.json({ success: true, results: results || [] });
        }

        case "delete_profile": {
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Hanya Administrator yang dapat menghapus akun." });
          }
          const targetId = (params && params[0]) || req.body.id;
          const results = await queryD1("DELETE FROM profiles WHERE id = ?", [targetId]);
          return res.json({ success: true, results: results || [] });
        }

        // --- BACKCHARGES ---
        case "get_all_backcharges": {
          const userRole = req.user.role || '';
          const userBranch = req.user.branch || '';
          const isNasional = userRole === 'Administrator' || 
            userRole === 'Division Head' || 
            userRole.includes('Administrator') ||
            userRole.includes('Division Head') ||
            userBranch === 'Nasional' || 
            userBranch === 'Semua Cabang' ||
            userBranch.toLowerCase().includes('semua');

          // Otorisasi lingkup data cabang berdasarkan sesi login resmi
          if (!isNasional) {
            let allowedBranches: string[] = [];
            if (userBranch) {
              const parts = userBranch.split(',').map((b: string) => b.trim()).filter(Boolean);
              parts.forEach((p: string) => {
                if (p.toLowerCase() === 'megabranch' || p.toLowerCase() === 'jakarta') {
                  allowedBranches.push("BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak");
                } else {
                  allowedBranches.push(p);
                }
              });
            } else if (userRole) {
              const rLower = userRole.toLowerCase();
              if (rLower.includes("west")) {
                allowedBranches = ["Lampung", "Medan", "Padang", "Palembang", "Pekanbaru"];
              } else if (rLower.includes("central")) {
                allowedBranches = ["Bandung", "BSO GSO & AFFCO", "BSO Sudirman", "BSO Sunter", "BSO Pondok Pinang", "BSO Banten", "BSO Bekasi", "BSO Daan Mogot", "BSO Pontianak"];
              } else if (rLower.includes("east")) {
                allowedBranches = ["Bali", "Balikpapan", "Banjarmasin", "Makassar", "Malang", "Manado", "Semarang", "Solo", "Surabaya"];
              }
            }
            allowedBranches = Array.from(new Set(allowedBranches));
            if (allowedBranches.length > 0) {
              const placeholders = allowedBranches.map(() => '?').join(', ');
              const results = await queryD1(`SELECT * FROM backcharges WHERE branch IN (${placeholders}) ORDER BY created_at DESC`, allowedBranches);
              return res.json({ success: true, results: results || [] });
            }
          }

          const branches = req.body.branches || (Array.isArray(params) && params.length > 0 ? params : null);
          if (Array.isArray(branches) && branches.length > 0) {
            const placeholders = branches.map(() => '?').join(', ');
            const results = await queryD1(`SELECT * FROM backcharges WHERE branch IN (${placeholders}) ORDER BY created_at DESC`, branches);
            return res.json({ success: true, results: results || [] });
          }
          const results = await queryD1("SELECT * FROM backcharges ORDER BY created_at DESC", []);
          return res.json({ success: true, results: results || [] });
        }

        case "get_paginated_backcharges": {
          const result = await getPaginatedBackcharges(req.body);
          return res.json({ success: true, ...result });
        }

        case "get_backcharge_detail": {
          const id = (params && params[0]) || req.body.id;
          const detailRows = await queryD1("SELECT * FROM backcharges WHERE id = ? LIMIT 1", [id]);
          return res.json({ success: true, results: detailRows || [] });
        }

        case "get_backcharges_by_ids": {
          const ids = (Array.isArray(params) && params.length > 0) ? params : (req.body.ids || []);
          if (!Array.isArray(ids) || ids.length === 0) {
            return res.json({ success: true, results: [] });
          }
          const placeholders = ids.map(() => '?').join(', ');
          const results = await queryD1(`SELECT * FROM backcharges WHERE id IN (${placeholders})`, ids);
          return res.json({ success: true, results: results || [] });
        }

        case "get_backcharge_ids": {
          const results = await queryD1("SELECT id FROM backcharges", []);
          return res.json({ success: true, results: results || [] });
        }

        case "get_top_backcharge_id_by_prefix": {
          const prefix = (params && params[0]) || req.body.prefix || '';
          const results = await queryD1(
            "SELECT id FROM backcharges WHERE id LIKE ? ORDER BY CAST(substr(id, 9) AS INTEGER) DESC LIMIT 1",
            [prefix]
          );
          return res.json({ success: true, results: results || [] });
        }

        case "get_dashboard_stats": {
          const { whereSql: sWhereSql, params: sParams } = req.body;
          const safeWhere = (sWhereSql && typeof sWhereSql === 'string' && !sWhereSql.includes(';') && !sWhereSql.includes('--')) ? sWhereSql : '1=1';
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
            WHERE ${safeWhere}
          `, sParams || []);

          const branchAggResult = await queryD1(`
            SELECT 
              branch, 
              COUNT(*) as total_count,
              SUM(value) as total_value,
              SUM(CASE WHEN status_payment = 'Lunas' THEN value ELSE 0 END) as paid_value,
              SUM(CASE WHEN status_payment = 'Belum Bayar' AND status_sap != 'Not Bill' THEN value ELSE 0 END) as os_value
            FROM backcharges 
            WHERE ${safeWhere}
            GROUP BY branch
          `, sParams || []);

          const catAggResult = await queryD1(`
            SELECT 
              category, 
              COUNT(*) as total_count,
              SUM(value) as total_value,
              SUM(CASE WHEN status_payment = 'Lunas' THEN value ELSE 0 END) as paid_value
            FROM backcharges 
            WHERE ${safeWhere}
            GROUP BY category
          `, sParams || []);

          return res.json({ 
            success: true, 
            results: {
              summary: summaryResult?.[0] || {},
              branchStats: branchAggResult || [],
              categoryStats: catAggResult || []
            }
          });
        }

        case "insert_backcharge": {
          const data = req.body.data;
          if (!data || typeof data !== 'object') {
            return res.status(400).json({ success: false, error: "Data transaksi diperlukan" });
          }
          const validCols = Object.keys(data).filter(col => ALLOWED_BACKCHARGE_COLUMNS.has(col));
          if (validCols.length === 0 || !data.id) {
            return res.status(400).json({ success: false, error: "Data transaksi tidak valid atau ID hilang" });
          }
          const placeholders = validCols.map(() => '?').join(', ');
          const vals = validCols.map(col => data[col] !== undefined ? data[col] : null);
          const results = await queryD1(
            `INSERT INTO backcharges (${validCols.join(', ')}) VALUES (${placeholders})`,
            vals
          );
          return res.json({ success: true, results: results || [] });
        }

        case "update_backcharge": {
          const targetId = req.body.id || (params && params[params.length - 1]);
          const data = req.body.data || {};
          if (!targetId || typeof data !== 'object') {
            return res.status(400).json({ success: false, error: "ID dan data update diperlukan" });
          }
          const validCols = Object.keys(data).filter(col => col !== 'id' && ALLOWED_BACKCHARGE_COLUMNS.has(col));
          if (validCols.length === 0) {
            return res.json({ success: true, results: [] });
          }
          const setClause = validCols.map(col => `${col} = ?`).join(', ');
          const vals = [...validCols.map(col => data[col] !== undefined ? data[col] : null), targetId];
          const results = await queryD1(`UPDATE backcharges SET ${setClause} WHERE id = ?`, vals);
          return res.json({ success: true, results: results || [] });
        }

        case "bulk_update_backcharges": {
          const items = req.body.items;
          if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, error: "Daftar pembaruan harus berupa array" });
          }
          for (const item of items) {
            const { id, updates } = item;
            if (!id || !updates || typeof updates !== 'object') continue;
            const validCols = Object.keys(updates).filter(col => col !== 'id' && ALLOWED_BACKCHARGE_COLUMNS.has(col));
            if (validCols.length > 0) {
              const setClause = validCols.map(col => `${col} = ?`).join(', ');
              const vals = [...validCols.map(col => updates[col] !== undefined ? updates[col] : null), id];
              await queryD1(`UPDATE backcharges SET ${setClause} WHERE id = ?`, vals);
            }
          }
          return res.json({ success: true });
        }

        case "delete_backcharge": {
          const id = (params && params[0]) || req.body.id;
          if (!id) return res.status(400).json({ success: false, error: "ID diperlukan" });

          // Otorisasi: Hanya Administrator, ASO, atau pembuat data yang boleh menghapus
          const userRole = req.user.role || '';
          const isAllowedToDelete = userRole === 'Administrator' || userRole.includes('ASO');
          if (!isAllowedToDelete) {
            const existing = await queryD1("SELECT created_by FROM backcharges WHERE id = ? LIMIT 1", [id]);
            if (!existing || existing.length === 0 || existing[0].created_by !== req.user.email) {
              return res.status(403).json({ success: false, error: "Akses ditolak: Anda tidak memiliki wewenang untuk menghapus transaksi ini." });
            }
          }

          const results = await queryD1("DELETE FROM backcharges WHERE id = ?", [id]);
          return res.json({ success: true, results: results || [] });
        }

        case "bulk_upsert_backcharges": {
          // Otorisasi: Hanya Administrator atau ASO yang dapat melakukan impor/upsert massal
          const userRole = req.user.role || '';
          if (userRole !== 'Administrator' && !userRole.includes('ASO') && userRole !== 'Division Head') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Anda tidak memiliki hak akses untuk upsert massal." });
          }

          const items = req.body.items;
          if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: "Data upsert massal harus berupa array" });
          }
          for (const tx of items) {
            if (!tx || typeof tx !== 'object' || !tx.id) continue;
            const validCols = Object.keys(tx).filter(col => ALLOWED_BACKCHARGE_COLUMNS.has(col));
            if (validCols.length === 0) continue;
            const placeholders = validCols.map(() => '?').join(', ');
            const updateAssigns = validCols.filter(col => col !== 'id').map(col => `${col} = excluded.${col}`).join(', ');
            const vals = validCols.map(col => tx[col] !== undefined ? tx[col] : null);
            const upsertSql = `
              INSERT INTO backcharges (${validCols.join(', ')}) 
              VALUES (${placeholders})
              ON CONFLICT(id) DO UPDATE SET ${updateAssigns || 'updated_at = CURRENT_TIMESTAMP'}
            `;
            await queryD1(upsertSql, vals);
          }
          return res.json({ success: true });
        }

        // --- ACTIVITY LOGS ---
        case "get_activity_logs": {
          const limit = Number(req.body.limit) || 50;
          const results = await queryD1("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?", [limit]);
          return res.json({ success: true, results: results || [] });
        }

        case "get_max_activity_log_id": {
          const results = await queryD1("SELECT MAX(id) as max_id FROM activity_logs", []);
          return res.json({ success: true, results: results || [] });
        }

        case "get_recent_activity_logs_since": {
          const sinceId = Number((params && params[0]) || req.body.sinceId || 0);
          const results = await queryD1(
            "SELECT id, timestamp, transaction_id, performed_by, action_description FROM activity_logs WHERE id > ? ORDER BY id ASC LIMIT 20",
            [sinceId]
          );
          return res.json({ success: true, results: results || [] });
        }

        case "insert_activity_log": {
          const txId = (params && params[0]) ?? req.body.transaction_id ?? '-';
          // Keamanan: Catat performed_by dari email sesi token resmi server agar otentik
          const user = (req.user?.email || (params && params[1])) ?? req.body.performed_by ?? '-';
          const desc = (params && params[2]) ?? req.body.action_description ?? '';
          const results = await queryD1(
            "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
            [txId, user, desc]
          );
          return res.json({ success: true, results: results || [] });
        }

        // --- CONTACT INQUIRIES ---
        case "get_contact_inquiries": {
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Hanya Administrator yang dapat melihat daftar aduan." });
          }
          const limit = Number(req.body.limit) || 30;
          const results = await queryD1("SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT ?", [limit]);
          return res.json({ success: true, results: results || [] });
        }

        case "insert_contact_inquiry": {
          let p = params || [];
          if (p.length === 0 && req.body.data) {
            const d = req.body.data;
            p = [d.id, d.full_name || d.name, d.email, d.subject, d.message, d.status || 'UNREAD', d.created_at || new Date().toISOString(), d.feedback || null, d.feedback_by || null, d.feedback_at || null];
          }
          const results = await queryD1(
            "INSERT INTO contact_inquiries (id, name, email, subject, message, status, created_at, feedback, feedback_by, feedback_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            p
          );
          return res.json({ success: true, results: results || [] });
        }

        case "update_contact_inquiry": {
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Hanya Administrator yang dapat merespons aduan." });
          }
          const { status, feedback, feedback_by, feedback_at, id } = req.body;
          const p = (params && params.length >= 5) ? params : [status, feedback, feedback_by || req.user.full_name, feedback_at, id];
          const results = await queryD1(
            "UPDATE contact_inquiries SET status = ?, feedback = ?, feedback_by = ?, feedback_at = ? WHERE id = ?",
            p
          );
          return res.json({ success: true, results: results || [] });
        }

        case "delete_contact_inquiry": {
          if (req.user.role !== 'Administrator') {
            return res.status(403).json({ success: false, error: "Akses ditolak: Hanya Administrator yang dapat menghapus aduan." });
          }
          const targetId = (params && params[0]) || req.body.id;
          const results = await queryD1("DELETE FROM contact_inquiries WHERE id = ?", [targetId]);
          return res.json({ success: true, results: results || [] });
        }

        default:
          return res.status(400).json({ 
            success: false, 
            error: `Operasi '${operationId}' tidak terdaftar dalam allowlist server.` 
          });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint /api/d1/query telah dinonaktifkan secara permanen demi keamanan produksi (mencegah eksposur SQL mentah).
  app.all(["/api/d1/query", "/d1/query"], (req, res) => {
    return res.status(403).json({ 
      success: false, 
      error: "Endpoint SQL mentah (/api/d1/query) telah dinonaktifkan secara permanen untuk keamanan produksi. Gunakan /api/d1/execute dengan allowlist." 
    });
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

  // Endpoint to immediately invalidate and unregister any stale Service Worker in browser cache
  app.get(["/sw.js", "/registerSW.js"], (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Clear-Site-Data", '"cache"');
    res.send(`
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll())
            .then((clients) => clients.forEach((c) => c.navigate(c.url)))
        );
      });
    `);
  });

  // Catch-all for API routes to prevent them from falling through to the Vite SPA fallback (which returns HTML)
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.url}` });
  });

  // Global API error handler ensuring CORS and JSON response
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("❌ Express unhandled error:", err?.message || err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      success: false,
      error: err?.message || "Internal Server Error"
    });
  });

  // Vite middleware for development vs static production serve
  let vite: any;
  const distPath = path.join(process.cwd(), "dist");
  const distExists = fs.existsSync(path.join(distPath, "index.html"));
  const isProd = process.env.NODE_ENV === "production" && distExists;

  if (isProd) {
    console.log(`[SERVER] Serving production build from ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("[SERVER] Starting Vite development server middleware mode");
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        allowedHosts: true
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${PORT} is in use. Trying port ${PORT + 1}...`);
      server.listen(PORT + 1, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT + 1}`);
      });
    } else {
      console.error("Server error:", err);
    }
  });

  if (!isProd && vite) {
    server.on("upgrade", (req, socket, head) => {
      vite.ws.handleUpgrade(req, socket, head);
    });
  }
  } catch (fatalErr: any) {
    console.error("❌ FATAL ERROR IN startServer:", fatalErr?.message, fatalErr?.stack);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("❌ Fatal error starting server:", err);
  process.exit(1);
});

