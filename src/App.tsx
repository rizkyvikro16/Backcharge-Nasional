import { evaluateRoleNotification } from "./lib/notificationRoleFilter";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, Mail, Layers, CheckCircle, Clock, AlertTriangle, BarChart3, 
  Download, FileSpreadsheet, RefreshCw, LogOut, Bell, BellOff, Smartphone, Volume2, Shield, Users, Landmark, UserCheck, X
} from 'lucide-react';

import { Profile, Backcharge, ActivityLog, AppNotification, UserRole, DashboardFilter, ContactInquiry, getUserBranches, getRoleAllowedBranches, isNationalOrAllBranches, hasRole, isRegionalHeadRole, ALL_SYSTEM_BRANCHES, packExtraFields, unpackExtraFields, syncNonOrSapStatus } from './types';
import { mockDb } from './supabaseClient';

import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import DatabaseView from './components/DatabaseView';
import DetailModal from './components/DetailModal';
import UserManagement from './components/UserManagement';
import AuditView from './components/AuditView';
import FeedbackView from './components/FeedbackView';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendBrowserNotification, 
  sendTestBrowserNotification,
  NotificationPermissionStatus 
} from './lib/browserNotification';

import { getApiUrl, getAuthHeaders, clearAuthToken } from './lib/api';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import IdleTimeoutModal from './components/IdleTimeoutModal';
import { useRbac } from './lib/rbac';

