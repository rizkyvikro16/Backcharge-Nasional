import { createClient } from '@supabase/supabase-js';
import { Backcharge, ActivityLog, Profile } from './types';

// Read Supabase environment variables from import.meta.env
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Detect if Supabase is properly configured
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client if configured, otherwise null
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// =========================================================================
// OFFLINE MOCK ENGINE (LOCAL STORAGE FALLBACK)
// =========================================================================

const INITIAL_PROFILES: Profile[] = [
  { id: '1', email: 'admin.pusat@company.id', full_name: 'Aris Munandar (HQ Admin)', role: 'Administrator', branch: 'Nasional', created_at: new Date().toISOString() },
  { id: '2', email: 'aso.jkt@company.id', full_name: 'Hendra Wijaya (ASO Jkt)', role: 'ASO / Staff', branch: 'Jakarta', created_at: new Date().toISOString() },
  { id: '3', email: 'sales.jkt@company.id', full_name: 'Dewi Lestari (Sales Jkt)', role: 'Sales Head', branch: 'Jakarta', created_at: new Date().toISOString() },
  { id: '4', email: 'bro.sby@company.id', full_name: 'Bayu Saputra (BRO Sby)', role: 'BRO', branch: 'Surabaya', created_at: new Date().toISOString() },
  { id: '5', email: 'admin.sby@company.id', full_name: 'Siti Rahma (Admin Sby)', role: 'Admin', branch: 'Surabaya', created_at: new Date().toISOString() },
  { id: '6', email: 'aso.bdg@company.id', full_name: 'Budi Setiawan (ASO Bdg)', role: 'ASO / Staff', branch: 'Bandung', created_at: new Date().toISOString() },
  { id: '7', email: 'sales.mdn@company.id', full_name: 'Rian Pratama (Sales Mdn)', role: 'Sales Head', branch: 'Medan', created_at: new Date().toISOString() },
  { id: '8', email: 'kacab.jkt@company.id', full_name: 'Agus Salim (Kacab Jkt)', role: 'Kepala Cabang', branch: 'Jakarta', created_at: new Date().toISOString() },
  { id: '9', email: 'rbu.nas@company.id', full_name: 'Rudy Hartono (Division Head)', role: 'Division Head', branch: 'Nasional', created_at: new Date().toISOString() },
  { id: '10', email: 'rh.west@company.id', full_name: 'Herman Prasetyo (RH West)', role: 'Regional Head West', branch: 'Lampung, Medan, Padang, Palembang, Pekanbaru', created_at: new Date().toISOString() },
  { id: '11', email: 'aso.ptk@company.id', full_name: 'Eko Prasetyo (ASO Pontianak)', role: 'ASO / Staff', branch: 'Pontianak', created_at: new Date().toISOString() },
  { id: '12', email: 'rh.central@company.id', full_name: 'Bambang S (RH Central)', role: 'Regional Head Central', branch: 'Bandung, Jakarta, Pontianak', created_at: new Date().toISOString() },
  { id: '13', email: 'rh.east@company.id', full_name: 'Agus K (RH East)', role: 'Regional Head East', branch: 'Bali, Balikpapan, Banjarmasin, Makassar, Malang, Semarang, Solo, Surabaya', created_at: new Date().toISOString() }
];

// Initialize local storage mock database if not already present
if (!localStorage.getItem('bc_profiles')) {
  localStorage.setItem('bc_profiles', JSON.stringify(INITIAL_PROFILES));
} else {
  // Ensure the new roles exist in localStorage if it was already initialized
  try {
    const currentProfs = JSON.parse(localStorage.getItem('bc_profiles') || '[]');
    let modified = false;
    
    currentProfs.forEach((prof: any) => {
      if ((prof.role as string) === 'kacab') { prof.role = 'Kepala Cabang'; modified = true; }
      if ((prof.role as string) === 'RBU') { prof.role = 'Division Head'; modified = true; }
      if ((prof.role as string) === 'RH') { prof.role = 'Regional Head'; modified = true; }
    });

    INITIAL_PROFILES.slice(7).forEach(p => {
      const idx = currentProfs.findIndex((prof: any) => prof.email.toLowerCase() === p.email.toLowerCase());
      if (idx === -1) {
        currentProfs.push(p);
        modified = true;
      } else {
        currentProfs[idx].role = p.role;
        currentProfs[idx].full_name = p.full_name;
        currentProfs[idx].branch = p.branch;
        modified = true;
      }
    });

    if (modified) {
      localStorage.setItem('bc_profiles', JSON.stringify(currentProfs));
    }
  } catch (e) {
    console.error("Failed to inject new mock profiles:", e);
  }
}

