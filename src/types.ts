export const BRANCH_LIST = [
  'Bali', 
  'Balikpapan', 
  'Bandung', 
  'Banjarmasin', 
  'Lampung', 
  'Makassar', 
  'Malang', 
  'Medan', 
  'Padang', 
  'Palembang', 
  'Pekanbaru', 
  'Semarang', 
  'Solo', 
  'Surabaya'
];

export const MEGABRANCH_LIST = [
  'BSO GSO & AFFCO',
  'BSO Sudirman',
  'BSO Sunter',
  'BSO Pondok Pinang',
  'BSO Banten',
  'BSO Bekasi',
  'BSO Daan Mogot',
  'BSO Pontianak'
];

export const ALL_SYSTEM_BRANCHES = Array.from(new Set([...BRANCH_LIST, ...MEGABRANCH_LIST]));

export function getUserBranches(branch: string): string[] {
  if (!branch) return [];
  if (branch === 'Nasional') return ALL_SYSTEM_BRANCHES;
  const parts = branch.split(',').map(s => s.trim()).filter(Boolean);
  const expanded = new Set<string>();
  parts.forEach(part => {
    if (part !== 'Megabranch') {
      expanded.add(part);
    }
    const pLower = part.toLowerCase();
    if (pLower === 'megabranch' || pLower === 'jakarta') {
      MEGABRANCH_LIST.forEach(b => expanded.add(b));
    }
  });
  return Array.from(expanded);
}

export type UserRole = 
  | 'Administrator' 
  | 'ASO' 
  | 'Sales Head' 
  | 'BRO' 
  | 'Admin' 
  | 'Kepala Cabang' 
  | 'Division Head' 
  | 'Regional Head'
  | 'Regional Head West' 
  | 'Regional Head Central' 
  | 'Regional Head East'
  | 'Admin Head'
  | 'Maintenance Center'
  | 'ASO Megabranch';

export const REGIONAL_HEAD_ROLES: UserRole[] = [
  'Regional Head West',
  'Regional Head Central',
  'Regional Head East',
  'Regional Head'
];

export function isRegionalHeadRole(role: string): boolean {
  return role ? role.startsWith('Regional Head') : false;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch: string;
  created_at: string;
  password?: string;
}

export type BackchargeCategory = 'Own Risk' | 'Maintenance' | 'Ekspedisi' | 'ETLE' | 'TPL' | 'Unclaimable Insurance' | 'Dokumen Kendaraan';

export interface Backcharge {
  id: string; // BC-2026-0001
  category: BackchargeCategory;
  branch: string;
  no_bak: string;
  no_spk: string;
  no_sap: string;
  no_tilang?: string;
  customer_name: string;
  license_plate: string;
  value: number;
  status_sap: string; // 'N/A' | 'Bill' | 'Not Bill'
  status_confirm: string; // 'Belum Konfirmasi' | 'Telah Dikonfirmasi' | 'Ditolak / Negosiasi Ulang'
  status_handover: string; // 'Pending' | 'Diserahkan ke Admin' | 'Diterima Admin'
  status_approval?: string; // 'Belum Approval' | 'Disetujui' | 'Ditolak'
  approved_by?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  approval_attachment_1_url?: string | null;
  approval_attachment_2_url?: string | null;
  approval_attachment_3_url?: string | null;

  regional_approval_status?: string;
  regional_approved_by?: string | null;
  regional_approved_at?: string | null;
  regional_approval_note?: string | null;

  division_approval_status?: string;
  division_approved_by?: string | null;
  division_approved_at?: string | null;
  division_approval_note?: string | null;
  no_invoice: string;
  status_payment: string; // 'Belum Bayar' | 'Lunas'
  payment_date?: string | null;
  created_by: string; // Email of creator
  created_at: string;
  updated_at: string;
  
  // File URL / Base64 Data paths
  file_bak_url?: string | null;
  file_handover_aso_sales_url?: string | null;
  file_handover_sales_admin_url?: string | null;
  tanggal?: string | null;
  tanggal_handover?: string | null;
  bro_name?: string | null;
  dok_pendukung_alasan?: string | null;
  nama_bro?: string | null;
  upload_dok_pendukung?: string | null;
  alasan?: string | null;
}

export interface ActivityLog {
  id: string | number;
  timestamp: string;
  transaction_id: string;
  performed_by: string;
  action_description: string;
}

export interface AppNotification {
  id: string;
  transaction_id: string;
  customer_name: string;
  category: string;
  branch: string;
  description: string;
  created_at: string;
  read: boolean;
  type?: string;
  typeLabel?: string;
}

export interface DashboardFilter {
  category?: string;
  stage?: string;
  branch?: string;
  statusPayment?: string;
  statusConfirm?: string;
  alert?: 'due' | 'pending' | 'high_value' | '';
}

export const WEST_BRANCHES = ['Lampung', 'Medan', 'Padang', 'Palembang', 'Pekanbaru'];
export const CENTRAL_BRANCHES = ['Bandung', 'BSO Pontianak'];
export const EAST_BRANCHES = ['Bali', 'Balikpapan', 'Banjarmasin', 'Makassar', 'Malang', 'Semarang', 'Solo', 'Surabaya'];

export interface ContactInquiry {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  message: string;
  status: 'Unread' | 'Replied' | 'Under Review';
  created_at: string;
  feedback?: string;
  feedback_by?: string;
  feedback_at?: string;
}


