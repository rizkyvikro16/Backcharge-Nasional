# 🚀 Skema Otomatis Push & Deploy: Cloudflare Workers & Pages

Dokumen ini menjelaskan 3 metode otomatisasi untuk mendeploy aplikasi **Backcharge Nasional ASSA** ke Cloudflare (Pages & Workers edge D1).

---

## 🌟 Metode 1: Otomatisasi CI/CD via GitHub Actions (Rekomendasi Utama)

Setiap kali Anda melakukan `git push` ke branch `main`, GitHub Actions akan secara otomatis:
1. Mengunduh source code & dependensi
2. Menjalankan build frontend Vite (`npm run build:pages`)
3. Mendeploy aset frontend ke **Cloudflare Pages**
4. Mendeploy Edge API ke **Cloudflare Workers** (`cloudflare-api-worker.js`)

File workflow telah dibuat di `.github/workflows/deploy-cloudflare.yml`.

### Langkah Pengaturan GitHub Secrets:
1. Buka repositori GitHub Anda: `https://github.com/rizkyvikro16/Backcharge-Nasional`
2. Masuk ke **Settings** > **Secrets and variables** > **Actions**.
3. Klik **New repository secret** dan tambahkan 2 secret berikut:
   - `CLOUDFLARE_API_TOKEN`: Buat API Token di Cloudflare Dashboard (*My Profile* > *API Tokens* > *Create Token* > pilih template *Edit Cloudflare Workers* atau Custom dengan izin `Account.Cloudflare Pages: Edit` & `Account.Workers Scripts: Edit`).
   - `CLOUDFLARE_ACCOUNT_ID`: Salin Account ID dari URL dashboard Cloudflare Anda (atau di sidebar kanan menu Workers & Pages).

### Cara Menjalankan:
Cukup lakukan push perubahan ke branch `main`:
```bash
git add .
git commit -m "feat: update aplikasi"
git push origin main
```
GitHub Actions akan langsung menjalankan proses deploy secara otomatis!

---

## ⚡ Metode 2: Direct Git Integration via Cloudflare Pages Dashboard

Jika Anda ingin Cloudflare meng-compile langsung dari repositori GitHub tanpa GitHub Actions:

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com)
2. Masuk ke menu **Compute (Workers & Pages)** > **Create Application** > tab **Pages** > **Connect to Git**.
3. Pilih repository `rizkyvikro16/Backcharge-Nasional`.
4. Atur **Build settings**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build:pages`
   - **Build output directory**: `dist`
5. Pada **Environment variables**, tambahkan:
   - `NODE_VERSION`: `20`
6. Klik **Save and Deploy**.

> *Setiap push ke GitHub akan otomatis di-build oleh server Cloudflare.*

---

## 💻 Metode 3: 1-Click Deploy via Terminal (Wrangler CLI)

Anda juga dapat melakukan deploy langsung dari terminal komputer Anda menggunakan perintah yang telah kami siapkan di `package.json`:

```bash
# 1. Login ke akun Cloudflare (hanya perlu sekali)
npx wrangler login

# 2. Deploy Frontend & Pages saja
npm run deploy:pages

# 3. Deploy Edge Worker API saja
npm run deploy:worker

# 4. Deploy Semuanya Sekaligus (Pages + Worker)
npm run deploy:all
```

---

## 🗄️ Konfigurasi Cloudflare D1 Database

Database D1 Anda sudah terkonfigurasi di `wrangler.toml` dan `wrangler.worker.toml`:
- **Database Name**: `backcharge-db`
- **Database ID**: `155712d3-90aa-439c-a7db-af868f08f681`
- **Binding Name**: `DB`

Untuk menjalankan migrasi skema SQL ke D1:
```bash
npx wrangler d1 execute backcharge-db --remote --file=cloudflare_d1_migration.sql
```