if (!localStorage.getItem('bc_backcharges')) {
  const defaultBackcharges: Backcharge[] = [
    {
      id: 'BC-2026-0001',
      category: 'Own Risk',
      branch: 'Jakarta',
      no_bak: 'BAK/2026/06/001',
      no_spk: '-',
      no_sap: 'SAP-OR-101',
      customer_name: 'PT Carrefour Indonesia',
      license_plate: 'B 9201 UBA',
      value: 4500000,
      status_sap: 'Bill',
      status_confirm: 'Telah Dikonfirmasi',
      status_handover: 'Diterima Admin',
      no_invoice: 'INV/2026/VI/011',
      status_payment: 'Lunas',
      created_by: 'aso.jkt@company.id',
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      file_bak_url: 'dummy_pdf_file',
      file_handover_aso_sales_url: 'dummy_photo_1',
      file_handover_sales_admin_url: 'dummy_photo_2',
      tanggal: '2026-06-28'
    },
    {
      id: 'BC-2026-0002',
      category: 'Maintenance',
      branch: 'Surabaya',
      no_bak: 'BAK/2026/06/002',
      no_spk: 'SPK-MAINT-202',
      no_sap: '-',
      customer_name: 'PT Unilever Indonesia',
      license_plate: 'L 1827 CV',
      value: 1200000,
      status_sap: 'N/A',
      status_confirm: 'Telah Dikonfirmasi',
      status_handover: 'Diserahkan ke Admin',
      no_invoice: '-',
      status_payment: 'Belum Bayar',
      created_by: 'bro.sby@company.id',
      created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      file_bak_url: 'dummy_pdf_file',
      tanggal: '2026-06-30'
    },
    {
      id: 'BC-2026-0003',
      category: 'Ekspedisi',
      branch: 'Bandung',
      no_bak: '-',
      no_spk: 'SPK-EXP-303',
      no_sap: '-',
      customer_name: 'PT Indofood CBP',
      license_plate: '-',
      value: 8500000,
      status_sap: 'N/A',
      status_confirm: 'Belum Konfirmasi',
      status_handover: 'Pending',
      no_invoice: '-',
      status_payment: 'Belum Bayar',
      created_by: 'aso.bdg@company.id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tanggal: '2026-07-01'
    },
    {
      id: 'BC-2026-0004',
      category: 'ETLE',
      branch: 'Pontianak',
      no_bak: 'BAK/2026/07/004',
      no_spk: '-',
      no_sap: '-',
      customer_name: 'PT Kalimantan Sawit Sejahtera',
      license_plate: 'KB 1423 XX',
      value: 2500000,
      status_sap: 'N/A',
      status_confirm: 'Belum Konfirmasi',
      status_handover: 'Diserahkan ke Admin',
      no_invoice: '-',
      status_payment: 'Belum Bayar',
      created_by: 'aso.ptk@company.id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tanggal: '2026-07-02'
    }
  ];
  localStorage.setItem('bc_backcharges', JSON.stringify(defaultBackcharges));
}

