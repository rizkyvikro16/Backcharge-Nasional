import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Filter, Plus, Download, Upload, Trash2, Edit3, Eye, 
  CheckCircle2, Clock, AlertCircle, X, ChevronLeft, ChevronRight, 
  FileSpreadsheet, ArrowUpDown, RefreshCw, CheckSquare, Square,
  Building, DollarSign, Layers, Tag, HelpCircle, FileText, Check, ShieldAlert,
  Calendar, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

import { 
  Backcharge, 
  Profile, 
  DashboardFilter, 
  ALL_SYSTEM_BRANCHES, 
  getRoleAllowedBranches, 
  isNationalOrAllBranches, 
  hasRole, 
  BackchargeCategory,
  unpackExtraFields,
  isRegionalHeadRole
} from '../types';
import { canPerformAction } from '../lib/rbac';
import MultiSelect from './MultiSelect';

export interface DatabaseViewProps {
  transactions: Backcharge[];
  currentUser: Profile;
  profiles: Profile[];
  isLoading?: boolean;
  onAddTransaction: (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<void>;
  onBulkAddTransactions: (newTxs: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  onSelectTransaction: (id: string) => void;
  onDeleteTransaction: (id: string) => Promise<void> | void;
  onUpdateTransaction: (id: string, updates: Partial<Backcharge>, logMessage: string) => Promise<void>;
  onBulkUpdateTransactions: (itemsToUpdate: { id: string; updates: Partial<Backcharge> }[], generalLogMessage: string, onProgress?: (current: number, total: number) => void) => Promise<void>;
  activeAlertFilter?: 'due' | 'pending' | 'high_value' | '';
  onClearAlertFilter?: () => void;
  activeDashboardFilter?: DashboardFilter | null;
  onClearDashboardFilter?: () => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CATEGORIES: BackchargeCategory[] = [
  'Own Risk',
  'Maintenance',
  'Ekspedisi',
  'ETLE',
  'TPL',
  'Unclaimable Insurance',
  'Dokumen Kendaraan'
];

const PAYMENT_STATUS_OPTIONS = ['Lunas', 'Belum Bayar'];
const APPROVAL_STATUS_OPTIONS = ['Disetujui', 'Belum Approval', 'Ditolak'];
const HANDOVER_STATUS_OPTIONS = ['Pending', 'Diterima Admin'];
const SAP_STATUS_OPTIONS = ['Bill', 'Not Bill', 'N/A'];

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case 'Own Risk':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Maintenance':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Ekspedisi':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ETLE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'TPL':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Unclaimable Insurance':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Dokumen Kendaraan':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getLeadTimeDays = (bakDateStr?: string | null, paymentDateStr?: string | null, isLunas?: boolean): number => {
  if (!bakDateStr) return 0;
  try {
    const bakDateOnly = bakDateStr.includes('T') ? bakDateStr.split('T')[0] : bakDateStr;
    const bakTime = new Date(`${bakDateOnly}T00:00:00`).getTime();
    if (isNaN(bakTime)) return 0;

    let targetTime = Date.now();
    if (isLunas && paymentDateStr) {
      const payDateOnly = paymentDateStr.includes('T') ? paymentDateStr.split('T')[0] : paymentDateStr;
      const payTime = new Date(`${payDateOnly}T00:00:00`).getTime();
      if (!isNaN(payTime) && payTime >= bakTime) {
        targetTime = payTime;
      }
    } else {
      const todayOnly = new Date().toISOString().split('T')[0];
      targetTime = new Date(`${todayOnly}T00:00:00`).getTime();
    }

    const diffDays = Math.round((targetTime - bakTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
};

const getLeadTimeColorClass = (days: number): { bg: string; text: string; border: string } => {
  if (days <= 7) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  } else if (days <= 14) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  } else if (days <= 30) {
    return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  } else {
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
  }
};

interface ApprovalTierInfo {
  role: 'SH' | 'Kacab' | 'RH' | 'DH';
  label: string;
  status: string;
  by?: string | null;
  at?: string | null;
}

interface ApprovalSummary {
  tiers: ApprovalTierInfo[];
  approvedTiers: ApprovalTierInfo[];
  pendingTiers: ApprovalTierInfo[];
  rejectedTiers: ApprovalTierInfo[];
  isFullyApproved: boolean;
  isRejected: boolean;
  isAllPending: boolean;
  isPartiallyApproved: boolean;
}

const getApprovalSummary = (tx: Backcharge): ApprovalSummary => {
  const transVal = Number(tx.value) || 0;
  const isMaintenance = tx.category === 'Maintenance';
  const isKacabCat = ['Maintenance', 'TPL', 'Dokumen Kendaraan', 'Unclaimable Insurance'].includes(tx.category);
  const isRegionalHeadReq = isMaintenance ? (transVal > 7500000) : (transVal > 5000000);
  const isDivisionHeadReq = transVal > 15000000;

  const tiers: ApprovalTierInfo[] = [
    {
      role: isKacabCat ? 'Kacab' : 'SH',
      label: isKacabCat ? 'Kacab' : 'SH',
      status: tx.status_approval || 'Belum Approval',
      by: tx.approved_by,
      at: tx.approved_at
    }
  ];

  if (isRegionalHeadReq || isDivisionHeadReq) {
    tiers.push({
      role: 'RH',
      label: 'RH',
      status: tx.regional_approval_status || 'Belum Approval',
      by: tx.regional_approved_by,
      at: tx.regional_approved_at
    });
  }

  if (isDivisionHeadReq) {
    tiers.push({
      role: 'DH',
      label: 'DH',
      status: tx.division_approval_status || 'Belum Approval',
      by: tx.division_approved_by,
      at: tx.division_approved_at
    });
  }

  const rejectedTiers = tiers.filter(t => t.status === 'Ditolak');
  const approvedTiers = tiers.filter(t => t.status === 'Disetujui');
  const pendingTiers = tiers.filter(t => !t.status || t.status === 'Belum Approval' || t.status === 'Pending');

  const isRejected = rejectedTiers.length > 0;
  const isFullyApproved = !isRejected && approvedTiers.length === tiers.length;
  const isAllPending = !isRejected && pendingTiers.length === tiers.length;
  const isPartiallyApproved = !isRejected && approvedTiers.length > 0 && pendingTiers.length > 0;

  return {
    tiers,
    approvedTiers,
    pendingTiers,
    rejectedTiers,
    isFullyApproved,
    isRejected,
    isAllPending,
    isPartiallyApproved
  };
};

const getShortApproverName = (byStr?: string | null): string => {
  if (!byStr || byStr === '-' || byStr === 'null' || byStr.trim() === '') return '-';
  const clean = byStr.replace(/\s*\([^)]*\)$/, '').trim();
  return clean || byStr;
};

const getApprovalText = (tx: Backcharge): string => {
  const s = getApprovalSummary(tx);
  if (s.isRejected) {
    const rejNames = s.rejectedTiers.map(t => `${t.label}: ${getShortApproverName(t.by)}`).join(', ');
    return `Ditolak (${rejNames})`;
  }
  if (s.isFullyApproved) {
    const appNames = s.approvedTiers.map(t => `${t.label}: ${getShortApproverName(t.by)}`).join(', ');
    return `Disetujui (${appNames})`;
  }
  if (s.isPartiallyApproved) {
    const pend = s.pendingTiers.map(t => t.label).join(', ');
    const appNames = s.approvedTiers.map(t => `${t.label}: ${getShortApproverName(t.by)}`).join(', ');
    return `Belum Appr. ${pend} (Disetujui ${appNames})`;
  }
  return `Belum Appr. ${s.tiers.map(t => t.label).join(', ')}`;
};

const PROCESS_STAGES = [
  'Menunggu Serah Terima Berkas',
  'Berkas di Admin (Belum Selesai Approval)',
  'Belum Approve SH',
  'Belum Approve KACAB',
  'Belum Approve RH',
  'Belum Approve DH',
  'Menunggu Cetak & Kirim Invoice',
  'Menunggu Pelunasan Backcharge',
  'Selesai (Lunas)',
  'Dokumen Ditolak (Reject)'
];

const getTransactionStage = (t: Backcharge): string => {
  const transVal = Number(t.value) || 0;
  const isMaintenance = t.category === 'Maintenance';
  const isRegionalHeadReq = isMaintenance ? (transVal > 7500000) : (transVal > 5000000);
  const isDivisionHeadReq = transVal > 15000000;

  const isDocRejected = Boolean(
    t.status_approval === 'Ditolak' || 
    t.regional_approval_status === 'Ditolak' || 
    t.division_approval_status === 'Ditolak' || 
    t.status_confirm === 'Ditolak / Negosiasi Ulang'
  );

  if (isDocRejected) {
    return 'Dokumen Ditolak (Reject)';
  }

  if (t.status_payment === 'Lunas') {
    return 'Selesai (Lunas)';
  }

  const isHandedOverAdmin = t.status_handover === 'Diterima Admin' || t.status_handover === 'Diserahkan ke Admin';
  if (!isHandedOverAdmin) {
    return 'Menunggu Serah Terima Berkas';
  }

  const isPendingL1 = !t.status_approval || t.status_approval === 'Belum Approval' || t.status_approval === 'Pending';
  const isL1Approved = t.status_approval === 'Disetujui';
  const isRegionalApproved = !isRegionalHeadReq || t.regional_approval_status === 'Disetujui';
  const isDivisionApproved = !isDivisionHeadReq || t.division_approval_status === 'Disetujui';

  if (!isL1Approved || isPendingL1) {
    const isKacabCat = ['Maintenance', 'TPL', 'Dokumen Kendaraan', 'Unclaimable Insurance'].includes(t.category);
    return isKacabCat ? 'Belum Approve KACAB' : 'Belum Approve SH';
  }

  if (isRegionalHeadReq && !isRegionalApproved) {
    return 'Belum Approve RH';
  }

  if (isDivisionHeadReq && !isDivisionApproved) {
    return 'Belum Approve DH';
  }

  const stepInvoice = Boolean(t.no_invoice && typeof t.no_invoice === 'string' && t.no_invoice.trim() !== '' && t.no_invoice.trim() !== '-');
  if (!stepInvoice) {
    return 'Menunggu Cetak & Kirim Invoice';
  }

  return 'Menunggu Pelunasan Backcharge';
};

const parseExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // If it's an Excel serial date number (e.g., 46322)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = Number(str);
    const utcDays = num > 60 ? num - 25569 : num - 25568;
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(str)) {
    const parts = str.split(/[/-]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
};

export default function DatabaseView({
  transactions,
  currentUser,
  profiles,
  isLoading = false,
  onAddTransaction,
  onBulkAddTransactions,
  onSelectTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onBulkUpdateTransactions,
  activeAlertFilter = '',
  onClearAlertFilter,
  activeDashboardFilter = null,
  onClearDashboardFilter,
  addToast
}: DatabaseViewProps) {
  // Permission helpers aligned with RBAC
  const canDelete = canPerformAction(currentUser?.role, 'delete') && (
    hasRole(currentUser?.role, 'Administrator') ||
    hasRole(currentUser?.role, 'ASO') ||
    hasRole(currentUser?.role, 'ASO Megabranch') ||
    hasRole(currentUser?.role, 'Maintenance Center')
  );

  const canAdd = canPerformAction(currentUser?.role, 'create');
  const canExport = canPerformAction(currentUser?.role, 'export');

  // Role authority checks for each section of Bulk Update
  const canUpdateHandover = useMemo(() => {
    if (!canPerformAction(currentUser?.role, 'update')) return false;
    return hasRole(currentUser?.role, 'Administrator') ||
      hasRole(currentUser?.role, 'Admin') ||
      hasRole(currentUser?.role, 'Admin Head') ||
      hasRole(currentUser?.role, 'ASO') ||
      hasRole(currentUser?.role, 'ASO Megabranch') ||
      hasRole(currentUser?.role, 'Maintenance Center');
  }, [currentUser]);

  const canUpdateSap = useMemo(() => {
    if (!canPerformAction(currentUser?.role, 'update')) return false;
    return hasRole(currentUser?.role, 'Administrator') ||
      hasRole(currentUser?.role, 'Admin Head') ||
      hasRole(currentUser?.role, 'Sales Head') ||
      hasRole(currentUser?.role, 'Sales');
  }, [currentUser]);

  const canUpdatePayment = useMemo(() => {
    if (!canPerformAction(currentUser?.role, 'update')) return false;
    return hasRole(currentUser?.role, 'Administrator') ||
      hasRole(currentUser?.role, 'Admin') ||
      hasRole(currentUser?.role, 'Admin Head') ||
      hasRole(currentUser?.role, 'Finance');
  }, [currentUser]);

  const canUpdateApproval = useMemo(() => {
    if (!canPerformAction(currentUser?.role, 'approve')) return false;
    return hasRole(currentUser?.role, 'Administrator') ||
      hasRole(currentUser?.role, 'Admin Head') ||
      hasRole(currentUser?.role, 'Kepala Cabang') ||
      hasRole(currentUser?.role, 'Sales Head') ||
      hasRole(currentUser?.role, 'Division Head') ||
      isRegionalHeadRole(currentUser?.role || '');
  }, [currentUser]);

  const canBulkAction = canUpdateHandover || canUpdateSap || canUpdatePayment || canUpdateApproval;

  // Authorized branches for current user
  const userBranches = useMemo(() => {
    if (!currentUser) return ALL_SYSTEM_BRANCHES;
    if (isNationalOrAllBranches(currentUser.branch, currentUser.role)) return ALL_SYSTEM_BRANCHES;
    return getRoleAllowedBranches(currentUser.role, currentUser.branch);
  }, [currentUser]);

  const getCreatorName = (email?: string) => {
    if (!email) return '-';
    const found = profiles.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());
    return found?.full_name || email;
  };

  // Filters State (Multi-selection via checkboxes)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);
  const [selectedApprovalStatuses, setSelectedApprovalStatuses] = useState<string[]>([]);
  const [selectedHandoverStatuses, setSelectedHandoverStatuses] = useState<string[]>([]);
  const [selectedSapStatuses, setSelectedSapStatuses] = useState<string[]>([]);
  const [selectedProcessStages, setSelectedProcessStages] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sorting State
  const [sortField, setSortField] = useState<keyof Backcharge>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Backcharge | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // Unified Bulk Update Modal States matching image_308f8e6a.png
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkHandoverStatus, setBulkHandoverStatus] = useState<string>('-- Tidak Diubah --');
  const [bulkHandoverDate, setBulkHandoverDate] = useState<string>('');
  const [bulkSapStatus, setBulkSapStatus] = useState<string>('-- Tidak Diubah --');
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState<string>('-- Tidak Diubah --');
  const [bulkApprovalStatus, setBulkApprovalStatus] = useState<string>('-- Tidak Diubah --');
  const [bulkAuditNote, setBulkAuditNote] = useState<string>('');
  const [bulkFile, setBulkFile] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null);
  const [editingFiles, setEditingFiles] = useState<{
    bak: { name: string; size: number; type: string; dataUrl: string } | null;
    supporting: { name: string; size: number; type: string; dataUrl: string } | null;
    handover: { name: string; size: number; type: string; dataUrl: string } | null;
  }>({ bak: null, supporting: null, handover: null });
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit
  const initialFormState = {
    category: 'Own Risk' as BackchargeCategory,
    branch: userBranches[0] || 'Bandung',
    customer_name: '',
    license_plate: '',
    value: 0,
    no_bak: '',
    no_spk: '',
    no_cmd: '',
    no_sap: '',
    no_tilang: '',
    nama_bro: '',
    tanggal: new Date().toISOString().split('T')[0],
    status_sap: 'N/A',
    status_confirm: 'Belum Konfirmasi',
    status_handover: 'Pending',
    status_payment: 'Belum Bayar',
    no_invoice: '',
    payment_date: '',
    alasan: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Autocomplete state for Add / Edit form (no_cmd, customer_name, license_plate, nama_bro)
  const [activeAutocompleteField, setActiveAutocompleteField] = useState<'no_cmd' | 'customer_name' | 'license_plate' | 'nama_bro' | null>(null);

  // Extract distinct historical data from transactions
  const historicalData = useMemo(() => {
    const cmds: string[] = [];
    const customers: string[] = [];
    const plates: string[] = [];
    const bros: string[] = [];

    const seenCmds = new Set<string>();
    const seenCustomers = new Set<string>();
    const seenPlates = new Set<string>();
    const seenBros = new Set<string>();

    transactions.forEach(t => {
      // 1. NO. CMD
      if (t.no_cmd && t.no_cmd !== '-' && t.no_cmd.trim()) {
        const c = t.no_cmd.trim();
        if (!seenCmds.has(c)) {
          seenCmds.add(c);
          cmds.push(c);
        }
      }
      // 2. NAMA CUSTOMER
      if (t.customer_name && t.customer_name !== '-' && t.customer_name.trim()) {
        const cust = t.customer_name.trim();
        if (!seenCustomers.has(cust)) {
          seenCustomers.add(cust);
          customers.push(cust);
        }
      }
      // 3. NO. POLISI
      if (t.license_plate && t.license_plate !== '-' && t.license_plate.trim()) {
        const lp = t.license_plate.trim().toUpperCase();
        if (!seenPlates.has(lp)) {
          seenPlates.add(lp);
          plates.push(lp);
        }
      }
      // 4. NAMA BRO
      const bro = (t.nama_bro || t.bro_name || '').trim();
      if (bro && bro !== '-') {
        if (!seenBros.has(bro)) {
          seenBros.add(bro);
          bros.push(bro);
        }
      }
    });

    return { cmds, customers, plates, bros };
  }, [transactions]);

  const getSuggestions = (field: 'no_cmd' | 'customer_name' | 'license_plate' | 'nama_bro', query: string) => {
    let list: string[] = [];
    if (field === 'no_cmd') list = historicalData.cmds;
    else if (field === 'customer_name') list = historicalData.customers;
    else if (field === 'license_plate') list = historicalData.plates;
    else if (field === 'nama_bro') list = historicalData.bros;

    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return list.slice(0, 5);
    }

    const exactStarts: string[] = [];
    const wordStarts: string[] = [];
    const otherMatches: string[] = [];

    list.forEach(item => {
      const itemLower = item.toLowerCase();
      if (itemLower.startsWith(q)) {
        exactStarts.push(item);
      } else {
        const words = itemLower.split(/[\s-]+/);
        if (words.some(w => w.startsWith(q))) {
          wordStarts.push(item);
        } else if (itemLower.includes(q)) {
          otherMatches.push(item);
        }
      }
    });

    exactStarts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    wordStarts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return [...exactStarts, ...wordStarts, ...otherMatches].slice(0, 8);
  };

