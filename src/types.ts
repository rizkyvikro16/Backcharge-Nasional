export const BRANCH_LIST = [
  'Bali', 
  'Balikpapan', 
  'Bandung', 
  'Banjarmasin', 
  'Jakarta', 
  'Lampung', 
  'Makassar', 
  'Malang', 
  'Medan', 
  'Padang', 
  'Palembang', 
  'Pekanbaru', 
  'Pontianak', 
  'Semarang', 
  'Solo', 
  'Surabaya'
];

export type UserRole = 
  | 'Administrator' 
  | 'ASO / Staff' 
  | 'Sales Head' 
  | 'BRO' 
  | 'Admin' 
  | 'Kepala Cabang' 
  | 'Division Head' 
  | 'Regional Head'
  | 'Regional Head West' 
  | 'Regional Head Central' 
  | 'Regional Head East';

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

export type BackchargeCategory = 'Own Risk' | 'Maintenance' | 'Ekspedisi' | 'ETLE' | 'TPL';

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
  no_invoice: string;
  status_payment: string; // 'Belum Bayar' | 'Lunas'
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

