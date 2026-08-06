import React, { useState, useEffect } from 'react';
import { 
  Key, Mail, Layers, CheckCircle, Clock, AlertTriangle, BarChart3, 
  Download, FileSpreadsheet, RefreshCw, LogOut, Bell, Shield, Users, Landmark, UserCheck
} from 'lucide-react';

import { Profile, Backcharge, ActivityLog, AppNotification, UserRole, DashboardFilter } from './types';
import { supabase, isSupabaseConfigured, mockDb } from './supabaseClient';

import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import DatabaseView from './components/DatabaseView';
import DetailModal from './components/DetailModal';
import UserManagement from './components/UserManagement';
import AuditView from './components/AuditView';

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
  return packed;
}

function unpackExtraFields(item: any): any {
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

  if (no_bak && no_bak.includes('||')) {
    const parts = no_bak.split('||');
    no_bak = parts[0];
    
    parts.slice(1).forEach((part: string) => {
      if (part.startsWith('TILANG:')) {
        no_tilang = part.substring(7);
      } else if (part.startsWith('TANGGAL:')) {
        tanggal = part.substring(8);
      } else if (part.startsWith('TANGGAL_HANDOVER:')) {
        tanggal_handover = part.substring(17);
      } else if (part.startsWith('NAMA_BRO:')) {
        nama_bro = part.substring(9);
      } else if (part.startsWith('ALASAN:')) {
        alasan = part.substring(7);
      } else if (part.startsWith('DOK_PENDUKUNG:')) {
        upload_dok_pendukung = part.substring(14);
      } else if (part.startsWith('APPROVAL:')) {
        status_approval = part.substring(9);
      } else if (part.startsWith('APPROVED_BY:')) {
        approved_by = part.substring(12);
      } else if (part.startsWith('APPROVED_AT:')) {
        approved_at = part.substring(12);
      } else if (part.startsWith('APPROVAL_NOTE:')) {
        approval_note = part.substring(14);
      }
    });
  }

  return {
    ...item,
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
    approval_note
  };
}

