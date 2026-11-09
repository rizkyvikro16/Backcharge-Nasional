import { Backcharge, ActivityLog, Profile, ContactInquiry, hasRole } from './types';
import { FULL_BACKCHARGES_DATA } from './lib/fullSeedData';

// =========================================================================
// LOCAL STORAGE MOCK ENGINE (OFFLINE FALLBACK & DEFAULT DATA SEEDING)
// =========================================================================

const INITIAL_PROFILES: Profile[] = [
  { id: '1', email: 'administrator@assa.id', full_name: 'ASSA Administrator', role: 'Administrator', branch: 'Nasional', created_at: new Date().toISOString(), password: 'password123' },
  { id: 'l8hovd', email: 'assa@assa.id', full_name: 'ASSA Admin', role: 'Administrator', branch: 'Nasional', created_at: new Date().toISOString(), password: 'password123' },
  { id: '1a', email: 'admin.pusat@company.id', full_name: 'Aris Munandar (HQ Admin)', role: 'Administrator', branch: 'Nasional', created_at: new Date().toISOString() },
  { id: '2', email: 'aso.jkt@company.id', full_name: 'Hendra Wijaya (ASO Megabranch)', role: 'ASO Megabranch', branch: 'BSO GSO & AFFCO', created_at: new Date().toISOString() },
  { id: '3', email: 'sales.jkt@company.id', full_name: 'Dewi Lestari (Sales Megabranch)', role: 'Sales Head', branch: 'BSO Sudirman', created_at: new Date().toISOString() },
  { id: '4', email: 'bro.sby@company.id', full_name: 'Bayu Saputra (BRO Sby)', role: 'BRO', branch: 'Surabaya', created_at: new Date().toISOString() },
  { id: '5', email: 'admin.sby@company.id', full_name: 'Siti Rahma (Admin Sby)', role: 'Admin', branch: 'Surabaya', created_at: new Date().toISOString() },
  { id: '6', email: 'aso.bdg@company.id', full_name: 'Budi Setiawan (ASO Bdg)', role: 'ASO', branch: 'Bandung', created_at: new Date().toISOString() },
  { id: '7', email: 'sales.mdn@company.id', full_name: 'Rian Pratama (Sales Mdn)', role: 'Sales Head', branch: 'Medan', created_at: new Date().toISOString() },
  { id: '8', email: 'kacab.jkt@company.id', full_name: 'Agus Salim (Kacab Megabranch)', role: 'Kepala Cabang', branch: 'BSO GSO & AFFCO', created_at: new Date().toISOString() },
  { id: '9', email: 'rbu.nas@company.id', full_name: 'Rudy Hartono (Division Head)', role: 'Division Head', branch: 'Nasional', created_at: new Date().toISOString() },
  { id: '10', email: 'rh.west@company.id', full_name: 'Herman Prasetyo (RH West)', role: 'Regional Head West', branch: 'Lampung, Medan, Padang, Palembang, Pekanbaru', created_at: new Date().toISOString() },
  { id: '11', email: 'aso.ptk@company.id', full_name: 'Eko Prasetyo (ASO Pontianak)', role: 'ASO Megabranch', branch: 'BSO Pontianak', created_at: new Date().toISOString() },
  { id: '12', email: 'rh.central@company.id', full_name: 'Bambang S (RH Central)', role: 'Regional Head Central', branch: 'Bandung, BSO GSO & AFFCO, BSO Sudirman, BSO Sunter, BSO Pondok Pinang, BSO Banten, BSO Bekasi, BSO Daan Mogot, BSO Pontianak', created_at: new Date().toISOString() },
  { id: '13', email: 'rh.east@company.id', full_name: 'Agus K (RH East)', role: 'Regional Head East', branch: 'Bali, Balikpapan, Banjarmasin, Makassar, Malang, Manado, Semarang, Solo, Surabaya', created_at: new Date().toISOString() }
];

