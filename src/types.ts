export type UserRole = 'Administrator' | 'ASO / Staff' | 'Sales / Sales Head' | 'BRO' | 'Admin';

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
  customer_name: string;
  license_plate: string;
  value: number;
  status_sap: string; // 'N/A' | 'Bill' | 'Not Bill'
  status_confirm: string; // 'Belum Konfirmasi' | 'Telah Dikonfirmasi' | 'Ditolak / Negosiasi Ulang'
  status_handover: string; // 'Pending' | 'Diserahkan ke Admin' | 'Diterima Admin'
  no_invoice: string;
  status_payment: string; // 'Belum Bayar' | 'Lunas'
  created_by: string; // Email of creator
  created_at: string;
  updated_at: string;
  
  // File URL / Base64 Data paths
  file_bak_url?: string | null;
  file_handover_aso_sales_url?: string | null;
  file_handover_sales_admin_url?: string | null;
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
}