  const handleSelectSuggestion = (field: 'no_cmd' | 'customer_name' | 'license_plate' | 'nama_bro', val: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: val };
      
      // Auto-fill convenience: If picking a plate and customer is empty, fill customer from historical match
      if (field === 'license_plate' && (!prev.customer_name || !prev.customer_name.trim())) {
        const matchTx = transactions.find(t => (t.license_plate || '').trim().toUpperCase() === val.toUpperCase());
        if (matchTx && matchTx.customer_name && matchTx.customer_name !== '-') {
          updated.customer_name = matchTx.customer_name.trim();
        }
      }
      return updated;
    });
    setActiveAutocompleteField(null);
  };

  const renderHighlightedText = (text: string, query: string) => {
    if (!query || !query.trim()) return <span>{text}</span>;
    const q = query.trim();
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerText.indexOf(lowerQ);
    if (idx === -1) return <span>{text}</span>;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);

    return (
      <span>
        {before}
        <span className="text-blue-700 font-extrabold bg-blue-100/90 px-0.5 rounded underline decoration-blue-400">{match}</span>
        {after}
      </span>
    );
  };

  const renderAutocompleteDropdown = (
    field: 'no_cmd' | 'customer_name' | 'license_plate' | 'nama_bro',
    query: string
  ) => {
    const suggestions = getSuggestions(field, query);
    if (suggestions.length === 0) return null;

    const fieldLabels: Record<string, string> = {
      no_cmd: 'No. CMD',
      customer_name: 'Customer',
      license_plate: 'No. Polisi',
      nama_bro: 'Nama BRO'
    };

    return (
      <div 
        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-blue-200/90 shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="px-3.5 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 bg-slate-50/90">
          <span className="flex items-center gap-1.5 text-blue-700">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            Riwayat {fieldLabels[field]} ({suggestions.length})
          </span>
          <span className="text-[9px] text-slate-400 font-normal">Klik untuk pilih</span>
        </div>
        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(field, item);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/90 transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2 overflow-hidden pr-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className={`text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate ${field === 'license_plate' || field === 'no_cmd' ? 'font-mono' : ''}`}>
                  {renderHighlightedText(item, query)}
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                Pilih
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Synchronize incoming Dashboard filter if provided
  useEffect(() => {
    if (activeDashboardFilter) {
      if (activeDashboardFilter.category) {
        const cats = activeDashboardFilter.category.split(',').map(c => c.trim()).filter(Boolean);
        setSelectedCategories(cats);
      } else {
        setSelectedCategories([]);
      }

      if (activeDashboardFilter.branch) {
        const branches = activeDashboardFilter.branch.split(',').map(b => b.trim()).filter(Boolean);
        setSelectedBranches(branches);
      } else {
        setSelectedBranches([]);
      }

      if (activeDashboardFilter.statusPayment) {
        const payments = activeDashboardFilter.statusPayment.split(',').map(p => p.trim()).filter(Boolean);
        setSelectedPaymentStatuses(payments);
      } else {
        setSelectedPaymentStatuses([]);
      }

      if (activeDashboardFilter.statusConfirm) {
        const handovers = activeDashboardFilter.statusConfirm.split(',').map(h => h.trim()).filter(Boolean);
        setSelectedHandoverStatuses(handovers);
      } else {
        setSelectedHandoverStatuses([]);
      }

      setSelectedApprovalStatuses([]);

      setStartDate(activeDashboardFilter.startDate || '');
      setEndDate(activeDashboardFilter.endDate || '');
      setSearchQuery(activeDashboardFilter.customerName || '');

      if (activeDashboardFilter.statusSap) {
        const saps = activeDashboardFilter.statusSap.split(',').map(s => s.trim()).filter(Boolean);
        setSelectedSapStatuses(saps);
      } else {
        setSelectedSapStatuses([]);
      }

      if (activeDashboardFilter.stage) {
        if (activeDashboardFilter.stage === '1_in_aso' || activeDashboardFilter.stage === '1_handover') {
          setSelectedProcessStages(['Menunggu Serah Terima Berkas']);
        } else if (activeDashboardFilter.stage === '2_at_admin' || activeDashboardFilter.stage === '2_confirm') {
          setSelectedProcessStages(['Berkas di Admin (Belum Selesai Approval)']);
        } else if (activeDashboardFilter.stage === '3_sap_sh') {
          setSelectedProcessStages(['Belum Approve SH']);
        } else if (activeDashboardFilter.stage === '3_sap_kacab') {
          setSelectedProcessStages(['Belum Approve KACAB']);
        } else if (activeDashboardFilter.stage === '3_sap_rh') {
          setSelectedProcessStages(['Belum Approve RH']);
        } else if (activeDashboardFilter.stage === '3_sap_dh') {
          setSelectedProcessStages(['Belum Approve DH']);
        } else if (activeDashboardFilter.stage === '4_invoice') {
          setSelectedProcessStages(['Menunggu Cetak & Kirim Invoice']);
        } else if (activeDashboardFilter.stage === '5_payment') {
          setSelectedProcessStages(['Menunggu Pelunasan Backcharge']);
        } else if (activeDashboardFilter.stage === '6_reject' || activeDashboardFilter.stage === 'Dokumen Ditolak (Reject)') {
          setSelectedProcessStages(['Dokumen Ditolak (Reject)']);
        } else {
          setSelectedProcessStages([activeDashboardFilter.stage]);
        }
      } else {
        setSelectedProcessStages([]);
      }
      setCurrentPage(1);
    }
  }, [activeDashboardFilter]);

  // Synchronize incoming Alert filter
  useEffect(() => {
    if (activeAlertFilter) {
      setCurrentPage(1);
    }
  }, [activeAlertFilter]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Branch authorization check
      if (userBranches && userBranches.length > 0 && !isNationalOrAllBranches(currentUser?.branch, currentUser?.role)) {
        const branchAllowed = userBranches.some(ub => ub.toLowerCase() === (t.branch || '').toLowerCase());
        if (!branchAllowed) return false;
      }

      // 2. Branch selector filter (multi-select)
      if (selectedBranches.length > 0) {
        const matchesBranch = selectedBranches.some(b => b.toLowerCase() === (t.branch || '').toLowerCase());
        if (!matchesBranch) return false;
      }

      // 3. Category filter (multi-select)
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(t.category)) {
          return false;
        }
      }

      // 4. Payment status filter (multi-select)
      if (selectedPaymentStatuses.length > 0) {
        const currentPay = t.status_payment || 'Belum Bayar';
        if (!selectedPaymentStatuses.includes(currentPay)) {
          return false;
        }
      }

      // 5. Approval status filter (multi-select)
      if (selectedApprovalStatuses.length > 0) {
        const apprSummary = getApprovalSummary(t);
        const matchesApproval = selectedApprovalStatuses.some(status => {
          if (status === 'Disetujui') {
            return apprSummary.isFullyApproved;
          }
          if (status === 'Ditolak') {
            return apprSummary.isRejected;
          }
          if (status === 'Belum Approval') {
            return !apprSummary.isFullyApproved && !apprSummary.isRejected;
          }
          return false;
        });
        if (!matchesApproval) return false;
      }

      // 6. Handover status filter (multi-select)
      if (selectedHandoverStatuses.length > 0) {
        const effectiveHandover = (t.status_handover === 'Diserahkan ke Admin') ? 'Diterima Admin' : (t.status_handover || 'Pending');
        if (!selectedHandoverStatuses.includes(effectiveHandover)) {
          return false;
        }
      }

      // 7. SAP status filter (multi-select)
      if (selectedSapStatuses.length > 0) {
        const effectiveSap = t.status_sap || 'N/A';
        if (!selectedSapStatuses.includes(effectiveSap)) {
          return false;
        }
      }

      // 8. Process Stage filter (multi-select)
      if (selectedProcessStages.length > 0) {
        const stage = getTransactionStage(t);
        const matchesStage = selectedProcessStages.some(selStage => {
          if (
            selStage === 'Berkas di Admin' || 
            selStage === 'Berkas di Admin (Belum Selesai Approval)' ||
            selStage === '2_confirm' ||
            selStage === '2_at_admin'
          ) {
            return [
              'Berkas di Admin',
              'Berkas di Admin (Belum Selesai Approval)',
              'Belum Approve SH',
              'Belum Approve KACAB',
              'Belum Approve RH',
              'Belum Approve DH'
            ].includes(stage);
          }
          return stage === selStage;
        });
        if (!matchesStage) return false;
      }

      // 9. Date Range filter
      const txDate = t.tanggal || (t.created_at ? t.created_at.split('T')[0] : '');
      if (startDate && txDate && txDate < startDate) return false;
      if (endDate && txDate && txDate > endDate) return false;

      // 10. Alert filter
      if (activeAlertFilter === 'high_value') {
        if ((t.value || 0) < 15000000) return false;
      } else if (activeAlertFilter === 'pending') {
        const isPending = t.status_handover === 'Pending' || t.status_payment === 'Belum Bayar' || !getApprovalSummary(t).isFullyApproved;
        if (!isPending) return false;
      } else if (activeAlertFilter === 'due') {
        if (t.status_payment === 'Lunas') return false;
        const dStr = t.tanggal || t.created_at;
        if (dStr) {
          const ageDays = Math.floor((Date.now() - new Date(dStr).getTime()) / (1000 * 60 * 60 * 24));
          if (ageDays < 30) return false;
        }
      }

      // 11. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = (t.id || '').toLowerCase().includes(q);
        const matchCust = (t.customer_name || '').toLowerCase().includes(q);
        const matchPlate = (t.license_plate || '').toLowerCase().includes(q);
        const matchBak = (t.no_bak || '').toLowerCase().includes(q);
        const matchSpk = (t.no_spk || '').toLowerCase().includes(q);
        const matchSap = (t.no_sap || '').toLowerCase().includes(q);
        const matchTilang = (t.no_tilang || '').toLowerCase().includes(q);
        const matchCmd = (t.no_cmd || '').toLowerCase().includes(q);
        const matchInvoice = (t.no_invoice || '').toLowerCase().includes(q);
        const matchBro = (t.nama_bro || t.bro_name || '').toLowerCase().includes(q);
        const matchBranch = (t.branch || '').toLowerCase().includes(q);

        if (!matchId && !matchCust && !matchPlate && !matchBak && !matchSpk && !matchSap && !matchTilang && !matchCmd && !matchInvoice && !matchBro && !matchBranch) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    userBranches,
    currentUser,
    selectedBranches,
    selectedCategories,
    selectedPaymentStatuses,
    selectedApprovalStatuses,
    selectedHandoverStatuses,
    selectedSapStatuses,
    selectedProcessStages,
    startDate,
    endDate,
    activeAlertFilter,
    searchQuery
  ]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredTransactions, sortField, sortDirection]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);


  // Sorting Handler
  const handleSort = (field: keyof Backcharge) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Selection handlers
  const handleSelectAllOnPage = () => {
    const pageIds = paginatedTransactions.map(t => t.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredTransactions.map(t => t.id);
    setSelectedIds(new Set(allIds));
    if (addToast) addToast(`Semua ${allIds.length} data terpilih!`, 'info');
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Active filters count for badge display
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedBranches.length > 0) count += selectedBranches.length;
    if (startDate || endDate) count++;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedPaymentStatuses.length > 0) count += selectedPaymentStatuses.length;
    if (selectedApprovalStatuses.length > 0) count += selectedApprovalStatuses.length;
    if (selectedHandoverStatuses.length > 0) count += selectedHandoverStatuses.length;
    if (selectedSapStatuses.length > 0) count += selectedSapStatuses.length;
    if (selectedProcessStages.length > 0) count += selectedProcessStages.length;
    return count;
  }, [
    searchQuery,
    selectedBranches,
    startDate,
    endDate,
    selectedCategories,
    selectedPaymentStatuses,
    selectedApprovalStatuses,
    selectedHandoverStatuses,
    selectedSapStatuses,
    selectedProcessStages
  ]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBranches([]);
    setSelectedCategories([]);
    setSelectedPaymentStatuses([]);
    setSelectedApprovalStatuses([]);
    setSelectedHandoverStatuses([]);
    setSelectedSapStatuses([]);
    setSelectedProcessStages([]);
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    if (onClearAlertFilter) onClearAlertFilter();
    if (onClearDashboardFilter) onClearDashboardFilter();
  };

  // EXCEL EXPORT (Comprehensive, Beautiful, and Formatted)
  const handleExportExcel = async () => {
    try {
      if (addToast) addToast('Menyiapkan file Rekap Excel lengkap...', 'info');

      const dataToExport = selectedIds.size > 0 
        ? sortedTransactions.filter(t => selectedIds.has(t.id))
        : sortedTransactions;

      if (dataToExport.length === 0) {
        if (addToast) addToast('Tidak ada data untuk diekspor.', 'error');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ASSA Rent Backcharge Workflow System';
      workbook.lastModifiedBy = currentUser?.full_name || 'ASSA Rent';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Rekap Backcharge Nasional', {
        views: [{ state: 'frozen', ySplit: 8, xSplit: 2 }]
      });

      // 1. BANNER HEADER
      worksheet.mergeCells('A1:AC1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = 'PT ADIRA SARANA ARMADA TBK (ASSA RENT) - REKAPITULASI BACKCHARGE NASIONAL';
      titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' } // Dark Navy
      };
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // 2. METADATA BLOCK
      const nowStr = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';

      worksheet.getCell('A3').value = 'Tanggal Unduh:';
      worksheet.getCell('B3').value = nowStr;
      worksheet.getCell('A4').value = 'Diunduh Oleh:';
      worksheet.getCell('B4').value = `${currentUser?.full_name || 'User'} (${currentUser?.role || '-'} - ${currentUser?.branch || 'Nasional'})`;
      worksheet.getCell('A5').value = 'Total Transaksi:';
      worksheet.getCell('B5').value = `${dataToExport.length} Data`;
      worksheet.getCell('A6').value = 'Total Nilai:';
      worksheet.getCell('B6').value = formatCurrency(dataToExport.reduce((sum, t) => sum + (Number(t.value) || 0), 0));

      ['A3', 'A4', 'A5', 'A6'].forEach(cellId => {
        worksheet.getCell(cellId).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
      });
      ['B3', 'B4', 'B5', 'B6'].forEach(cellId => {
        worksheet.getCell(cellId).font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF0F172A' } };
      });

      // 3. TABLE COLUMN DEFINITIONS
      const columnsConfig = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'ID Transaksi', key: 'id', width: 16 },
        { header: 'Tanggal', key: 'tanggal', width: 14 },
        { header: 'Cabang Otoritas', key: 'branch', width: 18 },
        { header: 'Kategori Backcharge', key: 'category', width: 20 },
        { header: 'Nama CUSTOMER', key: 'customer_name', width: 28 },
        { header: 'No. CMD', key: 'no_cmd', width: 16 },
        { header: 'No. Polisi', key: 'license_plate', width: 14 },
        { header: 'Nilai Nominal (Rp)', key: 'value', width: 18 },
        { header: 'No. BAK', key: 'no_bak', width: 18 },
        { header: 'No. SPK', key: 'no_spk', width: 18 },
        { header: 'No. SAP', key: 'no_sap', width: 16 },
        { header: 'No. Tilang / ETLE', key: 'no_tilang', width: 18 },
        { header: 'Nama Penginput', key: 'penginput', width: 22 },
        { header: 'Nama BRO', key: 'nama_bro', width: 20 },
        { header: 'Status SAP', key: 'status_sap', width: 14 },
        { header: 'Status Konfirmasi', key: 'status_confirm', width: 20 },
        { header: 'Status Serah Terima', key: 'status_handover', width: 22 },
        { header: 'Tanggal Serah Terima', key: 'tanggal_handover', width: 18 },
        { header: 'Status Approval Tier 1', key: 'status_approval', width: 20 },
        { header: 'Disetujui Oleh (Tier 1)', key: 'approved_by', width: 24 },
        { header: 'Waktu Approval Tier 1', key: 'approved_at', width: 20 },
        { header: 'Catatan Approval Tier 1', key: 'approval_note', width: 26 },
        { header: 'Status Approval RH', key: 'regional_approval_status', width: 20 },
        { header: 'Disetujui Oleh RH', key: 'regional_approved_by', width: 24 },
        { header: 'Status Approval DH', key: 'division_approval_status', width: 20 },
        { header: 'Disetujui Oleh DH', key: 'division_approved_by', width: 24 },
        { header: 'No. Invoice', key: 'no_invoice', width: 18 },
        { header: 'Status Pembayaran', key: 'status_payment', width: 18 },
        { header: 'Tanggal Pembayaran', key: 'payment_date', width: 18 },
        { header: 'Catatan / Alasan', key: 'alasan', width: 30 }
      ];

      const headerRowIndex = 8;
      const headerRow = worksheet.getRow(headerRowIndex);
      headerRow.height = 26;

      columnsConfig.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' } // Royal Blue
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        worksheet.getColumn(idx + 1).width = col.width;
      });

      // 4. POPULATE DATA ROWS
      dataToExport.forEach((tx, index) => {
        const rowIndex = headerRowIndex + 1 + index;
        const row = worksheet.getRow(rowIndex);
        row.height = 20;

        const isZebra = index % 2 === 1;
        const rowBgColor = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

        const rowValues = [
          index + 1,
          tx.id || '-',
          tx.tanggal || formatDate(tx.created_at),
          tx.branch || '-',
          tx.category || '-',
          tx.customer_name || '-',
          tx.no_cmd || '-',
          tx.license_plate || '-',
          Number(tx.value) || 0,
          tx.no_bak || '-',
          tx.no_spk || '-',
          tx.no_sap || '-',
          tx.no_tilang || '-',
          getCreatorName(tx.created_by),
          tx.nama_bro || tx.bro_name || '-',
          tx.status_sap || 'N/A',
          tx.status_confirm || 'Belum Konfirmasi',
          tx.status_handover || 'Pending',
          tx.tanggal_handover || '-',
          tx.status_approval || 'Belum Approval',
          tx.approved_by || '-',
          tx.approved_at ? formatDate(tx.approved_at) : '-',
          tx.approval_note || '-',
          tx.regional_approval_status || 'Belum Approval',
          tx.regional_approved_by || '-',
          tx.division_approval_status || 'Belum Approval',
          tx.division_approved_by || '-',
          tx.no_invoice || '-',
          tx.status_payment || 'Belum Bayar',
          tx.payment_date ? formatDate(tx.payment_date) : '-',
          tx.alasan || tx.dok_pendukung_alasan || '-'
        ];

        rowValues.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBgColor }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alignment & format specs
          if (colIdx === 0) { // No
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colIdx === 1) { // ID
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Courier New', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
          } else if (colIdx === 2) { // Tanggal
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colIdx === 7) { // Nilai
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0';
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colIdx === 26) { // Status Bayar
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            if (val === 'Lunas') {
              cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
            } else {
              cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFE11D48' } };
            }
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      // 5. SUMMARY ROW AT BOTTOM
      const lastDataRow = headerRowIndex + dataToExport.length;
      const totalRowIndex = lastDataRow + 1;
      const totalRow = worksheet.getRow(totalRowIndex);
      totalRow.height = 24;

      worksheet.mergeCells(`A${totalRowIndex}:G${totalRowIndex}`);
      const labelCell = worksheet.getCell(`A${totalRowIndex}`);
      labelCell.value = 'TOTAL KESELURUHAN';
      labelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'center' };

      const valueCell = worksheet.getCell(`H${totalRowIndex}`);
      valueCell.value = {
        formula: `SUM(H${headerRowIndex + 1}:H${lastDataRow})`,
        result: dataToExport.reduce((sum, t) => sum + (Number(t.value) || 0), 0)
      };
      valueCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      valueCell.numFmt = '#,##0';
      valueCell.alignment = { vertical: 'middle', horizontal: 'right' };

      for (let c = 1; c <= columnsConfig.length; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' }
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F172A' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      }

      // 6. GENERATE BLOB & DOWNLOAD
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const nowFormatted = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
      const filename = `Rekap_Backcharge_ASSA_Nasional_${nowFormatted}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      if (addToast) addToast(`Rekap Excel berhasil diunduh (${dataToExport.length} data)!`, 'success');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      // SheetJS Fallback
      try {
        const fallbackData = sortedTransactions.map((tx, idx) => ({
          'No': idx + 1,
          'ID Transaksi': tx.id,
          'Tanggal': tx.tanggal || formatDate(tx.created_at),
          'Cabang': tx.branch,
          'Kategori': tx.category,
          'Nama CUSTOMER': tx.customer_name,
          'No. Polisi': tx.license_plate,
          'Nilai (Rp)': tx.value,
          'No. BAK': tx.no_bak,
          'No. SPK': tx.no_spk,
          'No. SAP': tx.no_sap,
          'No. Tilang': tx.no_tilang || '-',
          'Nama BRO': tx.nama_bro || tx.bro_name || '-',
          'Status SAP': tx.status_sap,
          'Status Konfirmasi': tx.status_confirm,
          'Status Serah Terima': tx.status_handover,
          'Status Approval': getApprovalText(tx),
          'No. Invoice': tx.no_invoice,
          'Status Pembayaran': tx.status_payment,
          'Tanggal Pembayaran': tx.payment_date || '-',
          'Alasan': tx.alasan || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(fallbackData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Backcharge');
        XLSX.writeFile(wb, `Rekap_Backcharge_${Date.now()}.xlsx`);
        if (addToast) addToast('Rekap Excel diekspor via modul standar.', 'success');
      } catch (fallbackErr: any) {
        if (addToast) addToast(`Gagal export Excel: ${err.message}`, 'error');
      }
    }
  };

  // EXCEL IMPORT WORKFLOW
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ASSA Rent Backcharge Workflow System';
      workbook.lastModifiedBy = currentUser?.full_name || 'ASSA Rent';
      workbook.created = new Date();
      workbook.modified = new Date();

      // SHEET 1: Template Backcharge
      const wsTemplate = workbook.addWorksheet('Template Backcharge', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      // Headers corresponding to image_b5f6bef6.png
      const headers = [
        'Tanggal',
        'Kategori',
        'Cabang',
        'No CMD',
        'Nama Customer',
        'No Polisi',
        'Nilai Backcharge',
        'No BAK',
        'No SPK',
        'No Tilang',
        'PIC/BRO',
        'Alasan',
        'Tahap Proses',
        'No Invoice',
        'Status Bayar',
        'Status SAP (Bill/Not Bill/NA)'
      ];

      wsTemplate.addRow(headers);

      // Header row styling - dark navy #1A2234 / #0F172A with white bold text
      const headerRow = wsTemplate.getRow(1);
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A2332' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Sample Data Row 1 (matching Petunjuk & image_666936b0.png)
      wsTemplate.addRow([
        '2026-09-13',
        'Own Risk',
        'BSO Sunter',
        '2001874',
        'PT Mitra Bahagia Sejahtera',
        'B-1234-ABC',
        5000000,
        'BAK/2026/09/001',
        'SPK-12345',
        'TLG-001',
        'Budi Santoso',
        'Klaim perbaikan bodi penyok akibat senggolan',
        'Menunggu Serah Terima Berkas',
        'INV-2026-001',
        'Belum Bayar',
        'Bill'
      ]);

      // Sample Data Row 2
      wsTemplate.addRow([
        '2026-09-14',
        'Maintenance',
        'Bandung',
        '2001875',
        'PT Global Transport',
        'D-5678-XYZ',
        3500000,
        'BAK/2026/09/002',
        'SPK-12346',
        '-',
        'Ahmad Fauzi',
        'Penggantian ban dan servis berkala',
        'Menunggu Cetak & Kirim Invoice',
        'INV-2026-002',
        'Lunas',
        'Bill'
      ]);

      // Column widths for Sheet 1
      wsTemplate.columns = [
        { width: 15 }, // Tanggal
        { width: 18 }, // Kategori
        { width: 18 }, // Cabang
        { width: 15 }, // No CMD
        { width: 30 }, // Nama Customer
        { width: 16 }, // No Polisi
        { width: 18 }, // Nilai Backcharge
        { width: 22 }, // No BAK
        { width: 18 }, // No SPK
        { width: 16 }, // No Tilang
        { width: 20 }, // PIC/BRO
        { width: 38 }, // Alasan
        { width: 30 }, // Tahap Proses
        { width: 18 }, // No Invoice
        { width: 16 }, // Status Bayar
        { width: 26 }  // Status SAP
      ];

      // Format data rows
      for (let r = 2; r <= 3; r++) {
        const row = wsTemplate.getRow(r);
        row.height = 24;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNumber === 7) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      }

      // Add Data Validations to Sheet 1 (Rows 2 to 200)
      const catList = '"Own Risk,Maintenance,Ekspedisi,ETLE,TPL,Unclaimable Insurance,Dokumen Kendaraan"';
      const branchList = `"${ALL_SYSTEM_BRANCHES.slice(0, 20).join(',')}"`;
      const stageList = `"${PROCESS_STAGES.join(',')}"`;
      const paymentList = '"Belum Bayar,Lunas"';
      const sapList = '"Bill,Not Bill,N/A"';

      if ((wsTemplate as any).dataValidations && typeof (wsTemplate as any).dataValidations.add === 'function') {
        (wsTemplate as any).dataValidations.add('B2:B500', { type: 'list', allowBlank: true, formulae: [catList] });
        (wsTemplate as any).dataValidations.add('C2:C500', { type: 'list', allowBlank: true, formulae: [branchList] });
        (wsTemplate as any).dataValidations.add('M2:M500', { type: 'list', allowBlank: true, formulae: [stageList] });
        (wsTemplate as any).dataValidations.add('O2:O500', { type: 'list', allowBlank: true, formulae: [paymentList] });
        (wsTemplate as any).dataValidations.add('P2:P500', { type: 'list', allowBlank: true, formulae: [sapList] });
      }

      for (let r = 2; r <= 100; r++) {
        wsTemplate.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [catList] };
        wsTemplate.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [branchList] };
        wsTemplate.getCell(`M${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [stageList] };
        wsTemplate.getCell(`O${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [paymentList] };
        wsTemplate.getCell(`P${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [sapList] };
      }

      // SHEET 2: Petunjuk & Contoh Pengisian
      const wsGuide = workbook.addWorksheet('Petunjuk & Contoh Pengisian');

      // Title
      wsGuide.getCell('A1').value = 'PETUNJUK PENGISIAN TEMPLATE IMPORT BACKCHARGE';
      wsGuide.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E40AF' } };
      wsGuide.getRow(1).height = 28;

      // Table Header Row at Row 3
      const guideHeaders = ['No', 'Nama Kolom', 'Keterangan Pengisian', 'Contoh / Opsi Valid'];
      const guideHeaderRow = wsGuide.getRow(3);
      guideHeaderRow.values = guideHeaders;
      guideHeaderRow.height = 28;
      guideHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563EB' } // Bright Blue
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
          left: { style: 'thin', color: { argb: 'FF1D4ED8' } },
          bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
          right: { style: 'thin', color: { argb: 'FF1D4ED8' } }
        };
      });

      // Guide items matching image_666936b0.png
      const guideRows = [
        [1, 'Tanggal', 'Format tanggal transaksi', '2026-09-13 atau 13/09/2026'],
        [2, 'Kategori', 'Pilih dari Dropdown Kategori', 'Own Risk, Maintenance, Ekspedisi, ETLE, TPL, Unclaimable Insurance, Dokumen Kendaraan'],
        [3, 'Cabang', 'Pilih dari Dropdown Cabang', 'BSO Sunter, Bandung, Surabaya, dll.'],
        [4, 'No. CMD', 'Nomor CMD atas Customer', '2001874'],
        [5, 'Nama Customer', 'Nama PT / Customer penanggung', 'PT Mitra Bahagia Sejahtera'],
        [6, 'No Polisi', 'Nomor polisi kendaraan terkait', 'B-1234-ABC'],
        [7, 'Nilai Backcharge', 'Nominal biaya dalam rupiah (angka saja)', '5000000'],
        [8, 'No BAK', 'Nomor Berita Acara Kerusakan (jika ada)', 'BAK/2026/09/001 (isi "-" jika tidak ada)'],
        [9, 'No SPK', 'Nomor Surat Perintah Kerja (jika ada)', 'SPK-12345 (isi "-" jika tidak ada)'],
        [10, 'No Tilang', 'Nomor tilang (khusus kategori ETLE)', 'TLG-001 (isi "-" jika tidak ada)'],
        [11, 'PIC', 'Nama BRO / Broker / PIC pengaju', 'Budi Santoso'],
        [12, 'Alasan', 'Rincian / alasan timbulnya klaim', 'Klaim perbaikan bodi penyok akibat senggolan'],
        [13, 'Tahap Proses', 'Pilih dari Dropdown Tahap Proses', PROCESS_STAGES.join(', ')],
        [14, 'No Invoice', 'Nomor invoice billing (jika sudah dicetak)', 'INV-2026-001 (isi "-" jika belum ada)'],
        [15, 'Status Bayar', 'Pilih dari Dropdown Status Bayar', 'Belum Bayar / Lunas'],
        [16, 'Status SAP', 'Pilih dari Dropdown Status SAP', 'Bill / Not Bill / N/A']
      ];

      guideRows.forEach((r) => {
        const addedRow = wsGuide.addRow(r);
        addedRow.height = 24;
        addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNumber === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 2) {
            cell.font = { name: 'Arial', size: 9.5, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      // Guide column widths
      wsGuide.columns = [
        { width: 8 },  // No
        { width: 22 }, // Nama Kolom
        { width: 42 }, // Keterangan Pengisian
        { width: 85 }  // Contoh / Opsi Valid
      ];

      // Download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Template_Import_Massal_Backcharge.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      if (addToast) addToast('Template Excel resmi berhasil diunduh (2 Sheet: Template Backcharge & Petunjuk Pengisian).', 'success');
    } catch (err: any) {
      console.error('Failed to download template:', err);
      if (addToast) addToast(`Gagal mengunduh template: ${err.message}`, 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });

        // Target 'Template Backcharge' sheet or first sheet
        const targetSheetName = wb.SheetNames.find((name: string) => {
          const n = name.trim().toLowerCase();
          return n.includes('template') || n.includes('backcharge') || n.includes('data');
        }) || wb.SheetNames[0];

        const ws = wb.Sheets[targetSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
          setImportErrors(['File Excel kosong atau tidak terbaca.']);
          return;
        }

        const parsedItems: any[] = [];
        const errs: string[] = [];

        rawJson.forEach((row, index) => {
          const rowNum = index + 2;
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
              if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
            }
            return '';
          };

          const getRawVal = (keys: string[]) => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
              if (found && row[found] !== undefined && row[found] !== '') return row[found];
            }
            return '';
          };

          const customerRaw = getVal(['nama customer', 'customer', 'customer name', 'nama pelanggan', 'pelanggan']);
          const plateRaw = getVal(['no polisi', 'no. polisi', 'plat', 'license plate', 'nopol']);
          const valueRaw = getVal(['nilai backcharge', 'nilai', 'nominal', 'value', 'jumlah', 'biaya']);
          const cmdRaw = getVal(['no cmd', 'no. cmd', 'cmd', 'nomor cmd']);
          const categoryRaw = getVal(['kategori', 'category', 'jenis']);
          const branchRaw = getVal(['cabang', 'branch', 'cabang otoritas']);

          if (!customerRaw && !plateRaw && !valueRaw) {
            // Empty row, skip
            return;
          }

          if (!customerRaw) {
            errs.push(`Baris ${rowNum}: Nama CUSTOMER wajib diisi.`);
            return;
          }

          // Category normalization
          let category: BackchargeCategory = 'Own Risk';
          const catLower = categoryRaw.toLowerCase();
          if (catLower.includes('maintenance')) category = 'Maintenance';
          else if (catLower.includes('ekspedisi')) category = 'Ekspedisi';
          else if (catLower.includes('etle') || catLower.includes('tilang')) category = 'ETLE';
          else if (catLower.includes('tpl')) category = 'TPL';
          else if (catLower.includes('unclaim')) category = 'Unclaimable Insurance';
          else if (catLower.includes('dokumen')) category = 'Dokumen Kendaraan';

          // Branch normalization
          let branch = branchRaw;
          if (!branch || !ALL_SYSTEM_BRANCHES.includes(branch)) {
            branch = userBranches[0] || 'Bandung';
          }

          const parsedVal = Number(String(valueRaw).replace(/[^0-9.-]+/g, '')) || 0;

          // Stage mapping to system fields
          const tahapRaw = (getVal(['tahap proses', 'tahap', 'stage']) || '').trim().toLowerCase();
          let statusHandover = 'Diterima Admin';
          let statusApproval = 'Belum Approval';
          let regionalApprovalStatus = 'Belum Approval';
          let divisionApprovalStatus = 'Belum Approval';
          let statusPayment = getVal(['status bayar', 'status pembayaran', 'status payment']) || 'Belum Bayar';

          if (tahapRaw.includes('serah terima') || tahapRaw.includes('menunggu serah')) {
            statusHandover = 'Pending';
            statusApproval = 'Belum Approval';
          } else if (tahapRaw.includes('berkas di admin')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Belum Approval';
          } else if (tahapRaw.includes('belum approve sh') || tahapRaw.includes('approve sh')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Belum Approval';
          } else if (tahapRaw.includes('belum approve kacab') || tahapRaw.includes('approve kacab')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Belum Approval';
          } else if (tahapRaw.includes('belum approve rh') || tahapRaw.includes('approve rh')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Disetujui';
            regionalApprovalStatus = 'Belum Approval';
          } else if (tahapRaw.includes('belum approve dh') || tahapRaw.includes('approve dh')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Disetujui';
            regionalApprovalStatus = 'Disetujui';
            divisionApprovalStatus = 'Belum Approval';
          } else if (tahapRaw.includes('cetak & kirim invoice') || tahapRaw.includes('menunggu cetak') || tahapRaw.includes('blm invoice')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Disetujui';
            regionalApprovalStatus = 'Disetujui';
            divisionApprovalStatus = 'Disetujui';
          } else if (tahapRaw.includes('menunggu pelunasan')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Disetujui';
            regionalApprovalStatus = 'Disetujui';
            divisionApprovalStatus = 'Disetujui';
            statusPayment = 'Belum Bayar';
          } else if (tahapRaw.includes('lunas') || tahapRaw.includes('selesai')) {
            statusHandover = 'Diterima Admin';
            statusApproval = 'Disetujui';
            regionalApprovalStatus = 'Disetujui';
            divisionApprovalStatus = 'Disetujui';
            statusPayment = 'Lunas';
          } else if (tahapRaw.includes('reject') || tahapRaw.includes('ditolak')) {
            statusApproval = 'Ditolak';
          }

          if (getVal(['status bayar', 'status pembayaran']).toLowerCase() === 'lunas') {
            statusPayment = 'Lunas';
          }

          let statusSap = getVal(['status sap (bill/not bill/na)', 'status sap', 'sap status']) || 'Bill';
          if (statusSap.toLowerCase().includes('not bill')) statusSap = 'Not Bill';
          else if (statusSap.toLowerCase().includes('n/a') || statusSap.toLowerCase() === 'na') statusSap = 'N/A';
          else if (statusSap.toLowerCase().includes('bill')) statusSap = 'Bill';

          parsedItems.push({
            category,
            branch,
            no_cmd: cmdRaw || '-',
            customer_name: customerRaw,
            license_plate: plateRaw || '-',
            value: parsedVal,
            no_bak: getVal(['no bak', 'no. bak', 'bak']) || '-',
            no_spk: getVal(['no spk', 'no. spk', 'spk']) || '-',
            no_sap: getVal(['no sap', 'no. sap', 'sap']) || '-',
            no_tilang: getVal(['no tilang', 'no. tilang', 'tilang']) || '-',
            nama_bro: getVal(['pic/bro', 'pic / bro', 'pic', 'nama bro', 'bro']) || '-',
            bro_name: getVal(['pic/bro', 'pic / bro', 'pic', 'nama bro', 'bro']) || '-',
            tanggal: parseExcelDate(getRawVal(['tanggal', 'date', 'tgl'])),
            status_sap: statusSap,
            status_confirm: getVal(['status konfirmasi', 'status confirm']) || 'Belum Konfirmasi',
            status_handover: statusHandover,
            status_approval: statusApproval,
            regional_approval_status: regionalApprovalStatus,
            division_approval_status: divisionApprovalStatus,
            status_payment: statusPayment,
            no_invoice: getVal(['no invoice', 'no. invoice', 'invoice']) || '-',
            alasan: getVal(['alasan', 'keterangan', 'catatan', 'alasan timbulnya klaim']) || '-'
          });
        });

        setImportErrors(errs);
        setImportPreview(parsedItems);
      } catch (err: any) {
        setImportErrors([`Gagal memproses file: ${err.message}`]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setIsSubmitting(true);
    setImportProgress({ current: 0, total: importPreview.length, percent: 0 });
    try {
      await onBulkAddTransactions(importPreview, (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        setImportProgress({ current, total, percent });
      });
      setIsImportModalOpen(false);
      setImportPreview([]);
      setImportErrors([]);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      if (addToast) addToast(`Gagal import: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setImportProgress(null);
    }
  };

  // ADD / EDIT FORM SUBMISSIONS
  const handleOpenAdd = () => {
    setActiveAutocompleteField(null);
    setFormData({
      ...initialFormState,
      branch: userBranches[0] || 'Bandung'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (tx: Backcharge) => {
    setActiveAutocompleteField(null);
    setEditingTransaction(tx);
    setEditingFiles({ bak: null, supporting: null, handover: null });
    if (editFileInputRef.current) editFileInputRef.current.value = '';
    setFormData({
      category: tx.category,
      branch: tx.branch,
      customer_name: tx.customer_name,
      license_plate: tx.license_plate,
      value: tx.value,
      no_bak: tx.no_bak || '',
      no_spk: tx.no_spk || '',
      no_cmd: tx.no_cmd || '',
      no_sap: tx.no_sap || '',
      no_tilang: tx.no_tilang || '',
      nama_bro: tx.nama_bro || tx.bro_name || '',
      tanggal: tx.tanggal || (tx.created_at ? tx.created_at.split('T')[0] : ''),
      status_sap: tx.status_sap || 'N/A',
      status_confirm: tx.status_confirm || 'Belum Konfirmasi',
      status_handover: tx.status_handover || 'Pending',
      status_payment: tx.status_payment || 'Belum Bayar',
      no_invoice: tx.no_invoice || '',
      payment_date: tx.payment_date || '',
      alasan: tx.alasan || tx.dok_pendukung_alasan || ''
    });
    setIsEditModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.branch || !formData.branch.trim()) {
      if (addToast) addToast('Cabang Kota / BSO wajib diisi!', 'error');
      return false;
    }
    if (!formData.category || !formData.category.trim()) {
      if (addToast) addToast('Kategori Backcharge wajib diisi!', 'error');
      return false;
    }
    if (!formData.tanggal || !formData.tanggal.trim()) {
      if (addToast) addToast('Tanggal BAK wajib diisi!', 'error');
      return false;
    }
    if (!formData.no_cmd || !formData.no_cmd.trim()) {
      if (addToast) addToast('No. CMD wajib diisi dan tidak boleh kosong!', 'error');
      return false;
    }
    if (!/^\d+$/.test(formData.no_cmd.trim())) {
      if (addToast) addToast('No. CMD hanya boleh diisi angka saja!', 'error');
      return false;
    }
    if (formData.no_bak && formData.no_bak.trim() && !/^\d+$/.test(formData.no_bak.trim())) {
      if (addToast) addToast('No. BAK hanya boleh diisi angka saja!', 'error');
      return false;
    }
    if (formData.no_spk && formData.no_spk.trim() && !/^\d+$/.test(formData.no_spk.trim())) {
      if (addToast) addToast('No. SPK hanya boleh diisi angka saja!', 'error');
      return false;
    }
    if (!formData.customer_name || !formData.customer_name.trim()) {
      if (addToast) addToast('Nama CUSTOMER wajib diisi!', 'error');
      return false;
    }
    const plate = (formData.license_plate || '').trim().toUpperCase();
    if (!plate) {
      if (addToast) addToast('No. Polisi Kendaraan wajib diisi!', 'error');
      return false;
    }
    const plateRegex = /^[A-Z]{1,2}-[0-9]{1,4}-[A-Z]{1,3}$/;
    if (!plateRegex.test(plate)) {
      if (addToast) addToast('No. Polisi harus sesuai kriteria B-1234-ABC (contoh: B-1234-ABC, D-123-XYZ)!', 'error');
      return false;
    }
    if (!formData.nama_bro || !formData.nama_bro.trim()) {
      if (addToast) addToast('Nama BRO wajib diisi!', 'error');
      return false;
    }
    if (formData.value === undefined || formData.value === null || Number(formData.value) <= 0) {
      if (addToast) addToast('Nilai Backcharge (Rp) harus lebih besar dari 0!', 'error');
      return false;
    }
    return true;
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await onAddTransaction({
        ...formData,
        no_bak: (formData.no_bak || '').trim(),
        no_spk: (formData.no_spk || '').trim(),
        no_cmd: (formData.no_cmd || '').trim(),
        license_plate: (formData.license_plate || '').trim().toUpperCase()
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      if (addToast) addToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await onUpdateTransaction(
        editingTransaction.id,
        {
          ...formData,
          file_bak_url: editingFiles.bak ? editingFiles.bak.dataUrl : editingTransaction.file_bak_url,
          upload_dok_pendukung: editingFiles.supporting ? editingFiles.supporting.dataUrl : editingTransaction.upload_dok_pendukung,
          file_handover_aso_sales_url: editingFiles.handover ? editingFiles.handover.dataUrl : editingTransaction.file_handover_aso_sales_url,
          no_bak: (formData.no_bak || '').trim(),
          no_spk: (formData.no_spk || '').trim(),
          no_cmd: (formData.no_cmd || '').trim(),
          license_plate: (formData.license_plate || '').trim().toUpperCase()
        },
        `Update informasi transaksi ${editingTransaction.id}`
      );
      setIsEditModalOpen(false);
      setEditingTransaction(null);
    } catch (err: any) {
      if (addToast) addToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChangeEdit = (e: React.ChangeEvent<HTMLInputElement>, type: 'bak' | 'supporting' | 'handover') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      if (addToast) addToast('Ukuran file maksimal 20MB!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditingFiles(prev => ({
        ...prev,
        [type]: {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string
        }
      }));
      if (addToast) addToast(`Berkas "${file.name}" berhasil diunggah!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // BULK ACTIONS & HANDLERS (MATCHING image_308f8e6a.png)
  const handleOpenBulkModal = () => {
    setBulkHandoverStatus('-- Tidak Diubah --');
    setBulkHandoverDate(new Date().toISOString().split('T')[0]);
    setBulkSapStatus('-- Tidak Diubah --');
    setBulkPaymentStatus('-- Tidak Diubah --');
    setBulkApprovalStatus('-- Tidak Diubah --');
    setBulkAuditNote(`Update status massal oleh ${currentUser?.full_name || 'User'} (${currentUser?.role || 'Admin'})`);
    setBulkFile(null);
    setIsDraggingFile(false);
    setIsBulkUpdateModalOpen(true);
  };

  const handleProcessBulkFile = (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      if (addToast) addToast('Ukuran file maksimal 20MB!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBulkFile({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string
      });
      if (addToast) addToast(`Berkas "${file.name}" berhasil diunggah!`, 'success');
    };
    reader.onerror = () => {
      if (addToast) addToast('Gagal membaca file berkas.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleBulkFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessBulkFile(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessBulkFile(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleConfirmBulkUpdate = async () => {
    if (selectedIds.size === 0) return;

    // 1. Mandatory audit note check
    if (!bulkAuditNote.trim()) {
      if (addToast) addToast('Catatan audit / keterangan update massal wajib diisi!', 'error');
      return;
    }

    // 2. Mandatory file/photo attachment check
    if (!bulkFile) {
      if (addToast) addToast('Wajib melampirkan foto atau file bukti serah terima / lampiran!', 'error');
      return;
    }

    // 3. Status selection verification - require at least one status change
    const willUpdateHandover = canUpdateHandover && bulkHandoverStatus !== '-- Tidak Diubah --';
    const willUpdateHandoverDate = canUpdateHandover && Boolean(bulkHandoverDate && bulkHandoverDate.trim());
    const willUpdateSap = canUpdateSap && bulkSapStatus !== '-- Tidak Diubah --';
    const willUpdatePayment = canUpdatePayment && bulkPaymentStatus !== '-- Tidak Diubah --';
    const willUpdateApproval = canUpdateApproval && bulkApprovalStatus !== '-- Tidak Diubah --';

    if (!willUpdateHandover && !willUpdateSap && !willUpdatePayment && !willUpdateApproval) {
      if (addToast) addToast('Silakan pilih setidaknya satu status yang ingin diperbarui!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatesList: { id: string; updates: Partial<Backcharge> }[] = [];
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];
      const role = currentUser?.role || '';
      const approverLabel = `${currentUser?.full_name || 'User'} (${role})`;

      selectedIds.forEach(id => {
        const u: Partial<Backcharge> = {};

        // Melampirkan file / foto bukti massal ke transaksi
        if (bulkFile) {
          u.file_handover_sales_admin_url = bulkFile.dataUrl;
          u.file_handover_aso_sales_url = bulkFile.dataUrl;
          u.approval_attachment_1_url = bulkFile.dataUrl;
          u.upload_dok_pendukung = bulkFile.name;
        }

        // 1. Serah Terima Berkas & Tanggal
        if (willUpdateHandover) {
          u.status_handover = bulkHandoverStatus;
        }
        if (willUpdateHandoverDate) {
          u.tanggal_handover = bulkHandoverDate;
        } else if (willUpdateHandover && !u.tanggal_handover) {
          u.tanggal_handover = todayDate;
        }

        // 2. Status SAP / ERP Claim
        if (willUpdateSap) {
          u.status_sap = bulkSapStatus;
        }

        // 3. Status Pelunasan Pembayaran
        if (willUpdatePayment) {
          u.status_payment = bulkPaymentStatus;
          if (bulkPaymentStatus === 'Lunas') {
            u.payment_date = todayDate;
          }
        }

        // 4. Status Approval Backcharge (Strict Category and Nominal Tier Guarding)
        if (willUpdateApproval) {
          const existingTx = transactions.find(t => t.id === id);
          const txVal = Number(existingTx?.value) || 0;
          const isMaintenance = existingTx?.category === 'Maintenance';
          const isRhReq = isMaintenance ? (txVal > 7500000) : (txVal > 5000000);
          const isDhReq = txVal > 15000000;
          const isKacabCat = ['Maintenance', 'TPL', 'Dokumen Kendaraan', 'Unclaimable Insurance'].includes(existingTx?.category || '');
          const isShCat = ['Own Risk', 'Ekspedisi', 'ETLE'].includes(existingTx?.category || '');

          if (hasRole(role, 'Administrator') || hasRole(role, 'Admin Head')) {
            u.status_approval = bulkApprovalStatus;
            u.approved_by = approverLabel;
            u.approved_at = nowIso;
            u.approval_note = bulkAuditNote;
            if (isRhReq) {
              u.regional_approval_status = bulkApprovalStatus;
              u.regional_approved_by = approverLabel;
              u.regional_approved_at = nowIso;
              u.regional_approval_note = bulkAuditNote;
            }
            if (isDhReq) {
              u.division_approval_status = bulkApprovalStatus;
              u.division_approved_by = approverLabel;
              u.division_approved_at = nowIso;
              u.division_approval_note = bulkAuditNote;
            }
          } else if (hasRole(role, 'Division Head')) {
            if (isDhReq) {
              u.division_approval_status = bulkApprovalStatus;
              u.division_approved_by = approverLabel;
              u.division_approved_at = nowIso;
              u.division_approval_note = bulkAuditNote;
            }
          } else if (isRegionalHeadRole(role)) {
            if (isRhReq) {
              u.regional_approval_status = bulkApprovalStatus;
              u.regional_approved_by = approverLabel;
              u.regional_approved_at = nowIso;
              u.regional_approval_note = bulkAuditNote;
            }
          } else if (hasRole(role, 'Kepala Cabang')) {
            if (isKacabCat) {
              u.status_approval = bulkApprovalStatus;
              u.approved_by = approverLabel;
              u.approved_at = nowIso;
              u.approval_note = bulkAuditNote;
            }
          } else if (hasRole(role, 'Sales Head')) {
            if (isShCat) {
              u.status_approval = bulkApprovalStatus;
              u.approved_by = approverLabel;
              u.approved_at = nowIso;
              u.approval_note = bulkAuditNote;
            }
          }
        }

        updatesList.push({ id, updates: u });
      });

      await onBulkUpdateTransactions(
        updatesList,
        bulkAuditNote
      );

      setIsBulkUpdateModalOpen(false);
      setSelectedIds(new Set());
      setBulkFile(null);
    } catch (err: any) {
      if (addToast) addToast(`Gagal bulk update: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!canDelete) return;
    const reason = window.prompt('KONFIRMASI PENGHAPUSAN:\n\nMasukkan alasan / keterangan mengapa data transaksi ini dihapus:');
    if (reason === null) return;
    if (!reason.trim()) {
      if (addToast) addToast('Alasan penghapusan wajib diisi!', 'error');
      return;
    }
    try {
      await onDeleteTransaction(id);
      if (addToast) addToast(`Transaksi ${id} berhasil dihapus. Alasan: ${reason}`, 'success');
    } catch (err: any) {
      if (addToast) addToast(`Gagal hapus transaksi: ${err.message}`, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !canDelete) return;
    const count = selectedIds.size;
    const reason = window.prompt(`HAPUS ${count} TRANSAKSI SEKALIGUS:\n\nMasukkan alasan / keterangan mengapa ${count} transaksi ini dihapus:`);
    if (reason === null) return;
    if (!reason.trim()) {
      if (addToast) addToast('Alasan penghapusan massal wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const id of Array.from(selectedIds) as string[]) {
        await onDeleteTransaction(id);
      }
      setSelectedIds(new Set());
      if (addToast) addToast(`Berhasil menghapus ${count} transaksi! Alasan: ${reason}`, 'success');
    } catch (err: any) {
      if (addToast) addToast(`Gagal hapus transaksi: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. TOP HEADER & KPI METRICS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Data Backcharge</h1>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 font-extrabold text-xs rounded-full border border-blue-200">
              {filteredTransactions.length} dari {transactions.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Pencatatan transaksi, tracking progres Backcharge, dan audit berkas terpusat.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {canAdd && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Input Data Backcharge Baru"
            >
              <Plus className="w-4 h-4" />
              <span>Input Data Baru</span>
            </button>
          )}

          {canAdd && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200/60"
              title="Impor Massal Data Transaksi Excel"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Impor Massal</span>
            </button>
          )}

          {canExport && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Unduh Rekap Data Transaksi ke File Excel"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Rekap Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. DASHBOARD / ALERT ACTIVE FILTER NOTIFICATION BANNER */}
      {(activeDashboardFilter || activeAlertFilter) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-blue-50 border border-orange-200/90 rounded-2xl shadow-sm text-xs gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-extrabold text-slate-900">Filter Aktif dari Dashboard:</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-900 rounded-full border border-orange-200">
                  {filteredTransactions.length} Transaksi Sesuai
                </span>
              </div>
              <div className="text-slate-600 mt-1 flex flex-wrap items-center gap-1.5 font-medium text-[11px]">
                {activeAlertFilter === 'high_value' && <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">Nominal Tinggi (≥ Rp 15jt)</span>}
                {activeAlertFilter === 'pending' && <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">Status Pending</span>}
                {activeAlertFilter === 'due' && <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">Jatuh Tempo (&gt; 30 Hari)</span>}
                {activeDashboardFilter && (
                  <>
                    {activeDashboardFilter.category && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">
                        Kategori: {activeDashboardFilter.category}
                      </span>
                    )}
                    {activeDashboardFilter.branch && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">
                        Cabang: {activeDashboardFilter.branch}
                      </span>
                    )}
                    {activeDashboardFilter.stage && (
                      <span className="bg-orange-100 text-orange-900 border border-orange-300 px-2 py-0.5 rounded-md font-bold">
                        {activeDashboardFilter.stage === '2_confirm' || activeDashboardFilter.stage === '2_at_admin'
                          ? 'Tahap: Berkas di Admin (Belum Selesai Approval)'
                          : activeDashboardFilter.stage === '1_handover' || activeDashboardFilter.stage === '1_in_aso'
                          ? 'Tahap: Berkas ASO (Menunggu Serah Terima)'
                          : activeDashboardFilter.stage === '3_sap_sh'
                          ? 'Tahap: Belum Approve SH'
                          : activeDashboardFilter.stage === '3_sap_kacab'
                          ? 'Tahap: Belum Approve KACAB'
                          : activeDashboardFilter.stage === '3_sap_rh'
                          ? 'Tahap: Belum Approve RH'
                          : activeDashboardFilter.stage === '3_sap_dh'
                          ? 'Tahap: Belum Approve DH'
                          : activeDashboardFilter.stage === '4_invoice'
                          ? 'Tahap: Menunggu Cetak & Kirim Invoice'
                          : activeDashboardFilter.stage === '5_payment'
                          ? 'Tahap: Menunggu Pelunasan Backcharge'
                          : activeDashboardFilter.stage === '6_reject'
                          ? 'Tahap: Dokumen Ditolak (Reject)'
                          : `Tahap: ${activeDashboardFilter.stage}`}
                      </span>
                    )}
                    {activeDashboardFilter.statusPayment && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">
                        Status Bayar: {activeDashboardFilter.statusPayment}
                      </span>
                    )}
                    {activeDashboardFilter.statusSap && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">
                        Status SAP: {activeDashboardFilter.statusSap}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] self-end sm:self-center shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Hapus Filter</span>
          </button>
        </div>
      )}


      {/* 4. FILTER CONTROLS & SEARCH */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search & Branch Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari ID, Customer, Plat Nomor, No BAK, SPK, SAP, Tilang, BRO..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <MultiSelect
              options={userBranches}
              selected={selectedBranches}
              onChange={(branches) => {
                setSelectedBranches(branches);
                setCurrentPage(1);
              }}
              placeholder="Pilih Cabang Otoritas"
              className="w-full text-xs"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-1/2 py-2 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium"
              title="Tanggal Awal"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-1/2 py-2 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium"
              title="Tanggal Akhir"
            />
          </div>
        </div>

        {/* Row 2: Category, Payment, Approval, Handover, SAP, Tahap Proses Multi-Selects with Checkboxes & Reset button */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kategori</label>
            <MultiSelect
              options={CATEGORIES}
              selected={selectedCategories}
              onChange={(cats) => {
                setSelectedCategories(cats);
                setCurrentPage(1);
              }}
              placeholder="Semua Kategori"
              variant="rounded-xl"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status Bayar</label>
            <MultiSelect
              options={PAYMENT_STATUS_OPTIONS}
              selected={selectedPaymentStatuses}
              onChange={(statuses) => {
                setSelectedPaymentStatuses(statuses);
                setCurrentPage(1);
              }}
              placeholder="Semua Bayar"
              variant="rounded-xl"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status Approval</label>
            <MultiSelect
              options={APPROVAL_STATUS_OPTIONS}
              selected={selectedApprovalStatuses}
              onChange={(statuses) => {
                setSelectedApprovalStatuses(statuses);
                setCurrentPage(1);
              }}
              placeholder="Semua Approval"
              variant="rounded-xl"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Serah Terima</label>
            <MultiSelect
              options={HANDOVER_STATUS_OPTIONS}
              selected={selectedHandoverStatuses}
              onChange={(statuses) => {
                setSelectedHandoverStatuses(statuses);
                setCurrentPage(1);
              }}
              placeholder="Semua Serah Terima"
              variant="rounded-xl"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status SAP</label>
            <MultiSelect
              options={SAP_STATUS_OPTIONS}
              selected={selectedSapStatuses}
              onChange={(statuses) => {
                setSelectedSapStatuses(statuses);
                setCurrentPage(1);
              }}
              placeholder="Semua SAP"
              variant="rounded-xl"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tahap Proses</label>
            <MultiSelect
              options={PROCESS_STAGES}
              selected={selectedProcessStages}
              onChange={(stages) => {
                setSelectedProcessStages(stages);
                setCurrentPage(1);
              }}
              placeholder="Semua Tahap Proses"
              variant="rounded-xl"
              align="right"
              className="w-full"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-[0.98]"
              title="Reset semua filter ke kondisi awal"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-white text-[9px] font-black leading-none ml-0.5">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips / Pills */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center flex-wrap gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">
              Filter Aktif ({activeFiltersCount}):
            </span>
            {selectedCategories.map(cat => (
              <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-[10.5px] font-bold">
                <span>{cat}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} />
              </span>
            ))}
            {selectedPaymentStatuses.map(st => (
              <span key={st} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10.5px] font-bold">
                <span>{st}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedPaymentStatuses(prev => prev.filter(p => p !== st))} />
              </span>
            ))}
            {selectedApprovalStatuses.map(ap => (
              <span key={ap} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10.5px] font-bold">
                <span>Appr: {ap}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedApprovalStatuses(prev => prev.filter(a => a !== ap))} />
              </span>
            ))}
            {selectedHandoverStatuses.map(ho => (
              <span key={ho} className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-lg text-[10.5px] font-bold">
                <span>ST: {ho}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedHandoverStatuses(prev => prev.filter(h => h !== ho))} />
              </span>
            ))}
            {selectedSapStatuses.map(sap => (
              <span key={sap} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-[10.5px] font-bold">
                <span>SAP: {sap}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedSapStatuses(prev => prev.filter(s => s !== sap))} />
              </span>
            ))}
            {selectedProcessStages.map(stg => (
              <span key={stg} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-900 border border-orange-200 rounded-lg text-[10.5px] font-bold">
                <span>Tahap: {stg}</span>
                <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" onClick={() => setSelectedProcessStages(prev => prev.filter(s => s !== stg))} />
              </span>
            ))}
            <button
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline ml-1 cursor-pointer"
            >
              Hapus Semua
            </button>
          </div>
        )}
      </div>

      {/* 5. BULK ACTION FLOATING BAR */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-600 text-white font-extrabold text-xs rounded-xl">
              {selectedIds.size} Dipilih
            </span>
            <button
              onClick={handleSelectAllFiltered}
              className="text-xs text-slate-300 hover:text-white underline font-semibold"
            >
              Pilih semua {filteredTransactions.length} data terfilter
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-2 mt-2 sm:mt-0">
            {canBulkAction && (
              <button
                onClick={handleOpenBulkModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Status Massal ({selectedIds.size})</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih</span>
              </button>
            )}

            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded-xl transition-all text-slate-200"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* 6. MAIN TRANSACTIONS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="flex items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    {paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.has(t.id)) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('id')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ID Transaksi</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('tanggal')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tanggal</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('branch')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Cabang</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Kategori</th>
                <th className="py-3.5 px-4">Customer / Nopol / No. CMD</th>
                <th className="py-3.5 px-3">Penginput</th>
                <th className="py-3.5 px-3">Nama BRO</th>
                <th
                  onClick={() => handleSort('value')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Nominal (Rp)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3">No. BAK / SPK</th>
                <th className="py-3.5 px-3 text-center">Status SAP</th>
                <th className="py-3.5 px-3 text-center">Approval</th>
                <th className="py-3.5 px-3 text-center">Serah Terima</th>
                <th className="py-3.5 px-3 text-center">Status Bayar</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="font-bold text-xs">Memuat data transaksi Backcharge...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">Tidak ada transaksi yang cocok</p>
                      <p className="text-slate-400 text-xs">Coba ubah kata kunci pencarian atau reset filter</p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors"
                      >
                        Reset Semua Filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isSelected = selectedIds.has(tx.id);
                  const isPaid = tx.status_payment === 'Lunas';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleSelectRow(tx.id)}
                          className="flex items-center justify-center text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <button
                          onClick={() => onSelectTransaction(tx.id)}
                          className="hover:underline flex items-center gap-1 text-left"
                        >
                          {tx.id}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium text-[11px]">
                        {(() => {
                          const dateVal = tx.tanggal || tx.created_at;
                          const leadDays = getLeadTimeDays(dateVal, tx.payment_date, tx.status_payment === 'Lunas');
                          const color = getLeadTimeColorClass(leadDays);
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">{formatDate(dateVal)}</span>
                              <span 
                                className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border ${color.bg} ${color.text} ${color.border}`}
                                title={`Leadtime: ${leadDays} hari atas Tanggal BAK`}
                              >
                                ({leadDays} hari)
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold">
                          {tx.branch}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${getCategoryColor(tx.category)}`}>
                          {tx.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-bold text-slate-900 truncate" title={tx.customer_name}>
                          {tx.customer_name}
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5 font-mono text-[10px] text-slate-500 mt-0.5">
                          <span className="font-medium">{tx.license_plate || '-'}</span>
                          {tx.no_cmd && tx.no_cmd !== '-' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200/80 text-[9px]">
                              CMD: {tx.no_cmd}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap text-[11px]">
                        {getCreatorName(tx.created_by)}
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-semibold whitespace-nowrap text-[11px]">
                        {tx.nama_bro || tx.bro_name || '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(tx.value)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-600 font-mono">
                        <div>BAK: <span className="font-bold text-slate-800">{tx.no_bak || '-'}</span></div>
                        <div className="text-[10px] text-slate-400">SPK: {tx.no_spk || '-'}</div>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status_sap === 'Bill' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : tx.status_sap === 'Not Bill'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                          {tx.status_sap || 'N/A'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {(() => {
                          const summary = getApprovalSummary(tx);

                          // 1. Ada yang DITOLAK
                          if (summary.isRejected) {
                            const rejLabels = summary.rejectedTiers.map(t => t.label).join(', ');
                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1 shadow-xs">
                                  Ditolak {rejLabels}
                                </span>
                                {summary.rejectedTiers.map(t => (
                                  <div
                                    key={t.role}
                                    className="text-[9.5px] text-rose-700 font-semibold leading-tight max-w-[170px] truncate"
                                    title={`Ditolak oleh ${t.label}: ${t.by || '-'}${t.at ? ` (${t.at})` : ''}`}
                                  >
                                    Oleh: <span className="font-bold underline decoration-rose-300">{getShortApproverName(t.by)}</span>
                                  </div>
                                ))}
                                {summary.approvedTiers.length > 0 && (
                                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                    {summary.approvedTiers.map(t => (
                                      <div
                                        key={t.role}
                                        className="text-[9px] text-slate-500 font-medium leading-tight max-w-[170px] truncate"
                                        title={`Sebelumnya disetujui ${t.label}: ${t.by || '-'}`}
                                      >
                                        ✓ {t.label}: {getShortApproverName(t.by)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // 2. SEMUA TIER BELUM APPROVAL
                          if (summary.isAllPending) {
                            const pendingLabels = summary.tiers.map(t => t.label).join(', ');
                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span 
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-xs"
                                  title={`Memerlukan approval dari: ${pendingLabels}`}
                                >
                                  Belum Appr. {pendingLabels}
                                </span>
                              </div>
                            );
                          }

                          // 3. SEBAGIAN DISETUJUI, SEBAGIAN BELUM
                          if (summary.isPartiallyApproved) {
                            const pendingLabels = summary.pendingTiers.map(t => t.label).join(', ');
                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span 
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-xs"
                                  title={`Persetujuan masih pending untuk: ${pendingLabels}`}
                                >
                                  Belum Appr. {pendingLabels}
                                </span>
                                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                  {summary.approvedTiers.map(t => (
                                    <div
                                      key={t.role}
                                      className="text-[9.5px] text-emerald-700 font-semibold leading-tight max-w-[170px] truncate"
                                      title={`Disetujui oleh ${t.label}: ${t.by || '-'}${t.at ? ` (${t.at})` : ''}`}
                                    >
                                      ✓ <span className="font-bold text-emerald-800">{t.label}:</span> {getShortApproverName(t.by)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          // 4. SEMUA TIER LENGKAP DISETUJUI
                          if (summary.isFullyApproved) {
                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shadow-xs">
                                  Disetujui
                                </span>
                                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                  {summary.approvedTiers.map(t => (
                                    <div
                                      key={t.role}
                                      className="text-[9.5px] text-emerald-700 font-semibold leading-tight max-w-[170px] truncate"
                                      title={`Disetujui oleh ${t.label}: ${t.by || '-'}${t.at ? ` (${t.at})` : ''}`}
                                    >
                                      ✓ <span className="font-bold text-emerald-800">{t.label}:</span> {getShortApproverName(t.by)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          // Fallback jika tidak sesuai kondisi di atas
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                              {tx.status_approval || 'Belum Approval'}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status_handover === 'Diterima Admin' || tx.status_handover === 'Diserahkan ke Admin'
                            ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {tx.status_handover === 'Diserahkan ke Admin' || tx.status_handover === 'Diterima Admin' ? 'Diterima Admin' : (tx.status_handover || 'Pending')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(() => {
                          const hasInvoice = Boolean(tx.no_invoice && typeof tx.no_invoice === 'string' && tx.no_invoice.trim() !== '' && tx.no_invoice.trim() !== '-');
                          const invDate = tx.tanggal_invoice || (hasInvoice ? (tx.updated_at || tx.tanggal || tx.created_at) : null);
                          const invLeadDays = hasInvoice ? getLeadTimeDays(invDate, tx.payment_date, isPaid) : 0;
                          const invColor = getLeadTimeColorClass(invLeadDays);

                          return (
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* Status Bayar Pill */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                <span>{tx.status_payment || 'Belum Bayar'}</span>
                              </span>

                              {/* Informasi Nomor Invoice & Leadtime Belum Bayar */}
                              {hasInvoice && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span 
                                    className="text-[10px] font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded" 
                                    title={`Nomor Invoice: ${tx.no_invoice}`}
                                  >
                                    Inv: {tx.no_invoice}
                                  </span>
                                  <span 
                                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${invColor.bg} ${invColor.text} ${invColor.border}`}
                                    title={isPaid 
                                      ? `Lunas dalam ${invLeadDays} hari setelah invoice diterbitkan` 
                                      : `Belum bayar selama ${invLeadDays} hari setelah invoice diterbitkan`}
                                  >
                                    ({invLeadDays} hari)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { console.log('Clicked detail for:', tx.id); onSelectTransaction(tx.id); }}
                            title="Lihat Detail Transaksi"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(tx)}
                            title="Edit Transaksi"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteClick(tx.id)}
                              title="Hapus Transaksi"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 7. PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Menampilkan {sortedTransactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, sortedTransactions.length)} dari {sortedTransactions.length} data
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Awal
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-xs text-slate-800">
              Hal {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Akhir
            </button>
          </div>
        </div>
      </div>

      {/* 8. MODAL: TAMBAH / EDIT TRANSAKSI */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-lg my-auto flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Header: matching image_5707ecb1.png */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isAddModalOpen ? 'Input Backcharge Baru' : `Edit Transaksi ${editingTransaction?.id}`}
                </h3>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[10px] sm:text-[11px] rounded-lg border border-blue-200 uppercase tracking-wider">
                  {currentUser?.role || 'ADMINISTRATOR'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingTransaction(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={isAddModalOpen ? handleSubmitAdd : handleSubmitEdit} className="p-6 overflow-y-auto max-h-[82vh] space-y-4">
              {/* 1. CABANG KOTA / BSO */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  CABANG KOTA / BSO
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  required
                >
                  {userBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* 2. KATEGORI BACKCHARGE */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  KATEGORI BACKCHARGE
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as BackchargeCategory })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 3. TANGGAL BAK */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  TANGGAL BAK
                </label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              {/* 4. NO. BAK (BERITA ACARA KEJADIAN) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NO. BAK (BERITA ACARA KEJADIAN)
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                    Khusus Angka
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.no_bak}
                  onChange={(e) => setFormData({ ...formData, no_bak: e.target.value.replace(/\D/g, '') })}
                  placeholder="Contoh: 1002026102"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* 5. NO. SPK (SURAT PERINTAH KERJA) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NO. SPK (SURAT PERINTAH KERJA)
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                    Khusus Angka
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.no_spk}
                  onChange={(e) => setFormData({ ...formData, no_spk: e.target.value.replace(/\D/g, '') })}
                  placeholder="Contoh: 500101010"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* 6. NO. CMD (BARU DITAMBAHKAN SESUAI PERMINTAAN) */}
              <div className={`relative ${activeAutocompleteField === 'no_cmd' ? 'z-30' : 'z-20'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NO. CMD <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                    Khusus Angka
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.no_cmd || ''}
                    onFocus={() => setActiveAutocompleteField('no_cmd')}
                    onBlur={() => setTimeout(() => setActiveAutocompleteField(prev => prev === 'no_cmd' ? null : prev), 200)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setActiveAutocompleteField(null); }}
                    onChange={(e) => {
                      setFormData({ ...formData, no_cmd: e.target.value.replace(/\D/g, '') });
                      setActiveAutocompleteField('no_cmd');
                    }}
                    placeholder="Contoh: 2026001"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-8"
                    required
                  />
                  {formData.no_cmd && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, no_cmd: '' }); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {activeAutocompleteField === 'no_cmd' && renderAutocompleteDropdown('no_cmd', formData.no_cmd || '')}
              </div>

              {/* 7. NAMA CUSTOMER */}
              <div className={`relative ${activeAutocompleteField === 'customer_name' ? 'z-30' : 'z-15'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NAMA CUSTOMER <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-suggest riwayat</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.customer_name}
                    onFocus={() => setActiveAutocompleteField('customer_name')}
                    onBlur={() => setTimeout(() => setActiveAutocompleteField(prev => prev === 'customer_name' ? null : prev), 200)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setActiveAutocompleteField(null); }}
                    onChange={(e) => {
                      setFormData({ ...formData, customer_name: e.target.value });
                      setActiveAutocompleteField('customer_name');
                    }}
                    placeholder="PT Indonesia Gemilang"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-8"
                    required
                  />
                  {formData.customer_name && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, customer_name: '' }); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {activeAutocompleteField === 'customer_name' && renderAutocompleteDropdown('customer_name', formData.customer_name)}
              </div>

              {/* 8. NO. POLISI KENDARAAN */}
              <div className={`relative ${activeAutocompleteField === 'license_plate' ? 'z-30' : 'z-10'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NO. POLISI KENDARAAN <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Kriteria: B-1234-ABC
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.license_plate}
                    onFocus={() => setActiveAutocompleteField('license_plate')}
                    onBlur={() => setTimeout(() => setActiveAutocompleteField(prev => prev === 'license_plate' ? null : prev), 200)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setActiveAutocompleteField(null); }}
                    onChange={(e) => {
                      let val = e.target.value.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-');
                      if (!val.includes('-') && /^([A-Z]{1,2})([0-9]{1,4})([A-Z]{1,3})$/.test(val)) {
                        val = val.replace(/^([A-Z]{1,2})([0-9]{1,4})([A-Z]{1,3})$/, '$1-$2-$3');
                      }
                      setFormData({ ...formData, license_plate: val });
                      setActiveAutocompleteField('license_plate');
                    }}
                    placeholder="B-1234-ABC"
                    pattern="^[A-Za-z]{1,2}-[0-9]{1,4}-[A-Za-z]{1,3}$"
                    title="Format kriteria: B-1234-ABC (contoh: B-1234-ABC, D-123-XYZ)"
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-mono font-bold tracking-wider transition-all focus:outline-none pr-8 ${
                      !formData.license_plate
                        ? 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800'
                        : /^[A-Z]{1,2}-[0-9]{1,4}-[A-Z]{1,3}$/.test(formData.license_plate.trim())
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-950 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                        : 'border-amber-400 bg-amber-50/20 text-amber-950 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                    }`}
                    required
                  />
                  {formData.license_plate && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, license_plate: '' }); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {activeAutocompleteField === 'license_plate' && renderAutocompleteDropdown('license_plate', formData.license_plate)}

                {/* Status Validasi Real-time */}
                {formData.license_plate ? (
                  <div className="mt-1.5">
                    {/^[A-Z]{1,2}-[0-9]{1,4}-[A-Z]{1,3}$/.test(formData.license_plate.trim()) ? (
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Format kriteria valid: <strong className="font-mono text-emerald-800">{formData.license_plate.trim()}</strong></span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Harus sesuai kriteria <strong className="font-mono text-amber-800">B-1234-ABC</strong> (contoh: B-1234-ABC, D-567-XYZ)</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Format harus menggunakan tanda hubung (-), contoh: <strong className="font-mono text-slate-600">B-1234-ABC</strong>
                  </p>
                )}
              </div>

              {/* 9. NAMA BRO */}
              <div className={`relative ${activeAutocompleteField === 'nama_bro' ? 'z-30' : 'z-5'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    NAMA BRO <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-suggest riwayat</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.nama_bro}
                    onFocus={() => setActiveAutocompleteField('nama_bro')}
                    onBlur={() => setTimeout(() => setActiveAutocompleteField(prev => prev === 'nama_bro' ? null : prev), 200)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setActiveAutocompleteField(null); }}
                    onChange={(e) => {
                      setFormData({ ...formData, nama_bro: e.target.value });
                      setActiveAutocompleteField('nama_bro');
                    }}
                    placeholder="Nama BRO..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-8"
                    required
                  />
                  {formData.nama_bro && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, nama_bro: '' }); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {activeAutocompleteField === 'nama_bro' && renderAutocompleteDropdown('nama_bro', formData.nama_bro)}
              </div>

              {/* 10. NILAI BACKCHARGE (RP) */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  NILAI BACKCHARGE (RP)
                </label>
                <input
                  type="number"
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) || 0 })}
                  placeholder="Nominal"
                  min="0"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              {/* Khusus ETLE: Nomor Tilang */}
              {formData.category === 'ETLE' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    NO. TILANG / REFERENSI ETLE
                  </label>
                  <input
                    type="text"
                    value={formData.no_tilang}
                    onChange={(e) => setFormData({ ...formData, no_tilang: e.target.value })}
                    placeholder="Contoh: TLG-2026-9921"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              )}

              {/* UPLOAD DOKUMEN (HANYA EDIT) */}
              {isEditModalOpen && (
                <div className="space-y-4">
                  {/* 1. FILE BAK */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">1. FILE BAK (PDF / GAMBAR)</label>
                    <input type="file" ref={editFileInputRef} onChange={(e) => handleFileChangeEdit(e, 'bak')} className="hidden" id="edit-file-bak" />
                    <label htmlFor="edit-file-bak" className="cursor-pointer w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-all">
                      <span>{editingFiles.bak ? editingFiles.bak.name : (editingTransaction?.file_bak_url ? 'Ubah File BAK' : 'Pilih File BAK')}</span>
                      <Upload className="w-4 h-4 text-slate-400" />
                    </label>
                    {(editingFiles.bak || editingTransaction?.file_bak_url) && (
                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        <span className="text-slate-500">File BAK Tersimpan</span>
                        <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">Cloud Secure</span>
                      </div>
                    )}
                  </div>

                  {/* 2. DOKUMEN PENDUKUNG */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">2. DOKUMEN PENDUKUNG (FILE / FOTO)</label>
                    <input type="file" onChange={(e) => handleFileChangeEdit(e, 'supporting')} className="hidden" id="edit-file-supporting" />
                    <label htmlFor="edit-file-supporting" className="cursor-pointer w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-all">
                      <span>{editingFiles.supporting ? editingFiles.supporting.name : (editingTransaction?.upload_dok_pendukung ? 'Ubah Dokumen Pendukung' : 'Pilih Dokumen Pendukung')}</span>
                      <Upload className="w-4 h-4 text-slate-400" />
                    </label>
                  </div>

                  {/* 3. FOTO BUKTI SERAH TERIMA */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">3. PILIH FILE FOTO BUKTI SERAH TERIMA (WAJIB)</label>
                    <input type="file" onChange={(e) => handleFileChangeEdit(e, 'handover')} className="hidden" id="edit-file-handover" />
                    <label htmlFor="edit-file-handover" className="cursor-pointer w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-all">
                      <span>{editingFiles.handover ? editingFiles.handover.name : (editingTransaction?.file_handover_aso_sales_url ? 'Ubah Foto Serah Terima' : 'Pilih Foto Serah Terima')}</span>
                      <Upload className="w-4 h-4 text-slate-400" />
                    </label>
                  </div>
                </div>
              )}

              {/* Catatan / Alasan */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  CATATAN / ALASAN (OPSIONAL)
                </label>
                <textarea
                  rows={2}
                  value={formData.alasan}
                  onChange={(e) => setFormData({ ...formData, alasan: e.target.value })}
                  placeholder="Catatan tambahan atau rincian administratif..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Tombol Aksi: Persis seperti image_5707ecb1.png */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{isAddModalOpen ? 'Simpan & Kirim Notifikasi' : 'Perbarui Transaksi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: IMPOR EXCEL (BULK UPLOAD) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Import Massal Data Backcharge</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Import data dalam jumlah banyak secara massal menggunakan template spreadsheet Microsoft Excel yang disediakan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportPreview([]);
                  setImportErrors([]);
                  setImportProgress(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Main Box matching design */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-6 space-y-5">
                <div className="text-center space-y-1.5">
                  <h4 className="text-sm font-black text-slate-900">Sistem Import Massal berformat Excel (.xlsx)</h4>
                  <p className="text-xs text-slate-500 max-w-xl mx-auto">
                    Silakan unduh template Excel resmi di bawah ini, isi data transaksi sesuai format kolom yang telah ditentukan, lalu unggah kembali file Excel tersebut.
                  </p>
                </div>

                {/* Structure 16 Columns Header & Pills */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span className="text-xs font-bold text-slate-800">STRUKTUR 16 KOLOM TEMPLATE:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" /> Dropdown Validation Aktif
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        <HelpCircle className="w-3 h-3" /> Safe Sample Auto-Ignore
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 pt-1 text-[11px] font-medium">
                    {[
                      '1. Tanggal', '2. Kategori ▾', '3. Cabang ▾', '4. No CMD',
                      '5. Nama Customer', '6. No Polisi', '7. Nilai Backcharge', '8. No BAK',
                      '9. No SPK', '10. No Tilang', '11. PIC/BRO', '12. Alasan',
                      '13. Tahap Proses ▾', '14. No Invoice', '15. Status Bayar ▾', '16. Status SAP ▾'
                    ].map((col, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5 text-slate-700 text-center truncate" title={col}>
                        {col}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-2 text-[11px] text-blue-900">
                    <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Template Multi-Sheet Resmi (.xlsx):</span>
                      <p>
                        File Excel dilengkapi 2 sheet: <strong>Sheet 1: Template Backcharge</strong> (area entri data) dan <strong>Sheet 2: Petunjuk &amp; Contoh Pengisian</strong>. Dropdown validation aktif pada kolom Kategori, Cabang, Tahap Proses (sesuai sistem web), Status Bayar, dan Status SAP.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Download and Upload Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Template Excel (.xlsx)</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    id="excel-file-input"
                  />
                  <label
                    htmlFor="excel-file-input"
                    className="cursor-pointer flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Unggah File Excel</span>
                  </label>
                </div>
              </div>

              {/* Progress Bar during Import */}
              {importProgress && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Sedang Mengimpor Data ke Database...</span>
                    </span>
                    <span>{importProgress.percent}% ({importProgress.current} dari {importProgress.total} data)</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Terdapat kendala pada file:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                    {importErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importErrors.length > 5 && (
                      <li>Dan {importErrors.length - 5} kendala lainnya...</li>
                    )}
                  </ul>
                </div>
              )}

              {importPreview.length > 0 && !importProgress && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800">
                      Pratinjau Impor ({importPreview.length} Data Siap Ditambahkan):
                    </h4>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-60 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-600 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Kategori</th>
                          <th className="py-2 px-3">Cabang</th>
                          <th className="py-2 px-3">CUSTOMER</th>
                          <th className="py-2 px-3">No. Polisi</th>
                          <th className="py-2 px-3 text-right">Nilai (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3">{row.category}</td>
                            <td className="py-2 px-3">{row.branch}</td>
                            <td className="py-2 px-3 font-semibold">{row.customer_name}</td>
                            <td className="py-2 px-3 font-mono">{row.license_plate}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatCurrency(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importPreview.length > 15 && (
                    <p className="text-[11px] text-slate-400 mt-1 italic text-center">
                      ...menampilkan 15 dari {importPreview.length} total baris data yang akan diimpor.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-600">
                {importPreview.length > 0 ? `${importPreview.length} Baris data terdeteksi siap diimpor` : 'Belum ada file yang diunggah'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview([]);
                    setImportErrors([]);
                    setImportProgress(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={importPreview.length === 0 || isSubmitting || importProgress !== null}
                  onClick={handleConfirmImport}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Mulai Import Massal ({importPreview.length} Baris)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: BULK UPDATE STATUS (MATCHING DESIGN image_308f8e6a.png) */}
      {isBulkUpdateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl my-auto overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Update Status Massal ({selectedIds.size} Transaksi)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Ubah status beberapa transaksi sekaligus secara cepat dan aman.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkUpdateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-xl transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Selected Transactions & Role Information Box */}
              <div className="p-4 bg-blue-50/70 border border-blue-200/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-slate-900">
                    Transaksi Terpilih ({selectedIds.size}):
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10.5px] font-black uppercase rounded-lg tracking-wider">
                    ROLE: {currentUser?.role?.toUpperCase() || 'ADMINISTRATOR'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {Array.from(selectedIds).map(id => (
                    <span
                      key={id}
                      className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-mono font-bold rounded-lg shadow-2xs"
                    >
                      {id}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-blue-600 font-medium italic">
                  * Hanya bidang status sesuai wewenang role Anda yang akan diproses.
                </p>
              </div>

              {/* Section 1: SERAH TERIMA BERKAS & DOKUMEN LAMPIRAN MASSAL */}
              <div className="p-4 sm:p-5 rounded-2xl border transition-all bg-white border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                      SERAH TERIMA BERKAS &amp; DOKUMEN LAMPIRAN MASSAL
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!canUpdateHandover && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Terkunci
                      </span>
                    )}
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10.5px] font-black rounded-full">
                      Otorisasi ASO
                    </span>
                  </div>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!canUpdateHandover ? 'opacity-60' : ''}`}>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      STATUS SERAH TERIMA
                    </label>
                    <select
                      disabled={!canUpdateHandover}
                      value={bulkHandoverStatus}
                      onChange={(e) => setBulkHandoverStatus(e.target.value)}
                      className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="-- Tidak Diubah --">-- Tidak Diubah --</option>
                      <option value="Diterima Admin">Diterima Admin</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      TANGGAL SERAH TERIMA
                    </label>
                    <input
                      type="date"
                      disabled={!canUpdateHandover}
                      value={bulkHandoverDate}
                      onChange={(e) => setBulkHandoverDate(e.target.value)}
                      className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Sub-upload: UPLOAD DOKUMEN / BERKAS BUKTI SERAH TERIMA MASSAL */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-600">
                      UPLOAD DOKUMEN / BERKAS BUKTI SERAH TERIMA MASSAL <span className="text-rose-500">*</span>
                    </span>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase">
                      {selectedIds.size} TRANSAKSI TERPILIH
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={bulkFileInputRef}
                    onChange={handleBulkFileInputChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                    id="bulk-file-upload-input"
                  />

                  {!bulkFile ? (
                    <div
                      onClick={() => bulkFileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleFileDrop}
                      className={`border-2 border-dashed ${
                        isDraggingFile ? 'border-blue-500 bg-blue-100/50' : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/70'
                      } rounded-2xl p-5 text-center cursor-pointer transition-all group`}
                    >
                      <Upload className="w-6 h-6 text-blue-500 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-slate-800">
                        Pilih / Unggah Berkas Bukti Serah Terima (PDF / Foto)
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">
                        File ini akan otomatis dilampirkan ke {selectedIds.size} transaksi yang dipilih sekaligus
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-3 min-w-0">
                        {bulkFile.type.startsWith('image/') ? (
                          <img
                            src={bulkFile.dataUrl}
                            alt="Preview"
                            className="w-10 h-10 object-cover rounded-lg border border-blue-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            PDF
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" title={bulkFile.name}>
                            {bulkFile.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5">
                            <span>{formatFileSize(bulkFile.size)}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Siap Dilampirkan
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => bulkFileInputRef.current?.click()}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Hapus file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: STATUS SAP / ERP CLAIM */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                canUpdateSap ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/80 border-slate-200/70 opacity-60'
              } space-y-2`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    STATUS SAP / ERP CLAIM
                  </span>
                  <div className="flex items-center gap-2">
                    {!canUpdateSap && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Terkunci
                      </span>
                    )}
                    <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">
                      WEWENANG SALES HEAD
                    </span>
                  </div>
                </div>

                <select
                  disabled={!canUpdateSap}
                  value={bulkSapStatus}
                  onChange={(e) => setBulkSapStatus(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="-- Tidak Diubah --">-- Tidak Diubah --</option>
                  <option value="Bill">Bill</option>
                  <option value="Not Bill">Not Bill</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>

              {/* Section 3: STATUS PELUNASAN PEMBAYARAN */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                canUpdatePayment ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/80 border-slate-200/70 opacity-60'
              } space-y-2`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    STATUS PELUNASAN PEMBAYARAN
                  </span>
                  <div className="flex items-center gap-2">
                    {!canUpdatePayment && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Terkunci
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                      Wewenang Admin
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    STATUS PELUNASAN
                  </label>
                  <select
                    disabled={!canUpdatePayment}
                    value={bulkPaymentStatus}
                    onChange={(e) => setBulkPaymentStatus(e.target.value)}
                    className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="-- Tidak Diubah --">-- Tidak Diubah --</option>
                    <option value="Lunas">Lunas</option>
                    <option value="Belum Bayar">Belum Bayar</option>
                  </select>
                </div>
              </div>

              {/* Section 4: STATUS APPROVAL BACKCHARGE */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                canUpdateApproval ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/80 border-slate-200/70 opacity-60'
              } space-y-2`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    STATUS APPROVAL BACKCHARGE
                  </span>
                  <div className="flex items-center gap-2">
                    {!canUpdateApproval && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Terkunci
                      </span>
                    )}
                    <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                      WEWENANG RH / DH / KACAB / SALES HEAD
                    </span>
                  </div>
                </div>

                <select
                  disabled={!canUpdateApproval}
                  value={bulkApprovalStatus}
                  onChange={(e) => setBulkApprovalStatus(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="-- Tidak Diubah --">-- Tidak Diubah --</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Ditolak">Ditolak</option>
                </select>

                <p className="text-[10.5px] text-slate-400 italic mt-1.5">
                  * Memproses status approval dan menyinkronkan seluruh tier wewenang nominal yang berlaku.
                </p>
              </div>

              {/* Section 5: CATATAN AUDIT / KETERANGAN UPDATE MASSAL */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                  CATATAN AUDIT / KETERANGAN UPDATE MASSAL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bulkAuditNote}
                  onChange={(e) => setBulkAuditNote(e.target.value)}
                  placeholder={`Update status massal oleh ${currentUser?.full_name || 'User'} (${currentUser?.role || 'Admin'})`}
                  className="w-full text-xs py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsBulkUpdateModalOpen(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmBulkUpdate}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                <span>Terapkan Ke {selectedIds.size} Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