// Initialize local storage mock database if not already present
try {
  if (!localStorage.getItem('bc_profiles')) {
    localStorage.setItem('bc_profiles', JSON.stringify(INITIAL_PROFILES));
  } else {
    // Ensure the new roles exist in localStorage if it was already initialized
    let currentProfs = JSON.parse(localStorage.getItem('bc_profiles') || '[]');
    let modified = false;
    
    // Clean up demo user if present
    const prevLen = currentProfs.length;
    currentProfs = currentProfs.filter((p: any) => p.email !== 'maint.ctr@company.id');
    if (currentProfs.length !== prevLen) {
      modified = true;
    }
    
    currentProfs.forEach((prof: any) => {
      if (hasRole(prof.role, 'kacab')) { prof.role = 'Kepala Cabang'; modified = true; }
      if (hasRole(prof.role, 'RBU')) { prof.role = 'Division Head'; modified = true; }
      if (hasRole(prof.role, 'RH')) { prof.role = 'Regional Head'; modified = true; }
      if (hasRole(prof.role, 'ASO / Staff')) { prof.role = 'ASO'; modified = true; }
      if (hasRole(prof.role, 'Megabranch')) { prof.role = 'ASO Megabranch'; modified = true; }
      if (hasRole(prof.role, 'BRO Megabranch')) { prof.role = 'BRO'; modified = true; }
      if (hasRole(prof.role, 'SM Megabranch')) { prof.role = 'Sales Head'; modified = true; }
      if (prof.branch === 'Jakarta') { prof.branch = 'BSO GSO & AFFCO'; modified = true; }
      if (prof.branch && prof.branch.includes('Jakarta')) {
        prof.branch = prof.branch.replace(/Jakarta/g, 'BSO GSO & AFFCO');
        modified = true;
      }
      if (prof.branch === 'Pontianak') { prof.branch = 'BSO Pontianak'; modified = true; }
      if (prof.branch && prof.branch.includes('Pontianak') && !prof.branch.includes('BSO Pontianak')) {
        prof.branch = prof.branch.replace(/Pontianak/g, 'BSO Pontianak');
        modified = true;
      }
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
  }
} catch (e) {
  console.warn("Profiles localStorage initialization skipped or failed:", e);
}

const INITIAL_BACKCHARGES: Backcharge[] = FULL_BACKCHARGES_DATA;

// Clean up oversized 'bc_backcharges' from localStorage to prevent QuotaExceededError (5MB limit)
try {
  localStorage.removeItem('bc_backcharges');
} catch {}

let memBackcharges: Backcharge[] = [...INITIAL_BACKCHARGES];

const INITIAL_LOGS: ActivityLog[] = [
  { id: 1, timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0001', performed_by: 'aso.jkt@company.id', action_description: 'Membuat transaksi Backcharge baru kategori Own Risk di cabang Megabranch' },
  { id: 2, timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0001', performed_by: 'sales.jkt@company.id', action_description: 'Status Konfirmasi berubah dari "Belum Konfirmasi" menjadi "Telah Dikonfirmasi"' },
  { id: 3, timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), transaction_id: 'BC-2026-0002', performed_by: 'bro.sby@company.id', action_description: 'Membuat transaksi Backcharge baru kategori Maintenance di cabang Surabaya' }
];

try {
  if (!localStorage.getItem('bc_activity_logs')) {
    localStorage.setItem('bc_activity_logs', JSON.stringify(INITIAL_LOGS));
  } else {
    // Migrate existing activity logs referencing 'Jakarta' to 'Megabranch'
    let currentLogs = JSON.parse(localStorage.getItem('bc_activity_logs') || '[]');
    let modified = false;
    currentLogs.forEach((log: any) => {
      if (log.action_description && log.action_description.includes('cabang Jakarta')) {
        log.action_description = log.action_description.replace(/cabang Jakarta/g, 'cabang Megabranch');
        modified = true;
      }
    });
    if (modified) {
      localStorage.setItem('bc_activity_logs', JSON.stringify(currentLogs));
    }
  }
} catch (e) {
  console.warn("Activity logs storage skipped:", e);
}

if (!localStorage.getItem('bc_contact_inquiries')) {
  localStorage.setItem('bc_contact_inquiries', JSON.stringify([]));
} else {
  try {
    const existing = JSON.parse(localStorage.getItem('bc_contact_inquiries') || '[]');
    if (Array.isArray(existing)) {
      const filtered = existing.filter((item: any) => item.id !== 'CI-2026-0001' && item.id !== 'CI-2026-0002');
      localStorage.setItem('bc_contact_inquiries', JSON.stringify(filtered));
    }
  } catch (e) {
    console.error(e);
  }
}

// Helper mock functions
export const mockDb = {
  getProfiles: (): Profile[] => {
    try {
      const data = localStorage.getItem('bc_profiles');
      if (!data) return INITIAL_PROFILES;
      const parsed = JSON.parse(data);
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_PROFILES;
    } catch (e) {
      console.error("Corrupted Profiles in LocalStorage:", e);
      return INITIAL_PROFILES;
    }
  },

  getLogs: (): ActivityLog[] => {
    try {
      const data = localStorage.getItem('bc_activity_logs');
      if (!data) return INITIAL_LOGS;
      const parsed = JSON.parse(data);
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_LOGS;
    } catch (e) {
      console.error("Corrupted Activity Logs in LocalStorage:", e);
      return INITIAL_LOGS;
    }
  },
  
  saveProfile: (p: Profile) => {
    const profiles = mockDb.getProfiles();
    const idx = profiles.findIndex(prof => (prof.id && p.id && prof.id === p.id) || prof.email.toLowerCase() === p.email.toLowerCase());
    if (idx !== -1) {
      profiles[idx] = p;
    } else {
      profiles.push(p);
    }
    try {
      localStorage.setItem('bc_profiles', JSON.stringify(profiles));
    } catch {}
  },
  
  deleteProfile: (idOrEmail: string) => {
    const profiles = mockDb.getProfiles();
    const filtered = profiles.filter(p => p.id !== idOrEmail && p.email.toLowerCase() !== idOrEmail.toLowerCase());
    try {
      localStorage.setItem('bc_profiles', JSON.stringify(filtered));
    } catch {}
  },

  deleteBackcharge: (id: string) => {
    memBackcharges = memBackcharges.filter(item => item.id !== id);
  },

  getBackcharges: (): Backcharge[] => {
    return memBackcharges && memBackcharges.length > 0 ? memBackcharges : INITIAL_BACKCHARGES;
  },

  saveBackcharge: (b: Backcharge, performedByEmail: string) => {
    const idx = memBackcharges.findIndex(item => item.id === b.id);
    let logDesc = '';

    if (idx !== -1) {
      const old = memBackcharges[idx];
      memBackcharges[idx] = { ...b, updated_at: new Date().toISOString() };
      
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
      memBackcharges.push(b);
      logDesc = `Membuat transaksi Backcharge baru kategori ${b.category} di cabang ${b.branch}`;
    }

    if (logDesc) {
      mockDb.addLog(b.id, performedByEmail, logDesc);
    }
  },

  saveBackchargesBatch: (batchList: Backcharge[], performedByEmail: string) => {
    const bcMap = new Map<string, number>();
    memBackcharges.forEach((item, index) => {
      if (item.id) bcMap.set(item.id, index);
    });

    for (const b of batchList) {
      const idx = bcMap.has(b.id) ? bcMap.get(b.id)! : -1;
      if (idx !== -1) {
        memBackcharges[idx] = { ...b, updated_at: new Date().toISOString() };
      } else {
        memBackcharges.push(b);
        bcMap.set(b.id, memBackcharges.length - 1);
      }
    }

    mockDb.addLog('SYSTEM', performedByEmail, `Melakukan import data secara massal sebanyak ${batchList.length} data Backcharge`);
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
    try {
      localStorage.setItem('bc_activity_logs', JSON.stringify(logs.slice(0, 50)));
    } catch {}
  },

  getContactInquiries: (): ContactInquiry[] => {
    try {
      const data = localStorage.getItem('bc_contact_inquiries');
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Corrupted Contact Inquiries in LocalStorage:", e);
      return [];
    }
  },

  saveContactInquiry: (ci: ContactInquiry) => {
    const inquiries = mockDb.getContactInquiries();
    const idx = inquiries.findIndex(item => item.id === ci.id);
    if (idx !== -1) {
      inquiries[idx] = { ...ci };
    } else {
      inquiries.unshift(ci);
    }
    try {
      localStorage.setItem('bc_contact_inquiries', JSON.stringify(inquiries));
    } catch {}
  },

  deleteContactInquiry: (id: string) => {
    const inquiries = mockDb.getContactInquiries();
    const filtered = inquiries.filter(item => item.id !== id);
    try {
      localStorage.setItem('bc_contact_inquiries', JSON.stringify(filtered));
    } catch {}
  }
};
