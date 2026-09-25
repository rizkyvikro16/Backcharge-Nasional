import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, Mail, Layers, CheckCircle, Clock, AlertTriangle, BarChart3, 
  Download, FileSpreadsheet, RefreshCw, LogOut, Bell, Shield, Users, Landmark, UserCheck, X
} from 'lucide-react';

import { Profile, Backcharge, ActivityLog, AppNotification, UserRole, DashboardFilter, ContactInquiry, getUserBranches, getRoleAllowedBranches, isNationalOrAllBranches, hasRole, isRegionalHeadRole, ALL_SYSTEM_BRANCHES } from './types';
import { mockDb } from './supabaseClient';

import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import DatabaseView from './components/DatabaseView';
import DetailModal from './components/DetailModal';
import UserManagement from './components/UserManagement';
import AuditView from './components/AuditView';
import FeedbackView from './components/FeedbackView';
import { getApiUrl } from './lib/api';

// Helper functions to pack and unpack extra fields into/from no_bak text field as fallback for Supabase databases without schema updates
function packExtraFields(tx: any): string {
  let packed = tx.no_bak || '-';
  // Remove any previous packed info from no_bak if any
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

  return packed;
}

function unpackExtraFields(item: any): any {
  // 1. Direct DB column values take highest priority
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

  // 2. Fallback to packed fields inside no_bak ONLY if direct column value is missing/empty
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

export function cleanDbPayload(payload: any) {
  const DB_COLUMNS = [
    'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang',
    'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
    'status_handover', 'no_invoice', 'status_payment', 'created_by', 'created_at',
    'updated_at', 'file_bak_url', 'file_handover_aso_sales_url',
    'file_handover_sales_admin_url', 'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan',
    'status_approval', 'approved_by', 'approved_at', 'approval_note',
    'approval_attachment_1_url', 'approval_attachment_2_url', 'approval_attachment_3_url',
    'regional_approval_status', 'regional_approved_by', 'regional_approved_at', 'regional_approval_note',
    'division_approval_status', 'division_approved_by', 'division_approved_at', 'division_approval_note'
  ];
  const cleaned: any = {};
  for (const key of DB_COLUMNS) {
    if (key in payload) {
      cleaned[key] = payload[key];
    }
  }
  return cleaned;
}

// Helper to derive role-specific actionable tasks for Antrean Tugas
function deriveNotifications(transactionsList: Backcharge[], user: Profile, readIds: string[]): AppNotification[] {
  if (!user) return [];
  const list: AppNotification[] = [];
  const isBro = hasRole(user.role, 'BRO');

  transactionsList.forEach(t => {
    // Determine branch match
    const userBranches = getUserBranches(user.branch);
    const branchMatch = userBranches.includes(t.branch);
    if (!branchMatch) return;

    // 1. ASO Role Tasks
    if (hasRole(user.role, 'ASO') || hasRole(user.role, 'Maintenance Center') || hasRole(user.role, 'ASO Megabranch') || hasRole(user.role, 'Administrator') || isBro) {
      // Task A: Upload BAK / Dokumen Pendukung
      if (!t.file_bak_url || t.file_bak_url === 'dummy_pdf_file' || t.file_bak_url === '') {
        const id = `notif-aso-upload-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'UPLOAD_BAK',
          typeLabel: 'Upload BAK',
          description: `Dokumen Belum Lengkap: Silakan unggah berkas BAK untuk Backcharge ${t.customer_name} (${t.id}).`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }

      // Task B: Serah terima berkas ke Admin
      if (t.status_handover === 'Pending') {
        const id = `notif-aso-handover-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'HANDOVER_PENDING',
          typeLabel: 'Pending Serah Terima',
          description: `Menunggu Serah Terima: Berkas Backcharge ${t.id} (${t.customer_name}) belum diserahkan ke Admin.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }
    const val = t.value || 0;
    const isRegionalHead = isRegionalHeadRole(user.role as string);
    const isDivisionHead = hasRole(user.role, 'Division Head');
    const isMaintenance = t.category === 'Maintenance';
    const isRegionalHeadReq = isMaintenance 
      ? (val > 7500000 && val <= 15000000) 
      : (val > 5000000 && val <= 15000000);

    const tier1Approved = t.status_approval === 'Disetujui';
    const tier2Approved = !isRegionalHeadReq || t.regional_approval_status === 'Disetujui';

    if ((isRegionalHead || hasRole(user.role, 'Administrator')) && isRegionalHeadReq && tier1Approved && (!t.regional_approval_status || t.regional_approval_status === 'Belum Approval')) {
      const id = `notif-rh-approval-${t.id}`;
      list.push({
        id,
        transaction_id: t.id,
        customer_name: t.customer_name,
        category: t.category,
        branch: t.branch,
        type: 'APPROVAL_RH',
        typeLabel: 'Approval Regional Head',
        description: `Approval Backcharge: Backcharge ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Regional Head.`,
        created_at: t.created_at || new Date().toISOString(),
        read: readIds.includes(id)
      });
    }

    if ((isDivisionHead || hasRole(user.role, 'Administrator')) && val > 15000000 && tier1Approved && tier2Approved && (!t.division_approval_status || t.division_approval_status === 'Belum Approval')) {
      const id = `notif-dh-approval-${t.id}`;
      list.push({
        id,
        transaction_id: t.id,
        customer_name: t.customer_name,
        category: t.category,
        branch: t.branch,
        type: 'APPROVAL_DH',
        typeLabel: 'Approval Division Head',
        description: `Approval Backcharge: Backcharge ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Division Head.`,
        created_at: t.created_at || new Date().toISOString(),
        read: readIds.includes(id)
      });
    }


    // 2. Kepala Cabang Role Tasks
    const isKacab = hasRole(user.role, 'Kepala Cabang') || hasRole(user.role, 'kacab') || hasRole(user.role, 'Administrator') || isBro;
    if (isKacab) {
      // Task A: Approval for Maintenance & TPL
      const val = t.value || 0;
      const isMaintenance = t.category === 'Maintenance';
      const isTPL = t.category === 'TPL';
      if ((isMaintenance || isTPL) && (!t.status_approval || t.status_approval === 'Belum Approval')) {
        const id = `notif-kacab-approval-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'APPROVAL_KACAB',
          typeLabel: 'Approval Kacab',
          description: `Approval Backcharge (Kacab): Backcharge ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Kepala Cabang.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }

    // 3. Sales Head Role Tasks
    const isSH = hasRole(user.role, 'Sales Head') || hasRole(user.role, 'Sales / Sales Head') || hasRole(user.role, 'Administrator') || isBro;
    if (isSH) {
      // Task A: Approval for Own Risk, Ekspedisi, ETLE, etc.
      const val = t.value || 0;
      if ((t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {
        const id = `notif-sh-approval-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'APPROVAL_SH',
          typeLabel: 'Approval Sales Head',
          description: `Approval Backcharge (Sales Head): Backcharge ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Sales Head.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }

    // 4. Admin Role Tasks
    if (hasRole(user.role, 'Admin') || hasRole(user.role, 'Admin Head') || hasRole(user.role, 'Administrator') || isBro) {
      // Task A: Terima Berkas Fisik yang Diserahkan ASO
      if (t.status_handover === 'Diserahkan ke Admin') {
        const id = `notif-admin-handover-accept-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'HANDOVER_ACCEPT',
          typeLabel: 'Terima Berkas',
          description: `Penerimaan Berkas: Berkas ${t.id} telah diserahkan ASO. Harap konfirmasi penerimaan fisik.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }

      // Task B: Input Nomor Invoice
      const isHandedOver = ['Diserahkan ke Admin', 'Diserahkan ke Admin Pusat', 'Diterima Admin'].includes(t.status_handover);
      const hasNoInvoice = !t.no_invoice || t.no_invoice === '-' || t.no_invoice === '';
      if (isHandedOver && hasNoInvoice) {
        const id = `notif-admin-invoice-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'INPUT_INVOICE',
          typeLabel: 'Input Invoice',
          description: `Penerbitan Invoice: Berkas ${t.id} telah diserahkan. Segera terbitkan & input nomor invoice.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }

      // Task C: Follow Up Pembayaran
      if (t.no_invoice && t.no_invoice !== '-' && t.status_payment === 'Belum Bayar') {
        const id = `notif-admin-payment-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'FOLLOW_UP_PAYMENT',
          typeLabel: 'Tindak Lanjut Bayar',
          description: `Tindak Lanjut Pembayaran: Tagihan ${t.id} (${t.customer_name}) masih Belum Bayar.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }
  });

  // Deduplicate items by ID
  const uniqueMap = new Map<string, AppNotification>();
  list.forEach(item => uniqueMap.set(item.id, item));
  const uniqueList: AppNotification[] = Array.from(uniqueMap.values());

  // Sort by date descending
  return uniqueList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Helper to style badge notification types in Antrean Tugas
function getNotificationBadge(notif: AppNotification) {
  const type = notif.type || '';
  if (type === 'UPLOAD_BAK' || notif.id.includes('aso-upload')) {
    return {
      label: notif.typeLabel || 'Upload BAK',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold',
      borderLeftClass: 'border-l-purple-500',
      dotClass: 'bg-purple-600'
    };
  }
  if (type === 'HANDOVER_PENDING' || notif.id.includes('aso-handover')) {
    return {
      label: notif.typeLabel || 'Pending Serah Terima',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
      borderLeftClass: 'border-l-amber-500',
      dotClass: 'bg-amber-600'
    };
  }
  if (type === 'APPROVAL_KACAB' || notif.id.includes('kacab-approval')) {
    return {
      label: notif.typeLabel || 'Approval Kacab',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-extrabold',
      borderLeftClass: 'border-l-indigo-500',
      dotClass: 'bg-indigo-600'
    };
  }
  if (type === 'APPROVAL_SH' || notif.id.includes('sh-approval')) {
    return {
      label: notif.typeLabel || 'Approval Sales Head',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-extrabold',
      borderLeftClass: 'border-l-blue-500',
      dotClass: 'bg-blue-600'
    };
  }
  if (type === 'HANDOVER_ACCEPT' || notif.id.includes('handover-accept')) {
    return {
      label: notif.typeLabel || 'Terima Berkas',
      badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-extrabold',
      borderLeftClass: 'border-l-cyan-500',
      dotClass: 'bg-cyan-600'
    };
  }
  if (type === 'INPUT_INVOICE' || notif.id.includes('admin-invoice')) {
    return {
      label: notif.typeLabel || 'Input Invoice',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold',
      borderLeftClass: 'border-l-emerald-500',
      dotClass: 'bg-emerald-600'
    };
  }
  if (type === 'FOLLOW_UP_PAYMENT' || notif.id.includes('admin-payment')) {
    return {
      label: notif.typeLabel || 'Tindak Lanjut Bayar',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold',
      borderLeftClass: 'border-l-rose-500',
      dotClass: 'bg-rose-600'
    };
  }
  return {
    label: notif.typeLabel || 'Tugas Pending',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 font-extrabold',
    borderLeftClass: 'border-l-slate-400',
    dotClass: 'bg-slate-500'
  };
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);









  const [currentTab, setCurrentTab] = useState<'dashboard' | 'database' | 'audit' | 'users' | 'complaints'>('dashboard');
  const [activeAlertFilter, setActiveAlertFilter] = useState<'due' | 'pending' | 'high_value' | ''>('');
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilter | null>(null);
  
  // App data state with instant Stale-While-Revalidate local caching
  const [transactions, setTransactions] = useState<Backcharge[]>(() => {
    try {
      const cached = localStorage.getItem('backcharge_cache_txs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    try {
      const cached = localStorage.getItem('backcharge_cache_logs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const cached = localStorage.getItem('backcharge_cache_profs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inquiries, setInquiries] = useState<ContactInquiry[]>(() => {
    try {
      const cached = localStorage.getItem('bc_contact_inquiries');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications') || '[]');
    } catch {
      return [];
    }
  });
  
  // UI states
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Safety timeout guard: Prevent loading overlay from sticking for more than 8 seconds
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showD1Banner, setShowD1Banner] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isInitialLoadRef = useRef<boolean>(true);

  const isWorkerHost = typeof window !== 'undefined' && (
    window.location.hostname.includes("workers.dev") ||
    window.location.hostname.includes("pages.dev")
  );

  const [isD1Active, setIsD1Active] = useState<boolean>(() => {
    if (isWorkerHost) return true;
    return localStorage.getItem('backcharge_use_d1') !== 'false';
  });
  const [d1Error, setD1Error] = useState<string | null>(null);
  const [showD1Modal, setShowD1Modal] = useState<boolean>(true);
  const [migratingD1, setMigratingD1] = useState<boolean>(false);

  const runD1Migration = async () => {
    setMigratingD1(true);
    try {
      const res = await fetch(getApiUrl("/api/d1/migrate"), { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (data.success) {
        addToast(data.message || "Migrasi berhasil!", "success");
        setD1Error(null);
        setIsD1Active(true);
        try { localStorage.setItem('backcharge_use_d1', 'true'); } catch {}
        fetchData(true);
      } else {
        addToast(`Gagal migrasi: ${data.error || 'Respon tidak valid'}`, "error");
      }
    } catch (e: any) {
      addToast(`Error: ${e.message}`, "error");
    } finally {
      setMigratingD1(false);
    }
  };

  const runD1FullSqlImport = async () => {
    setMigratingD1(true);
    try {
      addToast("Memulai pengimporan 100% data SQL (2.125+ Data) ke Cloudflare D1...", "info");
      const res = await fetch(getApiUrl("/api/d1/import-sql"), { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (data.success) {
        addToast(data.message || "Pengimporan 100% data SQL selesai!", "success");
        setD1Error(null);
        setIsD1Active(true);
        try { localStorage.setItem('backcharge_use_d1', 'true'); } catch {}
        fetchData(true);
      } else {
        addToast(`Gagal impor data SQL: ${data.error || 'Respon tidak valid'}`, "error");
      }
    } catch (e: any) {
      addToast(`Error: ${e.message}`, "error");
    } finally {
      setMigratingD1(false);
    }
  };

  const runD1LiveSyncFromSupabase = async () => {
    setMigratingD1(true);
    try {
      addToast("Memulai pemindahan & sinkronisasi 100% data langsung dari Supabase ke Cloudflare D1...", "info");
      const res = await fetch(getApiUrl("/api/d1/sync-from-supabase"), { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (data.success) {
        addToast(data.message || "Sinkronisasi langsung dari Supabase ke D1 sukses!", "success");
        setD1Error(null);
        setIsD1Active(true);
        try { localStorage.setItem('backcharge_use_d1', 'true'); } catch {}
        fetchData(true);
      } else {
        addToast(`Gagal sinkronisasi data: ${data.error || 'Respon tidak valid'}`, "error");
      }
    } catch (e: any) {
      addToast(`Error: ${e.message}`, "error");
    } finally {
      setMigratingD1(false);
    }
  };

  // Query D1 Configuration Status from our secure Express backend on mount
  useEffect(() => {
    const checkD1Status = async () => {
      try {
        const response = await fetch(getApiUrl('/api/d1/status'));
        const text = await response.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        
        if (data.configured && data.authorized !== false) {
          setIsD1Active(true);
          setD1Error(null);
          try { localStorage.setItem('backcharge_use_d1', 'true'); } catch {}
          fetchData();
        } else {
          if (!isWorkerHost) {
            setIsD1Active(false);
            try { localStorage.setItem('backcharge_use_d1', 'false'); } catch {}
          } else {
            setIsD1Active(true);
          }
          if (data.error) {
            setD1Error(data.error);
          } else if (data.configured === false) {
            setD1Error("Kredensial Cloudflare D1 belum terkonfigurasi. Sila periksa CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, dan CLOUDFLARE_API_TOKEN di Settings.");
          }
        }
      } catch (err: any) {
        if (!isWorkerHost) setIsD1Active(false);
        setD1Error(err.message || String(err));
      }
    };
    checkD1Status();
  }, []);

  // Toast trigger helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Restore login session on mount
  useEffect(() => {
    const session = localStorage.getItem('backcharge_session_profile');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch {
        localStorage.removeItem('backcharge_session_profile');
      }
    }
  }, []);

  // Automatically derive role-specific actionable notifications
  useEffect(() => {
    if (currentUser) {
      const derived = deriveNotifications(transactions, currentUser, readNotifIds);
      setNotifications(derived);
    } else {
      setNotifications([]);
    }
  }, [transactions, currentUser, readNotifIds]);

  // Shared fast D1 query executor
  const executeD1Query = useCallback(async (sql: string, params: any[] = []): Promise<any[]> => {
    let res: Response;
    try {
      res = await fetch(getApiUrl("/api/d1/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params })
      });
    } catch (networkErr: any) {
      console.warn("Koneksi D1 gagal:", networkErr?.message || networkErr);
      throw new Error(`Koneksi D1 tidak dapat dijangkau: ${networkErr?.message || 'Network error'}`);
    }

    const text = await res.text();
    let d: any = {};
    try { 
      d = JSON.parse(text); 
    } catch {
      if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          try {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              for (const reg of registrations) reg.unregister();
            });
          } catch {}
        }
        throw new Error(`Koneksi API D1 terintersepsi (Status ${res.status}). Mengulang koneksi ke server...`);
      }
      throw new Error(`Respons D1 tidak valid (${res.status}): ${text.substring(0, 100) || 'Kosong'}`);
    }
    if (!d.success) {
      if (d.error && (d.error.includes("Database binding 'DB'") || d.error.includes("binding 'DB'"))) {
        console.warn("Cloudflare D1 binding DB not yet attached in Pages settings. Falling back to local cache.");
        return [];
      }
      throw new Error(d.error || "Gagal kueri D1");
    }
    return d.results || [];
  }, []);

  // Helper for 0ms Optimistic UI Updates & Instant Local Storage Cache Sync
  const updateTransactionsStateAndCache = useCallback((updater: (prev: Backcharge[]) => Backcharge[]) => {
    setTransactions(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem('backcharge_cache_txs', JSON.stringify(next));
        localStorage.setItem('backcharge_cache_time_v2', String(Date.now()));
        if (currentUser) {
          localStorage.setItem('backcharge_cache_user', currentUser.email);
        }
      } catch (e) {}
      return next;
    });
  }, [currentUser]);

  const updateProfilesStateAndCache = useCallback((updater: (prev: Profile[]) => Profile[]) => {
    setProfiles(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem('backcharge_cache_profs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const updateInquiriesStateAndCache = useCallback((updater: (prev: ContactInquiry[]) => ContactInquiry[]) => {
    setInquiries(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem('backcharge_cache_inquiries', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Fetch app data
  const fetchData = async (forceFull = false, userOverride?: Profile) => {
    const activeUser = userOverride || currentUser || (() => {
      try {
        const s = localStorage.getItem('backcharge_session_profile');
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    })();

    // 1. INSTANT LOCAL CACHE HYDRATION (0ms Load Experience)
    let loadedFromCache = false;
    try {
      const cachedTxsStr = localStorage.getItem('backcharge_cache_txs');
      const cachedLogsStr = localStorage.getItem('backcharge_cache_logs');
      const cachedProfsStr = localStorage.getItem('backcharge_cache_profs');
      
      if (cachedTxsStr) {
        const parsedTxs = JSON.parse(cachedTxsStr);
        if (Array.isArray(parsedTxs) && parsedTxs.length > 0) {
          setTransactions(parsedTxs);
          loadedFromCache = true;
        }
      }
      if (cachedLogsStr) {
        setLogs(JSON.parse(cachedLogsStr));
      }
      if (cachedProfsStr) {
        setProfiles(JSON.parse(cachedProfsStr));
      }
    } catch (e) {
      console.warn("Failed to read initial local cache:", e);
    }

    // Only set full-page blocking loading if we do NOT have any local data cached
    if (!loadedFromCache) {
      setLoading(true);
    }

    // Instant cache hydration is already applied above.
    // We proceed to query Cloudflare D1 so that data on screen is ALWAYS 100% synchronized with the D1 database.
    if (isD1Active) {
      try {
        // Concurrent fetching for all tables in background
        const fetchD1Promise = (async () => {
          let backchargesQuery = "SELECT * FROM backcharges WHERE 1=1";
          let queryParams: any[] = [];
          
          const logsQuery = "SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 250";
          const profilesQuery = "SELECT * FROM profiles ORDER BY full_name ASC";
          const inquiriesQuery = "SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 150";

          // Role & Branch authorization filter:
          // Jika cabang Nasional, Semua Cabang, atau role Administrator / Division Head:
          // JANGAN membatasi kueri dengan filter cabang apa pun, sehingga 100% data D1 termuat persis berapapun jumlah barisnya.
          const isNationalOrAll = !activeUser || isNationalOrAllBranches(activeUser.branch, activeUser.role);
          if (!isNationalOrAll && activeUser) {
            const allowedBranches = getRoleAllowedBranches(activeUser.role, activeUser.branch);
            if (allowedBranches.length > 0 && allowedBranches.length < ALL_SYSTEM_BRANCHES.length) {
              const branchList = allowedBranches.map(b => `'${b.replace(/'/g, "''")}'`).join(",");
              backchargesQuery += ` AND branch IN (${branchList})`;
            }
          }
          
          backchargesQuery += " ORDER BY created_at DESC";

          // Fetch all backcharges dynamically without artificial row limits
          const fetchAllBackchargesFromD1 = async (baseSql: string, params: any[] = []): Promise<any[]> => {
            const pageSize = 2000;
            try {
              const fullChunk = await executeD1Query(baseSql, params);
              if (fullChunk && Array.isArray(fullChunk) && fullChunk.length > 50) {
                return fullChunk;
              }
              // If it returned 50 or fewer, probe pagination to ensure no proxy or worker capped the results
              if (fullChunk && Array.isArray(fullChunk)) {
                const chunk0 = await executeD1Query(`${baseSql} LIMIT ${pageSize} OFFSET 0`, params);
                if (chunk0 && chunk0.length > fullChunk.length) {
                  let allResults = [...chunk0];
                  let offset = pageSize;
                  while (true) {
                    const nextChunk = await executeD1Query(`${baseSql} LIMIT ${pageSize} OFFSET ${offset}`, params);
                    if (!nextChunk || nextChunk.length === 0) break;
                    allResults = allResults.concat(nextChunk);
                    if (nextChunk.length < pageSize) break;
                    offset += pageSize;
                  }
                  return allResults;
                }
                return fullChunk;
              }
            } catch (queryErr) {
              console.warn("Direct full query failed, executing automatic chunk pagination...", queryErr);
            }

            // Auto-Pagination fallback for massive datasets
            let allResults: any[] = [];
            let offset = 0;
            while (true) {
              const pagedSql = `${baseSql} LIMIT ${pageSize} OFFSET ${offset}`;
              const chunk = await executeD1Query(pagedSql, params);
              if (!chunk || chunk.length === 0) break;
              allResults = allResults.concat(chunk);
              if (chunk.length < pageSize) break;
              offset += pageSize;
            }
            return allResults;
          };

          try {
            // Execute all D1 queries concurrently for maximum performance
            const [bcs, logsData, profilesData, inquiriesData] = await Promise.all([
              fetchAllBackchargesFromD1(backchargesQuery, queryParams),
              executeD1Query(logsQuery),
              executeD1Query(profilesQuery),
              executeD1Query(inquiriesQuery)
            ]);
            isInitialLoadRef.current = false;

            const unpackedTxs = (bcs || []).map(unpackExtraFields);
            setTransactions(unpackedTxs as Backcharge[]);
            setLogs((logsData as ActivityLog[]) || []);
            setProfiles((profilesData as Profile[]) || []);
            setInquiries((inquiriesData as ContactInquiry[]) || []);

            try {
              localStorage.setItem('backcharge_cache_txs', JSON.stringify(unpackedTxs));
              localStorage.setItem('backcharge_cache_logs', JSON.stringify(logsData));
              localStorage.setItem('backcharge_cache_profs', JSON.stringify(profilesData));
              localStorage.setItem('backcharge_cache_time_v2', String(Date.now()));
              localStorage.setItem('backcharge_cache_user', activeUser?.email || '');
            } catch (cacheErr) {
              try {
                // If localStorage quota is reached, store recent 500 items for instant hydration
                const lean = unpackedTxs.slice(0, 500);
                localStorage.setItem('backcharge_cache_txs', JSON.stringify(lean));
                localStorage.setItem('backcharge_cache_time_v2', String(Date.now()));
                localStorage.setItem('backcharge_cache_user', activeUser?.email || '');
              } catch {}
            }
          } catch (e: any) {
            const errStr = String(e?.message || e || "").toLowerCase();
            const isSchemaError = errStr.includes("no such table") || 
                                  errStr.includes("no such column") || 
                                  errStr.includes("has no column") || 
                                  errStr.includes("sqlite_error");
            
            if (isSchemaError) {
              console.warn("Gagal kueri D1 karena skema belum lengkap, mencoba migrasi skema otomatis...", e);
              try {
                await fetch(getApiUrl("/api/d1/migrate"), { method: "POST" });
                const [bcs, logsData, profilesData, inquiriesData] = await Promise.all([
                  fetchAllBackchargesFromD1(backchargesQuery, queryParams),
                  executeD1Query(logsQuery),
                  executeD1Query(profilesQuery),
                  executeD1Query(inquiriesQuery)
                ]);

                const unpackedTxs = (bcs || []).map(unpackExtraFields);
                setTransactions(unpackedTxs as Backcharge[]);
                setLogs((logsData as ActivityLog[]) || []);
                setProfiles((profilesData as Profile[]) || []);
                setInquiries((inquiriesData as ContactInquiry[]) || []);
                try {
                  localStorage.setItem('backcharge_cache_txs', JSON.stringify(unpackedTxs));
                  localStorage.setItem('backcharge_cache_time_v2', String(Date.now()));
                  localStorage.setItem('backcharge_cache_user', activeUser?.email || '');
                } catch {}
                return;
              } catch (retryErr: any) {
                console.warn("Gagal kueri D1 setelah migrasi:", retryErr.message || retryErr);
                throw retryErr;
              }
            } else {
              // Network error or fetch issue: rethrow directly to outer catch without running /api/d1/migrate!
              throw e;
            }
          }
        })();

        await fetchD1Promise;
        setD1Error(null);
      } catch (err: any) {
        console.warn("Cloudflare D1 offline/unreachable, mengaktifkan cadangan data lokal:", err.message);
        
        // 1. First attempt to hydrate from localStorage cache if available
        let restoredFromCache = false;
        try {
          const cachedTxsStr = localStorage.getItem('backcharge_cache_txs');
          if (cachedTxsStr) {
            const cachedTxs = JSON.parse(cachedTxsStr);
            if (Array.isArray(cachedTxs) && cachedTxs.length > 0) {
              setTransactions(cachedTxs);
              restoredFromCache = true;
            }
          }
          const cachedLogsStr = localStorage.getItem('backcharge_cache_logs');
          if (cachedLogsStr) setLogs(JSON.parse(cachedLogsStr));
          const cachedProfsStr = localStorage.getItem('backcharge_cache_profs');
          if (cachedProfsStr) setProfiles(JSON.parse(cachedProfsStr));
        } catch (cacheErr) {}

        // 2. If no local cache exists, safely fallback to mockDb data
        if (!restoredFromCache) {
          let bcs = mockDb.getBackcharges();
          if (activeUser && !isNationalOrAllBranches(activeUser.branch, activeUser.role)) {
            const userBranches = getUserBranches(activeUser.branch);
            bcs = bcs.filter(t => userBranches.includes(t.branch));
          }
          const unpackedData = bcs.map(unpackExtraFields);
          setTransactions(unpackedData as Backcharge[]);
          setLogs(mockDb.getLogs());
          setProfiles(mockDb.getProfiles());
          setInquiries(mockDb.getContactInquiries());
        }

        if (!isWorkerHost) {
          setIsD1Active(false);
        }
        
        setD1Error(err.message || String(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Fetch mock offline data with minimum latency simulation
    setTimeout(() => {
      let bcs = mockDb.getBackcharges();
      if (activeUser && !isNationalOrAllBranches(activeUser.branch, activeUser.role)) {
        const userBranches = getUserBranches(activeUser.branch);
        bcs = bcs.filter(t => userBranches.includes(t.branch));
      }
      
      const unpackedData = bcs.map(unpackExtraFields);
      setTransactions(unpackedData as Backcharge[]);
      setLogs(mockDb.getLogs());
      setProfiles(mockDb.getProfiles());
      setInquiries(mockDb.getContactInquiries());
      setLoading(false);
    }, 50); // instant feeling
  };

  // Fetch data on login or session restore or D1 status change
  useEffect(() => {
    if (currentUser) {
      fetchData(false, currentUser);
    }
  }, [currentUser, isD1Active]);

  const handleRefreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    addToast("Memperbarui & menyinkronkan data dengan database...", "info");
    try {
      await fetchData(true);
      addToast("Data berhasil diperbarui & disinkronkan!", "success");
    } catch (err: any) {
      addToast(`Gagal menyinkronkan data: ${err.message || String(err)}`, "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Login handler
  const handleLoginSuccess = (profile: Profile) => {
    try {
      localStorage.removeItem('backcharge_cache_txs');
      localStorage.removeItem('backcharge_cache_logs');
      localStorage.removeItem('backcharge_cache_profs');
      localStorage.removeItem('backcharge_cache_time_v2');
      localStorage.removeItem('backcharge_cache_user');
    } catch (e) {}
    setTransactions([]);
    setLoading(true);
    setCurrentUser(profile);
    localStorage.setItem('backcharge_session_profile', JSON.stringify(profile));
    addToast(`Otentikasi Berhasil! Selamat datang, ${profile.full_name}.`, 'success');
    
    // Immediately fetch user data with profile object to ensure zero-lag data population
    fetchData(true, profile);
  };

  // Logout handler
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    try {
      localStorage.removeItem('backcharge_cache_txs');
      localStorage.removeItem('backcharge_cache_logs');
      localStorage.removeItem('backcharge_cache_profs');
      localStorage.removeItem('backcharge_cache_time_v2');
      localStorage.removeItem('backcharge_cache_user');
    } catch (e) {}
    setCurrentUser(null);
    localStorage.removeItem('backcharge_session_profile');
    setShowLogoutConfirm(false);
    addToast("Berhasil logout dari sistem Backcharge.", "info");
  };

    const generateNextTransactionId = async (): Promise<string> => {
    const year = new Date().getFullYear();
    let maxNum = 0;

    // 1. Check D1 Database first
    if (isD1Active) {
      try {
        // Order numerically using CAST & SUBSTR to ensure correct sequential ordering (e.g. 1000 > 999)
        const res = await executeD1Query(
          "SELECT id FROM backcharges WHERE id LIKE ? ORDER BY CAST(substr(id, 9) AS INTEGER) DESC LIMIT 1", 
          [`BC-${year}-%`]
        );
        if (res && res.length > 0) {
          const match = res[0].id.match(/BC-\d+-(\d+)/);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to get max ID from D1, falling back to local cache", err);
      }
    } 

    // 2. Unconditionally check in-memory transactions state to prevent rapid double-click clashes
    const currentYearPrefix = `BC-${year}-`;
    transactions.forEach(t => {
      if (t.id && t.id.startsWith(currentYearPrefix)) {
        const match = t.id.match(/BC-\d+-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    return `BC-${year}-${String(nextNum).padStart(4, '0')}`;
  };

  // 1. ADD NEW TRANSACTION WORKFLOW
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const newId = await generateNextTransactionId();
      const creatorEmail = currentUser.email;

      const txObj: Backcharge = {
        ...newTx,
        id: newId,
        created_by: creatorEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nama_bro: newTx.nama_bro || newTx.bro_name || '-',
        bro_name: newTx.nama_bro || newTx.bro_name || '-',
        alasan: newTx.alasan || newTx.dok_pendukung_alasan || '-',
        dok_pendukung_alasan: newTx.alasan || newTx.dok_pendukung_alasan || '-',
        upload_dok_pendukung: newTx.upload_dok_pendukung || null
      };

      const newLog: ActivityLog = {
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
        transaction_id: newId,
        performed_by: creatorEmail,
        action_description: `Membuat Backcharge baru: ${newId} (Kategori: ${txObj.category}, Nilai: Rp ${txObj.value.toLocaleString('id-ID')})`
      };

      if (isD1Active) {
        const cleanedInsertObj = cleanDbPayload(txObj);
        const columns = Object.keys(cleanedInsertObj);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(cleanedInsertObj);

        const sql = `INSERT INTO backcharges (${columns.join(', ')}) VALUES (${placeholders})`;
        await executeD1Query(sql, values);

        await executeD1Query(
          "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
          [newId, creatorEmail, `Membuat Backcharge baru: ${newId}`]
        );
      } else {
        mockDb.saveBackcharge(txObj, creatorEmail);
      }

      // Update local state & cache
      updateTransactionsStateAndCache(prev => [txObj, ...prev]);
      setLogs(prev => [newLog, ...prev]);
      addToast(`Transaksi Backcharge ${newId} berhasil disimpan!`, 'success');
    } catch (err: any) {
      console.error("Gagal simpan transaksi:", err);
      addToast(`Gagal menyimpan transaksi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1b. BULK ADD TRANSACTIONS WORKFLOW (ADMIN ONLY)
  const handleBulkAddTransactions = async (
    newTxs: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>[],
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!currentUser || newTxs.length === 0) return;

    const year = new Date().getFullYear();
    let maxNum = 0;
    const usedIds = new Set<string>();

    if (isD1Active) {
      try {
        const topResults = await executeD1Query(
          "SELECT id FROM backcharges WHERE id LIKE ? ORDER BY CAST(substr(id, 9) AS INTEGER) DESC LIMIT 1",
          [`BC-${year}-%`]
        );
        if (topResults && topResults.length > 0) {
          const topId = topResults[0].id;
          const match = topId.match(/BC-\d+-(\d+)/);
          if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
          }
        }

        // Unconditionally verify in-memory state to ensure non-synchronized transactions are not duplicated
        const currentYearPrefix = `BC-${year}-`;
        transactions.forEach(t => {
          usedIds.add(t.id);
          if (t.id && t.id.startsWith(currentYearPrefix)) {
            const match = t.id.match(/BC-\d+-(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
        });

        const allD1Ids = await executeD1Query("SELECT id FROM backcharges");
        if (allD1Ids && Array.isArray(allD1Ids)) {
          allD1Ids.forEach((row: any) => { if (row.id) usedIds.add(row.id); });
        }
      } catch (e) {
        console.warn("Gagal cek max ID dari D1 untuk bulk insert:", e);
      }
    } else {
      const allIds = mockDb.getBackcharges().map(item => item.id);
      allIds.forEach(id => usedIds.add(id));
      const currentYearPrefix = `BC-${year}-`;
      const existingNums = allIds
        .filter(id => id && id.startsWith(currentYearPrefix))
        .map(id => {
          const parts = id.split('-');
          const numPart = parts[parts.length - 1];
          const parsed = parseInt(numPart, 10);
          return isNaN(parsed) ? 0 : parsed;
        });
      maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    }

    const creatorEmail = currentUser.email;
    const preparedTxsMap = new Map<string, Backcharge>();

    for (const rawTx of newTxs) {
      const newTx = rawTx as any;
      let existingMatch: Backcharge | null = null;

      const cleanIdParam = newTx.id ? String(newTx.id).trim().toUpperCase() : '';
      const cleanBakParam = (newTx.no_bak && newTx.no_bak !== '-') ? newTx.no_bak.trim().toLowerCase() : '';
      const cleanSpkParam = (newTx.no_spk && newTx.no_spk !== '-') ? newTx.no_spk.trim().toLowerCase() : '';
      const cleanSapParam = (newTx.no_sap && newTx.no_sap !== '-') ? newTx.no_sap.trim().toLowerCase() : '';
      const cleanCustomerParam = newTx.customer_name ? newTx.customer_name.trim().toLowerCase() : '';
      const cleanPlateParam = newTx.license_plate ? newTx.license_plate.trim().toLowerCase() : '';
      const cleanTanggalParam = newTx.tanggal || '';
      const cleanBranchParam = newTx.branch || '';

      // 1. DUPLICATE MATCHING against existing database records:
      // a) Explicit ID
      if (cleanIdParam) {
        existingMatch = transactions.find(t => t.id?.toUpperCase() === cleanIdParam) || null;
      }
      // b) No BAK
      if (!existingMatch && cleanBakParam) {
        existingMatch = transactions.find(t => t.no_bak && t.no_bak !== '-' && t.no_bak.trim().toLowerCase() === cleanBakParam) || null;
      }
      // c) No SPK
      if (!existingMatch && cleanSpkParam) {
        existingMatch = transactions.find(t => t.no_spk && t.no_spk !== '-' && t.no_spk.trim().toLowerCase() === cleanSpkParam) || null;
      }
      // d) No SAP
      if (!existingMatch && cleanSapParam) {
        existingMatch = transactions.find(t => t.no_sap && t.no_sap !== '-' && t.no_sap.trim().toLowerCase() === cleanSapParam) || null;
      }
      // e) Composite (Tanggal + Customer + Cabang + No Polisi)
      if (!existingMatch && cleanCustomerParam && cleanTanggalParam) {
        existingMatch = transactions.find(t => 
          t.tanggal === cleanTanggalParam &&
          t.customer_name?.trim().toLowerCase() === cleanCustomerParam &&
          t.branch === cleanBranchParam &&
          (t.license_plate || '').trim().toLowerCase() === cleanPlateParam
        ) || null;
      }

      // 2. DUPLICATE MATCHING against previously prepared items in current batch:
      let targetId = existingMatch ? existingMatch.id : '';
      if (!targetId) {
        for (const [pId, pTx] of preparedTxsMap.entries()) {
          if (cleanIdParam && pId.toUpperCase() === cleanIdParam) { targetId = pId; break; }
          if (cleanBakParam && pTx.no_bak && pTx.no_bak !== '-' && pTx.no_bak.trim().toLowerCase() === cleanBakParam) { targetId = pId; break; }
          if (cleanSpkParam && pTx.no_spk && pTx.no_spk !== '-' && pTx.no_spk.trim().toLowerCase() === cleanSpkParam) { targetId = pId; break; }
          if (cleanSapParam && pTx.no_sap && pTx.no_sap !== '-' && pTx.no_sap.trim().toLowerCase() === cleanSapParam) { targetId = pId; break; }
          if (cleanCustomerParam && pTx.tanggal === cleanTanggalParam && pTx.customer_name?.trim().toLowerCase() === cleanCustomerParam && pTx.branch === cleanBranchParam && (pTx.license_plate || '').trim().toLowerCase() === cleanPlateParam) { targetId = pId; break; }
        }
      }

      // 3. Generate new ID if completely new
      if (!targetId) {
        let nextNum = maxNum + 1;
        let formatCount = String(nextNum).padStart(4, '0');
        targetId = `BC-${year}-${formatCount}`;

        while (usedIds.has(targetId)) {
          nextNum++;
          formatCount = String(nextNum).padStart(4, '0');
          targetId = `BC-${year}-${formatCount}`;
        }

        usedIds.add(targetId);
        maxNum = nextNum;
      }

      const existingBase: Partial<Backcharge> = preparedTxsMap.get(targetId) || existingMatch || {};

      const txObj: Backcharge = {
        ...(existingBase as Backcharge),
        ...newTx,
        id: targetId,
        created_by: existingBase.created_by || creatorEmail,
        created_at: existingBase.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nama_bro: newTx.nama_bro || newTx.bro_name || existingBase.nama_bro || '-',
        bro_name: newTx.nama_bro || newTx.bro_name || existingBase.bro_name || '-',
        alasan: newTx.alasan || newTx.dok_pendukung_alasan || existingBase.alasan || '-',
        dok_pendukung_alasan: newTx.alasan || newTx.dok_pendukung_alasan || existingBase.dok_pendukung_alasan || '-',
        upload_dok_pendukung: newTx.upload_dok_pendukung || existingBase.upload_dok_pendukung || null
      };

      preparedTxsMap.set(targetId, txObj);
    }

    const preparedTxs = Array.from(preparedTxsMap.values());

    const cleanSupabasePayload = (payload: any) => {
      const DB_COLUMNS = [
        'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang',
        'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
        'status_handover', 'no_invoice', 'status_payment', 'created_by', 'created_at',
        'updated_at', 'file_bak_url', 'file_handover_aso_sales_url',
        'file_handover_sales_admin_url', 'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan',
        'status_approval', 'approved_by', 'approved_at', 'approval_note',
        'approval_attachment_1_url', 'approval_attachment_2_url', 'approval_attachment_3_url',
        'regional_approval_status', 'regional_approved_by', 'regional_approved_at', 'regional_approval_note',
        'division_approval_status', 'division_approved_by', 'division_approved_at', 'division_approval_note'
      ];
      const cleaned: any = {};
      for (const key of DB_COLUMNS) {
        if (key in payload) {
          cleaned[key] = payload[key];
        }
      }
      return cleaned;
    };

    if (isD1Active) {
      try {
        const cleanedPayloads = preparedTxs.map(tx => cleanDbPayload(tx));

        const firstRowColumns = Object.keys(cleanedPayloads[0] || {});
        // SQLite limits the total number of bound variables in a single SQL statement.
        const maxSqlVariables = 90;
        const batchSize = Math.max(1, Math.floor(maxSqlVariables / (firstRowColumns.length || 1)));
        
        let currentCount = 0;
        const totalCount = cleanedPayloads.length;
        if (onProgress) onProgress(0, totalCount);

        for (let i = 0; i < cleanedPayloads.length; i += batchSize) {
          const batch = cleanedPayloads.slice(i, i + batchSize);
          if (batch.length === 0) continue;

          const columns = Object.keys(batch[0]);
          const updateAssigns = columns
            .filter(col => col !== 'id')
            .map(col => `${col} = excluded.${col}`)
            .join(', ');

          const valueRows: string[] = [];
          const params: any[] = [];

          for (const tx of batch) {
            const rowPlaceholders = columns.map(() => '?').join(', ');
            valueRows.push(`(${rowPlaceholders})`);
            for (const col of columns) {
              params.push(tx[col] !== undefined && tx[col] !== null ? tx[col] : null);
            }
          }

          const sql = `
            INSERT INTO backcharges (${columns.join(', ')}) 
            VALUES ${valueRows.join(', ')} 
            ON CONFLICT(id) DO UPDATE SET ${updateAssigns}
          `;

          try {
            await executeD1Query(sql, params);
          } catch (e: any) {
            if (e.message?.includes("SQLITE_TOOBIG") || String(e).includes("SQLITE_TOOBIG")) {
              console.warn("⚠️ Batch insert failed with SQLITE_TOOBIG. Retrying row-by-row...");
              for (const tx of batch) {
                const singleSql = `
                  INSERT INTO backcharges (${columns.join(', ')}) 
                  VALUES (${columns.map(() => '?').join(', ')}) 
                  ON CONFLICT(id) DO UPDATE SET ${updateAssigns}
                `;
                let singleParams = columns.map(col => tx[col] !== undefined && tx[col] !== null ? tx[col] : null);
                
                try {
                  await executeD1Query(singleSql, singleParams);
                } catch (err2: any) {
                  if (err2.message?.includes("SQLITE_TOOBIG") || String(err2).includes("SQLITE_TOOBIG")) {
                     console.warn(`❌ Single row insert failed with SQLITE_TOOBIG. Truncating large text fields for row...`);
                     singleParams = singleParams.map(val => (typeof val === 'string' && val.length > 50000) ? val.substring(0, 50000) + "... [TRUNCATED DUE TO CLOUDFLARE D1 SIZE LIMIT]" : val);
                     await executeD1Query(singleSql, singleParams);
                  } else {
                     throw err2;
                  }
                }
              }
            } else {
              throw e;
            }
          }

          currentCount = Math.min(i + batch.length, totalCount);
          if (onProgress) onProgress(currentCount, totalCount);
        }

        // Write activity log to D1
        await executeD1Query(
          "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
          ['SYSTEM', creatorEmail, `Melakukan import data secara massal sebanyak ${newTxs.length} data Backcharge`]
        );

        addToast(`Berhasil mengimpor ${newTxs.length} data Backcharge secara massal ke Cloudflare D1!`, 'success');
        fetchData(true);
      } catch (err: any) {
        console.error("Bulk D1 insert failed:", err);
        addToast(`Gagal mengimpor massal ke Cloudflare D1: ${err.message}`, 'error');
      }
      return;
    } else {
      const totalCount = preparedTxs.length;
      if (onProgress) onProgress(0, totalCount);

      mockDb.saveBackchargesBatch(preparedTxs, creatorEmail);
      if (onProgress) onProgress(totalCount, totalCount);

      addToast(`Berhasil mengimpor ${newTxs.length} data Backcharge secara offline!`, 'success');
      fetchData(true);
    }
  };

  // 2. UPDATE TRANSACTION WORKFLOW STATUS
  const handleUpdateTransaction = async (id: string, updates: Partial<Backcharge>, logMessage: string) => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const targetTx = transactions.find(t => t.id === id);
      if (!targetTx) {
        setLoading(false);
        return;
      }

      const updatedTx: Backcharge = {
        ...targetTx,
        ...updates,
        updated_at: new Date().toISOString()
      };
      // Keep packed no_bak in 100% sync
      updatedTx.no_bak = packExtraFields(updatedTx);

      const newLog: ActivityLog = {
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
        transaction_id: id,
        performed_by: currentUser.email,
        action_description: logMessage || `Memperbarui transaksi ${id}`
      };

      if (isD1Active) {
        const cleanedUpdateObj = cleanDbPayload({
          ...updates,
          no_bak: updatedTx.no_bak,
          updated_at: new Date().toISOString()
        });

        const columns = Object.keys(cleanedUpdateObj);
        if (columns.length > 0) {
          const setClause = columns.map(col => `${col} = ?`).join(', ');
          const values = [...Object.values(cleanedUpdateObj), id];

          const sql = `UPDATE backcharges SET ${setClause} WHERE id = ?`;
          await executeD1Query(sql, values);
        }

        if (logMessage) {
          await executeD1Query(
            "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
            [id, currentUser.email, logMessage]
          );
        }
      } else {
        mockDb.saveBackcharge(updatedTx, currentUser.email);
      }

      // Update local state & cache
      updateTransactionsStateAndCache(prev => prev.map(t => t.id === id ? updatedTx : t));
      if (logMessage) {
        setLogs(prev => [newLog, ...prev]);
      }
      addToast(`Transaksi ${id} berhasil diperbarui!`, 'success');
    } catch (err: any) {
      console.error("Gagal memperbarui transaksi:", err);
      addToast(`Gagal memperbarui transaksi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2B. DELETE TRANSACTION WORKFLOW (ADMINISTRATOR, ASO, MAINTENANCE CENTER)
  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser || (!hasRole(currentUser.role, 'Administrator') && !hasRole(currentUser.role, 'ASO') && !hasRole(currentUser.role, 'ASO Megabranch') && !hasRole(currentUser.role, 'Maintenance Center') && !hasRole(currentUser.role, 'Admin'))) {
      addToast("Akses Ditolak: Hanya Administrator, ASO, ASO Megabranch, atau Maintenance Center yang boleh menghapus data!", "error");
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus data Backcharge dengan ID ${id} secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setLoading(true);

    try {
      if (isD1Active) {
        await executeD1Query(`DELETE FROM activity_logs WHERE transaction_id = ?`, [id]);
        await executeD1Query(`DELETE FROM backcharges WHERE id = ?`, [id]);
      } else {
        mockDb.deleteBackcharge(id);
      }

      // Update local state & cache
      updateTransactionsStateAndCache(prev => prev.filter(t => t.id !== id));
      addToast(`Backcharge ${id} berhasil dihapus!`, 'success');
    } catch (err: any) {
      console.error("Gagal hapus transaksi:", err);
      addToast(`Gagal menghapus transaksi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. ADMIN: ADD USER WORKFLOW (0 D1 Rows Read)
  const handleAddUser = async (email: string, fullName: string, role: UserRole, branch: string, password?: string) => {
    if (!currentUser || !hasRole(currentUser.role, 'Administrator')) return;

    const newProfile: Profile = {
      id: Math.random().toString(36).substring(7),
      email,
      full_name: fullName,
      role,
      branch,
      created_at: new Date().toISOString(),
      password: password || 'password123'
    };

    // 1. INSTANT OPTIMISTIC UI & LOCAL CACHE UPDATE
    updateProfilesStateAndCache(prev => [...prev, newProfile]);
    addToast(`Staf ${fullName} sukses didaftarkan!`, 'success');

    // 2. ASYNC BACKGROUND SYNC
    if (isD1Active) {
      (async () => {
        try {
          await executeD1Query(
            "INSERT INTO profiles (id, email, full_name, role, branch, created_at, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [newProfile.id, newProfile.email, newProfile.full_name, newProfile.role, newProfile.branch, newProfile.created_at, newProfile.password]
          );
          await executeD1Query(
            "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
            ['SYSTEM', currentUser.email, `Menambahkan staf pengguna baru: ${fullName} (${email}) - ${role}`]
          );
        } catch (err: any) {
          console.error("Gagal simpan user ke D1:", err);
        }
      })();
      return;
    }

    mockDb.saveProfile(newProfile);
  };

  // 4. ADMIN: UPDATE USER WORKFLOW (0 D1 Rows Read)
  const handleUpdateUser = async (id: string, updates: Partial<Profile>) => {
    if (!currentUser || !hasRole(currentUser.role, 'Administrator')) return;

    // 1. INSTANT OPTIMISTIC UI UPDATE
    updateProfilesStateAndCache(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    addToast(`Data pengguna diperbarui!`, 'success');

    // 2. ASYNC BACKGROUND SYNC
    if (isD1Active) {
      (async () => {
        try {
          const columns = Object.keys(updates);
          if (columns.length > 0) {
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            const values = [...Object.values(updates), id];
            await executeD1Query(`UPDATE profiles SET ${setClause} WHERE id = ?`, values);
          }
        } catch (err: any) {}
      })();
      return;
    }
  };

  const handleUpdateOwnPassword = async (newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    
    const updatedUser = { ...currentUser, password: newPassword };
    setCurrentUser(updatedUser);
    localStorage.setItem('backcharge_session_profile', JSON.stringify(updatedUser));
    updateProfilesStateAndCache(prev => prev.map(p => p.id === currentUser.id ? updatedUser : p));
    addToast('Password berhasil diubah!', 'success');

    if (isD1Active) {
      (async () => {
        try {
          await executeD1Query(`UPDATE profiles SET password = ? WHERE id = ?`, [newPassword, currentUser.id]);
        } catch (err: any) {}
      })();
      return true;
    }

    return true;
  };

  // 5. ADMIN: DELETE USER WORKFLOW
  const handleDeleteUser = async (id: string) => {
    if (!currentUser || !hasRole(currentUser.role, 'Administrator')) return;

    setLoading(true);

    try {
      if (isD1Active) {
        await executeD1Query(`DELETE FROM profiles WHERE id = ?`, [id]);
      } else {
        mockDb.deleteProfile(id);
      }

      // Update local state & cache
      updateProfilesStateAndCache(prev => prev.filter(p => p.id !== id));
      addToast(`Akses portal untuk pengguna dihapus.`, 'success');
    } catch (err: any) {
      console.error("Gagal menghapus pengguna:", err);
      addToast(`Gagal menghapus pengguna: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 6. CONTACT & FEEDBACK INQUIRIES WORKFLOW (0 D1 Rows Read)
  const handleAddInquiry = async (newInquiry: ContactInquiry) => {
    updateInquiriesStateAndCache(prev => [newInquiry, ...prev]);
    addToast(`Aduan/masukan Anda berhasil terkirim!`, 'success');

    if (isD1Active) {
      (async () => {
        try {
          await executeD1Query(
            "INSERT INTO contact_inquiries (id, name, email, subject, message, status, created_at, feedback, feedback_by, feedback_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              newInquiry.id,
              newInquiry.full_name,
              newInquiry.email,
              newInquiry.subject,
              newInquiry.message,
              newInquiry.status,
              newInquiry.created_at,
              newInquiry.feedback || null,
              newInquiry.feedback_by || null,
              newInquiry.feedback_at || null
            ]
          );
          await executeD1Query(
            "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
            [newInquiry.id, currentUser?.email || 'Guest / Customer', `Mengirim keluhan / masukan baru dengan subjek "${newInquiry.subject}"`]
          );
        } catch (err: any) {}
      })();
      return;
    }

    mockDb.saveContactInquiry(newInquiry);
  };

  const handleUpdateInquiry = async (updatedInquiry: ContactInquiry) => {
    setLoading(true);

    try {
      if (isD1Active) {
        await executeD1Query(
          "UPDATE contact_inquiries SET status = ?, feedback = ?, feedback_by = ?, feedback_at = ? WHERE id = ?",
          [
            updatedInquiry.status,
            updatedInquiry.feedback || null,
            updatedInquiry.feedback_by || null,
            updatedInquiry.feedback_at || null,
            updatedInquiry.id
          ]
        );
        await executeD1Query(
          "INSERT INTO activity_logs (transaction_id, performed_by, action_description) VALUES (?, ?, ?)",
          [updatedInquiry.id, currentUser?.email || 'System / Tim Terkait', `Memberikan tanggapan feedback pada aduan ${updatedInquiry.id}`]
        );
      } else {
        mockDb.saveContactInquiry(updatedInquiry);
      }

      // Update local state & cache
      updateInquiriesStateAndCache(prev => prev.map(inq => inq.id === updatedInquiry.id ? updatedInquiry : inq));
      addToast(`Tanggapan feedback sukses disimpan!`, 'success');
    } catch (err: any) {
      console.error("Gagal update feedback:", err);
      addToast(`Gagal menyimpan tanggapan feedback: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    setLoading(true);

    try {
      if (isD1Active) {
        await executeD1Query(`DELETE FROM contact_inquiries WHERE id = ?`, [id]);
      } else {
        mockDb.deleteContactInquiry(id);
      }

      // Update local state & cache
      updateInquiriesStateAndCache(prev => prev.filter(inq => inq.id !== id));
      addToast(`Aduan berhasil dihapus!`, 'success');
    } catch (err: any) {
      console.error("Gagal menghapus aduan:", err);
      addToast(`Gagal menghapus aduan: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    setReadNotifIds(prev => {
      const updated = [...prev, notif.id];
      localStorage.setItem('read_notifications', JSON.stringify(updated));
      return updated;
    });
    setSelectedTransactionId(notif.transaction_id);
    setShowNotifDropdown(false);
    setCurrentTab('database');
  };

  const selectedTransaction = transactions.find(t => t.id === selectedTransactionId);

  // Authenticate screen guard
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Header texts
  const tabHeaders = {
    dashboard: { title: 'Dashboard', subtitle: 'Memantau status dan performa Backcharge secara real-time.' },
    database: { title: 'Data Backcharge', subtitle: 'Pencatatan transaksi, tracking progres Backcharge, dan audit berkas.' },
    audit: { title: 'Audit Trail Aktivitas', subtitle: 'Mutasi log penyerahan berkas fisik secara transparan seluruh cabang.' },
    users: { title: 'Manajemen Staf & Pengguna', subtitle: 'Hak akses otoritas dan wilayah Backcharge nasional.' },
    complaints: { title: 'Hub Keluhan & Masukan', subtitle: 'Penyampaian aspirasi, keluhan atau masukan serta monitoring tindak lanjut feedback.' }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 pb-20 md:pb-0">
      
      {/* 1. TOAST ALERTS OVERLAY */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-xl text-xs font-bold transition-all duration-300 shadow-xl flex items-center justify-between mb-2 pointer-events-auto border animate-in fade-in slide-in-from-top-4 ${
              t.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : t.type === 'error' 
                  ? 'bg-red-600 text-white border-red-500' 
                  : 'bg-blue-600 text-white border-blue-500'
            }`}
          >
            <span>{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-3 font-black text-sm opacity-85 hover:opacity-100">×</button>
          </div>
        ))}
      </div>

      {/* 2. DESKTOP COLLAPSIBLE SIDEBAR */}
      <aside 
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        className={`hidden md:flex bg-slate-900 text-slate-300 flex-shrink-0 flex-col border-r border-slate-800 transition-all duration-300 ease-in-out z-40 ${
          sidebarHover ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-center overflow-hidden h-16 flex-shrink-0">
          <div className="flex items-center space-x-3 w-full justify-start pl-1">
            <div className="bg-white p-1 rounded-xl flex-shrink-0 w-9 h-9 flex items-center justify-center shadow-md">
              <img 
                src="https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q" 
                alt="ASSA" 
                className="w-7 h-7 object-contain"
              />
            </div>
            <div className={`transition-all duration-300 ${sidebarHover ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 overflow-hidden'}`}>
              <h1 className="text-sm font-extrabold text-white leading-none truncate">Backcharge Nasional</h1>
              <p className="text-[9px] text-slate-500 font-extrabold tracking-wide mt-0.5 uppercase">Workflow system</p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-3 bg-slate-800/40 rounded-2xl border border-slate-800/60 flex items-center space-x-3 overflow-hidden justify-start transition-all duration-300">
          <div className="w-10 h-10 bg-blue-500 text-white font-extrabold rounded-xl flex items-center justify-center text-sm shadow-md shadow-blue-500/10 flex-shrink-0">
            {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className={`transition-all duration-300 min-w-0 ${sidebarHover ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 overflow-hidden'}`}>
            <p className="text-xs font-black text-white truncate leading-tight">{currentUser.full_name}</p>
            <p className="text-[9px] font-bold text-blue-400 mt-0.5 truncate uppercase">{currentUser.role}</p>
            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded mt-1 inline-block border border-emerald-500/20 uppercase">
              {currentUser.branch}
            </span>
          </div>
        </div>

        {/* Navigations links */}
        <nav className="flex-grow px-3 py-2 space-y-1">
          <button 
            onClick={() => setCurrentTab('dashboard')} 
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
              currentTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Dashboard</span>
          </button>

          <button 
            onClick={() => setCurrentTab('database')} 
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
              currentTab === 'database' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <Layers className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Data Backcharge</span>
          </button>

          <button 
            onClick={() => setCurrentTab('complaints')} 
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
              currentTab === 'complaints' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <Mail className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Keluhan & Masukan</span>
          </button>

          {/* ADMIN ONLY TABS */}
          {hasRole(currentUser.role, 'Administrator') && (
            <>
              <button 
                onClick={() => setCurrentTab('audit')} 
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                  currentTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                }`}
              >
                <Clock className="w-5 h-5 flex-shrink-0" />
                <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Audit Trail Activity</span>
              </button>

              <button 
                onClick={() => setCurrentTab('users')} 
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                  currentTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                }`}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Manajemen Pengguna</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* 3. MOBILE BOTTOM FIXED BAR (ACCESSIBILITY FOR MOBILE PHONES) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 shadow-2xl flex justify-around py-2.5 px-1 z-40 safe-bottom">
        <button 
          onClick={() => setCurrentTab('dashboard')} 
          className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
            currentTab === 'dashboard' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 flex-shrink-0" />
          <span className="truncate max-w-[64px]">Dashboard</span>
        </button>
        <button 
          onClick={() => setCurrentTab('database')} 
          className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
            currentTab === 'database' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-5 h-5 flex-shrink-0" />
          <span className="truncate max-w-[64px]">Database</span>
        </button>
        <button 
          onClick={() => setCurrentTab('complaints')} 
          className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
            currentTab === 'complaints' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="w-5 h-5 flex-shrink-0" />
          <span className="truncate max-w-[64px]">Keluhan</span>
        </button>
        
        {hasRole(currentUser.role, 'Administrator') && (
          <>
            <button 
              onClick={() => setCurrentTab('audit')} 
              className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
                currentTab === 'audit' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span className="truncate max-w-[64px]">Audit</span>
            </button>
            <button 
              onClick={() => setCurrentTab('users')} 
              className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
                currentTab === 'users' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className="truncate max-w-[64px]">User</span>
            </button>
          </>
        )}
      </nav>

      {/* 4. MAIN CONTAINER CONTENT */}
      <div className="flex-grow flex flex-col min-w-0 overflow-y-auto max-w-full">
        
        {/* Top Header status bar */}
        <header className="bg-white border-b border-slate-200 px-3 md:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="bg-white p-1 rounded-lg shadow-sm md:hidden w-8 h-8 flex-shrink-0 flex items-center justify-center border border-slate-200">
              <img 
                src="https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q" 
                alt="ASSA" 
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm md:text-lg font-extrabold text-slate-900 leading-tight truncate">
                {tabHeaders[currentTab].title}
              </h2>
              <p className="text-[9px] md:text-xs text-slate-400 font-medium truncate">
                {tabHeaders[currentTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 md:space-x-2 relative flex-shrink-0">
            
            {/* Sync & Refresh Data Button */}
            <button 
              onClick={handleRefreshData} 
              disabled={isRefreshing}
              className={`p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 ${
                isRefreshing ? 'opacity-70 cursor-not-allowed bg-blue-50 text-blue-600' : ''
              }`}
              title="Sinkronkan & Perbarui Data dari Database"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Notification drop indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas"
              >
                <Bell className="w-4 h-4" />
                <AnimatePresence>
                  {notifications.some(n => !n.read) && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 1.5, 1], opacity: 1 }}
                      transition={{ 
                        duration: 0.5, 
                        repeat: Infinity,
                        repeatType: "reverse",
                        repeatDelay: 1.5
                      }}
                      className="absolute top-1 right-1"
                    >
                      <span className="flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Notification Dropdown Box */}
              {showNotifDropdown && (
                <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-black text-slate-800 block truncate">Antrean Tugas</span>
                      <span className="text-[9px] text-slate-500 font-semibold truncate block">{currentUser?.role} • {currentUser?.branch}</span>
                    </div>
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-extrabold flex-shrink-0">
                      {notifications.length} Pending
                    </span>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100 text-xs">
                    {notifications.map(n => {
                      const badge = getNotificationBadge(n);
                      return (
                        <div 
                          key={n.id} 
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 hover:bg-slate-100/80 cursor-pointer transition-all flex flex-col space-y-1.5 border-l-4 ${badge.borderLeftClass} ${
                            n.read ? 'opacity-60 bg-white' : 'bg-slate-50/70 font-semibold'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-slate-900 font-mono text-[11px]">{n.transaction_id}</span>
                              <span className={`px-2 py-0.5 text-[9px] rounded-full border inline-flex items-center space-x-1 shadow-2xs ${badge.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`}></span>
                                <span>{badge.label}</span>
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-600 bg-slate-200/60 border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase">{n.branch}</span>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium leading-snug break-words">{n.description}</p>
                          <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono pt-0.5">
                            <span className="font-sans font-bold text-slate-500 truncate max-w-[150px]">{n.customer_name}</span>
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}

                    {notifications.length === 0 && (
                      <div className="p-5 text-center text-slate-400">
                        <p className="text-xs font-bold text-slate-600">Semua Tugas Selesai! 🎉</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">Tidak ada antrean tugas pending untuk peran Anda saat ini.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout Portal */}
            <button 
              onClick={handleLogout}
              className="p-2 md:px-3 text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl transition-all border border-transparent flex items-center space-x-1.5"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline text-xs font-bold">Logout Portal</span>
            </button>
          </div>
        </header>


        {/* 5. JENDELA AREA TAB KONTEN */}
        <main className="p-3 sm:p-4 md:p-6 flex-grow space-y-6 pb-28 md:pb-6 max-w-full">
          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-xl flex items-center space-x-2 animate-pulse justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Menyelaraskan data real-time dengan database...</span>
            </div>
          )}



          {currentTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions} 
              currentUser={currentUser!}
              isLoading={loading}
              onSelectTransaction={(id) => {
                setSelectedTransactionId(id);
                setCurrentTab('database');
              }}
              addToast={addToast}
              onUpdatePassword={handleUpdateOwnPassword}
              onSelectAlertFilter={(filter) => {
                setActiveAlertFilter(filter);
                setCurrentTab('database');
              }}
              onSelectDashboardFilter={(filter) => {
                setActiveDashboardFilter(filter);
                setCurrentTab('database');
              }}
            />
          )}

          {currentTab === 'database' && (
            <DatabaseView 
              transactions={transactions}
              currentUser={currentUser!}
              profiles={profiles}
              isLoading={loading}
              onAddTransaction={handleAddTransaction}
              onBulkAddTransactions={handleBulkAddTransactions}
              onSelectTransaction={setSelectedTransactionId}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              activeAlertFilter={activeAlertFilter}
              onClearAlertFilter={() => {
                setActiveAlertFilter('');
                setActiveDashboardFilter(null);
              }}
              activeDashboardFilter={activeDashboardFilter}
              onClearDashboardFilter={() => setActiveDashboardFilter(null)}
              addToast={addToast}
            />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={logs} profiles={profiles} />
          )}

          {currentTab === 'users' && (
            <UserManagement 
              profiles={profiles}
              currentUser={currentUser!}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {currentTab === 'complaints' && (
            <FeedbackView 
              inquiries={inquiries}
              currentUser={currentUser!}
              onAddInquiry={handleAddInquiry}
              onUpdateInquiry={handleUpdateInquiry}
              onDeleteInquiry={handleDeleteInquiry}
              addToast={addToast}
            />
          )}
        </main>
      </div>

      {/* 6. GLOBAL DETAIL MODAL FOR TRANSACTION STEPS */}
      {selectedTransactionId && selectedTransaction && (
        <DetailModal 
          transaction={selectedTransaction}
          currentUser={currentUser!}
          profiles={profiles}
          onClose={() => setSelectedTransactionId(null)}
          onUpdateStatus={handleUpdateTransaction}
          addToast={addToast}
        />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-red-500" />
              Konfirmasi Keluar
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin keluar dari Portal Manajemen Backcharge PT Adi Sarana Armada, Tbk? Sesi Anda akan diakhiri.
            </p>
            <div className="flex justify-end space-x-2 mt-5">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={confirmLogout}
                className="px-3.5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all"
              >
                Keluar Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE / CONNECTION ERROR POPUP MODAL */}
      {d1Error && showD1Modal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-amber-100 space-y-4 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500"></div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-grow">
                <h3 className="text-base font-black text-slate-900">Sistem Maintenance / Kendala Koneksi D1</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Terdeteksi kendala komunikasi dengan database Cloudflare D1. Sistem berjalan dalam mode pemulihan / offline:
                </p>
              </div>
              <button 
                onClick={() => setShowD1Modal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-all text-xs font-bold"
                title="Tutup Popup"
              >
                ✕
              </button>
            </div>

            <pre className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-mono text-slate-700 break-all overflow-x-auto whitespace-pre-wrap max-h-28">
              {d1Error}
            </pre>

            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-extrabold text-slate-800">Langkah Perbaikan API Token Cloudflare Anda:</p>
              <ul className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 pl-1 leading-relaxed">
                <li>Buka <strong className="font-bold text-slate-900">Cloudflare Dashboard</strong> &gt; <strong className="font-bold text-slate-900">My Profile</strong> &gt; <strong className="font-bold text-slate-900">API Tokens</strong>.</li>
                <li>Buat token dengan template <strong className="font-bold text-slate-900">Edit Cloudflare D1</strong> (atau setel izin <strong className="font-bold text-slate-900">Account: D1: Edit</strong>).</li>
                <li>Simpan Token tersebut di menu <strong className="font-bold text-slate-900">Settings</strong> dengan variabel <strong className="font-mono bg-amber-50 px-1 py-0.5 rounded text-amber-800 border border-amber-200">CLOUDFLARE_API_TOKEN</strong>.</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                disabled={migratingD1}
                onClick={runD1LiveSyncFromSupabase}
                className="px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                {migratingD1 ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                <span>Sinkronkan Supabase</span>
              </button>
              <button
                disabled={migratingD1}
                onClick={runD1FullSqlImport}
                className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                {migratingD1 ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                <span>Impor SQL</span>
              </button>
              <button
                onClick={() => setShowD1Modal(false)}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Tutup (Lanjutkan Aplikasi)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING MAINTENANCE BADGE (WHEN POPUP IS MINIMIZED/CLOSED) */}
      {d1Error && !showD1Modal && (
        <button
          onClick={() => setShowD1Modal(true)}
          className="fixed bottom-4 right-4 z-[150] bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold transition-all animate-bounce"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>⚠️ Sistem Maintenance / Kendala D1 (Klik Detail)</span>
        </button>
      )}

      {/* NON-BLOCKING FLOATING SYNC BADGE WHEN DATA IS ALREADY PRESENT */}
      {loading && transactions.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center space-x-2.5 text-xs font-semibold animate-fade-in pointer-events-none">
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          <span>Menyelaraskan data dengan Cloudflare D1...</span>
        </div>
      )}

      {/* FULL-PAGE BACKDROP LOADER WHEN DATA IS INITIALIZING / PREPARING FOR USER ROLE & BRANCH */}
      {loading && transactions.length === 0 && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-6 animate-fade-in">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[11px] font-extrabold text-indigo-700 tracking-wide uppercase">
                <Shield className="w-3.5 h-3.5" />
                <span>Otentikasi Berhasil</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Menyiapkan Data Anda</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Sedang memuat & menyelaraskan transaksi sesuai role dan cabang handling dari database Cloudflare D1...
              </p>
            </div>

            {/* USER ROLE & BRANCH INFO BADGES */}
            {currentUser && (
              <div className="w-full bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2.5 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Pengguna:</span>
                  <span className="font-bold text-slate-800">{currentUser.full_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Role Akses:</span>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md font-extrabold text-[11px]">
                    {currentUser.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Cabang Handling:</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-extrabold text-[11px]">
                    {currentUser.branch}
                  </span>
                </div>
              </div>
            )}

            {/* ANIMATED PROGRESS BAR */}
            <div className="w-full space-y-1.5">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 h-full w-full rounded-full animate-pulse origin-left"></div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                <span>Memuat Transaksi Cabang...</span>
                <span>Cloudflare D1 Aktif</span>
              </div>
            </div>

            <div className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-center space-x-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Koneksi Terenkripsi & Aman D1</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