if (!localStorage.getItem('bc_activity_logs')) {
  const initialLogs: ActivityLog[] = [
    { id: 1, timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0001', performed_by: 'aso.jkt@company.id', action_description: 'Membuat transaksi Backcharge baru kategori Own Risk di cabang Jakarta' },
    { id: 2, timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0001', performed_by: 'sales.jkt@company.id', action_description: 'Status Konfirmasi berubah dari "Belum Konfirmasi" menjadi "Telah Dikonfirmasi"' },
    { id: 3, timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0002', performed_by: 'bro.sby@company.id', action_description: 'Membuat transaksi Backcharge baru kategori Maintenance di cabang Surabaya' }
  ];
  localStorage.setItem('bc_activity_logs', JSON.stringify(initialLogs));
}

// Helper mock functions
export const mockDb = {
  getProfiles: (): Profile[] => {
    return JSON.parse(localStorage.getItem('bc_profiles') || '[]');
  },
  
  saveProfile: (p: Profile) => {
    const profiles = mockDb.getProfiles();
    const idx = profiles.findIndex(prof => (prof.id && p.id && prof.id === p.id) || prof.email.toLowerCase() === p.email.toLowerCase());
    if (idx !== -1) {
      profiles[idx] = p;
    } else {
      profiles.push(p);
    }
    localStorage.setItem('bc_profiles', JSON.stringify(profiles));
  },
  
  deleteProfile: (idOrEmail: string) => {
    const profiles = mockDb.getProfiles();
    const filtered = profiles.filter(p => p.id !== idOrEmail && p.email.toLowerCase() !== idOrEmail.toLowerCase());
    localStorage.setItem('bc_profiles', JSON.stringify(filtered));
  },

  deleteBackcharge: (id: string) => {
    const bcs = mockDb.getBackcharges();
    const filtered = bcs.filter(item => item.id !== id);
    localStorage.setItem('bc_backcharges', JSON.stringify(filtered));
  },

  getBackcharges: (): Backcharge[] => {
    return JSON.parse(localStorage.getItem('bc_backcharges') || '[]');
  },

  saveBackcharge: (b: Backcharge, performedByEmail: string) => {
    const bcs = mockDb.getBackcharges();
    const idx = bcs.findIndex(item => item.id === b.id);
    let logDesc = '';

    if (idx !== -1) {
      const old = bcs[idx];
      bcs[idx] = { ...b, updated_at: new Date().toISOString() };
      
      // Auto-trigger logging emulator
      if (old.status_confirm !== b.status_confirm) {
        logDesc += `Status Konfirmasi berubah dari "${old.status_confirm}" menjadi "${b.status_confirm}". `;
      }
      if (old.status_sap !== b.status_sap) {
        logDesc += `Status SAP berubah dari "${old.status_sap}" menjadi "${b.status_sap}". `;
      }
      if (old.status_handover !== b.status_handover) {
        logDesc += `Status Serah Terima berubah dari "${old.status_handover}" menjadi "${b.status_handover}". `;
      }
      if (old.no_invoice !== b.no_invoice) {
        logDesc += `Nomor Invoice diperbarui dari "${old.no_invoice}" menjadi "${b.no_invoice}". `;
      }
      if (old.status_payment !== b.status_payment) {
        logDesc += `Status Pembayaran berubah dari "${old.status_payment}" menjadi "${b.status_payment}". `;
      }
      if (!old.file_bak_url && b.file_bak_url) {
        logDesc += 'File BAK berhasil diupload. ';
      }
      if (!old.file_handover_aso_sales_url && b.file_handover_aso_sales_url) {
        logDesc += 'Foto serah terima ASO ke Sales diupload. ';
      }
      if (!old.file_handover_sales_admin_url && b.file_handover_sales_admin_url) {
        logDesc += 'Foto serah terima Sales ke Admin diupload. ';
      }
    } else {
      bcs.push(b);
      logDesc = `Membuat transaksi Backcharge baru kategori ${b.category} di cabang ${b.branch}`;
    }

    localStorage.setItem('bc_backcharges', JSON.stringify(bcs));

    if (logDesc) {
      mockDb.addLog(b.id, performedByEmail, logDesc);
    }
  },

  getLogs: (): ActivityLog[] => {
    return JSON.parse(localStorage.getItem('bc_activity_logs') || '[]');
  },

  addLog: (transactionId: string, performedBy: string, description: string) => {
    const logs = mockDb.getLogs();
    const newLog: ActivityLog = {
      id: logs.length + 1,
      timestamp: new Date().toISOString(),
      transaction_id: transactionId,
      performed_by: performedBy,
      action_description: description
    };
    logs.unshift(newLog);
    localStorage.setItem('bc_activity_logs', JSON.stringify(logs));
  }
};
