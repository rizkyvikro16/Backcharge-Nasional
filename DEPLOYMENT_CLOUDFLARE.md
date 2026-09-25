# Panduan Lengkap Deploy ke Cloudflare Pages (100% Sukses)

Aplikasi **Backcharge Nasional ASSA** telah dioptimalkan secara penuh untuk arsitektur edge **Cloudflare Pages (Full-Stack Advanced Mode)** dengan database **Cloudflare D1**.

---

## 1. Hubungkan Repository GitHub ke Cloudflare Pages

1. Buka dashboard Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com)
2. Di menu navigasi samping kiri, klik **Compute (Workers & Pages)** -> **Overview**.
3. Klik tombol **Create Application** (atau **Create**).
4. Pilih tab **Pages**, lalu klik **Connect to Git**.
5. Pilih akun GitHub Anda (`rizkyvikro16`) dan pilih repositori:
   `rizkyvikro16/Backcharge-Nasional`
6. Klik **Begin setup**.

---

## 2. Pengaturan Build (Build Settings)

Pada halaman **Set up builds and deployments**, masukkan konfigurasi berikut:

* **Project name**: `backcharge-nasional` (atau nama pilihan Anda)
* **Production branch**: `main`
* **Framework preset**: `Vite` (atau `None`)
* **Build command**: `npm run build:pages`
* **Build output directory**: `dist`
* **Root directory**: `/` (kosongkan / default)

---

## 3. Tambahkan Database Binding Cloudflare D1 (Wajib)

Aplikasi menggunakan edge database Cloudflare D1 dengan binding bernama `DB`.

### Langkah A: Buat Database D1 (Jika Belum Ada)
1. Di sidebar Cloudflare, buka **Storage & Databases** -> **D1 SQL Database**.
2. Klik **Create database**, beri nama misalnya: `backcharge-d1`.
3. Klik **Create**.

### Langkah B: Sambungkan ke Cloudflare Pages
1. Masuk ke project Pages Anda (`backcharge-nasional`).
2. Masuk ke tab **Settings** -> **Functions**.
3. Gulir ke bawah ke bagian **D1 database bindings**.
4. Klik **Add binding**:
   * **Variable name**: `DB` (Wajib huruf besar semua)
   * **D1 database**: Pilih database D1 yang Anda buat (`backcharge-d1`)
5. Klik **Save**.

*Catatan: Saat aplikasi pertama kali dibuka di Cloudflare Pages, Worker secara otomatis menjalankan migrasi mandiri (self-healing migration) dan membuat seluruh tabel database (backcharges, profiles, activity_logs, contact_inquiries) secara instan tanpa perlu menjalankan SQL manual.*

---

## 4. Environment Variables (Opsional)

Jika ingin mengatur variabel lingkungan tambahan, masuk ke **Settings** -> **Environment variables**:

* `NODE_VERSION`: `20`
* `VITE_GOOGLE_APPS_SCRIPT_URL`: *(Sudah memiliki fallback bawaan di kode, bisa diisi jika menggunakan script baru)*
* `GOOGLE_DRIVE_FOLDER_ID`: `1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ`

---

## 5. Jalankan Deployment

1. Klik tombol **Save and Deploy**.
2. Cloudflare Pages akan menarik kode dari GitHub, mengompilasi Vite, dan menerbitkan web serta API Worker edge ke CDN global Cloudflare.
3. Setelah status centang hijau **Success**, kunjungi tautan domain yang disediakan (misal: `https://backcharge-nasional.pages.dev`).

---

## 6. Login Pertama Kali

Gunakan akun administrator bawaan sistem:
* **Email**: `administrator@assa.id` (atau `assa@assa.id`)
* **Password**: `password123`