export function cleanDbPayload(payload: any) {
  const DB_COLUMNS = [
    'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang', 'no_cmd',
    'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
    'status_handover', 'no_invoice', 'status_payment', 'payment_date', 'created_by', 'created_at',
    'updated_at', 'file_bak_url', 'file_handover_aso_sales_url',
    'file_handover_sales_admin_url', 'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan',
    'status_approval', 'approved_by', 'approved_at', 'approval_note',
    'approval_attachment_1_url', 'approval_attachment_2_url', 'approval_attachment_3_url',
    'regional_approval_status', 'regional_approved_by', 'regional_approved_at', 'regional_approval_note',
    'division_approval_status', 'division_approved_by', 'division_approved_at', 'division_approval_note'
  ];
  const cleaned: any = {};
  const normalized = { ...payload };
  if (normalized.bro_name && !normalized.nama_bro) normalized.nama_bro = normalized.bro_name;
  if (normalized.dok_pendukung_alasan && !normalized.alasan) normalized.alasan = normalized.dok_pendukung_alasan;

  for (const key of DB_COLUMNS) {
    if (key in normalized && normalized[key] !== undefined) {
      cleaned[key] = normalized[key];
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
      if ((['Maintenance', 'TPL', 'Dokumen Kendaraan', 'Unclaimable Insurance'].includes(t.category)) && (!t.status_approval || t.status_approval === 'Belum Approval')) {
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
      // Task: Input Nomor Invoice
      const isHandedOver = ['Diterima Admin', 'Diserahkan ke Admin', 'Diserahkan ke Admin Pusat'].includes(t.status_handover);
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
          description: `Penerbitan Invoice: Berkas ${t.id} telah diterima Admin. Segera terbitkan & input nomor invoice.`,
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
  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(() => {
    try {
      const session = localStorage.getItem('backcharge_session_profile');
      const lastActivity = Number(localStorage.getItem('backcharge_last_activity') || '0');
      // Jika ada sesi tersimpan tetapi sudah tidak aktif >= 1 jam
      if (session && lastActivity > 0 && (Date.now() - lastActivity >= 60 * 60 * 1000)) {
        clearAuthToken();
        localStorage.removeItem('backcharge_last_activity');
        return 'Sesi Anda telah berakhir otomatis karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.';
      }
    } catch {}
    return null;
  });

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
      const session = localStorage.getItem('backcharge_session_profile');
      const lastActivity = Number(localStorage.getItem('backcharge_last_activity') || '0');
      if (session && lastActivity > 0 && (Date.now() - lastActivity >= 60 * 60 * 1000)) {
        clearAuthToken();
        localStorage.removeItem('backcharge_last_activity');
        return null;
      }
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  });

  // Handler auto-logout jika 1 jam tidak digunakan
  const handleAutoLogout = useCallback((reason: string) => {
    try {
      localStorage.removeItem('backcharge_cache_txs');
      localStorage.removeItem('backcharge_cache_logs');
      localStorage.removeItem('backcharge_cache_profs');
      localStorage.removeItem('backcharge_cache_time_v2');
      localStorage.removeItem('backcharge_cache_user');
      localStorage.removeItem('backcharge_last_activity');
    } catch (e) {}
    clearAuthToken();
    setCurrentUser(null);
    setSessionTimeoutNotice(reason);
    addToast(reason, "info");
  }, []);

  // Hook pendeteksi inaktivitas 1 jam dengan dialog peringatan di menit ke-58
  const { 
    showWarning: showIdleWarning, 
    secondsRemaining: idleSecondsRemaining, 
    resetTimer: resetIdleTimer 
  } = useIdleTimeout({
    enabled: !!currentUser,
    onTimeout: handleAutoLogout
  });









  const { canView, canAction } = useRbac();

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'database' | 'audit' | 'users' | 'complaints'>('dashboard');
  const [activeAlertFilter, setActiveAlertFilter] = useState<'due' | 'pending' | 'high_value' | ''>('');
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilter | null>(null);

  // Automatic RBAC Tab Route Guard: Redirect user if active tab is disallowed
  useEffect(() => {
    if (!currentUser) return;
    if (!canView(currentUser.role, currentTab)) {
      const allTabs: Array<'dashboard' | 'database' | 'complaints' | 'audit' | 'users'> = [
        'dashboard',
        'database',
        'complaints',
        'audit',
        'users'
      ];
      const nextAllowed = allTabs.find(t => canView(currentUser.role, t));
      if (nextAllowed) {
        setCurrentTab(nextAllowed);
      }
    }
  }, [currentUser, currentTab, canView]);
  
  // App data state with instant Stale-While-Revalidate local caching
  
const normalizeTransactions = (txs: Backcharge[]): Backcharge[] => {
  const kacabCats = ['Maintenance', 'TPL', 'Dokumen Kendaraan', 'Unclaimable Insurance'];
  const shCats = ['Own Risk', 'Ekspedisi', 'ETLE'];
  return txs.map(t => {
    let item = { ...t };
    if (item.approved_by) {
      const isKacab = kacabCats.includes(item.category);
      let newApprovedBy = item.approved_by;
      if (isKacab && newApprovedBy.includes('(Sales Head)')) {
        newApprovedBy = newApprovedBy.replace('(Sales Head)', '(Kepala Cabang)');
      } else if (shCats.includes(item.category) && (newApprovedBy.includes('(Kepala Cabang)') || newApprovedBy.includes('(Kacab)'))) {
        newApprovedBy = newApprovedBy.replace(/\((Kepala Cabang|Kacab)\)/, '(Sales Head)');
      }
      item.approved_by = newApprovedBy;
    }

    // Skema Otomatis: Selain Own Risk, otomatis 'Bill' jika diapprove/invoice/lunas, dan 'Not Bill' jika direject
    return syncNonOrSapStatus(item);
  });
};

const [transactions, setTransactions] = useState<Backcharge[]>(() => {
    try {
      const cached = localStorage.getItem('backcharge_cache_txs');
      return cached ? normalizeTransactions(JSON.parse(cached)) : [];
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
  const [activeDetailRecord, setActiveDetailRecord] = useState<Backcharge | null>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Direct single-row Primary Key fetcher for opening records from any page across millions of records
  useEffect(() => {
    if (!selectedTransactionId) {
      setActiveDetailRecord(null);
      return;
    }

    const localFound = transactions.find(t => t.id === selectedTransactionId);
    console.log('Detail fetch effect:', {selectedTransactionId, localFound});
    if (localFound) {
      setActiveDetailRecord(localFound);
    }

    let isMounted = true;
    fetch(getApiUrl("/api/d1/execute"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ operationId: "get_backcharge_detail", params: [selectedTransactionId] })
    })
      .then(res => res.json())
      .then(d => {
        if (isMounted && d.success && d.results && d.results.length > 0) {
          setActiveDetailRecord(unpackExtraFields(d.results[0]));
        }
      })
      .catch(err => {
        console.warn("Direct detail query notice:", err?.message || err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTransactionId, transactions]);

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
  const isWorkerHost = typeof window !== 'undefined' && (
    window.location.hostname.includes("workers.dev") ||
    window.location.hostname.includes("pages.dev")
  );

  const [isD1Active, setIsD1Active] = useState<boolean>(() => {
    if (isWorkerHost) return true;
    return localStorage.getItem('backcharge_use_d1') !== 'false';
  });
  const [d1Error, setD1Error] = useState<string | null>(null);
  const [showD1Modal, setShowD1Modal] = useState<boolean>(false);
  const [migratingD1, setMigratingD1] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [browserNotifPermission, setBrowserNotifPermission] = useState<NotificationPermissionStatus>(() => {
    return getNotificationPermission();
  });
  const [showBrowserNotifPrompt, setShowBrowserNotifPrompt] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const dismissed = localStorage.getItem('dismiss_browser_notif_prompt');
    const perm = getNotificationPermission();
    return perm === 'default' && !dismissed;
  });

  const handleRequestBrowserNotif = async () => {
    const res = await requestNotificationPermission();
    setBrowserNotifPermission(res);
    setShowBrowserNotifPrompt(false);
    if (res === 'granted') {
      addToast('Notifikasi browser & HP berhasil diaktifkan! Anda akan menerima peringatan real-time.', 'success');
      sendTestBrowserNotification();
    } else if (res === 'denied') {
      addToast('Izin notifikasi diblokir browser. Silakan klik ikon gembok di samping alamat web untuk mengizinkan.', 'error');
    }
  };

  // Sync notification permission status on window focus
  useEffect(() => {
    const handleFocus = () => {
      setBrowserNotifPermission(getNotificationPermission());
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Listen for Service Worker message or custom event when user clicks a notification
  useEffect(() => {
    const handleOpenDetail = (e: any) => {
      const txId = e.detail?.txId;
      if (txId) {
        setSelectedTransactionId(txId);
      }
    };
    window.addEventListener('open-backcharge-detail', handleOpenDetail);

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OPEN_BACKCHARGE_DETAIL' && e.data?.txId) {
        setSelectedTransactionId(e.data.txId);
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('open-backcharge-detail', handleOpenDetail);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Real-time Background Sync & Push Notification Engine (Optimized Delta Polling)
  const lastSeenLogIdRef = useRef<number>(0);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (logs.length > 0 && lastSeenLogIdRef.current === 0) {
      const maxId = Math.max(...logs.map(l => Number(l.id) || 0), 0);
      lastSeenLogIdRef.current = maxId;
    }
  }, [logs]);

  useEffect(() => {
    if (!currentUser || !isD1Active) return;

    const pollRealtimeUpdates = async () => {
      // 0 rows read if page is in background (hidden)
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      try {
        // Ultra-low row read probe: reads ONLY 1 row via index
        const probeRes = await executeD1Query("get_max_activity_log_id");
        const maxId = Number(probeRes?.[0]?.max_id) || 0;

        if (maxId <= 0) return;

        if (lastSeenLogIdRef.current === 0) {
          lastSeenLogIdRef.current = maxId;
          return;
        }

        // If no new activity logs, 0 extra rows read!
        if (maxId <= lastSeenLogIdRef.current) {
          return;
        }

        // Fetch ONLY newly added logs since last check (indexed range scan)
        const newLogs = await executeD1Query(
          "get_recent_activity_logs_since",
          [lastSeenLogIdRef.current]
        );

        if (newLogs && Array.isArray(newLogs) && newLogs.length > 0) {
          lastSeenLogIdRef.current = Math.max(...newLogs.map(l => Number(l.id) || 0));

          // Pre-fetch related transactions for branch-accurate role routing
          const txMap = new Map<string, Backcharge>(transactions.map(t => [t.id, t]));
          let notifiedCount = 0;

          for (const log of newLogs) {
            const targetTx = log.transaction_id ? txMap.get(log.transaction_id) || null : null;
            const decision = evaluateRoleNotification(currentUser, log, targetTx);

            if (decision.shouldNotify) {
              notifiedCount++;
              const desc = log.action_description || '';
              sendBrowserNotification({
                title: decision.title,
                body: (log.transaction_id && log.transaction_id !== 'SYSTEM' ? log.transaction_id + ': ' : '') + desc,
                txId: log.transaction_id !== 'SYSTEM' ? log.transaction_id : undefined,
                tag: 'live-log-' + log.id
              });
              if (newLogs.length <= 2) {
                addToast(decision.title + ': ' + desc, 'info');
              }
            }
          }

          if (newLogs.length > 2 && notifiedCount > 0) {
            addToast(`Terdapat ${notifiedCount} aktivitas baru diperbarui di sistem.`, 'info');
          }

          // Update logs in local state
          setLogs(prev => {
            const existingIds = new Set(prev.map(p => String(p.id)));
            const fresh = newLogs.filter(l => !existingIds.has(String(l.id)));
            return [...fresh.reverse(), ...prev].slice(0, 100);
          });

          // Fetch ONLY specific transactions that were modified (uses PRIMARY KEY index: 1 row per tx!)
          const changedTxIds = [...new Set(newLogs.map(l => l.transaction_id).filter(id => id && id !== 'SYSTEM' && id !== '-'))];
          if (changedTxIds.length > 0) {
            const updatedTxs = await executeD1Query(
              "get_backcharges_by_ids",
              changedTxIds
            );

            if (updatedTxs && Array.isArray(updatedTxs) && updatedTxs.length > 0) {
              const unpackedUpdated = updatedTxs.map(unpackExtraFields);
              updateTransactionsStateAndCache(prev => {
                const map = new Map<string, Backcharge>(prev.map(t => [t.id, t]));
                unpackedUpdated.forEach((ut: Backcharge) => {
                  map.set(ut.id, ut);
                });
                return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              });
            }
          }
        }
      } catch (err) {
        // Silent background polling
      }
    };

    // Polling interval: 45 seconds (drastically conserves D1 rows read quota)
    pollTimerRef.current = setInterval(pollRealtimeUpdates, 45000);

    // Instant sync when user switches back to this browser tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        pollRealtimeUpdates();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
    };
  }, [currentUser, isD1Active]);

  const isInitialLoadRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);



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
    try {
      localStorage.setItem('DATABASE_SECRET_KEY', 'b9fee9224e290f7c8989888ea76e67ca7015134aeeb20e2a8337e3f31bb900fc');
    } catch {}
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
            console.info("Status database notice:", data.error);
          }
        }
      } catch (err: any) {
        if (!isWorkerHost) setIsD1Active(false);
        console.warn("Notice checking D1 status:", err?.message || err);
        fetchData();
      }
    };
    checkD1Status();
  }, []);

  // Toast trigger helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const finalMessage = (import.meta.env.PROD && type === 'error') ? 'Terjadi kesalahan. Coba lagi nanti.' : message;
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev.slice(-1), { id, message: finalMessage, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
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

  // Diagnostic: Identify non-conforming IDs
  useEffect(() => {
    const nonConforming = transactions.filter(t => t.id && !t.id.match(/^BC-\d{4}-\d{4}$/));
    if (nonConforming.length > 0) {
        console.warn("Non-conforming IDs found:", nonConforming.map(t => t.id));
    }
  }, [transactions]);


  // Shared in-flight query map to coalesce identical requests on the frontend
  const inFlightClientQueries = useRef<Map<string, Promise<any[]>>>(new Map());

  // Shared fast D1 query executor
  // Shared fast D1 allowlist executor - strictly sends operationId and parameters, never raw SQL
  const executeD1Query = useCallback(async (sqlOrOpId: string, params: any[] = [], attempt = 1, extraPayload: any = {}): Promise<any[]> => {
    let operationId = sqlOrOpId;
    const trimmed = sqlOrOpId.trim();

    // Map any legacy SQL query string to safe server allowlist operations
    if (trimmed.startsWith("SELECT MAX(id)")) {
      operationId = "get_max_activity_log_id";
    } else if (trimmed.includes("FROM activity_logs") && trimmed.includes("WHERE id >")) {
      operationId = "get_recent_activity_logs_since";
    } else if (trimmed.includes("FROM activity_logs")) {
      operationId = "get_activity_logs";
    } else if (trimmed.includes("FROM profiles") && trimmed.includes("WHERE LOWER(email)")) {
      operationId = "get_profile_by_email";
    } else if (trimmed.includes("FROM profiles")) {
      operationId = "get_profiles";
    } else if (trimmed.includes("FROM contact_inquiries")) {
      operationId = "get_contact_inquiries";
    } else if (trimmed.includes("FROM backcharges") && trimmed.includes("WHERE id IN")) {
      operationId = "get_backcharges_by_ids";
    } else if (trimmed.includes("SELECT id FROM backcharges WHERE id LIKE")) {
      operationId = "get_top_backcharge_id_by_prefix";
    } else if (trimmed.trim() === "SELECT id FROM backcharges") {
      operationId = "get_backcharge_ids";
    } else if (trimmed.includes("FROM backcharges") && trimmed.includes("WHERE id =")) {
      operationId = "get_backcharge_detail";
    } else if (trimmed.includes("FROM backcharges")) {
      operationId = "get_all_backcharges";
    } else if (trimmed.startsWith("DELETE FROM backcharges")) {
      operationId = "delete_backcharge";
    } else if (trimmed.startsWith("DELETE FROM profiles")) {
      operationId = "delete_profile";
    } else if (trimmed.startsWith("DELETE FROM contact_inquiries")) {
      operationId = "delete_contact_inquiry";
    } else if (trimmed.startsWith("INSERT INTO activity_logs")) {
      operationId = "insert_activity_log";
    } else if (trimmed.startsWith("INSERT INTO profiles")) {
      operationId = "insert_profile";
    } else if (trimmed.startsWith("INSERT INTO contact_inquiries")) {
      operationId = "insert_contact_inquiry";
    } else if (trimmed.startsWith("UPDATE profiles SET password =")) {
      operationId = "update_profile_password";
    } else if (trimmed.startsWith("UPDATE contact_inquiries")) {
      operationId = "update_contact_inquiry";
    }

    const isReadQuery = operationId.startsWith("get_");
    const dedupeKey = `${operationId}:::${JSON.stringify(params || [])}:::${JSON.stringify(extraPayload || {})}`;
    const databaseSecretKey = localStorage.getItem('DATABASE_SECRET_KEY') || '';

    if (attempt === 1 && isReadQuery && inFlightClientQueries.current.has(dedupeKey)) {
      return inFlightClientQueries.current.get(dedupeKey)!;
    }

    const runQuery = async (): Promise<any[]> => {
      let res: Response;
      try {
        res = await fetch(getApiUrl("/api/d1/execute"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            operationId,
            params: params,
            ...(extraPayload || {})
          })
        });
      } catch (networkErr: any) {
        if (attempt <= 4) {
          await new Promise(r => setTimeout(r, attempt * 400));
          return executeD1Query(sqlOrOpId, params, attempt + 1, extraPayload);
        }
        console.warn("Koneksi D1 gagal:", networkErr?.message || networkErr);
        if (isReadQuery) {
          return [];
        }
        throw new Error("Koneksi D1 tidak dapat dijangkau: " + (networkErr?.message || 'Network error'));
      }

      const text = await res.text();
      const isRateExceeded = res.status === 429 || 
        text.includes("Rate exceeded") || 
        text.includes("rate limit") || 
        text.includes("too many requests") ||
        text.includes("10022");

      if (isRateExceeded && attempt <= 6) {
        const delayMs = Math.min(6000, attempt * 800 + Math.floor(Math.random() * 400));
        console.warn("⚠️ D1 Rate Limit (429). Retrying query in " + delayMs + "ms (attempt " + attempt + "/6)...");
        await new Promise(r => setTimeout(r, delayMs));
        return executeD1Query(sqlOrOpId, params, attempt + 1, extraPayload);
      }

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
          if (attempt <= 3) {
            await new Promise(r => setTimeout(r, 400));
            return executeD1Query(sqlOrOpId, params, attempt + 1, extraPayload);
          }
          if (isReadQuery) {
            console.warn("Koneksi API mengembalikan halaman SPA. Menggunakan cadangan data lokal.");
            return [];
          }
          throw new Error("Koneksi API D1 terintersepsi (Status " + res.status + ").");
        }
        if (isRateExceeded) {
          if (isReadQuery) return [];
          throw new Error("Rate limit sementara Cloudflare D1.");
        }
        if (isReadQuery) return [];
        throw new Error("Respons D1 (" + res.status + "): " + (text.substring(0, 100) || 'Kosong'));
      }

      if (!d.success) {
        if (d.error && (d.error.includes("Database binding 'DB'") || d.error.includes("binding 'DB'"))) {
          console.warn("Cloudflare D1 binding DB not yet attached in Pages settings. Falling back to local cache.");
          return [];
        }
        const errStr = (d.error || "").toLowerCase();
        if ((errStr.includes("rate limit") || errStr.includes("rate exceeded")) && attempt <= 6) {
          const delayMs = Math.min(6000, attempt * 800 + Math.floor(Math.random() * 400));
          await new Promise(r => setTimeout(r, delayMs));
          return executeD1Query(sqlOrOpId, params, attempt + 1, extraPayload);
        }
        if (isReadQuery) {
          console.warn("D1 query returned unsuccessful, falling back gracefully:", d.error);
          console.error("DEBUG: D1 error details:", d.error);
          return [];
        }
        throw new Error(d.error || "Gagal kueri D1");
      }

      return d.results || [];
    };

    const promise = runQuery();

    if (isReadQuery && attempt === 1) {
      inFlightClientQueries.current.set(dedupeKey, promise);
      promise.finally(() => {
        inFlightClientQueries.current.delete(dedupeKey);
      });
    }

    return promise;
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
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      const cachedUser = localStorage.getItem('backcharge_cache_user');
      const cachedTxsStr = localStorage.getItem('backcharge_cache_txs');
      const cachedLogsStr = localStorage.getItem('backcharge_cache_logs');
      const cachedProfsStr = localStorage.getItem('backcharge_cache_profs');
      
      // Only hydrate cached transactions if the cache matches the active user (prevents branch leaks between roles/regions)
      if (cachedTxsStr && (!cachedUser || !activeUser || cachedUser === activeUser.email)) {
        const parsedTxs = JSON.parse(cachedTxsStr);
        if (Array.isArray(parsedTxs) && parsedTxs.length > 0) {
          setTransactions(normalizeTransactions(parsedTxs));
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
          let allowedBranchesParam: string[] | undefined = undefined;

          // Role & Branch authorization filter:
          // Jika cabang Nasional, Semua Cabang, atau role Administrator / Division Head:
          // JANGAN membatasi kueri dengan filter cabang apa pun, sehingga 100% data D1 termuat persis berapapun jumlah barisnya.
          const isNationalOrAll = !activeUser || isNationalOrAllBranches(activeUser.branch, activeUser.role);
          if (!isNationalOrAll && activeUser) {
            const allowedBranches = getRoleAllowedBranches(activeUser.role, activeUser.branch);
            if (allowedBranches.length > 0 && allowedBranches.length < ALL_SYSTEM_BRANCHES.length) {
              allowedBranchesParam = allowedBranches;
            }
          }

          // Fetch all backcharges dynamically with parameterized branch allowlist
          const fetchAllBackchargesFromD1 = async (): Promise<any[]> => {
            return await executeD1Query("get_all_backcharges", allowedBranchesParam || [], 1, { branches: allowedBranchesParam });
          };

                    try {
            // =========================================================================
            // SMART INDEXED DELTA SYNCHRONIZATION (Ultra-Low D1 Rows Read Quota)
            // =========================================================================
            let cachedTxs: Backcharge[] = [];
            try {
              const cachedStr = localStorage.getItem("backcharge_cache_txs");
              if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                if (Array.isArray(parsed) && parsed.length > 0) cachedTxs = parsed;
              }
            } catch {}

            const cachedMaxUpdated = localStorage.getItem("backcharge_cache_max_updated") || "";
            const cachedMaxCreated = localStorage.getItem("backcharge_cache_max_created") || "";
            let finalTxs: Backcharge[] = cachedTxs;

            // Always fetch 100% actual live data directly from Cloudflare D1 (Full Sync)
            const bcs = await fetchAllBackchargesFromD1();
            
            if (bcs && Array.isArray(bcs) && bcs.length > 0) {
              finalTxs = bcs.map(unpackExtraFields);
            }

            const logsData = await executeD1Query("get_activity_logs");
            const profilesData = await executeD1Query("get_profiles");
            const inquiriesData = await executeD1Query("get_contact_inquiries");

            isInitialLoadRef.current = false;
            if (finalTxs && Array.isArray(finalTxs)) {
              if (finalTxs.length > 0) {
                const maxUp = finalTxs.reduce((max, t) => (t.updated_at && t.updated_at > max) ? t.updated_at : max, "");
                const maxCr = finalTxs.reduce((max, t) => (t.created_at && t.created_at > max) ? t.created_at : max, "");
                try {
                  localStorage.setItem("backcharge_cache_max_updated", maxUp);
                  localStorage.setItem("backcharge_cache_max_created", maxCr);
                  localStorage.setItem("backcharge_cache_count", String(finalTxs.length));
                } catch {}
              } else {
                // If D1 returned 0 backcharges, fallback to local storage mockDb so data never disappears
                const localFallback = mockDb.getBackcharges();
                if (localFallback && localFallback.length > 0) {
                  finalTxs = localFallback;
                }
              }
            }

            let finalProfiles = (profilesData as Profile[]) || [];
            if (!finalProfiles || finalProfiles.length === 0) {
              finalProfiles = mockDb.getProfiles();
            }

            let finalLogs = (logsData as ActivityLog[]) || [];
            if (!finalLogs || finalLogs.length === 0) {
              finalLogs = mockDb.getLogs();
            }

            let finalInquiries = (inquiriesData as ContactInquiry[]) || [];
            if (!finalInquiries || finalInquiries.length === 0) {
              finalInquiries = mockDb.getContactInquiries();
            }

            setTransactions(normalizeTransactions(finalTxs as Backcharge[]));
            setLogs(finalLogs);
            setProfiles(finalProfiles);
            setInquiries(finalInquiries);

            try {
              localStorage.setItem("backcharge_cache_txs", JSON.stringify(finalTxs));
              localStorage.setItem("backcharge_cache_logs", JSON.stringify(finalLogs));
              localStorage.setItem("backcharge_cache_profs", JSON.stringify(finalProfiles));
              localStorage.setItem("backcharge_cache_time_v2", String(Date.now()));
              localStorage.setItem("backcharge_cache_user", activeUser?.email || "");
            } catch (cacheErr) {
              try {
                const lean = finalTxs.slice(0, 500);
                localStorage.setItem("backcharge_cache_txs", JSON.stringify(lean));
                localStorage.setItem("backcharge_cache_time_v2", String(Date.now()));
                localStorage.setItem("backcharge_cache_user", activeUser?.email || "");
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
                  fetchAllBackchargesFromD1(),
                  executeD1Query("get_activity_logs"),
                  executeD1Query("get_profiles"),
                  executeD1Query("get_contact_inquiries")
                ]);

                const unpackedTxs = (bcs || []).map(unpackExtraFields);
                setTransactions(normalizeTransactions(unpackedTxs as Backcharge[]));
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
              setTransactions(normalizeTransactions(cachedTxs));
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
            const userBranches = getRoleAllowedBranches(activeUser.role, activeUser.branch);
            bcs = bcs.filter(t => userBranches.includes(t.branch));
          }
          const unpackedData = bcs.map(unpackExtraFields);
          setTransactions(normalizeTransactions(unpackedData as Backcharge[]));
          setLogs(mockDb.getLogs());
          setProfiles(mockDb.getProfiles());
          setInquiries(mockDb.getContactInquiries());
        }

        if (!isWorkerHost) {
          setIsD1Active(false);
        }
        setD1Error(null);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
      return;
    }
    
    // Fetch mock offline data with minimum latency simulation
    setTimeout(() => {
      let bcs = mockDb.getBackcharges();
      if (activeUser && !isNationalOrAllBranches(activeUser.branch, activeUser.role)) {
        const userBranches = getRoleAllowedBranches(activeUser.role, activeUser.branch);
        bcs = bcs.filter(t => userBranches.includes(t.branch));
      }
      
      const unpackedData = bcs.map(unpackExtraFields);
      setTransactions(unpackedData as Backcharge[]);
      setLogs(mockDb.getLogs());
      setProfiles(mockDb.getProfiles());
      setInquiries(mockDb.getContactInquiries());
      setLoading(false);
      isFetchingRef.current = false;
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
  const handleLoginSuccess = (profile: Profile, token?: string) => {
    setSessionTimeoutNotice(null);
    try {
      localStorage.setItem('backcharge_last_activity', String(Date.now()));
    } catch {}
    setCurrentUser(profile);
    localStorage.setItem('backcharge_session_profile', JSON.stringify(profile));
    if (token) {
      localStorage.setItem('backcharge_auth_token', token);
    }
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
      localStorage.removeItem('backcharge_last_activity');
    } catch (e) {}
    clearAuthToken();
    setCurrentUser(null);
    setSessionTimeoutNotice(null);
    setShowLogoutConfirm(false);
    addToast("Berhasil logout dari sistem Backcharge.", "info");
  };

    const generateNextTransactionId = async (): Promise<string> => {
    const year = new Date().getFullYear();
    let maxNum = 0;

    // 1. Check D1 Database first
    if (isD1Active) {
      try {
        const res = await executeD1Query(
          "get_top_backcharge_id_by_prefix", 
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
      // Check duplicate No. BAK if provided and not '-'
      const cleanBak = (newTx.no_bak || '').trim().toLowerCase();
      if (cleanBak && cleanBak !== '-') {
        const existingBak = transactions.find(t => t.no_bak && t.no_bak.trim().toLowerCase() === cleanBak);
        if (existingBak) {
          throw new Error(`No. BAK "${newTx.no_bak}" sudah terdaftar pada data transaksi ${existingBak.id} (${existingBak.customer_name}). Penyimpanan dibatalkan untuk menghindari duplikasi data.`);
        }
      }

      // Check duplicate No. SPK if provided and not '-'
      const cleanSpk = (newTx.no_spk || '').trim().toLowerCase();
      if (cleanSpk && cleanSpk !== '-') {
        const existingSpk = transactions.find(t => t.no_spk && t.no_spk.trim().toLowerCase() === cleanSpk);
        if (existingSpk) {
          throw new Error(`No. SPK "${newTx.no_spk}" sudah terdaftar pada data transaksi ${existingSpk.id} (${existingSpk.customer_name}). Penyimpanan dibatalkan untuk menghindari duplikasi data.`);
        }
      }

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
        await executeD1Query("insert_backcharge", [], 1, { data: cleanedInsertObj });

        await executeD1Query(
          "insert_activity_log",
          [newId, creatorEmail, `Membuat Backcharge baru: ${newId}`]
        );
      } else {
        mockDb.saveBackcharge(txObj, creatorEmail);
      }

      // Update local state & cache
      updateTransactionsStateAndCache(prev => [txObj, ...prev]);
      setLogs(prev => [newLog, ...prev]);
      addToast(`Transaksi Backcharge ${newId} berhasil disimpan!`, 'success');
      sendBrowserNotification({
        title: '🚨 Backcharge Baru Berhasil Dibuat!',
        body: `${txObj.branch} • ${txObj.customer_name} (${newId}) - Rp ${txObj.value.toLocaleString('id-ID')}`,
        txId: newId,
        tag: 'create-tx-' + newId
      });
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
          "get_top_backcharge_id_by_prefix",
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

        const allD1Ids = await executeD1Query("get_backcharge_ids");
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

        const batchSize = 25;
        let currentCount = 0;
        const totalCount = cleanedPayloads.length;
        if (onProgress) onProgress(0, totalCount);

        for (let i = 0; i < cleanedPayloads.length; i += batchSize) {
          const batch = cleanedPayloads.slice(i, i + batchSize);
          if (batch.length === 0) continue;

          await executeD1Query("bulk_upsert_backcharges", [], 1, { items: batch });

          currentCount = Math.min(i + batch.length, totalCount);
          if (onProgress) onProgress(currentCount, totalCount);
        }

        // Write activity log to D1
        await executeD1Query(
          "insert_activity_log",
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
      // Harmonize Non-OR SAP status
      syncNonOrSapStatus(updatedTx);
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
          status_sap: updatedTx.status_sap,
          no_bak: updatedTx.no_bak,
          updated_at: new Date().toISOString()
        });

        await executeD1Query("update_backcharge", [id], 1, { id, data: cleanedUpdateObj });

        if (logMessage) {
          await executeD1Query(
            "insert_activity_log",
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
      const isAppr = updates.status_approval || updates.regional_approval_status || updates.division_approval_status;
      const isPay = updates.status_payment;
      const notifHeader = isAppr ? '📋 Update Approval Backcharge' : isPay ? '💰 Status Pelunasan Diperbarui' : '🔄 Status Backcharge Diperbarui';
      sendBrowserNotification({
        title: notifHeader,
        body: `${id}: ${logMessage || 'Status transaksi berhasil diperbarui.'}`,
        txId: id,
        tag: 'update-bc-' + id + '-' + Date.now()
      });
    } catch (err: any) {
      console.error("Gagal memperbarui transaksi:", err);
      addToast(`Gagal memperbarui transaksi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2B. HIGH-PERFORMANCE ATOMIC BULK UPDATE TRANSACTIONS
  const handleBulkUpdateTransactions = async (
    itemsToUpdate: { id: string; updates: Partial<Backcharge> }[],
    generalLogMessage: string,
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!currentUser || itemsToUpdate.length === 0) return;
    setLoading(true);

    try {
      const nowStr = new Date().toISOString();
      const total = itemsToUpdate.length;
      let processed = 0;

      // Prepare map of updated records
      const updatedMap = new Map<string, Backcharge>();
      const logsToAdd: ActivityLog[] = [];

      itemsToUpdate.forEach(({ id, updates }) => {
        const target = transactions.find(t => t.id === id);
        if (target) {
          const updated: Backcharge = {
            ...target,
            ...updates,
            updated_at: nowStr
          };
          syncNonOrSapStatus(updated);
          updated.no_bak = packExtraFields(updated);
          updatedMap.set(id, updated);

          logsToAdd.push({
            id: String(Date.now() + Math.random()),
            timestamp: nowStr,
            transaction_id: id,
            performed_by: currentUser.email,
            action_description: generalLogMessage || `Update status massal transaksi ${id}`
          });
        }
      });

      if (isD1Active) {
        // Execute in safe chunks of 15 to stay within HTTP payload and execution limits
        const BATCH_SIZE = 15;
        for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
          const batch = itemsToUpdate.slice(i, i + BATCH_SIZE).map(({ id, updates }) => {
            const up = updatedMap.get(id);
            return {
              id,
              updates: cleanDbPayload({
                ...updates,
                status_sap: up?.status_sap || updates.status_sap,
                no_bak: up?.no_bak,
                updated_at: nowStr
              })
            };
          });

          await executeD1Query("bulk_update_backcharges", [], 1, { items: batch });

          processed = Math.min(i + batch.length, total);
          if (onProgress) onProgress(processed, total);
        }

        // Insert batch summary into activity_logs
        await executeD1Query(
          "insert_activity_log",
          ['BATCH_UPDATE', currentUser.email, `Update status massal (${itemsToUpdate.length} transaksi): ${generalLogMessage}`]
        ).catch(() => {});
      } else {
        // Offline / Mock database save
        updatedMap.forEach(updatedTx => {
          mockDb.saveBackcharge(updatedTx, currentUser.email);
        });
        if (onProgress) onProgress(total, total);
      }

      // Single atomic React state update
      updateTransactionsStateAndCache(prev =>
        prev.map(t => updatedMap.get(t.id) || t)
      );

      if (logsToAdd.length > 0) {
        setLogs(prev => [...logsToAdd.slice(0, 50), ...prev]);
      }

      addToast(`Berhasil memperbarui ${itemsToUpdate.length} transaksi secara massal!`, 'success');

      sendBrowserNotification({
        title: '🔄 Update Status Massal Berhasil',
        body: `Berhasil memperbarui status untuk ${itemsToUpdate.length} transaksi.`,
        tag: 'bulk-update-' + Date.now()
      });
    } catch (err: any) {
      console.error("Gagal melakukan update status massal:", err);
      addToast(`Gagal update status massal: ${err.message}`, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 2B. DELETE TRANSACTION WORKFLOW (ADMINISTRATOR, ASO, MAINTENANCE CENTER)
  const handleDeleteTransaction = async (id: string) => {
    const isAllowedToDelete = currentUser && (
      hasRole(currentUser.role, 'Administrator') ||
      hasRole(currentUser.role, 'ASO') ||
      hasRole(currentUser.role, 'ASO Megabranch') ||
      hasRole(currentUser.role, 'Maintenance Center')
    );

    if (!isAllowedToDelete) {
      addToast("Akses Ditolak: Hanya Administrator, ASO, ASO Megabranch, atau Maintenance Center yang berhak menghapus data transaksi!", "error");
      return;
    }

    const target = transactions.find(t => t.id === id);
    const details = target 
      ? `(Customer: ${target.customer_name || '-'}, Cabang: ${target.branch || '-'}, Nilai: Rp ${Number(target.value || 0).toLocaleString('id-ID')}, No Polisi: ${target.license_plate || '-'})`
      : '';

    if (!window.confirm(`KONFIRMASI PENGHAPUSAN TRANSAKSI:\n\nApakah Anda yakin ingin menghapus data Backcharge ${id} ${details}?\n\nRiwayat aktivitas transaksi ini akan tetap disimpan secara permanen di Log Sistem untuk keperluan audit.`)) {
      return;
    }

    setLoading(true);

    try {
      if (isD1Active) {
        // Catat bukti audit log penghapusan transaksi (Activity logs terdahulu TIDAK dihapus agar tetap bisa diaudit)
        const deletionLogMessage = `PENGHAPUSAN TRANSAKSI OLEH ${currentUser.role.toUpperCase()} (${currentUser.email}): ID ${id} ${details}`;
        await executeD1Query(
          "insert_activity_log",
          [id, currentUser.email, deletionLogMessage]
        );
        await executeD1Query("delete_backcharge", [id]);
      } else {
        mockDb.deleteBackcharge(id);
      }

      // Update local state & cache
      updateTransactionsStateAndCache(prev => prev.filter(t => t.id !== id));
      setSelectedTransactionId(prevId => prevId === id ? null : prevId);
      addToast(`Backcharge ${id} berhasil dihapus dan dicatat di Log Sistem!`, 'success');
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
            "insert_profile",
            [newProfile.id, newProfile.email, newProfile.full_name, newProfile.role, newProfile.branch, newProfile.created_at, newProfile.password]
          );
          await executeD1Query(
            "insert_activity_log",
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
          await executeD1Query("update_profile", [id], 1, { id, data: updates });
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
          await executeD1Query("update_profile_password", [newPassword, currentUser.id]);
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
        await executeD1Query("delete_profile", [id]);
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
          await executeD1Query("insert_contact_inquiry", [], 1, { data: newInquiry });
          await executeD1Query(
            "insert_activity_log",
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
          "update_contact_inquiry",
          [
            updatedInquiry.status,
            updatedInquiry.feedback || null,
            updatedInquiry.feedback_by || null,
            updatedInquiry.feedback_at || null,
            updatedInquiry.id
          ]
        );
        await executeD1Query(
          "insert_activity_log",
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
        await executeD1Query("delete_contact_inquiry", [id]);
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

  const selectedTransaction = activeDetailRecord || transactions.find(t => t.id === selectedTransactionId) || null;

  // Authenticate screen guard
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} sessionTimeoutMessage={sessionTimeoutNotice} />;
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
          {canView(currentUser.role, 'dashboard') && (
            <button 
              onClick={() => setCurrentTab('dashboard')} 
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                currentTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Dashboard</span>
            </button>
          )}

          {canView(currentUser.role, 'database') && (
            <button 
              onClick={() => setCurrentTab('database')} 
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                currentTab === 'database' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Layers className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Data Backcharge</span>
            </button>
          )}

          {canView(currentUser.role, 'complaints') && (
            <button 
              onClick={() => setCurrentTab('complaints')} 
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                currentTab === 'complaints' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Mail className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Keluhan & Masukan</span>
            </button>
          )}

          {canView(currentUser.role, 'audit') && (
            <button 
              onClick={() => setCurrentTab('audit')} 
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                currentTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Audit Trail Activity</span>
            </button>
          )}

          {canView(currentUser.role, 'users') && (
            <button 
              onClick={() => setCurrentTab('users')} 
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                currentTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Manajemen Pengguna</span>
            </button>
          )}
        </nav>
      </aside>

      {/* 3. MOBILE BOTTOM FIXED BAR (ACCESSIBILITY FOR MOBILE PHONES) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 shadow-2xl flex justify-around py-2.5 px-1 z-40 safe-bottom">
        {canView(currentUser.role, 'dashboard') && (
          <button 
            onClick={() => setCurrentTab('dashboard')} 
            className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
              currentTab === 'dashboard' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">Dashboard</span>
          </button>
        )}
        {canView(currentUser.role, 'database') && (
          <button 
            onClick={() => setCurrentTab('database')} 
            className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
              currentTab === 'database' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">Database</span>
          </button>
        )}
        {canView(currentUser.role, 'complaints') && (
          <button 
            onClick={() => setCurrentTab('complaints')} 
            className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
              currentTab === 'complaints' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">Keluhan</span>
          </button>
        )}
        {canView(currentUser.role, 'audit') && (
          <button 
            onClick={() => setCurrentTab('audit')} 
            className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
              currentTab === 'audit' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">Audit</span>
          </button>
        )}
        {canView(currentUser.role, 'users') && (
          <button 
            onClick={() => setCurrentTab('users')} 
            className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold flex-1 py-1 px-0.5 rounded-lg transition-colors ${
              currentTab === 'users' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">User</span>
          </button>
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
            
            {/* Real-Time Notification Status & Settings Button */}
            {browserNotifPermission === 'granted' ? (
              <button
                onClick={() => setShowNotifSettings(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/90 rounded-xl text-xs font-bold transition-all shadow-sm"
                title="Notifikasi Browser & HP Aktif. Klik untuk opsi atau tes."
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline">Notif Real-time</span>
              </button>
            ) : browserNotifPermission === 'denied' ? (
              <button
                onClick={() => setShowNotifSettings(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                title="Notifikasi Diblokir Browser. Klik untuk petunjuk."
              >
                <BellOff className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Notif Diblokir</span>
              </button>
            ) : (
              <button
                onClick={handleRequestBrowserNotif}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-extrabold transition-all shadow-sm animate-pulse"
                title="Klik untuk mengaktifkan notifikasi di browser & HP"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span className="text-[11px] sm:text-xs">Aktifkan Notif HP</span>
              </button>
            )}

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

            {/* Notification slide-out drawer trigger */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas & Notifikasi"
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
            </div>

            {/* Slide-out Notification Panel (Drawer) on the Right */}
            {showNotifDropdown && (
              <>
                {/* Backdrop Overlay */}
                <div 
                  className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 animate-in fade-in duration-200"
                  onClick={() => setShowNotifDropdown(false)}
                />
                
                {/* Panel Drawer */}
                <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Antrean Tugas & Notifikasi</h3>
                        <p className="text-[10px] text-slate-300 font-medium">{currentUser?.role} • {currentUser?.branch}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-1 rounded-full font-extrabold">
                        {notifications.length} Pending
                      </span>
                      <button 
                        onClick={() => setShowNotifDropdown(false)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
                        title="Tutup panel"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto custom-scrollbar divide-y divide-slate-100 p-3 space-y-2">
                    {notifications.map(n => {
                      const badge = getNotificationBadge(n);
                      return (
                        <div 
                          key={n.id} 
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 rounded-xl hover:bg-blue-50/60 cursor-pointer transition-all flex flex-col space-y-2 border-l-4 shadow-2xs border border-slate-100 ${badge.borderLeftClass} ${
                            n.read ? 'opacity-70 bg-white' : 'bg-slate-50 font-semibold'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-slate-900 font-mono text-xs">{n.transaction_id}</span>
                              <span className={`px-2 py-0.5 text-[10px] rounded-full border inline-flex items-center space-x-1 ${badge.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`}></span>
                                <span>{badge.label}</span>
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-600 bg-slate-200/60 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase">{n.branch}</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{n.description}</p>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100/80">
                            <span className="font-sans font-bold text-slate-600 truncate max-w-[200px]">{n.customer_name}</span>
                            <span>{new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                      );
                    })}

                    {notifications.length === 0 && (
                      <div className="py-16 text-center text-slate-400">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                          <CheckCircle className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Semua Tugas Selesai! 🎉</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto italic">Tidak ada antrean tugas pending untuk peran dan wilayah Anda saat ini.</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button 
                      onClick={() => { setShowNotifDropdown(false); setShowNotifSettings(true); }}
                      className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-bold py-2 px-3 flex items-center justify-center space-x-2 bg-blue-50/80 hover:bg-blue-100 rounded-xl transition-all border border-blue-200/60 shadow-xs"
                    >
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span>Pengaturan Notifikasi Real-Time (HP & Web)</span>
                    </button>
                  </div>
                </div>
              </>
            )}

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

        {/* Real-time Browser/HP Notification Banner */}
        {showBrowserNotifPrompt && browserNotifPermission === 'default' && (
          <div className="mx-3 sm:mx-6 mt-3 p-3 sm:p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0 border border-white/20">
                <Bell className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <p className="text-xs font-bold sm:font-extrabold">Aktifkan Notifikasi Real-Time di Browser & Layar HP!</p>
                <p className="text-[11px] text-blue-100/90 font-medium">Dapatkan peringatan seketika saat ada input denda Backcharge baru, perubahan status pelunasan, atau update approval.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button 
                onClick={handleRequestBrowserNotif}
                className="px-3.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Izinkan Sekarang</span>
              </button>
              <button 
                onClick={() => {
                  setShowBrowserNotifPrompt(false);
                  localStorage.setItem('dismiss_browser_notif_prompt', 'true');
                }}
                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                title="Tutup banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. JENDELA AREA TAB KONTEN */}
        <main className="p-3 sm:p-4 md:p-6 flex-grow space-y-6 pb-28 md:pb-6 max-w-full">
          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-xl flex items-center space-x-2 animate-pulse justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Menyelaraskan data real-time dengan database...</span>
            </div>
          )}



          {currentTab === 'dashboard' && canView(currentUser?.role, 'dashboard') && (
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
                setActiveAlertFilter('');
                setActiveDashboardFilter(filter);
                setCurrentTab('database');
              }}
            />
          )}

          {currentTab === 'database' && canView(currentUser?.role, 'database') && (
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
              onBulkUpdateTransactions={handleBulkUpdateTransactions}
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

          {currentTab === 'audit' && canView(currentUser?.role, 'audit') && (
            <AuditView logs={logs} profiles={profiles} />
          )}

          {currentTab === 'users' && canView(currentUser?.role, 'users') && (
            <UserManagement 
              profiles={profiles}
              currentUser={currentUser!}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {currentTab === 'complaints' && canView(currentUser?.role, 'complaints') && (
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
      {selectedTransaction && (
        <DetailModal 
          transaction={selectedTransaction}
          currentUser={currentUser!}
          profiles={profiles}
          onClose={() => {
            setSelectedTransactionId(null);
            setActiveDetailRecord(null);
          }}
          onUpdateStatus={(id, updates, log) => {
            handleUpdateTransaction(id, updates, log);
            if (activeDetailRecord && activeDetailRecord.id === id) {
              setActiveDetailRecord(prev => prev ? { ...prev, ...updates } : null);
            }
          }}
          onDeleteTransaction={(id) => {
            handleDeleteTransaction(id);
            setSelectedTransactionId(null);
            setActiveDetailRecord(null);
          }}
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

      {/* NON-BLOCKING FLOATING SYNC BADGE WHEN DATA IS BEING RETRIEVED OR SYNCED */}
      {loading && (
        <div className="fixed top-4 right-4 z-[9999] bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center space-x-2.5 text-xs font-semibold animate-fade-in pointer-events-none">
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          <span>Sedang mengambil database...</span>
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
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Sedang Mengambil Database</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Sedang mengambil database & menyelaraskan transaksi sesuai role dan cabang...
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

      {/* 1-Hour Inactivity Warning Modal */}
      <IdleTimeoutModal
        isOpen={showIdleWarning}
        secondsRemaining={idleSecondsRemaining}
        onStayLoggedIn={resetIdleTimer}
        onLogout={() => handleAutoLogout("Anda telah keluar dari sistem.")}
      />

    </div>
  );
}
