export const BRANCH_LIST = [
  'Bali', 
  'Balikpapan', 
  'Bandung', 
  'Banjarmasin', 
  'Lampung', 
  'Makassar', 
  'Malang', 
  'Manado',
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

export const REGIONAL_WEST_BRANCHES = [
  'Lampung', 'Medan', 'Padang', 'Palembang', 'Pekanbaru'
];

export const REGIONAL_CENTRAL_BRANCHES = [
  'Bandung', 'BSO GSO & AFFCO', 'BSO Sudirman', 'BSO Sunter', 'BSO Pondok Pinang', 'BSO Banten', 'BSO Bekasi', 'BSO Daan Mogot', 'BSO Pontianak'
];

export const REGIONAL_EAST_BRANCHES = [
  'Bali', 'Balikpapan', 'Banjarmasin', 'Makassar', 'Malang', 'Manado', 'Semarang', 'Solo', 'Surabaya'
];

export const WEST_BRANCHES = REGIONAL_WEST_BRANCHES;
export const CENTRAL_BRANCHES = REGIONAL_CENTRAL_BRANCHES;
export const EAST_BRANCHES = REGIONAL_EAST_BRANCHES;

export function isNationalOrAllBranches(branch?: string, role?: string): boolean {
  if (role) {
    const roles = role.split(',').map(s => s.trim());
    if (roles.includes('Administrator') || roles.includes('Division Head')) return true;
  }
  if (!branch) return true;
  const bLower = branch.trim().toLowerCase();
  return (
    bLower === 'nasional' ||
    bLower === 'semua cabang' ||
    bLower === 'semua' ||
    bLower === 'all' ||
    bLower === 'all branches' ||
    bLower === 'pusat' ||
    bLower === 'head office'
  );
}

export function getUserBranches(branch: string): string[] {
  if (!branch) return [];
  if (isNationalOrAllBranches(branch)) return ALL_SYSTEM_BRANCHES;
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

export function getRoleAllowedBranches(role?: string, branch?: string): string[] {
  // Administrator, Division Head, or 'Nasional' / 'Semua Cabang' gets access to all branches
  if (isNationalOrAllBranches(branch, role)) {
    return ALL_SYSTEM_BRANCHES;
  }

  // 1. If specific branch(es) are configured on user's profile, that is their definitive authority
  if (branch && branch.trim()) {
    const userBranches = getUserBranches(branch);
    if (userBranches.length > 0) return userBranches;
  }

  // 2. Role-based regional fallback when branch is unspecified in profile
  if (role) {
    const rLower = role.toLowerCase();
    if (rLower.includes('west')) {
      return REGIONAL_WEST_BRANCHES;
    }
    if (rLower.includes('central')) {
      return REGIONAL_CENTRAL_BRANCHES;
    }
    if (rLower.includes('east')) {
      return REGIONAL_EAST_BRANCHES;
    }
  }

  return ALL_SYSTEM_BRANCHES;
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
  if (!role) return false;
  const roles = role.split(',').map(s => s.trim().toLowerCase());
  return roles.some(r => r.startsWith('regional head') || r === 'rh' || r.includes('regional head'));
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
  no_cmd?: string;
  customer_name: string;
  license_plate: string;
  value: number;
  status_sap: string; // 'N/A' | 'Bill' | 'Not Bill'
  status_confirm: string; // 'Belum Konfirmasi' | 'Telah Dikonfirmasi' | 'Ditolak / Negosiasi Ulang'
  status_handover: string; // 'Pending' | 'Diterima Admin'
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
  tanggal_invoice?: string | null;
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
  startDate?: string;
  endDate?: string;
  alert?: 'due' | 'pending' | 'high_value' | '';
  customerName?: string;
  statusSap?: string;
}

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



export function hasRole(roleStr: string | UserRole | undefined | null, targetRole: string): boolean {
  if (!roleStr) return false;
  return String(roleStr).split(',').map(s => s.trim()).includes(targetRole);
}

export function packExtraFields(tx: any): string {
  let packed = tx.no_bak || '-';
  if (packed.includes('||')) {
    packed = packed.split('||')[0];
  }
  if (!packed) packed = '-';

  if (tx.no_tilang && tx.no_tilang !== '-') packed += `||TILANG:${tx.no_tilang}`;
  if (tx.tanggal) packed += `||TANGGAL:${tx.tanggal}`;
  if (tx.tanggal_handover) packed += `||TANGGAL_HANDOVER:${tx.tanggal_handover}`;
  if (tx.nama_bro && tx.nama_bro !== '-') packed += `||NAMA_BRO:${tx.nama_bro}`;
  if (tx.alasan && tx.alasan !== '-') packed += `||ALASAN:${tx.alasan}`;
  if (tx.upload_dok_pendukung) packed += `||DOK_PENDUKUNG:${tx.upload_dok_pendukung}`;
  if (tx.status_approval) packed += `||APPROVAL:${tx.status_approval}`;
  if (tx.approved_by) packed += `||APPROVED_BY:${tx.approved_by}`;
  if (tx.approved_at) packed += `||APPROVED_AT:${tx.approved_at}`;
  if (tx.approval_note) packed += `||APPROVAL_NOTE:${tx.approval_note}`;
  
  if (tx.approval_attachment_1_url) packed += `||APP_ATT1:${tx.approval_attachment_1_url}`;
  if (tx.approval_attachment_2_url) packed += `||APP_ATT2:${tx.approval_attachment_2_url}`;
  if (tx.approval_attachment_3_url) packed += `||APP_ATT3:${tx.approval_attachment_3_url}`;

  if (tx.regional_approval_status) packed += `||REG_STATUS:${tx.regional_approval_status}`;
  if (tx.regional_approved_by) packed += `||REG_BY:${tx.regional_approved_by}`;
  if (tx.regional_approved_at) packed += `||REG_AT:${tx.regional_approved_at}`;
  if (tx.regional_approval_note) packed += `||REG_NOTE:${tx.regional_approval_note}`;

  if (tx.division_approval_status) packed += `||DIV_STATUS:${tx.division_approval_status}`;
  if (tx.division_approved_by) packed += `||DIV_BY:${tx.division_approved_by}`;
  if (tx.division_approved_at) packed += `||DIV_AT:${tx.division_approved_at}`;
  if (tx.division_approval_note) packed += `||DIV_NOTE:${tx.division_approval_note}`;
  if (tx.tanggal_invoice) packed += `||TGL_INV:${tx.tanggal_invoice}`;

  return packed;
}

export function unpackExtraFields(item: any): any {
  if (!item) return item;
  let no_bak = item.no_bak || '-';
  let no_tilang = item.no_tilang || '-';
  let tanggal = item.tanggal || null;
  let tanggal_handover = item.tanggal_handover || null;
  let nama_bro = item.nama_bro || item.bro_name || '-';
  let alasan = item.alasan || item.dok_pendukung_alasan || '-';
  let upload_dok_pendukung = item.upload_dok_pendukung || null;
  let status_approval = item.status_approval || 'Belum Approval';
  let approved_by = item.approved_by || null;
  let approved_at = item.approved_at || null;
  let approval_note = item.approval_note || null;

  let approval_attachment_1_url = item.approval_attachment_1_url || null;
  let approval_attachment_2_url = item.approval_attachment_2_url || null;
  let approval_attachment_3_url = item.approval_attachment_3_url || null;

  let regional_approval_status = item.regional_approval_status || 'Belum Approval';
  let regional_approved_by = item.regional_approved_by || null;
  let regional_approved_at = item.regional_approved_at || null;
  let regional_approval_note = item.regional_approval_note || null;

  let division_approval_status = item.division_approval_status || 'Belum Approval';
  let division_approved_by = item.division_approved_by || null;
  let division_approved_at = item.division_approved_at || null;
  let division_approval_note = item.division_approval_note || null;
  let tanggal_invoice = item.tanggal_invoice || null;

  if (no_bak && no_bak.includes('||')) {
    const parts = no_bak.split('||');
    no_bak = parts[0];
    
    parts.slice(1).forEach((part: string) => {
      if (part.startsWith('TILANG:')) {
        const val = part.substring(7);
        if (!no_tilang || no_tilang === '-') no_tilang = val;
      } else if (part.startsWith('TANGGAL:')) {
        const val = part.substring(8);
        if (!tanggal) tanggal = val;
      } else if (part.startsWith('TANGGAL_HANDOVER:')) {
        const val = part.substring(17);
        if (!tanggal_handover) tanggal_handover = val;
      } else if (part.startsWith('NAMA_BRO:')) {
        const val = part.substring(9);
        if (!nama_bro || nama_bro === '-') nama_bro = val;
      } else if (part.startsWith('ALASAN:')) {
        const val = part.substring(7);
        if (!alasan || alasan === '-') alasan = val;
      } else if (part.startsWith('DOK_PENDUKUNG:')) {
        const val = part.substring(14);
        if (!upload_dok_pendukung) upload_dok_pendukung = val;
      } else if (part.startsWith('APPROVAL:')) {
        const val = part.substring(9);
        if (!item.status_approval || item.status_approval === 'Belum Approval') status_approval = val;
      } else if (part.startsWith('APPROVED_BY:')) {
        const val = part.substring(12);
        if (!approved_by) approved_by = val;
      } else if (part.startsWith('APPROVED_AT:')) {
        const val = part.substring(12);
        if (!approved_at) approved_at = val;
      } else if (part.startsWith('APPROVAL_NOTE:')) {
        const val = part.substring(14);
        if (!approval_note) approval_note = val;
      } else if (part.startsWith('APP_ATT1:')) {
        const val = part.substring(9);
        if (!approval_attachment_1_url) approval_attachment_1_url = val;
      } else if (part.startsWith('APP_ATT2:')) {
        const val = part.substring(9);
        if (!approval_attachment_2_url) approval_attachment_2_url = val;
      } else if (part.startsWith('APP_ATT3:')) {
        const val = part.substring(9);
        if (!approval_attachment_3_url) approval_attachment_3_url = val;
      } else if (part.startsWith('REG_STATUS:')) {
        const val = part.substring(11);
        if (!item.regional_approval_status || item.regional_approval_status === 'Belum Approval') regional_approval_status = val;
      } else if (part.startsWith('REG_BY:')) {
        const val = part.substring(7);
        if (!regional_approved_by) regional_approved_by = val;
      } else if (part.startsWith('REG_AT:')) {
        const val = part.substring(7);
        if (!regional_approved_at) regional_approved_at = val;
      } else if (part.startsWith('REG_NOTE:')) {
        const val = part.substring(9);
        if (!regional_approval_note) regional_approval_note = val;
      } else if (part.startsWith('DIV_STATUS:')) {
        const val = part.substring(11);
        if (!item.division_approval_status || item.division_approval_status === 'Belum Approval') division_approval_status = val;
      } else if (part.startsWith('DIV_BY:')) {
        const val = part.substring(7);
        if (!division_approved_by) division_approved_by = val;
      } else if (part.startsWith('DIV_AT:')) {
        const val = part.substring(7);
        if (!division_approved_at) division_approved_at = val;
      } else if (part.startsWith('DIV_NOTE:')) {
        const val = part.substring(9);
        if (!division_approval_note) division_approval_note = val;
      } else if (part.startsWith('TGL_INV:')) {
        const val = part.substring(8);
        if (!tanggal_invoice) tanggal_invoice = val;
      }
    });
  }

  const status_handover = item.status_handover || 'Pending';

  return {
    ...item,
    status_handover,
    no_bak,
    no_tilang,
    tanggal,
    tanggal_handover,
    tanggal_invoice,
    bro_name: nama_bro,
    nama_bro,
    dok_pendukung_alasan: alasan,
    alasan,
    upload_dok_pendukung,
    status_approval,
    approved_by,
    approved_at,
    approval_note,
    approval_attachment_1_url,
    approval_attachment_2_url,
    approval_attachment_3_url,
    regional_approval_status,
    regional_approved_by,
    regional_approved_at,
    regional_approval_note,
    division_approval_status,
    division_approved_by,
    division_approved_at,
    division_approval_note
  };
}

/**
 * Harmonizes SAP Status for Non-Own Risk categories:
 * - Kategori selain Own Risk (Maintenance, Ekspedisi, ETLE, Dokumen Kendaraan, dll):
 *   - Otomatis 'Bill' jika disetujui (status_approval = 'Disetujui', regional/division disetujui, invoice terbit, atau lunas)
 *   - Otomatis 'Not Bill' jika ditolak (status_approval = 'Ditolak', regional/division ditolak, atau negosiasi ulang ditolak)
 */
export function syncNonOrSapStatus<T extends Partial<Backcharge>>(tx: T): T {
  if (tx.category && tx.category !== 'Own Risk') {
    const isRejected = tx.status_approval === 'Ditolak' || 
                       tx.regional_approval_status === 'Ditolak' || 
                       tx.division_approval_status === 'Ditolak' || 
                       tx.status_confirm === 'Ditolak / Negosiasi Ulang';

    const isApproved = tx.status_approval === 'Disetujui' || 
                       tx.regional_approval_status === 'Disetujui' || 
                       tx.division_approval_status === 'Disetujui' ||
                       (tx.no_invoice && tx.no_invoice !== '-' && tx.no_invoice.trim() !== '') ||
                       tx.status_payment === 'Lunas';

    if (isRejected) {
      tx.status_sap = 'Not Bill';
    } else if (isApproved) {
      tx.status_sap = 'Bill';
    }
  }
  return tx;
}

