import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE')) {
  console.error('❌ Error: Supabase URL atau Anon Key tidak terkonfigurasi di file .env Anda!');
  console.log('💡 Silakan isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env terlebih dahulu untuk mengekspor data.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigrationExport() {
  console.log('🚀 Memulai ekspor data dari Supabase ke format Cloudflare D1 (SQLite)...');
  
  let sqlDump = `-- =========================================================================\n`;
  sqlDump += `-- CLOUDFLARE D1 (SQLITE) MIGRATION SCRIPT - BACKCHARGE SYSTEM\n`;
  sqlDump += `-- Generated on: ${new Date().toISOString()}\n`;
  sqlDump += `-- =========================================================================\n\n`;

  // 1. Write translated Schemas for SQLite/D1
  sqlDump += `-- 1. Schema Definition for Cloudflare D1\n\n`;
  sqlDump += `DROP TABLE IF EXISTS profiles;\n`;
  sqlDump += `CREATE TABLE IF NOT EXISTS profiles (\n`;
  sqlDump += `    id TEXT PRIMARY KEY,\n`;
  sqlDump += `    email TEXT UNIQUE NOT NULL,\n`;
  sqlDump += `    full_name TEXT NOT NULL,\n`;
  sqlDump += `    role TEXT NOT NULL,\n`;
  sqlDump += `    branch TEXT NOT NULL,\n`;
  sqlDump += `    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL\n`;
  sqlDump += `);\n\n`;

  sqlDump += `DROP TABLE IF EXISTS backcharges;\n`;
  sqlDump += `CREATE TABLE IF NOT EXISTS backcharges (\n`;
  sqlDump += `    id TEXT PRIMARY KEY,\n`;
  sqlDump += `    category TEXT NOT NULL,\n`;
  sqlDump += `    branch TEXT NOT NULL,\n`;
  sqlDump += `    no_bak TEXT DEFAULT '-',\n`;
  sqlDump += `    no_spk TEXT DEFAULT '-',\n`;
  sqlDump += `    no_sap TEXT DEFAULT '-',\n`;
  sqlDump += `    customer_name TEXT NOT NULL,\n`;
  sqlDump += `    license_plate TEXT DEFAULT '-',\n`;
  sqlDump += `    value REAL NOT NULL DEFAULT 0,\n`;
  sqlDump += `    status_sap TEXT NOT NULL DEFAULT 'N/A',\n`;
  sqlDump += `    status_confirm TEXT NOT NULL DEFAULT 'Belum Konfirmasi',\n`;
  sqlDump += `    status_handover TEXT NOT NULL DEFAULT 'Pending',\n`;
  sqlDump += `    no_invoice TEXT DEFAULT '-',\n`;
  sqlDump += `    status_payment TEXT NOT NULL DEFAULT 'Belum Bayar',\n`;
  sqlDump += `    status_approval TEXT,\n`;
  sqlDump += `    approved_by TEXT,\n`;
  sqlDump += `    approved_at TEXT,\n`;
  sqlDump += `    created_by TEXT NOT NULL,\n`;
  sqlDump += `    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,\n`;
  sqlDump += `    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,\n`;
  sqlDump += `    file_bak_url TEXT,\n`;
  sqlDump += `    file_handover_aso_sales_url TEXT,\n`;
  sqlDump += `    file_handover_sales_admin_url TEXT,\n`;
  sqlDump += `    approval_note TEXT,\n`;
  sqlDump += `    approval_attachment_1_url TEXT,\n`;
  sqlDump += `    approval_attachment_2_url TEXT,\n`;
  sqlDump += `    approval_attachment_3_url TEXT\n`;
  sqlDump += `);\n\n`;

  sqlDump += `DROP TABLE IF EXISTS activity_logs;\n`;
  sqlDump += `CREATE TABLE IF NOT EXISTS activity_logs (\n`;
  sqlDump += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
  sqlDump += `    timestamp TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,\n`;
  sqlDump += `    transaction_id TEXT NOT NULL,\n`;
  sqlDump += `    performed_by TEXT NOT NULL,\n`;
  sqlDump += `    action_description TEXT NOT NULL\n`;
  sqlDump += `);\n\n`;

  sqlDump += `DROP TABLE IF EXISTS contact_inquiries;\n`;
  sqlDump += `CREATE TABLE IF NOT EXISTS contact_inquiries (\n`;
  sqlDump += `    id TEXT PRIMARY KEY,\n`;
  sqlDump += `    name TEXT NOT NULL,\n`;
  sqlDump += `    email TEXT NOT NULL,\n`;
  sqlDump += `    subject TEXT NOT NULL,\n`;
  sqlDump += `    message TEXT NOT NULL,\n`;
  sqlDump += `    status TEXT DEFAULT 'Open',\n`;
  sqlDump += `    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,\n`;
  sqlDump += `    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL\n`;
  sqlDump += `);\n\n`;

  // Helper function to escape SQL string values safely for SQLite
  const escapeSql = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  };

  try {
    // 2. Fetch Profiles
    console.log('⏳ Mengekspor tabel `profiles`...');
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) throw pErr;
    if (profiles && profiles.length > 0) {
      sqlDump += `-- DATA: profiles (${profiles.length} baris)\n`;
      for (const item of profiles) {
        sqlDump += `INSERT INTO profiles (id, email, full_name, role, branch, created_at) VALUES (\n`;
        sqlDump += `  ${escapeSql(item.id)}, ${escapeSql(item.email)}, ${escapeSql(item.full_name)},\n`;
        sqlDump += `  ${escapeSql(item.role)}, ${escapeSql(item.branch)}, ${escapeSql(item.created_at)}\n`;
        sqlDump += `);\n`;
      }
      sqlDump += '\n';
    }

    // 3. Fetch Backcharges
    console.log('⏳ Mengekspor tabel `backcharges`...');
    const { data: backcharges, error: bErr } = await supabase.from('backcharges').select('*');
    if (bErr) throw bErr;
    if (backcharges && backcharges.length > 0) {
      sqlDump += `-- DATA: backcharges (${backcharges.length} baris)\n`;
      for (const item of backcharges) {
        sqlDump += `INSERT INTO backcharges (\n`;
        sqlDump += `  id, category, branch, no_bak, no_spk, no_sap, customer_name, license_plate,\n`;
        sqlDump += `  value, status_sap, status_confirm, status_handover, no_invoice, status_payment,\n`;
        sqlDump += `  status_approval, approved_by, approved_at, created_by, created_at, updated_at,\n`;
        sqlDump += `  file_bak_url, file_handover_aso_sales_url, file_handover_sales_admin_url,\n`;
        sqlDump += `  approval_note, approval_attachment_1_url, approval_attachment_2_url, approval_attachment_3_url\n`;
        sqlDump += `) VALUES (\n`;
        sqlDump += `  ${escapeSql(item.id)}, ${escapeSql(item.category)}, ${escapeSql(item.branch)},\n`;
        sqlDump += `  ${escapeSql(item.no_bak)}, ${escapeSql(item.no_spk)}, ${escapeSql(item.no_sap)},\n`;
        sqlDump += `  ${escapeSql(item.customer_name)}, ${escapeSql(item.license_plate)}, ${escapeSql(item.value)},\n`;
        sqlDump += `  ${escapeSql(item.status_sap)}, ${escapeSql(item.status_confirm)}, ${escapeSql(item.status_handover)},\n`;
        sqlDump += `  ${escapeSql(item.no_invoice)}, ${escapeSql(item.status_payment)}, ${escapeSql(item.status_approval)},\n`;
        sqlDump += `  ${escapeSql(item.approved_by)}, ${escapeSql(item.approved_at)}, ${escapeSql(item.created_by)},\n`;
        sqlDump += `  ${escapeSql(item.created_at)}, ${escapeSql(item.updated_at)}, ${escapeSql(item.file_bak_url)},\n`;
        sqlDump += `  ${escapeSql(item.file_handover_aso_sales_url)}, ${escapeSql(item.file_handover_sales_admin_url)},\n`;
        sqlDump += `  ${escapeSql(item.approval_note)}, ${escapeSql(item.approval_attachment_1_url)},\n`;
        sqlDump += `  ${escapeSql(item.approval_attachment_2_url)}, ${escapeSql(item.approval_attachment_3_url)}\n`;
        sqlDump += `);\n`;
      }
      sqlDump += '\n';
    }

    // 4. Fetch Activity Logs
    console.log('⏳ Mengekspor tabel `activity_logs`...');
    const { data: logs, error: lErr } = await supabase.from('activity_logs').select('*');
    if (lErr) throw lErr;
    if (logs && logs.length > 0) {
      sqlDump += `-- DATA: activity_logs (${logs.length} baris)\n`;
      for (const item of logs) {
        sqlDump += `INSERT INTO activity_logs (id, timestamp, transaction_id, performed_by, action_description) VALUES (\n`;
        sqlDump += `  ${escapeSql(item.id)}, ${escapeSql(item.timestamp)}, ${escapeSql(item.transaction_id)},\n`;
        sqlDump += `  ${escapeSql(item.performed_by)}, ${escapeSql(item.action_description)}\n`;
        sqlDump += `);\n`;
      }
      sqlDump += '\n';
    }

    // 5. Fetch Contact Inquiries
    console.log('⏳ Mengekspor tabel `contact_inquiries`...');
    try {
      const { data: inquiries, error: cErr } = await supabase.from('contact_inquiries').select('*');
      if (cErr) throw cErr;
      if (inquiries && inquiries.length > 0) {
        sqlDump += `-- DATA: contact_inquiries (${inquiries.length} baris)\n`;
        for (const item of inquiries) {
          sqlDump += `INSERT INTO contact_inquiries (id, name, email, subject, message, status, created_at, updated_at) VALUES (\n`;
          sqlDump += `  ${escapeSql(item.id)}, ${escapeSql(item.name)}, ${escapeSql(item.email)},\n`;
          sqlDump += `  ${escapeSql(item.subject)}, ${escapeSql(item.message)}, ${escapeSql(item.status)},\n`;
          sqlDump += `  ${escapeSql(item.created_at)}, ${escapeSql(item.updated_at)}\n`;
          sqlDump += `);\n`;
        }
        sqlDump += '\n';
      }
    } catch (inqError) {
      console.warn('⚠️ Tabel `contact_inquiries` tidak ditemukan atau gagal diekspor (diabaikan).');
    }

    // Write to Output SQL File
    const outputPath = path.join(process.cwd(), 'cloudflare_d1_migration.sql');
    fs.writeFileSync(outputPath, sqlDump, 'utf8');

    console.log('\n========================================================');
    console.log('✨ EKSPOR DATA SELESAI DENGAN SUKSES! ✨');
    console.log(`📂 File SQL D1 tersimpan di: ${outputPath}`);
    console.log('========================================================\n');
    console.log('ℹ️ Langkah berikutnya untuk migrasi ke Cloudflare D1:');
    console.log('1. Jalankan perintah wrangler CLI berikut untuk membuat database D1:');
    console.log('   $ npx wrangler d1 create backcharge-db');
    console.log('2. Impor file SQL ini ke database D1 lokal atau produksi Anda:');
    console.log('   $ npx wrangler d1 execute backcharge-db --file=./cloudflare_d1_migration.sql --remote');
    console.log('========================================================\n');

  } catch (error: any) {
    console.error('❌ Terjadi kesalahan saat ekspor data:', error.message);
    process.exit(1);
  }
}

runMigrationExport();