// Helper to derive role-specific actionable tasks for Antrean Tugas
function deriveNotifications(transactionsList: Backcharge[], user: Profile, readIds: string[]): AppNotification[] {
  if (!user) return [];
  const list: AppNotification[] = [];
  const isBro = user.role === 'BRO';

  transactionsList.forEach(t => {
    // Determine branch match
    const userBranches = user.branch ? user.branch.split(',').map(s => s.trim()) : [];
    const branchMatch = user.branch === 'Nasional' || userBranches.includes(t.branch) || t.branch === user.branch;
    if (!branchMatch) return;

    // 1. ASO / Staff Role Tasks
    if (user.role === 'ASO / Staff' || user.role === 'Administrator' || isBro) {
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
          description: `Dokumen Belum Lengkap: Silakan unggah berkas BAK untuk denda ${t.customer_name} (${t.id}).`,
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
          description: `Menunggu Serah Terima: Berkas denda ${t.id} (${t.customer_name}) belum diserahkan ke Admin.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }

    // 2. Kepala Cabang Role Tasks
    const isKacab = user.role === 'Kepala Cabang' || (user.role as string) === 'kacab' || user.role === 'Administrator' || isBro;
    if (isKacab) {
      // Task A: Approval for Maintenance & TPL
      if ((t.category === 'Maintenance' || t.category === 'TPL') && (!t.status_approval || t.status_approval === 'Belum Approval')) {
        const id = `notif-kacab-approval-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'APPROVAL_KACAB',
          typeLabel: 'Approval Kacab',
          description: `Approval Backcharge (Kacab): Denda ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Kepala Cabang.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }

    // 3. Sales Head Role Tasks
    const isSH = user.role === 'Sales Head' || (user.role as string) === 'Sales / Sales Head' || user.role === 'Administrator' || isBro;
    if (isSH) {
      // Task A: Approval for Own Risk, Ekspedisi, ETLE
      if ((t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE') && (!t.status_approval || t.status_approval === 'Belum Approval')) {
        const id = `notif-sh-approval-${t.id}`;
        list.push({
          id,
          transaction_id: t.id,
          customer_name: t.customer_name,
          category: t.category,
          branch: t.branch,
          type: 'APPROVAL_SH',
          typeLabel: 'Approval Sales Head',
          description: `Approval Backcharge (Sales Head): Denda ${t.category} ${t.id} (${t.customer_name}) membutuhkan persetujuan Sales Head.`,
          created_at: t.created_at || new Date().toISOString(),
          read: readIds.includes(id)
        });
      }
    }

    // 4. Admin Role Tasks
    if (user.role === 'Admin' || user.role === 'Administrator' || isBro) {
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
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'database' | 'audit' | 'users'>('dashboard');
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
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  // Fetch app data
  const fetchData = async () => {
    setLoading(true);
    
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch backcharges
        let query = supabase.from('backcharges').select('*').order('created_at', { ascending: false });
        
        // Apply branch filter if not national
        if (currentUser && currentUser.branch !== 'Nasional') {
          if (currentUser.branch.includes(',')) {
            const userBranches = currentUser.branch.split(',').map(s => s.trim());
            query = query.in('branch', userBranches);
          } else {
            query = query.eq('branch', currentUser.branch);
          }
        }
        
        const { data: bcData, error: bcError } = await query;
        if (bcError) throw bcError;
        
        const unpackedData = ((bcData as any[]) || []).map(unpackExtraFields);
        setTransactions(unpackedData as Backcharge[]);
        try { localStorage.setItem('backcharge_cache_txs', JSON.stringify(unpackedData)); } catch {}

        // 2. Fetch logs
        const { data: logsData, error: logsError } = await supabase
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(300);
        if (logsError) throw logsError;
        setLogs((logsData as ActivityLog[]) || []);
        try { localStorage.setItem('backcharge_cache_logs', JSON.stringify(logsData || [])); } catch {}

        // 3. Fetch profiles (for administrator)
        if (currentUser?.role === 'Administrator') {
          const { data: profsData, error: profsError } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });
          if (profsError) throw profsError;
          setProfiles((profsData as Profile[]) || []);
          try { localStorage.setItem('backcharge_cache_profs', JSON.stringify(profsData || [])); } catch {}
        }
      } catch (err: any) {
        addToast(`Gagal menyinkronkan data: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Fetch mock offline data
      setTimeout(() => {
        let bcs = mockDb.getBackcharges();
        if (currentUser && currentUser.branch !== 'Nasional') {
          const userBranches = currentUser.branch.split(',').map(s => s.trim());
          bcs = bcs.filter(t => userBranches.includes(t.branch) || t.branch === currentUser.branch);
        }
        
        const unpackedData = bcs.map(unpackExtraFields);
        setTransactions(unpackedData as Backcharge[]);
        setLogs(mockDb.getLogs());
        setProfiles(mockDb.getProfiles());
        setLoading(false);
      }, 300);
    }
  };

  // Fetch data on login or session restore
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  // =========================================================================
  // SUPABASE REAL-TIME LISTENER FOR REAL-TIME NOTIFICATIONS
  // =========================================================================
  useEffect(() => {
    if (!currentUser) return;

    if (isSupabaseConfigured && supabase) {
      // Set up real-time postgres changes channel
      const channel = supabase
        .channel('backcharge-realtime-notif')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'backcharges' },
          (payload) => {
            // Trigger automatic background sync
            fetchData();

            const newRecord = payload.new as Backcharge;
            const oldRecord = payload.old as Backcharge;

            const userBranches = currentUser.branch ? currentUser.branch.split(',').map(s => s.trim()) : [];
            const isRelevantBranch = currentUser.branch === 'Nasional' || newRecord.branch === currentUser.branch || userBranches.includes(newRecord.branch);

            // Generate descriptive notifications
            if (payload.eventType === 'INSERT') {
              if (isRelevantBranch) {
                addToast(`Denda Baru: ${newRecord.id} - ${newRecord.customer_name}`, 'info');
              }
            } else if (payload.eventType === 'UPDATE') {
              if (isRelevantBranch) {
                let changeMessage = '';
                if (oldRecord.status_confirm !== newRecord.status_confirm) {
                  changeMessage = `Status konfirmasi diperbarui menjadi "${newRecord.status_confirm}"`;
                } else if (oldRecord.status_sap !== newRecord.status_sap) {
                  changeMessage = `Status SAP diperbarui menjadi "${newRecord.status_sap}"`;
                } else if (oldRecord.status_handover !== newRecord.status_handover) {
                  changeMessage = `Status penyerahan berkas diperbarui menjadi "${newRecord.status_handover}"`;
                } else if (oldRecord.no_invoice !== newRecord.no_invoice) {
                  changeMessage = `Nomor Invoice diperbarui menjadi "${newRecord.no_invoice}"`;
                } else if (oldRecord.status_payment !== newRecord.status_payment) {
                  changeMessage = `Status pembayaran diperbarui menjadi "${newRecord.status_payment}"`;
                }

                if (changeMessage) {
                  addToast(`Status Diperbarui: ${newRecord.id} - ${changeMessage}`, 'success');
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  // Login handler
  const handleLoginSuccess = (profile: Profile) => {
    setCurrentUser(profile);
    localStorage.setItem('backcharge_session_profile', JSON.stringify(profile));
    addToast(`Otentikasi Berhasil! Selamat datang, ${profile.full_name}.`, 'success');
  };

  // Logout handler
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('backcharge_session_profile');
    setShowLogoutConfirm(false);
    addToast("Berhasil logout dari sistem denda.", "info");
  };

  // 1. ADD NEW TRANSACTION WORKFLOW
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;

    // Generate unique ID: BC-YYYY-XXXX
    const year = new Date().getFullYear();
    let allIds: string[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('backcharges').select('id');
        if (!error && data) {
          allIds = data.map((item: any) => item.id);
        }
      } catch (e) {
        console.error("Error fetching all IDs from database:", e);
      }
    } else {
      allIds = mockDb.getBackcharges().map(item => item.id);
    }

    // Filter by year prefix and extract maximum numeric suffix
    const currentYearPrefix = `BC-${year}-`;
    const existingNums = allIds
      .filter(id => id && id.startsWith(currentYearPrefix))
      .map(id => {
        const parts = id.split('-');
        const numPart = parts[parts.length - 1];
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });

    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    let nextNum = maxNum + 1;
    let formatCount = String(nextNum).padStart(4, '0');
    let newId = `BC-${year}-${formatCount}`;

    // Loop fallback to guarantee 100% uniqueness in memory
    while (allIds.includes(newId)) {
      nextNum++;
      formatCount = String(nextNum).padStart(4, '0');
      newId = `BC-${year}-${formatCount}`;
    }

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

    const cleanSupabasePayload = (payload: any) => {
      const DB_COLUMNS = [
        'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang',
        'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
        'status_handover', 'no_invoice', 'status_payment', 'created_by', 'created_at',
        'updated_at', 'file_bak_url', 'file_handover_aso_sales_url',
        'file_handover_sales_admin_url', 'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan'
      ];
      const cleaned: any = {};
      for (const key of DB_COLUMNS) {
        if (key in payload) {
          cleaned[key] = payload[key];
        }
      }
      return cleaned;
    };

    if (isSupabaseConfigured && supabase) {
      let cleanedInsertObj = cleanSupabasePayload({
        ...txObj,
        no_bak: packExtraFields(txObj)
      });
      let success = false;
      let retries = 0;
      let lastError: any = null;

      while (!success && retries < 10) {
        try {
          const { error } = await supabase.from('backcharges').insert([cleanedInsertObj]);
          if (error) throw error;
          success = true;
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || '';
          const match = errMsg.match(/Could not find the ['"]([^'"]+)['"] column/i);
          if (match && match[1]) {
            const missingCol = match[1];
            console.warn(`Column '${missingCol}' not found in Supabase schema cache. Removing and retrying...`);
            delete cleanedInsertObj[missingCol];
            retries++;
          } else {
            break;
          }
        }
      }

      if (success) {
        addToast(`Transaksi denda ${newId} berhasil disimpan!`, 'success');
        fetchData();
      } else {
        let errMsg = lastError?.message || '';
        if (errMsg.toLowerCase().includes('schema cache') || errMsg.toLowerCase().includes('could not find')) {
          errMsg += ' (Tips: Silakan jalankan perintah sql `NOTIFY pgrst, \'reload schema\';` di SQL Editor Supabase Anda untuk memuat ulang cache skema Supabase)';
        }
        addToast(`Server gagal menyimpan denda: ${errMsg}`, 'error');
        throw lastError;
      }
    } else {
      // Mock Offline insertion
      mockDb.saveBackcharge(txObj, creatorEmail);
      
      addToast(`Denda denda ${newId} sukses disimpan offline!`, 'success');
      fetchData();
    }
  };

  // 2. UPDATE TRANSACTION WORKFLOW STATUS
  const handleUpdateTransaction = async (id: string, updates: Partial<Backcharge>, logMessage: string) => {
    if (!currentUser) return;

    const targetTx = transactions.find(t => t.id === id);
    if (!targetTx) return;

    const updatedTx = {
      ...targetTx,
      ...updates,
      updated_at: new Date().toISOString()
    };

    const cleanSupabasePayload = (payload: any) => {
      const DB_COLUMNS = [
        'id', 'category', 'branch', 'no_bak', 'no_spk', 'no_sap', 'no_tilang',
        'customer_name', 'license_plate', 'value', 'status_sap', 'status_confirm',
        'status_handover', 'no_invoice', 'status_payment', 'created_by', 'created_at',
        'updated_at', 'file_bak_url', 'file_handover_aso_sales_url',
        'file_handover_sales_admin_url', 'tanggal', 'tanggal_handover', 'nama_bro', 'upload_dok_pendukung', 'alasan'
      ];
      const cleaned: any = {};
      for (const key of DB_COLUMNS) {
        if (key in payload) {
          cleaned[key] = payload[key];
        }
      }
      return cleaned;
    };

    if (isSupabaseConfigured && supabase) {
      let cleanedUpdateObj = cleanSupabasePayload({
        ...updates,
        no_bak: packExtraFields(updatedTx),
        updated_at: new Date().toISOString()
      });
      let success = false;
      let retries = 0;
      let lastError: any = null;

      while (!success && retries < 10) {
        try {
          const { error } = await supabase
            .from('backcharges')
            .update(cleanedUpdateObj)
            .eq('id', id);
          if (error) throw error;
          success = true;
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || '';
          const match = errMsg.match(/Could not find the ['"]([^'"]+)['"] column/i);
          if (match && match[1]) {
            const missingCol = match[1];
            console.warn(`Column '${missingCol}' not found in Supabase schema cache. Removing and retrying...`);
            delete cleanedUpdateObj[missingCol];
            retries++;
          } else {
            break;
          }
        }
      }

      if (success) {
        // Insert audit log explicitly (Trigger handles status but explicit details are logged nicely)
        try {
          await supabase.from('activity_logs').insert([{
            transaction_id: id,
            performed_by: currentUser.email,
            action_description: logMessage
          }]);
        } catch (logErr) {
          console.warn("Failed to insert activity log:", logErr);
        }

        addToast(`Transaksi ${id} diperbarui tervalidasi!`, 'success');
        fetchData();
      } else {
        let errMsg = lastError?.message || '';
        if (errMsg.toLowerCase().includes('schema cache') || errMsg.toLowerCase().includes('could not find')) {
          errMsg += ' (Tips: Silakan jalankan perintah sql `NOTIFY pgrst, \'reload schema\';` di SQL Editor Supabase Anda untuk memuat ulang cache skema Supabase)';
        }
        addToast(`Server gagal memproses update: ${errMsg}`, 'error');
      }
    } else {
      // Mock Offline update
      mockDb.saveBackcharge(updatedTx, currentUser.email);
      
      addToast(`Status ${id} diperbarui offline!`, 'success');
      fetchData();
    }
  };

  // 2B. DELETE TRANSACTION WORKFLOW (ADMINISTRATOR ONLY)
  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') {
      addToast("Akses Ditolak: Hanya Administrator yang boleh menghapus data!", "error");
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus data Backcharge dengan ID ${id} secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Hapus log aktivitas terkait terlebih dahulu jika diperlukan
        await supabase.from('activity_logs').delete().eq('transaction_id', id);
        
        const { error } = await supabase
          .from('backcharges')
          .delete()
          .eq('id', id);

        if (error) throw error;

        addToast(`Denda ${id} berhasil dihapus permanen!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Server gagal menghapus denda: ${err.message}`, 'error');
      }
    } else {
      mockDb.deleteBackcharge(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      addToast(`Denda ${id} berhasil dihapus offline!`, 'success');
    }
  };

  // 3. ADMIN: ADD USER WORKFLOW
  const handleAddUser = async (email: string, fullName: string, role: UserRole, branch: string, password?: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    const newProfile: Profile = {
      id: Math.random().toString(36).substring(7),
      email,
      full_name: fullName,
      role,
      branch,
      created_at: new Date().toISOString(),
      password: password || 'password123'
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('profiles').insert([newProfile]);
        if (error) throw error;
        
        // Log explicitly
        await supabase.from('activity_logs').insert([{
          transaction_id: 'SYSTEM',
          performed_by: currentUser.email,
          action_description: `Menambahkan staf pengguna baru: ${fullName} (${email}) - ${role}`
        }]);

        addToast(`Staf ${fullName} sukses didaftarkan!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal menambahkan pengguna: ${err.message}`, 'error');
      }
    } else {
      mockDb.saveProfile(newProfile);
      mockDb.addLog('SYSTEM', currentUser.email, `Menambahkan staf pengguna baru: ${fullName} (${email}) - ${role}`);
      addToast(`Staf ${fullName} didaftarkan offline!`, 'success');
      fetchData();
    }
  };

  // 4. ADMIN: UPDATE USER WORKFLOW
  const handleUpdateUser = async (id: string, updates: Partial<Profile>) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        addToast(`Data pengguna diperbarui!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal memperbarui pengguna: ${err.message}`, 'error');
      }
    } else {
      const profilesList = mockDb.getProfiles();
      const target = profilesList.find(p => p.id === id);
      if (target) {
        mockDb.saveProfile({ ...target, ...updates });
        mockDb.addLog('SYSTEM', currentUser.email, `Mengubah data pengguna ${target.email}`);
        addToast(`Data pengguna ${target.email} sukses diupdate offline!`, 'success');
        fetchData();
      }
    }
  };

  const handleUpdateOwnPassword = async (newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ password: newPassword })
          .eq('id', currentUser.id);

        if (error) throw error;
        
        const updatedUser = { ...currentUser, password: newPassword };
        setCurrentUser(updatedUser);
        localStorage.setItem('backcharge_session_profile', JSON.stringify(updatedUser));
        
        addToast('Password berhasil diubah!', 'success');
        return true;
      } catch (err: any) {
        addToast(`Gagal mengubah password: ${err.message}`, 'error');
        return false;
      }
    } else {
      try {
        const profilesList = mockDb.getProfiles();
        const target = profilesList.find(p => p.id === currentUser.id);
        if (target) {
          const updatedUser = { ...target, password: newPassword };
          mockDb.saveProfile(updatedUser);
          setCurrentUser(updatedUser);
          localStorage.setItem('backcharge_session_profile', JSON.stringify(updatedUser));
          mockDb.addLog('SYSTEM', currentUser.email, `Mengubah password mandiri`);
          addToast('Password berhasil diubah!', 'success');
          return true;
        }
        return false;
      } catch (err: any) {
        addToast('Gagal mengubah password offline.', 'error');
        return false;
      }
    }
  };

  // 5. ADMIN: DELETE USER WORKFLOW
  const handleDeleteUser = async (id: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;

        addToast(`Akses portal untuk pengguna dihapus.`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal menghapus pengguna: ${err.message}`, 'error');
      }
    } else {
      const profilesList = mockDb.getProfiles();
      const target = profilesList.find(p => p.id === id);
      const targetLabel = target ? target.email : id;
      mockDb.deleteProfile(id);
      mockDb.addLog('SYSTEM', currentUser.email, `Menghapus akses pengguna: ${targetLabel}`);
      addToast(`Akses portal untuk ${targetLabel} dihapus offline.`, 'success');
      fetchData();
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
    dashboard: { title: 'Dashboard', subtitle: 'Memantau status dan performa denda secara real-time.' },
    database: { title: 'Data Backcharge', subtitle: 'Pencatatan transaksi, tracking progres denda, dan audit berkas.' },
    audit: { title: 'Audit Trail Aktivitas', subtitle: 'Mutasi log penyerahan berkas fisik secara transparan seluruh cabang.' },
    users: { title: 'Manajemen Staf & Pengguna', subtitle: 'Hak akses otoritas dan wilayah denda nasional.' }
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
        <div className="p-4 group-hover:p-6 border-b border-slate-800 flex items-center justify-center overflow-hidden h-16 flex-shrink-0">
          <div className="flex items-center space-x-3 w-full justify-start pl-1">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-md flex-shrink-0">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className={`transition-all duration-300 ${sidebarHover ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 overflow-hidden'}`}>
              <h1 className="text-sm font-extrabold text-white leading-none truncate">BC Nasional</h1>
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

          {/* ADMIN ONLY TABS */}
          {currentUser.role === 'Administrator' && (
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

        {/* Bottom logout */}
        <div className="p-3 border-t border-slate-800 flex-shrink-0 h-16 flex items-center">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-start space-x-3 py-2.5 px-3 rounded-xl bg-red-950/20 hover:bg-red-900/40 text-xs font-bold text-red-400 transition-all border border-red-950/50"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* 3. MOBILE BOTTOM FIXED BAR (ACCESSIBILITY FOR MOBILE PHONES) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-slate-400 shadow-2xl flex justify-around py-3 z-40">
        <button 
          onClick={() => setCurrentTab('dashboard')} 
          className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
            currentTab === 'dashboard' ? 'text-blue-500' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
        <button 
          onClick={() => setCurrentTab('database')} 
          className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
            currentTab === 'database' ? 'text-blue-500' : 'text-slate-400'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>Database</span>
        </button>
        
        {currentUser.role === 'Administrator' && (
          <>
            <button 
              onClick={() => setCurrentTab('audit')} 
              className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
                currentTab === 'audit' ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Audit</span>
            </button>
            <button 
              onClick={() => setCurrentTab('users')} 
              className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
                currentTab === 'users' ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>User</span>
            </button>
          </>
        )}
      </nav>

      {/* 4. MAIN CONTAINER CONTENT */}
      <div className="flex-grow flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header status bar */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm md:hidden">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-extrabold text-slate-900 leading-none">
                {tabHeaders[currentTab].title}
              </h2>
              <p className="text-[9px] md:text-xs text-slate-400 font-bold mt-1 leading-none">
                {tabHeaders[currentTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 relative">
            
            {/* Sync Global Button */}
            <button 
              onClick={fetchData} 
              disabled={loading}
              className={`p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 ${loading ? 'animate-spin' : ''}`}
              title="Sinkronkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Notification drop indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                )}
              </button>

              {/* Notification Dropdown Box */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Antrean Tugas</span>
                      <span className="text-[9px] text-slate-500 font-semibold">{currentUser?.role} • {currentUser?.branch}</span>
                    </div>
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-extrabold">
                      {notifications.length} Tugas Pending
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
                          <p className="text-[10px] text-slate-600 font-medium leading-snug">{n.description}</p>
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

            {/* Mobile logout */}
            <button 
              onClick={handleLogout}
              className="md:hidden p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-50"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 5. JENDELA AREA TAB KONTEN */}
        <main className="p-4 md:p-6 flex-grow space-y-6 pb-24 md:pb-6">
          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-xl flex items-center space-x-2 animate-pulse justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Menyelaraskan data real-time dengan database...</span>
            </div>
          )}

          {currentTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions} 
              currentUser={currentUser}
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
              currentUser={currentUser}
              isLoading={loading}
              onAddTransaction={handleAddTransaction}
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
            />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={logs} profiles={profiles} />
          )}

          {currentTab === 'users' && (
            <UserManagement 
              profiles={profiles}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>

      {/* 6. GLOBAL DETAIL MODAL FOR TRANSACTION STEPS */}
      {selectedTransactionId && selectedTransaction && (
        <DetailModal 
          transaction={selectedTransaction}
          currentUser={currentUser}
          onClose={() => setSelectedTransactionId(null)}
          onUpdateStatus={handleUpdateTransaction}
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

    </div>
  );
}
