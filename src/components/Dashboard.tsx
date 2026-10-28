import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, CheckCircle, Clock, Map, 
  Layers, ShieldAlert, ArrowRight, Award,
  Calendar, FileSpreadsheet, Search,
  Mail, FileText, Info, ArrowUpRight, ArrowDownRight, Lock, Loader2,
  AlertCircle, BarChart3, X, AlertTriangle, History, Wrench
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Backcharge, Profile, DashboardFilter, BRANCH_LIST, MEGABRANCH_LIST, ALL_SYSTEM_BRANCHES, getUserBranches, getRoleAllowedBranches, isNationalOrAllBranches, BackchargeCategory, hasRole, isRegionalHeadRole } from '../types';
import MultiSelect from './MultiSelect';

interface DashboardProps {
  transactions: Backcharge[];
  currentUser?: Profile;
  isLoading?: boolean;
  onSelectTransaction?: (id: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onUpdatePassword?: (newPassword: string) => Promise<boolean>;
  onSelectAlertFilter?: (filter: 'due' | 'pending' | 'high_value') => void;
  onSelectDashboardFilter?: (filter: DashboardFilter) => void;
}

const getCategoryColorClass = (cat: BackchargeCategory) => {
  switch(cat) {
    case 'Own Risk': return { bg: 'bg-indigo-600', text: 'text-indigo-600', lightBg: 'bg-indigo-50', border: 'border-indigo-100' };
    case 'Maintenance': return { bg: 'bg-blue-500', text: 'text-blue-500', lightBg: 'bg-blue-50', border: 'border-blue-100' };
    case 'Ekspedisi': return { bg: 'bg-sky-400', text: 'text-sky-400', lightBg: 'bg-sky-50', border: 'border-sky-100' };
    case 'ETLE': return { bg: 'bg-amber-500', text: 'text-amber-500', lightBg: 'bg-amber-50', border: 'border-amber-100' };
    case 'TPL': return { bg: 'bg-rose-500', text: 'text-rose-500', lightBg: 'bg-rose-50', border: 'border-rose-100' };
    case 'Unclaimable Insurance': return { bg: 'bg-teal-500', text: 'text-teal-500', lightBg: 'bg-teal-50', border: 'border-teal-100' };
    case 'Dokumen Kendaraan': return { bg: 'bg-purple-500', text: 'text-purple-500', lightBg: 'bg-purple-50', border: 'border-purple-100' };
    default: return { bg: 'bg-slate-500', text: 'text-slate-500', lightBg: 'bg-slate-50', border: 'border-slate-100' };
  }
};

const formatRatio = (val: number) => {
  if (!val || isNaN(val) || !Number.isFinite(val) || val <= 0) return '0%';
  if (val >= 100) return '100%';
  return val < 0.1 ? '<0.1%' : (val < 10 ? val.toFixed(1) : Math.round(val).toString()) + '%';
};

export default function Dashboard({ 
  transactions, 
  currentUser, 
  isLoading = false,
  onSelectTransaction, 
  addToast, 
  onUpdatePassword,
  onSelectAlertFilter,
  onSelectDashboardFilter
}: DashboardProps) {
  // Role helper
  const userRole = currentUser?.role || 'ASO';
  const isAdmin = userRole === 'Admin' || userRole === 'Admin Head';

  // Branch mapping - filtered strictly according to user role & authorized branches
  const userBranches = useMemo(() => {
    if (!currentUser) return null;
    if (isNationalOrAllBranches(currentUser.branch, currentUser.role)) return null;
    const allowed = getRoleAllowedBranches(currentUser.role, currentUser.branch);
    return allowed && allowed.length < ALL_SYSTEM_BRANCHES.length ? allowed : null;
  }, [currentUser]);

  const branchList = useMemo(() => {
    if (userBranches && userBranches.length > 0) {
      const filtered = ALL_SYSTEM_BRANCHES.filter(b => userBranches.some(ub => ub.toLowerCase() === b.toLowerCase()));
      return filtered.length > 0 ? filtered : userBranches;
    }
    return ALL_SYSTEM_BRANCHES;
  }, [userBranches]);

  const availableBranchOptions = branchList;

  // Local/global settings
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranchFilters, setSelectedBranchFilters] = useState<string[]>([]);
  const [selectedPipelineCategory, setSelectedPipelineCategory] = useState<BackchargeCategory>('Own Risk');

  // Pipeline filter and view states
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [hideEmptyPipelines, setHideEmptyPipelines] = useState(false);

  const [lastUpdatedTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + 
      ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  });

  // Drill-down per branch modal state
  const [branchSearch, setBranchSearch] = useState('');
  const [branchSort, setBranchSort] = useState<'top3-value-asc' | 'total-desc' | 'total-asc' | 'value-desc' | 'value-asc' | 'ratio-desc'>('top3-value-asc');
  const [branchPerformanceFilter, setBranchPerformanceFilter] = useState<'all' | 'low' | 'top10'>('all');
  
  const [selectedDrillDownBranch, setSelectedDrillDownBranch] = useState<string | null>(null);
  const [drillDownSearch, setDrillDownSearch] = useState('');

  // Email ringkasan modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState(currentUser?.email || '');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Sync selected branch filter with user's primary branch on login
  React.useEffect(() => {
    if (currentUser) {
      if (!isNationalOrAllBranches(currentUser.branch, currentUser.role)) {
        const branches = getRoleAllowedBranches(currentUser.role, currentUser.branch);
        if (branches.length === 1) {
          // Default to their only branch if they only handle exactly 1 branch
          setSelectedBranchFilters([branches[0]]);
        } else {
          // If they handle multiple branches (e.g., Regional, Megabranch, or custom list), show consolidated data across all their authorized branches
          setSelectedBranchFilters([]);
        }
      } else {
        setSelectedBranchFilters([]);
      }
    }
  }, [currentUser]);

  // Change password modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const actualCurrentPassword = currentUser?.password || 'password123';
    
    if (currentPasswordInput !== actualCurrentPassword) {
      setPasswordError('Password saat ini salah!');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordError('Password baru minimal harus 6 karakter!');
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordError('Konfirmasi password baru tidak cocok!');
      return;
    }

    if (onUpdatePassword) {
      const success = await onUpdatePassword(newPasswordInput);
      if (success) {
        setShowChangePasswordModal(false);
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmNewPasswordInput('');
      }
    } else {
      if (addToast) {
        addToast('Fungsi ganti password tidak dikonfigurasi.', 'error');
      }
    }
  };



  const getTxAgeDays = (t: Backcharge) => {
    const dStr = t.tanggal || t.created_at;
    if (!dStr) return 0;
    const ms = Date.parse(dStr);
    return isNaN(ms) ? 0 : Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
  };

  // 1. Filter global transactions by selected Date Range and Branch
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const transactionDate = t.tanggal || (t.created_at ? t.created_at.split('T')[0] : '');
      
      let matchesStartDate = true;
      let matchesEndDate = true;
      let matchesBranch = true;
      
      if (startDate && transactionDate) {
        matchesStartDate = transactionDate >= startDate;
      }
      if (endDate && transactionDate) {
        matchesEndDate = transactionDate <= endDate;
      }
      if (selectedBranchFilters.length > 0) {
        matchesBranch = selectedBranchFilters.some(sf => t.branch && t.branch.toLowerCase() === sf.toLowerCase());
      } else if (userBranches && userBranches.length > 0 && !isNationalOrAllBranches(currentUser?.branch, currentUser?.role)) {
        matchesBranch = userBranches.some(ub => ub.toLowerCase() === t.branch?.toLowerCase());
      }
      
      return matchesStartDate && matchesEndDate && matchesBranch;
    });
  }, [transactions, startDate, endDate, selectedBranchFilters, userBranches, currentUser]);

  // 2. Trend Calculations relative to "Periode Lalu"
  const { activeCount, activeValue, priorCount, priorValue } = useMemo(() => {
    const actCount = filteredTransactions.length;
    const actValue = filteredTransactions.reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    let pCount = 0;
    let pValue = 0;

    if (startDate && endDate) {
      // Compare selected range to preceding equivalent period
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      
      const priorEnd = new Date(start.getTime() - 24 * 3600 * 1000);
      const priorStart = new Date(priorEnd.getTime() - durationMs);
      
      const priorStartStr = priorStart.toISOString().split('T')[0];
      const priorEndStr = priorEnd.toISOString().split('T')[0];
      
      const priorPeriodTransactions = transactions.filter(t => {
        const transactionDate = t.tanggal || (t.created_at ? t.created_at.split('T')[0] : '');
        if (!transactionDate) return false;
        const matchesDate = transactionDate >= priorStartStr && transactionDate <= priorEndStr;
        let matchesBranch = true;
        if (selectedBranchFilters.length > 0) {
          matchesBranch = selectedBranchFilters.some(sf => t.branch && t.branch.toLowerCase() === sf.toLowerCase());
        } else if (userBranches && userBranches.length > 0) {
          matchesBranch = userBranches.some(ub => ub.toLowerCase() === t.branch?.toLowerCase());
        }
        return matchesDate && matchesBranch;
      });
      
      pCount = priorPeriodTransactions.length;
      pValue = priorPeriodTransactions.reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    } else {
      // Default trend baseline: Compare last 30 days to sixty-to-thirty days ago
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
      
      const prev30 = transactions.filter(t => {
        const transactionDate = t.tanggal || (t.created_at ? t.created_at.split('T')[0] : '');
        if (!transactionDate) return false;
        const d = new Date(transactionDate);
        const matchesDate = d >= sixtyDaysAgo && d < thirtyDaysAgo;
        let matchesBranch = true;
        if (selectedBranchFilters.length > 0) {
          matchesBranch = selectedBranchFilters.some(sf => t.branch && t.branch.toLowerCase() === sf.toLowerCase());
        } else if (userBranches && userBranches.length > 0) {
          matchesBranch = userBranches.some(ub => ub.toLowerCase() === t.branch?.toLowerCase());
        }
        return matchesDate && matchesBranch;
      });
      
      pCount = prev30.length;
      pValue = prev30.reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    }

    return { activeCount: actCount, activeValue: actValue, priorCount: pCount, priorValue: pValue };
  }, [transactions, startDate, endDate, selectedBranchFilters, filteredTransactions, userBranches]);

  // 2B. Period Segmentation Calculation Helper: Cutoff vs Current Month
  const calculateKpiStats = (txList: Backcharge[]) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayPrevMonthObj = new Date(currentYear, currentMonth, 0);
    const cutoffDateStr = `${lastDayPrevMonthObj.getFullYear()}-${String(lastDayPrevMonthObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonthObj.getDate()).padStart(2, '0')}`;
    const lastDayCurrMonthObj = new Date(currentYear, currentMonth + 1, 0);
    const currentMonthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayCurrMonthObj.getDate()).padStart(2, '0')}`;

    const monthNamesId = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const currentMonthName = monthNamesId[currentMonth];
    const cutoffMonthName = monthNamesId[lastDayPrevMonthObj.getMonth()];
    const currentMonthLabel = `${currentMonthName} ${currentYear}`;
    const cutoffDateLabel = `${lastDayPrevMonthObj.getDate()} ${cutoffMonthName} ${lastDayPrevMonthObj.getFullYear()}`;

    let cutoffCount = 0;
    let cutoffValue = 0;
    let cutoffLunasCount = 0;
    let cutoffLunasValue = 0;
    let cutoffOsCount = 0;
    let cutoffOsValue = 0;

    let currentMonthCount = 0;
    let currentMonthValue = 0;
    let currentMonthLunasCount = 0;
    let currentMonthLunasValue = 0;
    let currentMonthOsCount = 0;
    let currentMonthOsValue = 0;

    let grandTotalCount = 0;
    let grandTotalValue = 0;
    let grandTotalLunasCount = 0;
    let grandTotalLunasValue = 0;
    let grandTotalOsCount = 0;
    let grandTotalOsValue = 0;

    txList.forEach(t => {
      const val = Number(t.value) || 0;
      const isLunas = t.status_payment === 'Lunas';
      
      let tDate = '';
      if (t.tanggal) {
        if (t.tanggal.includes('T')) tDate = t.tanggal.split('T')[0];
        else if (t.tanggal.includes('/')) {
          const p = t.tanggal.split('/');
          if (p[0].length === 4) tDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
          else if (p[2].length === 4) tDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        } else {
          tDate = t.tanggal.split(' ')[0];
        }
      } else if (t.created_at) {
        tDate = t.created_at.split('T')[0].split(' ')[0];
      }

      grandTotalCount++;
      grandTotalValue += val;
      if (isLunas) {
        grandTotalLunasCount++;
        grandTotalLunasValue += val;
      } else {
        grandTotalOsCount++;
        grandTotalOsValue += val;
      }

      if (tDate && tDate < currentMonthStartStr) {
        cutoffCount++;
        cutoffValue += val;
        if (isLunas) {
          cutoffLunasCount++;
          cutoffLunasValue += val;
        } else {
          cutoffOsCount++;
          cutoffOsValue += val;
        }
      } else {
        currentMonthCount++;
        currentMonthValue += val;
        if (isLunas) {
          currentMonthLunasCount++;
          currentMonthLunasValue += val;
        } else {
          currentMonthOsCount++;
          currentMonthOsValue += val;
        }
      }
    });

    const cutoffLunasRatio = cutoffValue > 0 && !isNaN(cutoffLunasValue) ? Math.max(0, Math.min(100, (cutoffLunasValue / cutoffValue) * 100)) : 0;
    const cutoffOsRatio = cutoffValue > 0 && !isNaN(cutoffOsValue) ? Math.max(0, Math.min(100, (cutoffOsValue / cutoffValue) * 100)) : 0;

    const currentMonthLunasRatio = currentMonthValue > 0 && !isNaN(currentMonthLunasValue) ? Math.max(0, Math.min(100, (currentMonthLunasValue / currentMonthValue) * 100)) : 0;
    const currentMonthOsRatio = currentMonthValue > 0 && !isNaN(currentMonthOsValue) ? Math.max(0, Math.min(100, (currentMonthOsValue / currentMonthValue) * 100)) : 0;

    const grandLunasRatio = grandTotalValue > 0 && !isNaN(grandTotalLunasValue) ? Math.max(0, Math.min(100, (grandTotalLunasValue / grandTotalValue) * 100)) : 0;
    const grandOsRatio = grandTotalValue > 0 && !isNaN(grandTotalOsValue) ? Math.max(0, Math.min(100, (grandTotalOsValue / grandTotalValue) * 100)) : 0;

    return {
      currentMonthLabel,
      currentMonthName,
      cutoffMonthName,
      cutoffDateLabel,
      cutoffDateStr,
      currentMonthStartStr,
      currentMonthEndStr,
      lastDayCurrMonth: lastDayCurrMonthObj.getDate(),
      cutoffCount,
      cutoffValue,
      cutoffLunasCount,
      cutoffLunasValue,
      cutoffOsCount,
      cutoffOsValue,
      cutoffLunasRatio,
      cutoffOsRatio,
      cutoffSettlementRatio: Math.round(cutoffLunasRatio),
      currentMonthCount,
      currentMonthValue,
      currentMonthLunasCount,
      currentMonthLunasValue,
      currentMonthOsCount,
      currentMonthOsValue,
      currentMonthLunasRatio,
      currentMonthOsRatio,
      currentMonthSettlementRatio: Math.round(currentMonthLunasRatio),
      grandTotalCount,
      grandTotalValue,
      grandTotalLunasCount,
      grandTotalLunasValue,
      grandTotalOsCount,
      grandTotalOsValue,
      grandLunasRatio,
      grandOsRatio,
      grandSettlementRatio: Math.round(grandLunasRatio)
    };
  };


  // Separate Filtered Transactions & Metrics for Maintenance and ETLE
  const maintenanceTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.category === 'Maintenance');
  }, [filteredTransactions]);

  const etleTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.category === 'ETLE');
  }, [filteredTransactions]);

  const maintenanceStats = useMemo(() => calculateKpiStats(maintenanceTransactions), [maintenanceTransactions]);
  const etleStats = useMemo(() => calculateKpiStats(etleTransactions), [etleTransactions]);

  const getPercentChange = (current: number, prior: number) => {
    const safeCurrent = Number(current) || 0;
    const safePrior = Number(prior) || 0;
    if (safePrior === 0 || isNaN(safePrior) || isNaN(safeCurrent)) {
      return safeCurrent > 0 ? { percent: 100, isUp: true } : { percent: 0, isUp: true };
    }
    const diff = safeCurrent - safePrior;
    const pct = Math.round((diff / safePrior) * 100);
    const safePct = isNaN(pct) || !Number.isFinite(pct) ? 0 : pct;
    return { percent: Math.abs(safePct), isUp: safePct >= 0 };
  };

  const countChange = getPercentChange(activeCount, priorCount);
  const valueChange = getPercentChange(activeValue, priorValue);

  // Check if current user is Division Head or Regional Head for clean view
  const isCleanExecutive = hasRole(currentUser?.role, 'Division Head') || 
                           (isRegionalHeadRole(currentUser?.role as string)) || 
                           hasRole(currentUser?.role, 'RBU') || 
                           hasRole(currentUser?.role, 'RH');

  const [selectedBsoFilter, setSelectedBsoFilter] = useState<string>('Semua BSO');
  const [bsoSearchInput, setBsoSearchInput] = useState<string>('');

  const isMegabranchContext = useMemo(() => {
    return hasRole(currentUser?.role, 'ASO Megabranch') || 
      currentUser?.branch === 'Megabranch' || 
      (currentUser?.branch && currentUser.branch.includes('Megabranch')) ||
      selectedBranchFilters.includes('Megabranch') ||
      selectedBranchFilters.some(sf => MEGABRANCH_LIST.some(mb => mb.toLowerCase() === sf.toLowerCase()));
  }, [currentUser, selectedBranchFilters]);

  // 3. Main stats calculation based on filtered subset (Memoized)
  const {
    totalCount,
    lunasCount,
    lunasValue,
    pendingCount,
    pendingValue,
    rejectCount,
    rejectValue,
    stage1Input,
    stage2InAso,
    stage3AtAdmin,
    stage4ApproveSH,
    stage4ApproveKacab,
    stage5RegionalApprove,
    stage6DivisionApprove,
    stage7Invoice,
    stage8Payment,
    categoryStats,
    branchStats,
    categoryPipelines,
    dueSoonCount,
    pendingOldCount,
    over30DaysOsCount
  } = useMemo(() => {
    const totalCountVal = filteredTransactions.length;
    
    let lCount = 0;
    let lValue = 0;
    
    let pCount = 0;
    let pValue = 0;
    
    let rCount = 0;
    let rValue = 0;

    // Pipeline stage counters (9 stages)
    let s1Input = 0;
    let s2InAso = 0;
    let s3AtAdmin = 0;
    let s4ApproveSH = 0;
    let s4ApproveKacab = 0;
    let s5RegionalApprove = 0;
    let s6DivisionApprove = 0;
    let s7Invoice = 0;
    let s8Payment = 0;

    // Category counts
    const catStats: Record<BackchargeCategory, { count: number; value: number }> = {
      'Own Risk': { count: 0, value: 0 },
      'Maintenance': { count: 0, value: 0 },
      'Ekspedisi': { count: 0, value: 0 },
      'ETLE': { count: 0, value: 0 },
      'TPL': { count: 0, value: 0 },
      'Unclaimable Insurance': { count: 0, value: 0 },
      'Dokumen Kendaraan': { count: 0, value: 0 }
    };

    const bStats: Record<string, { total: number; value: number; resolved: number; pending: number }> = {};
    branchList.forEach(b => {
      bStats[b] = { total: 0, value: 0, resolved: 0, pending: 0 };
    });

    const catPipelines: Record<BackchargeCategory, {
      stage1Input: number;
      stage1InputValue: number;
      stage2InAso: number;
      stage2InAsoValue: number;
      stage3AtAdmin: number;
      stage3AtAdminValue: number;
      stage4ApproveSH: number;
      stage4ApproveSHValue: number;
      stage4ApproveKacab: number;
      stage4ApproveKacabValue: number;
      stage5RegionalApprove: number;
      stage5RegionalApproveValue: number;
      stage6DivisionApprove: number;
      stage6DivisionApproveValue: number;
      stage7Invoice: number;
      stage7InvoiceValue: number;
      stageSudahInvoiceBlmBayar: number;
      stageSudahInvoiceBlmBayarValue: number;
      stage8Lunas: number;
      stage8LunasValue: number;
      stageReject: number;
      stageRejectValue: number;
    }> = {
      'Own Risk': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'Maintenance': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'Ekspedisi': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'ETLE': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'TPL': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'Unclaimable Insurance': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 },
      'Dokumen Kendaraan': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveSH: 0, stage4ApproveSHValue: 0, stage4ApproveKacab: 0, stage4ApproveKacabValue: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0, stageSudahInvoiceBlmBayar: 0, stageSudahInvoiceBlmBayarValue: 0, stage8Lunas: 0, stage8LunasValue: 0, stageReject: 0, stageRejectValue: 0 }
    };

    filteredTransactions.forEach(t => {
      const val = Number(t.value) || 0;
      const cat = t.category;

      // Category distribution
      if (catStats[cat]) {
        catStats[cat].count++;
        catStats[cat].value += val;
      }

      // Branch matrix
      const branchName = t.branch;
      if (userBranches && !userBranches.some(ub => ub.toLowerCase() === branchName.toLowerCase())) {
        return;
      }
      if (bStats[branchName]) {
        bStats[branchName].total++;
        bStats[branchName].value += val;
        if (t.status_payment === 'Lunas') {
          bStats[branchName].resolved++;
        } else {
          bStats[branchName].pending++;
        }
      } else {
        bStats[branchName] = {
          total: 1,
          value: val,
          resolved: t.status_payment === 'Lunas' ? 1 : 0,
          pending: t.status_payment !== 'Lunas' ? 1 : 0
        };
      }

      // Status breakdown
      const isNotBill = t.status_sap === 'Not Bill' || String(t.status_sap || '').toLowerCase() === 'not bill';

      if (t.status_payment === 'Lunas') {
        lCount++;
        lValue += val;
      } else if (
        isNotBill ||
        t.status_approval === 'Ditolak' || 
        t.regional_approval_status === 'Ditolak' || 
        t.division_approval_status === 'Ditolak' || 
        t.status_confirm === 'Ditolak / Negosiasi Ulang'
      ) {
        rCount++;
        rValue += val;
      } else {
        pCount++;
        pValue += val;
      }

      // Stage 1 is cumulative: total registered cases
      s1Input = filteredTransactions.length;

      // Pipeline classification
      const transVal = Number(t.value) || 0;
      const isMaintenance = t.category === 'Maintenance';
      const isRegionalHeadReq = isMaintenance 
        ? (transVal > 7500000) 
        : (transVal > 5000000);
      const isDivisionHeadReq = transVal > 15000000;

      const isDocRejected = Boolean(
        isNotBill ||
        t.status_approval === 'Ditolak' || 
        t.regional_approval_status === 'Ditolak' || 
        t.division_approval_status === 'Ditolak' || 
        t.status_confirm === 'Ditolak / Negosiasi Ulang'
      );

      const isPendingL1 = !t.status_approval || t.status_approval === 'Belum Approval' || t.status_approval === 'Pending';
      const isL1Approved = t.status_approval === 'Disetujui';
      const isRegionalApproved = !isRegionalHeadReq || t.regional_approval_status === 'Disetujui';
      const isDivisionApproved = !isDivisionHeadReq || t.division_approval_status === 'Disetujui';

      const stepInvoice = Boolean(t.no_invoice && typeof t.no_invoice === 'string' && t.no_invoice.trim() !== '' && t.no_invoice.trim() !== '-');
      const stepPayment = t.status_payment === 'Lunas';
      const isHandedOverAdmin = t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin';

      // Populate Category Pipeline (Counts & Values)
      if (catPipelines[cat]) {
        catPipelines[cat].stage1Input++;
        catPipelines[cat].stage1InputValue += transVal;

        // Pipeline Classification (consistent with DatabaseView.tsx stages)
        if (isDocRejected || isNotBill) {
          catPipelines[cat].stageReject++;
          catPipelines[cat].stageRejectValue += transVal;
        } else if (stepPayment) {
          catPipelines[cat].stage8Lunas++;
          catPipelines[cat].stage8LunasValue += transVal;
        } else if (!isHandedOverAdmin) {
          catPipelines[cat].stage2InAso++;
          catPipelines[cat].stage2InAsoValue += transVal;
        } else {
          // Handed over, not rejected, not paid -> Berkas di Admin or Approval or Invoice stage
          const isFullyApproved = (isL1Approved && isRegionalApproved && isDivisionApproved);
          
          if (!isFullyApproved) {
            catPipelines[cat].stage3AtAdmin++;
            catPipelines[cat].stage3AtAdminValue += transVal;

            // Approval bottleneck breakdown
            const isKacabCat = cat === 'Maintenance' || cat === 'TPL' || cat === 'Dokumen Kendaraan' || cat === 'Unclaimable Insurance';
            if (isPendingL1) {
              if (isKacabCat) {
                catPipelines[cat].stage4ApproveKacab++;
                catPipelines[cat].stage4ApproveKacabValue += transVal;
              } else {
                catPipelines[cat].stage4ApproveSH++;
                catPipelines[cat].stage4ApproveSHValue += transVal;
              }
            } else if (isL1Approved && isRegionalHeadReq && !isRegionalApproved) {
              catPipelines[cat].stage5RegionalApprove++;
              catPipelines[cat].stage5RegionalApproveValue += transVal;
            } else if (isL1Approved && isRegionalApproved && isDivisionHeadReq && !isDivisionApproved) {
              catPipelines[cat].stage6DivisionApprove++;
              catPipelines[cat].stage6DivisionApproveValue += transVal;
            }
          } else if (!stepInvoice) {
            catPipelines[cat].stage7Invoice++;
            catPipelines[cat].stage7InvoiceValue += transVal;
          } else {
            // Invoiced and not yet paid
            catPipelines[cat].stageSudahInvoiceBlmBayar++;
            catPipelines[cat].stageSudahInvoiceBlmBayarValue += transVal;
          }
        }
      }

      if (isDocRejected || isNotBill) {
        // Dokumen ditolak / Not Bill sudah tercatat di rCount / rValue dan stageReject
      } else if (stepPayment) {
        s8Payment++;
      } else if (!isHandedOverAdmin) {
        s2InAso++;
      } else if (!(isL1Approved && isRegionalApproved && isDivisionApproved)) {
        s3AtAdmin++;
      } else if (!stepInvoice) {
        s7Invoice++;
      }

      if (!stepInvoice && !stepPayment && !isNotBill && !isDocRejected && isHandedOverAdmin) {
        const isKacabCat = t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Dokumen Kendaraan' || t.category === 'Unclaimable Insurance';
        if (isPendingL1) {
          if (isKacabCat) {
            s4ApproveKacab++;
          } else {
            s4ApproveSH++;
          }
        } else if (isL1Approved && isRegionalHeadReq && !isRegionalApproved) {
          s5RegionalApprove++;
        } else if (isL1Approved && isRegionalApproved && isDivisionHeadReq && !isDivisionApproved) {
          s6DivisionApprove++;
        }
      }
    });

    const nowMsVal = Date.now();
    const getTxAgeDaysVal = (tx: Backcharge) => {
      const dStr = tx.tanggal || tx.created_at;
      if (!dStr) return 0;
      const ms = Date.parse(dStr);
      return isNaN(ms) ? 0 : Math.max(0, Math.floor((nowMsVal - ms) / (1000 * 60 * 60 * 24)));
    };

    const dsCount = filteredTransactions.filter(t => t.status_payment === 'Belum Bayar' && t.status_sap !== 'Not Bill' && getTxAgeDaysVal(t) > 15).length;
    const poCount = filteredTransactions.filter(t => t.status_payment === 'Belum Bayar' && t.status_sap !== 'Not Bill' && getTxAgeDaysVal(t) > 7).length;
    const o30Count = filteredTransactions.filter(t => t.status_payment === 'Belum Bayar' && t.status_sap !== 'Not Bill' && getTxAgeDaysVal(t) > 30).length;

    return {
      totalCount: totalCountVal,
      lunasCount: lCount,
      lunasValue: lValue,
      pendingCount: pCount,
      pendingValue: pValue,
      rejectCount: rCount,
      rejectValue: rValue,
      stage1Input: s1Input,
      stage2InAso: s2InAso,
      stage3AtAdmin: s3AtAdmin,
      stage4ApproveSH: s4ApproveSH,
      stage4ApproveKacab: s4ApproveKacab,
      stage5RegionalApprove: s5RegionalApprove,
      stage6DivisionApprove: s6DivisionApprove,
      stage7Invoice: s7Invoice,
      stage8Payment: s8Payment,
      categoryStats: catStats,
      branchStats: bStats,
      categoryPipelines: catPipelines,
      dueSoonCount: dsCount,
      pendingOldCount: poCount,
      over30DaysOsCount: o30Count
    };
  }, [filteredTransactions, branchList, userBranches]);

  const formatRupiah = (num: number) => {
    const safeNum = Number(num);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(isNaN(safeNum) ? 0 : safeNum);
  };



  // Generate real trend data for graphs based strictly on actual data
  const getTrendData = () => {
    if (filteredTransactions.length > 0) {
      const trendMap: Record<string, { count: number; value: number; rawDate: Date }> = {};
      filteredTransactions.forEach(t => {
        let dateObj: Date | null = null;
        
        if (t.tanggal) {
          if (t.tanggal.includes('/')) {
            const parts = t.tanggal.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const year = parseInt(parts[2], 10);
              dateObj = new Date(year, month, day);
            }
          } else if (t.tanggal.includes('-')) {
            const parts = t.tanggal.split('T')[0].split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const day = parseInt(parts[2], 10);
              dateObj = new Date(year, month, day);
            }
          } else {
            dateObj = new Date(t.tanggal);
          }
        }
        
        if ((!dateObj || isNaN(dateObj.getTime())) && t.created_at) {
          dateObj = new Date(t.created_at);
        }
        
        if (!dateObj || isNaN(dateObj.getTime())) {
          return;
        }
        
        // Format as "DD MMM"
        const day = dateObj.getDate().toString().padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const month = monthNames[dateObj.getMonth()];
        const label = `${day} ${month}`;
        
        const val = Number(t.value) || 0;
        if (!trendMap[label]) {
          trendMap[label] = { count: 0, value: 0, rawDate: dateObj };
        }
        trendMap[label].count++;
        trendMap[label].value += val;
      });
      
      const sorted = Object.entries(trendMap)
        .map(([label, info]) => ({
          label,
          count: info.count,
          valueInMillions: Number((info.value / 1_000_000).toFixed(2)),
          rawDate: info.rawDate
        }))
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
      
      return sorted;
    }
    
    return [];
  };

  const trendData = getTrendData();

  // Top 5 cases with highest bill value
  const topHighestValueTransactions = [...filteredTransactions]
    .map(t => ({
      ...t,
      leadTimeDays: getTxAgeDays(t)
    }))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 5);

  // Top 5 customers with highest cumulative bill value
  const topCustomers = (() => {
    const customerMap: Record<string, { 
      name: string; 
      cases: number; 
      totalValue: number; 
      branches: Record<string, number>; 
      categories: Record<string, number>; 
    }> = {};

    filteredTransactions.forEach(t => {
      const name = t.customer_name || 'Umum / Unknown';
      const val = Number(t.value) || 0;
      if (!customerMap[name]) {
        customerMap[name] = { 
          name, 
          cases: 0, 
          totalValue: 0, 
          branches: {}, 
          categories: {} 
        };
      }
      customerMap[name].cases++;
      customerMap[name].totalValue += val;
      
      if (t.branch) {
        customerMap[name].branches[t.branch] = (customerMap[name].branches[t.branch] || 0) + 1;
      }
      if (t.category) {
        customerMap[name].categories[t.category] = (customerMap[name].categories[t.category] || 0) + 1;
      }
    });

    return Object.values(customerMap)
      .map(c => {
        const mainBranch = Object.entries(c.branches).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const domCategory = Object.entries(c.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        return {
          name: c.name,
          casesCount: c.cases,
          totalValue: c.totalValue,
          branch: mainBranch,
          category: domCategory
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  })();

  // Top 5 customers for Maintenance category
  const maintenanceTopCustomers = useMemo(() => {
    const map: Record<string, { name: string; cases: number; totalValue: number }> = {};
    filteredTransactions.forEach(t => {
      if (t.category === 'Maintenance') {
        const name = t.customer_name || 'Umum / Unknown';
        const val = Number(t.value) || 0;
        if (!map[name]) {
          map[name] = { name, cases: 0, totalValue: 0 };
        }
        map[name].cases++;
        map[name].totalValue += val;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Top 5 customers for ETLE category
  const etleTopCustomers = useMemo(() => {
    const map: Record<string, { name: string; cases: number; totalValue: number }> = {};
    filteredTransactions.forEach(t => {
      if (t.category === 'ETLE') {
        const name = t.customer_name || 'Umum / Unknown';
        const val = Number(t.value) || 0;
        if (!map[name]) {
          map[name] = { name, cases: 0, totalValue: 0 };
        }
        map[name].cases++;
        map[name].totalValue += val;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Download filtered data in XLS Excel format
  const handleDownloadExcel = () => {
    if (filteredTransactions.length === 0) {
      if (addToast) addToast('Tidak ada data dalam periode ini untuk diunduh', 'error');
      return;
    }

    const formatDateOnly = (dateStr?: string | null) => {
      if (!dateStr) return '-';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    try {
      // Calculate Summary Metrics for Management
      const totalTransactions = filteredTransactions.length;
      const totalValue = filteredTransactions.reduce((acc, t) => acc + (Number(t.value) || 0), 0);
      
      const lunasTx = filteredTransactions.filter(t => t.status_payment === 'Lunas');
      const totalLunasCount = lunasTx.length;
      const totalLunasValue = lunasTx.reduce((acc, t) => acc + (Number(t.value) || 0), 0);
      const pctLunasValue = totalValue > 0 ? Math.round((totalLunasValue / totalValue) * 100) : 0;

      const belumBayarTx = filteredTransactions.filter(t => t.status_payment !== 'Lunas');
      const totalBelumBayarCount = belumBayarTx.length;
      const totalBelumBayarValue = totalValue - totalLunasValue;

      const divApprovedCount = filteredTransactions.filter(t => t.division_approval_status === 'Disetujui').length;
      const pctDivApproved = totalTransactions > 0 ? Math.round((divApprovedCount / totalTransactions) * 100) : 0;

      const userName = currentUser?.full_name || 'Admin';
      const userRoleName = currentUser?.role || 'Executive';

      let excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Laporan Executive ASSA</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; }
            
            /* Typography */
            .title-text { font-size: 16px; font-weight: bold; color: #1e3a8a; text-align: left; }
            .subtitle-text { font-size: 10px; color: #475569; text-align: left; }
            
            /* KPI Cards */
            .kpi-title { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 10px; text-align: center; border: 1px solid #1e293b; padding: 6px; }
            .kpi-value-blue { background-color: #f8fafc; color: #1e40af; font-weight: bold; font-size: 15px; text-align: center; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 8px; }
            .kpi-value-green { background-color: #f8fafc; color: #15803d; font-weight: bold; font-size: 15px; text-align: center; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 8px; }
            .kpi-value-red { background-color: #f8fafc; color: #b91c1c; font-weight: bold; font-size: 15px; text-align: center; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 8px; }
            .kpi-value-orange { background-color: #f8fafc; color: #c2410c; font-weight: bold; font-size: 15px; text-align: center; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 8px; }
            .kpi-desc { background-color: #f1f5f9; color: #64748b; font-size: 9px; text-align: center; border: 1px solid #cbd5e1; padding: 4px; }
            
            /* Table Formatting */
            .header-row th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-size: 11px; border: 1px solid #0f172a; padding: 12px 6px; text-align: center; }
            td { border: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; vertical-align: middle; }
            
            /* Zebra striping */
            .row-even { background-color: #f8fafc; }
            .row-odd { background-color: #ffffff; }
            
            /* Cell formatting alignments and formats */
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono { font-family: 'Consolas', 'Courier New', monospace; }
            
            /* Excel formatting structures */
            .force-text { mso-number-format: "\\@"; }
            .currency-format { mso-number-format: "IDR\\ #\\,\\#\\#0"; text-align: right; font-weight: bold; }
            .number-format { mso-number-format: "\\#\\,\\#\\#0"; text-align: right; }
            
            /* Status pill styling in Excel */
            .status-lunas { background-color: #dcfce7; color: #15803d; font-weight: bold; text-align: center; }
            .status-belum-bayar { background-color: #fee2e2; color: #b91c1c; font-weight: bold; text-align: center; }
            
            .status-approved { background-color: #ecfdf5; color: #047857; font-weight: bold; text-align: center; }
            .status-pending { background-color: #fffbeb; color: #b45309; font-weight: bold; text-align: center; }
            .status-rejected { background-color: #fef2f2; color: #b91c1c; font-weight: bold; text-align: center; }
            
            .status-handover-done { background-color: #eff6ff; color: #1d4ed8; font-weight: bold; text-align: center; }
            .status-handover-pending { background-color: #f8fafc; color: #64748b; text-align: center; }
            
            .total-row { background-color: #e2e8f0; font-weight: bold; border-top: 2px double #0f172a; border-bottom: 2px double #0f172a; }
          </style>
        </head>
        <body>
          <table>
            <!-- TITLE HEADER BLOCK -->
            <tr>
              <td colspan="22" class="title-text" style="border: none;">PT ADI SARANA ARMADA, TBK (ASSA)</td>
            </tr>
            <tr>
              <td colspan="22" class="title-text" style="font-size: 14px; color: #475569; border: none;">LAPORAN EXECUTIVE REKAPITULASI DATA BACKCHARGE</td>
            </tr>
            <tr>
              <td colspan="22" class="subtitle-text" style="border: none; padding-bottom: 15px;">
                Filter Periode: <strong>${startDate} s/d ${endDate}</strong> | Unduh Oleh: <strong>${userName} (${userRoleName})</strong> | Tanggal Unduh: ${new Date().toLocaleString('id-ID')} | Total Item: <strong>${totalTransactions}</strong>
              </td>
            </tr>
            <tr><td colspan="22" style="border: none; height: 10px;"></td></tr>

            <!-- EXECUTIVE SUMMARY METRIC CARDS -->
            <tr>
              <td colspan="5" class="kpi-title">TOTAL PORTFOLIO BACKCHARGE</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-title">STATUS PEMBAYARAN (LUNAS)</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-title">STATUS OUTSTANDING (BELUM BAYAR)</td>
              <td style="border: none;"></td>
              <td colspan="4" class="kpi-title">APPROVAL STATUS (DIVISI HEAD)</td>
            </tr>
            <tr>
              <td colspan="5" class="kpi-value-blue" style="mso-number-format: 'IDR\\ #\\,\\#\\#0';">${totalValue}</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-value-green" style="mso-number-format: 'IDR\\ #\\,\\#\\#0';">${totalLunasValue}</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-value-red" style="mso-number-format: 'IDR\\ #\\,\\#\\#0';">${totalBelumBayarValue}</td>
              <td style="border: none;"></td>
              <td colspan="4" class="kpi-value-orange">${divApprovedCount} / ${totalTransactions}</td>
            </tr>
            <tr>
              <td colspan="5" class="kpi-desc">Dari Akumulasi <strong>${totalTransactions} Kasus</strong> Backcharge</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-desc">Tingkat Kolektabilitas: <strong>${pctLunasValue}%</strong> (${totalLunasCount} Kasus)</td>
              <td style="border: none;"></td>
              <td colspan="5" class="kpi-desc">Total Kasus Outstanding: <strong>${totalBelumBayarCount} Item</strong></td>
              <td style="border: none;"></td>
              <td colspan="4" class="kpi-desc">Persetujuan Akhir: <strong>${pctDivApproved}% Disetujui</strong></td>
            </tr>
            
            <!-- SPACING -->
            <tr><td colspan="22" style="border: none; height: 15px;"></td></tr>

            <!-- TABLE HEADER ROW -->
            <thead>
              <tr class="header-row">
                <th style="width: 40px;">No</th>
                <th style="width: 110px;">ID Transaksi</th>
                <th style="width: 90px;">Tanggal BAK</th>
                <th style="width: 100px;">Kategori</th>
                <th style="width: 90px;">Cabang Kota</th>
                <th style="width: 120px;">No BAK</th>
                <th style="width: 110px;">No Surat Tilang</th>
                <th style="width: 120px;">No SPK</th>
                <th style="width: 120px;">No SAP</th>
                <th style="width: 180px;">Nama Customer</th>
                <th style="width: 90px;">No Polisi</th>
                <th style="width: 120px;">Nilai Backcharge</th>
                <th style="width: 80px;">Status SAP</th>
                <th style="width: 110px;">Serah Terima</th>
                <th style="width: 110px;">No Invoice</th>
                <th style="width: 90px;">Status Bayar</th>
                <th style="width: 130px;">Nama PIC</th>
                <th style="width: 180px;">Alasan/Keterangan Backcharge</th>
                <th style="width: 110px;">Appr. ASO/Sales</th>
                <th style="width: 110px;">Appr. Regional</th>
                <th style="width: 110px;">Appr. Divisi</th>
                <th style="width: 130px;">Tanggal Diinput</th>
              </tr>
            </thead>
            <tbody>
      `;

      filteredTransactions.forEach((t, index) => {
        const isEven = index % 2 === 0;
        const rowClass = isEven ? 'row-even' : 'row-odd';

        const pStatus = t.status_payment === 'Lunas' ? 'status-lunas' : 'status-belum-bayar';
        
        const appASO = t.status_approval === 'Disetujui' ? 'status-approved' : 
                       t.status_approval === 'Ditolak' ? 'status-rejected' : 'status-pending';
                       
        const appReg = t.regional_approval_status === 'Disetujui' ? 'status-approved' : 
                       t.regional_approval_status === 'Ditolak' ? 'status-rejected' : 'status-pending';
                       
        const appDiv = t.division_approval_status === 'Disetujui' ? 'status-approved' : 
                       t.division_approval_status === 'Ditolak' ? 'status-rejected' : 'status-pending';
                       
        const hStatus = t.status_handover === 'Diterima Admin' || t.status_handover === 'Diserahkan ke Admin' 
                        ? 'status-handover-done' : 'status-handover-pending';

        const brokerName = t.nama_bro || t.bro_name || '-';
        const reasonText = t.alasan || '-';

        excelTemplate += `
          <tr class="${rowClass}">
            <td class="text-center number-format">${index + 1}</td>
            <td class="force-text" style="font-weight: bold; color: #1e3a8a;">${t.id}</td>
            <td class="text-center">${formatDateOnly(t.tanggal)}</td>
            <td>${t.category}</td>
            <td class="text-center" style="font-weight: 500;">${t.branch}</td>
            <td class="force-text">${t.no_bak || '-'}</td>
            <td class="force-text">${t.no_tilang || '-'}</td>
            <td class="force-text">${t.no_spk || '-'}</td>
            <td class="force-text">${t.no_sap || '-'}</td>
            <td style="font-weight: 500;">${t.customer_name}</td>
            <td class="font-mono text-center force-text" style="font-weight: bold;">${t.license_plate || '-'}</td>
            <td class="currency-format">${t.value}</td>
            <td class="text-center force-text" style="font-weight: 500;">${t.status_sap || '-'}</td>
            <td class="${hStatus}">${t.status_handover}</td>
            <td class="force-text">${t.no_invoice || '-'}</td>
            <td class="${pStatus}">${t.status_payment}</td>
            <td>${brokerName}</td>
            <td>${reasonText}</td>
            <td class="${appASO}">${t.status_approval || 'Belum Approval'}</td>
            <td class="${appReg}">${t.regional_approval_status || 'Belum Approval'}</td>
            <td class="${appDiv}">${t.division_approval_status || 'Belum Approval'}</td>
            <td class="text-center subtitle-text">${t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : '-'}</td>
          </tr>
        `;
      });

      excelTemplate += `
              <tr class="total-row">
                <td colspan="11" style="text-align: right; padding: 10px; font-size: 11px;">GRAND TOTAL REKAPITULASI:</td>
                <td class="currency-format" style="font-size: 11px;">${totalValue}</td>
                <td colspan="10" style="background-color: #e2e8f0;"></td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Executive_ASSA_${startDate}_${endDate}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (addToast) addToast('Berhasil mengunduh data Backcharge format Excel Executive!', 'success');
    } catch (err: any) {
      if (addToast) addToast('Gagal memproses ekspor data: ' + err.message, 'error');
    }
  };

  // Download PDF / print window trigger
  const handlePrintPDF = () => {
    if (addToast) addToast('Menyiapkan format cetak laporan...', 'info');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Mock saving filters

  // Mock Email Ringkasan sender
  const handleSendEmailReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress.trim()) return;
    
    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setShowEmailModal(false);
      if (addToast) {
        addToast(`Ringkasan eksekutif Backcharge berhasil dikirim ke ${emailAddress}!`, 'success');
      }
    }, 1200);
  };

  // Active filter statistics for Category progress bars
  const totalCategoryCases = useMemo(() => {
    return (Object.values(categoryStats) as { count: number; value: number }[]).reduce((acc, curr) => acc + curr.count, 0);
  }, [categoryStats]);

  // Base branches list for Executive KPI Cards and Top 3 detection
  const baseBranchStatsList = useMemo(() => {
    return Object.keys(branchStats)
      .filter(branch => {
        if (selectedBranchFilters.length > 0) {
          return selectedBranchFilters.some(sf => branch.toLowerCase() === sf.toLowerCase());
        }
        if (!userBranches || userBranches.length === 0) return true;
        return userBranches.some(ub => ub.toLowerCase() === branch.toLowerCase());
      })
      .map(branch => {
        const stats = branchStats[branch];
        const ratio = stats.total > 0 && !isNaN(stats.resolved) ? Math.max(0, Math.min(100, Math.round((stats.resolved / stats.total) * 100))) : 0;
        return {
          name: branch,
          totalCases: stats.total,
          totalValue: stats.value,
          resolved: stats.resolved,
          pending: stats.pending,
          ratio
        };
      });
  }, [branchStats, selectedBranchFilters, userBranches]);

  // Calculate Executive Branch KPIs (Memoized)
  const branchKPIs = useMemo(() => {
    const totalActiveBranchesCountVal = baseBranchStatsList.filter(b => b.totalCases > 0).length;
    const totalBranchesValueSumVal = baseBranchStatsList.reduce((sum, b) => sum + b.totalValue, 0);
    const totalBranchesCasesSumVal = baseBranchStatsList.reduce((sum, b) => sum + b.totalCases, 0);
    const totalBranchesResolvedSumVal = baseBranchStatsList.reduce((sum, b) => sum + b.resolved, 0);
    
    const avgNationalSettlementRatioVal = totalBranchesCasesSumVal > 0 
      ? Math.round((totalBranchesResolvedSumVal / totalBranchesCasesSumVal) * 100) 
      : 0;

    // Find Top Performer branch (highest ratio, breaking ties with totalCases or totalValue)
    const topBranchObjVal = baseBranchStatsList.length > 0
      ? [...baseBranchStatsList]
          .filter(b => b.totalCases > 0)
          .sort((a, b) => b.ratio - a.ratio || b.totalCases - a.totalCases || b.totalValue - a.totalValue)[0]
      : null;

    // Identify Top 3 branches globally for achievements badges
    const absoluteTop3NamesVal = [...baseBranchStatsList]
      .filter(b => b.totalCases > 0)
      .sort((a, b) => b.ratio - a.ratio || b.totalCases - a.totalCases)
      .slice(0, 3)
      .map(b => b.name);

    return {
      totalActiveBranchesCount: totalActiveBranchesCountVal,
      totalBranchesValueSum: totalBranchesValueSumVal,
      totalBranchesCasesSum: totalBranchesCasesSumVal,
      totalBranchesResolvedSum: totalBranchesResolvedSumVal,
      avgNationalSettlementRatio: avgNationalSettlementRatioVal,
      topBranchObj: topBranchObjVal,
      absoluteTop3Names: absoluteTop3NamesVal
    };
  }, [baseBranchStatsList]);

  const {
    totalActiveBranchesCount,
    totalBranchesValueSum,
    totalBranchesCasesSum,
    totalBranchesResolvedSum,
    avgNationalSettlementRatio,
    topBranchObj,
    absoluteTop3Names
  } = branchKPIs;

  // Helper to resolve beautiful pastel colors per branch
  const getBranchBadgeColor = (branchName: string) => {
    let hash = 0;
    for (let i = 0; i < branchName.length; i++) {
      hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      { bg: 'bg-blue-50 border-blue-200 text-blue-700', hoverBg: 'group-hover:bg-blue-100 group-hover:text-blue-800' },
      { bg: 'bg-purple-50 border-purple-200 text-purple-700', hoverBg: 'group-hover:bg-purple-100 group-hover:text-purple-800' },
      { bg: 'bg-indigo-50 border-orange-200 text-indigo-700', hoverBg: 'group-hover:bg-indigo-100 group-hover:text-orange-800' },
      { bg: 'bg-rose-50 border-rose-200 text-rose-700', hoverBg: 'group-hover:bg-rose-100 group-hover:text-rose-800' },
      { bg: 'bg-amber-50 border-amber-200 text-amber-700', hoverBg: 'group-hover:bg-amber-100 group-hover:text-amber-800' },
      { bg: 'bg-teal-50 border-teal-200 text-teal-700', hoverBg: 'group-hover:bg-teal-100 group-hover:text-teal-800' },
      { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', hoverBg: 'group-hover:bg-emerald-100 group-hover:text-emerald-800' },
      { bg: 'bg-cyan-50 border-cyan-200 text-cyan-700', hoverBg: 'group-hover:bg-cyan-100 group-hover:text-cyan-800' },
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Filter, search and sort branches dynamically for grid rendering (Memoized)
  const processedBranches = useMemo(() => {
    let list = baseBranchStatsList.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()));

    // Apply Quick Performance Filters
    if (branchPerformanceFilter === 'low') {
      list = list.filter(b => b.ratio < 10);
    } else if (branchPerformanceFilter === 'top10') {
      list = [...list]
        .sort((a, b) => b.ratio - a.ratio || b.totalCases - a.totalCases)
        .slice(0, 10);
    }

    // Sort the final result based on selection (TOP 1, TOP 2, TOP 3, then nominal terkecil ke terbesar)
    list.sort((a, b) => {
      if (branchSort === 'top3-value-asc') {
        const top1 = absoluteTop3Names[0];
        const top2 = absoluteTop3Names[1];
        const top3 = absoluteTop3Names[2];

        const getRankPriority = (name: string) => {
          if (name === top1) return 1;
          if (name === top2) return 2;
          if (name === top3) return 3;
          return 4;
        };

        const rankA = getRankPriority(a.name);
        const rankB = getRankPriority(b.name);

        if (rankA !== rankB) {
          return rankA - rankB;
        }

        // Rank 4: Remaining branches after TOP 1, 2, 3 sorted from nominal terkecil ke terbesar
        if (a.totalValue !== b.totalValue) {
          return a.totalValue - b.totalValue;
        }
        if (a.totalCases !== b.totalCases) {
          return a.totalCases - b.totalCases;
        }
        return a.name.localeCompare(b.name);
      }

      if (branchSort === 'total-desc') return b.totalCases - a.totalCases;
      if (branchSort === 'total-asc') return a.totalCases - b.totalCases;
      if (branchSort === 'value-desc') return b.totalValue - a.totalValue;
      if (branchSort === 'value-asc') return a.totalValue - b.totalValue;
      if (branchSort === 'ratio-desc') return b.ratio - a.ratio;
      return 0;
    });

    return list;
  }, [baseBranchStatsList, branchSearch, branchPerformanceFilter, branchSort, absoluteTop3Names]);

  // Drill down branch transactions filtering (Memoized)
  const drillDownTransactions = useMemo(() => {
    return filteredTransactions.filter(t => {
      if (t.branch !== selectedDrillDownBranch) return false;
      if (!drillDownSearch.trim()) return true;
      const s = drillDownSearch.toLowerCase();
      return t.id.toLowerCase().includes(s) || 
             t.customer_name.toLowerCase().includes(s) || 
             t.license_plate.toLowerCase().includes(s);
    });
  }, [filteredTransactions, selectedDrillDownBranch, drillDownSearch]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12 font-sans animate-pulse">
        {/* HEADER BAR SKELETON */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-7 bg-slate-200/80 rounded-xl w-72 md:w-96" />
              <div className="h-4 bg-slate-200/50 rounded-lg w-52" />
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-200/60 rounded-xl" />
              <div className="space-y-1.5 text-right">
                <div className="h-4 bg-slate-200/70 rounded-md w-24 ml-auto" />
                <div className="h-3 bg-slate-200/40 rounded-md w-16 ml-auto" />
              </div>
              <div className="w-10 h-10 bg-slate-200/80 rounded-full" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 bg-slate-200/50 rounded w-32" />
            <div className="h-3 bg-slate-200/50 rounded w-40" />
          </div>
        </div>

        {/* 1. FILTER GLOBAL & ALERTS SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-white p-4 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <div className="h-4 bg-slate-200/60 rounded w-40" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="h-3 bg-slate-200/40 rounded w-12" />
                <div className="h-10 bg-slate-200/60 rounded-xl" />
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-slate-200/40 rounded w-12" />
                <div className="h-10 bg-slate-200/60 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-slate-200/40 rounded w-28" />
              <div className="h-10 bg-slate-200/60 rounded-xl" />
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-4 rounded-3xl border border-slate-200 shadow-md space-y-3">
            <div className="h-4 bg-slate-200/60 rounded w-44" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
            </div>
          </div>
        </div>

        {/* 2. STATS SUMMARIES SKELETON */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200/50 rounded w-20" />
              <div className="w-8 h-8 bg-slate-200/60 rounded-full" />
            </div>
            <div className="h-7 bg-slate-200/80 rounded-xl w-24" />
            <div className="h-3 bg-slate-200/40 rounded w-16" />
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200/50 rounded w-20" />
              <div className="w-8 h-8 bg-slate-200/60 rounded-full" />
            </div>
            <div className="h-7 bg-slate-200/80 rounded-xl w-28" />
            <div className="h-3 bg-slate-200/40 rounded w-20" />
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200/50 rounded w-20" />
              <div className="w-8 h-8 bg-slate-200/60 rounded-full" />
            </div>
            <div className="h-7 bg-slate-200/80 rounded-xl w-20" />
            <div className="h-3 bg-slate-200/40 rounded w-14" />
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200/50 rounded w-20" />
              <div className="w-8 h-8 bg-slate-200/60 rounded-full" />
            </div>
            <div className="h-7 bg-slate-200/80 rounded-xl w-32" />
            <div className="h-3 bg-slate-200/40 rounded w-24" />
          </div>
        </div>

        {/* 3. CHARTS SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-5 bg-slate-200/60 rounded w-48" />
              <div className="h-3 bg-slate-200/40 rounded w-24" />
            </div>
            <div className="h-64 bg-slate-200/30 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          </div>
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="h-5 bg-slate-200/60 rounded w-40" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
                    <div className="h-3 bg-slate-200/50 rounded w-20" />
                  </div>
                  <div className="h-4 bg-slate-200/70 rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      
      {/* HEADER BAR */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Pemantauan Progres Backcharge</h1>
            <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
              <span>PT ADI SARANA ARMADA TBK | Cabang: {currentUser?.branch || 'Pusat'}</span>
              {selectedBranchFilters.length > 0 && (
                <span className="bg-indigo-600 text-white font-black px-2.5 py-0.5 rounded-full text-[10px] shadow-sm">
                  Saringan Aktif: Cabang {selectedBranchFilters.join(', ')}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowChangePasswordModal(true)}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm hover:shadow text-slate-600 transition-all flex items-center justify-center cursor-pointer"
              title="Ubah Password"
            >
              <Lock className="w-4 h-4 text-indigo-600" />
            </button>
            <div className="text-right ml-2">
              <p className="text-xs font-black text-slate-900">{currentUser?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 font-medium">{currentUser?.role || 'User'}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-sm">
              {currentUser?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
        
        {/* Sub-header info */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            Real-time Database Active
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Terakhir diakses: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* 1. FILTER GLOBAL SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Filter Global &amp; Otoritas Cabang
            </label>
            <p className="text-[11px] text-slate-400">Saring ringkasan dashboard berdasarkan cabang otoritas &amp; rentang tanggal transaksi.</p>
          </div>
          {(startDate || endDate || selectedBranchFilters.length > 0) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedBranchFilters([]); }}
              className="text-xs font-extrabold text-red-500 hover:text-red-600 hover:underline transition-all cursor-pointer self-start sm:self-auto"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Branch Multi-Select Filter */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Map className="w-3.5 h-3.5 text-indigo-600 inline" />
              Cabang Otoritas:
            </span>
            <MultiSelect
              options={availableBranchOptions}
              selected={selectedBranchFilters}
              onChange={setSelectedBranchFilters}
              placeholder={
                currentUser?.branch === 'Nasional' || !currentUser?.branch || isNationalOrAllBranches(currentUser?.branch, currentUser?.role)
                  ? 'Semua Cabang (Nasional)'
                  : currentUser?.branch === 'Megabranch' || hasRole(currentUser?.role, 'ASO Megabranch')
                  ? 'Semua BSO Megabranch (8 BSO)'
                  : isRegionalHeadRole(currentUser?.role as string)
                  ? `Semua Cabang Wilayah (${availableBranchOptions.length} Cabang)`
                  : availableBranchOptions.length === 1 
                    ? `Cabang ${availableBranchOptions[0]}`
                    : `Semua Cabang Otoritas (${availableBranchOptions.length} Cabang)`
              }
            />
          </div>

          <div>
            <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5">Tanggal Mulai:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
            />
          </div>

          <div>
            <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5">Tanggal Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
            />
          </div>
        </div>
      </div>



      {/* 2B. EXECUTIVE KPI CARDS GRID - KHUSUS KATEGORI: MAINTENANCE */}
      <div className="space-y-3 pt-1">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 rounded-xl border border-blue-200 shadow-sm flex items-center justify-center">
              <Wrench className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                  KPI KHUSUS KATEGORI : MAINTENANCE
                </h3>
                <span className="text-[9.5px] font-extrabold bg-blue-100/80 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-xs">
                  Maintenance ({maintenanceTransactions.length} Kasus)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Rangkuman akrual &amp; realisasi tagihan tersinkronisasi 100% khusus kategori Maintenance.
              </p>
            </div>
          </div>
        </div>

        {/* 5 CARDS GRID KHUSUS MAINTENANCE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* CARD 1: S.D. CUTOFF BULAN LALU (MAINTENANCE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'Maintenance', endDate: maintenanceStats.cutoffDateStr })}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk menyaring data Maintenance s.d. cut-off ${maintenanceStats.cutoffDateLabel}`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    S.D. CUTOFF BULAN LALU
                  </span>
                </div>
                <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Cutoff
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-4">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {maintenanceStats.cutoffCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Transaksi</span>
                </div>
                <p className="text-base font-extrabold text-blue-700 mt-1 truncate">
                  {formatRupiah(maintenanceStats.cutoffValue)}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Akumulasi Maintenance sebelum bulan berjalan
                </p>
              </div>
            </div>

            {/* Footer Period / Cutoff Info */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-blue-600 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-blue-500 flex-shrink-0" />
                Cutoff {maintenanceStats.cutoffMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                s.d. {maintenanceStats.cutoffDateLabel}
              </span>
            </div>
          </div>

          {/* CARD 2: REALISASI & OS S.D. CUTOFF (MAINTENANCE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'Maintenance', statusPayment: 'Lunas', endDate: maintenanceStats.cutoffDateStr })}
            className="bg-white rounded-2xl border border-emerald-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk melihat rincian terbayar & OS Maintenance s.d. cutoff ${maintenanceStats.cutoffDateLabel}`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100/70">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TERBAYAR &amp; OS S.D. CUTOFF
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Realisasi
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-2.5">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight truncate">
                    {formatRupiah(maintenanceStats.cutoffLunasValue)}
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{maintenanceStats.cutoffLunasCount} Transaksi Lunas</span>
                </p>
              </div>

              {/* Semantic 2-Column Comparison Block */}
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {/* LUNAS BLOCK */}
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">LUNAS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-emerald-950 truncate">
                      {formatRupiah(maintenanceStats.cutoffLunasValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-emerald-700 mt-0.5">
                      {maintenanceStats.cutoffLunasCount} Transaksi
                    </div>
                  </div>
                </div>

                {/* OS BLOCK */}
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-amber-800">
                    <Clock className="w-3 h-3 flex-shrink-0 text-amber-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">OS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-amber-950 truncate">
                      {formatRupiah(maintenanceStats.cutoffOsValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-amber-800 mt-0.5">
                      {maintenanceStats.cutoffOsCount} Transaksi
                    </div>
                  </div>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(maintenanceStats.cutoffLunasRatio > 0 ? 3 : 0, maintenanceStats.cutoffLunasRatio)}%` }} 
                  />
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(maintenanceStats.cutoffOsRatio > 0 ? 3 : 0, maintenanceStats.cutoffOsRatio)}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-[8.5px] font-bold">
                  <span className="text-emerald-700">Lunas {formatRatio(maintenanceStats.cutoffLunasRatio)}</span>
                  <span className="text-amber-700">OS {formatRatio(maintenanceStats.cutoffOsRatio)}</span>
                </div>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-emerald-700 flex items-center truncate">
                <History className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />
                Cutoff {maintenanceStats.cutoffMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                s.d. {maintenanceStats.cutoffDateLabel}
              </span>
            </div>
          </div>

          {/* CARD 3: TOTAL BULAN BERJALAN (MAINTENANCE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'Maintenance', startDate: maintenanceStats.currentMonthStartStr, endDate: maintenanceStats.currentMonthEndStr })}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk menyaring transaksi Maintenance bulan berjalan (${maintenanceStats.currentMonthLabel})`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TOTAL BULAN BERJALAN
                  </span>
                </div>
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Bulan Ini
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-4">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {maintenanceStats.currentMonthCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Transaksi</span>
                </div>
                <p className="text-base font-extrabold text-purple-700 mt-1 truncate">
                  {formatRupiah(maintenanceStats.currentMonthValue)}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Total transaksi Maintenance periode aktif
                </p>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-purple-700 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-purple-600 flex-shrink-0" />
                {maintenanceStats.currentMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                1 - {maintenanceStats.lastDayCurrMonth} {maintenanceStats.currentMonthName}
              </span>
            </div>
          </div>

          {/* CARD 4: REALISASI & OS BULAN BERJALAN (MAINTENANCE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'Maintenance', statusPayment: 'Belum Bayar', startDate: maintenanceStats.currentMonthStartStr })}
            className="bg-white rounded-2xl border border-amber-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk melihat rincian terbayar & OS Maintenance bulan berjalan (${maintenanceStats.currentMonthLabel})`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-amber-100/70">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TERBAYAR &amp; OS BULAN BERJALAN
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Realisasi
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-2.5">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight truncate">
                    {formatRupiah(maintenanceStats.currentMonthLunasValue)}
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{maintenanceStats.currentMonthLunasCount} Transaksi Lunas</span>
                </p>
              </div>

              {/* Semantic 2-Column Comparison Block */}
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {/* LUNAS BLOCK */}
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">LUNAS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-emerald-950 truncate">
                      {formatRupiah(maintenanceStats.currentMonthLunasValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-emerald-700 mt-0.5">
                      {maintenanceStats.currentMonthLunasCount} Transaksi
                    </div>
                  </div>
                </div>

                {/* OS BLOCK */}
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-amber-800">
                    <Clock className="w-3 h-3 flex-shrink-0 text-amber-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">OS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-amber-950 truncate">
                      {formatRupiah(maintenanceStats.currentMonthOsValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-amber-800 mt-0.5">
                      {maintenanceStats.currentMonthOsCount} Transaksi
                    </div>
                  </div>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(maintenanceStats.currentMonthLunasRatio > 0 ? 3 : 0, maintenanceStats.currentMonthLunasRatio)}%` }} 
                  />
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(maintenanceStats.currentMonthOsRatio > 0 ? 3 : 0, maintenanceStats.currentMonthOsRatio)}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-[8.5px] font-bold">
                  <span className="text-emerald-700">Lunas {formatRatio(maintenanceStats.currentMonthLunasRatio)}</span>
                  <span className="text-amber-700">OS {formatRatio(maintenanceStats.currentMonthOsRatio)}</span>
                </div>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-amber-800 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-amber-600 flex-shrink-0" />
                {maintenanceStats.currentMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                1 - {maintenanceStats.lastDayCurrMonth} {maintenanceStats.currentMonthName}
              </span>
            </div>
          </div>

          {/* CARD 5: TOP 5 CUSTOMER TERTINGGI (MAINTENANCE) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 flex-shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TOP 5 CUSTOMER TERTINGGI
                  </span>
                </div>
                <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100 flex-shrink-0">
                  Maintenance
                </span>
              </div>

              {/* List of Top 5 Customers */}
              <div className="mt-3 space-y-2">
                {maintenanceTopCustomers.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada data customer</p>
                ) : (
                  maintenanceTopCustomers.map((cust, cIdx) => (
                    <div 
                      key={cust.name}
                      onClick={() => onSelectDashboardFilter?.({ category: 'Maintenance', customerName: cust.name })}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-orange-200 rounded-xl p-2.5 cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99]"
                      title={`Klik untuk melihat transaksi Maintenance dari ${cust.name}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          cIdx === 0 ? 'bg-amber-100 text-amber-800' : cIdx === 1 ? 'bg-slate-200 text-slate-700' : cIdx === 2 ? 'bg-amber-900 text-amber-100' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                            {cust.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {cust.cases} Kasus Transaksi
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-xs font-black text-slate-900 block">
                          {formatRupiah(cust.totalValue)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-500">
              <span className="font-bold">Klik customer untuk filter data</span>
              <span className="font-extrabold uppercase">Top 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2C. EXECUTIVE KPI CARDS GRID - KHUSUS KATEGORI: ETLE */}
      <div className="space-y-3 pt-1">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                  KPI KHUSUS KATEGORI : ETLE
                </h3>
                <span className="text-[9.5px] font-extrabold bg-amber-100/80 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200 shadow-xs">
                  ETLE ({etleTransactions.length} Kasus)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Rangkuman akrual &amp; realisasi tagihan tersinkronisasi 100% khusus kategori ETLE (Electronic Traffic Law Enforcement).
              </p>
            </div>
          </div>
        </div>

        {/* 5 CARDS GRID KHUSUS ETLE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* CARD 1: S.D. CUTOFF BULAN LALU (ETLE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'ETLE', endDate: etleStats.cutoffDateStr })}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk menyaring data ETLE s.d. cut-off ${etleStats.cutoffDateLabel}`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    S.D. CUTOFF BULAN LALU
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Cutoff
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-4">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {etleStats.cutoffCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Transaksi</span>
                </div>
                <p className="text-base font-extrabold text-amber-700 mt-1 truncate">
                  {formatRupiah(etleStats.cutoffValue)}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Akumulasi ETLE sebelum bulan berjalan
                </p>
              </div>
            </div>

            {/* Footer Period / Cutoff Info */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-amber-600 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-amber-500 flex-shrink-0" />
                Cutoff {etleStats.cutoffMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                s.d. {etleStats.cutoffDateLabel}
              </span>
            </div>
          </div>

          {/* CARD 2: REALISASI & OS S.D. CUTOFF (ETLE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'ETLE', statusPayment: 'Lunas', endDate: etleStats.cutoffDateStr })}
            className="bg-white rounded-2xl border border-emerald-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk melihat rincian terbayar & OS ETLE s.d. cutoff ${etleStats.cutoffDateLabel}`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100/70">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TERBAYAR &amp; OS S.D. CUTOFF
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Realisasi
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-2.5">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight truncate">
                    {formatRupiah(etleStats.cutoffLunasValue)}
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{etleStats.cutoffLunasCount} Transaksi Lunas</span>
                </p>
              </div>

              {/* Semantic 2-Column Comparison Block */}
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {/* LUNAS BLOCK */}
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">LUNAS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-emerald-950 truncate">
                      {formatRupiah(etleStats.cutoffLunasValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-emerald-700 mt-0.5">
                      {etleStats.cutoffLunasCount} Transaksi
                    </div>
                  </div>
                </div>

                {/* OS BLOCK */}
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-amber-800">
                    <Clock className="w-3 h-3 flex-shrink-0 text-amber-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">OS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-amber-950 truncate">
                      {formatRupiah(etleStats.cutoffOsValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-amber-800 mt-0.5">
                      {etleStats.cutoffOsCount} Transaksi
                    </div>
                  </div>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(etleStats.cutoffLunasRatio > 0 ? 3 : 0, etleStats.cutoffLunasRatio)}%` }} 
                  />
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(etleStats.cutoffOsRatio > 0 ? 3 : 0, etleStats.cutoffOsRatio)}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-[8.5px] font-bold">
                  <span className="text-emerald-700">Lunas {formatRatio(etleStats.cutoffLunasRatio)}</span>
                  <span className="text-amber-700">OS {formatRatio(etleStats.cutoffOsRatio)}</span>
                </div>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-emerald-700 flex items-center truncate">
                <History className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />
                Cutoff {etleStats.cutoffMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                s.d. {etleStats.cutoffDateLabel}
              </span>
            </div>
          </div>

          {/* CARD 3: TOTAL BULAN BERJALAN (ETLE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'ETLE', startDate: etleStats.currentMonthStartStr, endDate: etleStats.currentMonthEndStr })}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk menyaring transaksi ETLE bulan berjalan (${etleStats.currentMonthLabel})`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TOTAL BULAN BERJALAN
                  </span>
                </div>
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Bulan Ini
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-4">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {etleStats.currentMonthCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Transaksi</span>
                </div>
                <p className="text-base font-extrabold text-purple-700 mt-1 truncate">
                  {formatRupiah(etleStats.currentMonthValue)}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Total transaksi ETLE periode aktif
                </p>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-purple-700 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-purple-600 flex-shrink-0" />
                {etleStats.currentMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                1 - {etleStats.lastDayCurrMonth} {etleStats.currentMonthName}
              </span>
            </div>
          </div>

          {/* CARD 4: REALISASI & OS BULAN BERJALAN (ETLE) */}
          <div 
            onClick={() => onSelectDashboardFilter?.({ category: 'ETLE', statusPayment: 'Belum Bayar', startDate: etleStats.currentMonthStartStr })}
            className="bg-white rounded-2xl border border-amber-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer active:scale-[0.99] group"
            title={`Klik untuk melihat rincian terbayar & OS ETLE bulan berjalan (${etleStats.currentMonthLabel})`}
          >
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-amber-100/70">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TERBAYAR &amp; OS BULAN BERJALAN
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Realisasi
                </span>
              </div>

              {/* Main Primary Metric */}
              <div className="py-2.5">
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight truncate">
                    {formatRupiah(etleStats.currentMonthLunasValue)}
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{etleStats.currentMonthLunasCount} Transaksi Lunas</span>
                </p>
              </div>

              {/* Semantic 2-Column Comparison Block */}
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {/* LUNAS BLOCK */}
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">LUNAS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-emerald-950 truncate">
                      {formatRupiah(etleStats.currentMonthLunasValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-emerald-700 mt-0.5">
                      {etleStats.currentMonthLunasCount} Transaksi
                    </div>
                  </div>
                </div>

                {/* OS BLOCK */}
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center space-x-1 text-amber-800">
                    <Clock className="w-3 h-3 flex-shrink-0 text-amber-600" />
                    <span className="text-[9px] font-black tracking-wider uppercase">OS</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] sm:text-xs font-black text-amber-950 truncate">
                      {formatRupiah(etleStats.currentMonthOsValue)}
                    </div>
                    <div className="text-[9.5px] font-semibold text-amber-800 mt-0.5">
                      {etleStats.currentMonthOsCount} Transaksi
                    </div>
                  </div>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(etleStats.currentMonthLunasRatio > 0 ? 3 : 0, etleStats.currentMonthLunasRatio)}%` }} 
                  />
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500" 
                    style={{ width: `${Math.max(etleStats.currentMonthOsRatio > 0 ? 3 : 0, etleStats.currentMonthOsRatio)}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-[8.5px] font-bold">
                  <span className="text-emerald-700">Lunas {formatRatio(etleStats.currentMonthLunasRatio)}</span>
                  <span className="text-amber-700">OS {formatRatio(etleStats.currentMonthOsRatio)}</span>
                </div>
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
              <span className="font-extrabold text-amber-800 flex items-center truncate">
                <Calendar className="w-3 h-3 mr-1 text-amber-600 flex-shrink-0" />
                {etleStats.currentMonthName}
              </span>
              <span className="text-[8.5px] text-slate-400 font-semibold truncate">
                1 - {etleStats.lastDayCurrMonth} {etleStats.currentMonthName}
              </span>
            </div>
          </div>

          {/* CARD 5: TOP 5 CUSTOMER TERTINGGI (ETLE) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              {/* Header: Icon + Title + Pill */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 flex-shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-slate-700 truncate">
                    TOP 5 CUSTOMER TERTINGGI
                  </span>
                </div>
                <span className="text-[9px] font-extrabold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex-shrink-0">
                  ETLE
                </span>
              </div>

              {/* List of Top 5 Customers */}
              <div className="mt-3 space-y-2">
                {etleTopCustomers.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada data customer</p>
                ) : (
                  etleTopCustomers.map((cust, cIdx) => (
                    <div 
                      key={cust.name}
                      onClick={() => onSelectDashboardFilter?.({ category: 'ETLE', customerName: cust.name })}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-amber-200 rounded-xl p-2.5 cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99]"
                      title={`Klik untuk melihat transaksi ETLE dari ${cust.name}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          cIdx === 0 ? 'bg-amber-100 text-amber-800' : cIdx === 1 ? 'bg-slate-200 text-slate-700' : cIdx === 2 ? 'bg-amber-900 text-amber-100' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-700 transition-colors">
                            {cust.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {cust.cases} Kasus Transaksi
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-xs font-black text-slate-900 block">
                          {formatRupiah(cust.totalValue)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Period Info */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-500">
              <span className="font-bold">Klik customer untuk filter data</span>
              <span className="font-extrabold uppercase">Top 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3B. WORKFLOW PIPELINE PER KATEGORI (WITHOUT STAGE 8) - REDESIGNED TO MATRIX GRID */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-6 animate-in fade-in">
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Workflow Pipeline &amp; Bottleneck Analysis (Per Kategori)
            </h3>
            <p className="text-[11px] text-slate-400">Analisis matriks hambatan proses (Tahap 1 - 6) serta total realisasi pelunasan per kategori (Tahap 7).</p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative w-full sm:w-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Cari kategori..."
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              />
              {pipelineSearch && (
                <button
                  onClick={() => setPipelineSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Hide Empty Toggle */}
            <label className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl text-[11px] font-black text-slate-700 cursor-pointer hover:bg-slate-100 transition-all shadow-sm">
              <input
                type="checkbox"
                checked={hideEmptyPipelines}
                onChange={(e) => setHideEmptyPipelines(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
              />
              <span>Sembunyikan Kategori Kosong</span>
            </label>
          </div>
        </div>

        {/* Matrix computations */}
        {(() => {
          const allCategories: BackchargeCategory[] = ['Own Risk', 'Maintenance', 'Ekspedisi', 'ETLE', 'TPL', 'Unclaimable Insurance', 'Dokumen Kendaraan'];
          
          const filteredCategories = allCategories.filter(cat => {
            const matchesSearch = cat.toLowerCase().includes(pipelineSearch.toLowerCase());
            const count = categoryStats[cat]?.count || 0;
            const matchesEmpty = !hideEmptyPipelines || count > 0;
            return matchesSearch && matchesEmpty;
          });

          const getPipelineFilter = (extra: Partial<DashboardFilter>): DashboardFilter => {
            const isAllSelected = selectedBranchFilters.length === 0 || selectedBranchFilters.some(sf => isNationalOrAllBranches(sf));
            return {
              ...extra,
              ...(startDate ? { startDate } : {}),
              ...(endDate ? { endDate } : {}),
              ...(!isAllSelected ? { branch: selectedBranchFilters.join(',') } : {})
            };
          };

          // Metrics calculations
          let totalFilteredTransactions = 0;
          let totalFilteredValue = 0;
          let totalActiveBottleneckCells = 0;
          let totalPendingSlaTransactions = 0;
          let totalPendingSlaValue = 0;
          let totalLunasTransactions = 0;
          let totalLunasValue = 0;
          let totalRejectTransactions = 0;
          let totalRejectValue = 0;
          let totalStage1Aso = 0;
          let totalStage1AsoVal = 0;
          let totalStage2Admin = 0;
          let totalStage2AdminVal = 0;
          let totalStage3SH = 0;
          let totalStage3SHVal = 0;
          let totalStage3Kacab = 0;
          let totalStage3KacabVal = 0;
          let totalStage4RH = 0;
          let totalStage4RHVal = 0;
          let totalStage5DH = 0;
          let totalStage5DHVal = 0;
          let totalStage6Inv = 0;
          let totalStage6InvVal = 0;
          let totalStageSudahInv = 0;
          let totalStageSudahInvVal = 0;

          filteredCategories.forEach(cat => {
            const count = categoryStats[cat]?.count || 0;
            const catVal = categoryStats[cat]?.value || 0;
            totalFilteredTransactions += count;
            totalFilteredValue += catVal;

            const pipeline = categoryPipelines[cat] || {
              stage1Input: 0,
              stage1InputValue: 0,
              stage2InAso: 0,
              stage2InAsoValue: 0,
              stage3AtAdmin: 0,
              stage3AtAdminValue: 0,
              stage4ApproveSH: 0,
              stage4ApproveSHValue: 0,
              stage4ApproveKacab: 0,
              stage4ApproveKacabValue: 0,
              stage5RegionalApprove: 0,
              stage5RegionalApproveValue: 0,
              stage6DivisionApprove: 0,
              stage6DivisionApproveValue: 0,
              stage7Invoice: 0,
              stage7InvoiceValue: 0,
              stageSudahInvoiceBlmBayar: 0,
              stageSudahInvoiceBlmBayarValue: 0,
              stage8Lunas: 0,
              stage8LunasValue: 0,
              stageReject: 0,
              stageRejectValue: 0,
            };

            totalStage1Aso += (pipeline.stage2InAso || 0);
            totalStage1AsoVal += (pipeline.stage2InAsoValue || 0);
            totalStage2Admin += (pipeline.stage3AtAdmin || 0);
            totalStage2AdminVal += (pipeline.stage3AtAdminValue || 0);
            totalStage3SH += (pipeline.stage4ApproveSH || 0);
            totalStage3SHVal += (pipeline.stage4ApproveSHValue || 0);
            totalStage3Kacab += (pipeline.stage4ApproveKacab || 0);
            totalStage3KacabVal += (pipeline.stage4ApproveKacabValue || 0);
            totalStage4RH += (pipeline.stage5RegionalApprove || 0);
            totalStage4RHVal += (pipeline.stage5RegionalApproveValue || 0);
            totalStage5DH += (pipeline.stage6DivisionApprove || 0);
            totalStage5DHVal += (pipeline.stage6DivisionApproveValue || 0);
            totalStage6Inv += (pipeline.stage7Invoice || 0);
            totalStage6InvVal += (pipeline.stage7InvoiceValue || 0);
            totalStageSudahInv += (pipeline.stageSudahInvoiceBlmBayar || 0);
            totalStageSudahInvVal += (pipeline.stageSudahInvoiceBlmBayarValue || 0);
            totalLunasTransactions += (pipeline.stage8Lunas || 0);
            totalLunasValue += (pipeline.stage8LunasValue || 0);
            totalRejectTransactions += (pipeline.stageReject || 0);
            totalRejectValue += (pipeline.stageRejectValue || 0);

            if (pipeline.stage2InAso > 0) totalActiveBottleneckCells++;
            if (pipeline.stage3AtAdmin > 0) totalActiveBottleneckCells++;
            if (pipeline.stage4ApproveSH > 0) totalActiveBottleneckCells++;
            if (pipeline.stage4ApproveKacab > 0) totalActiveBottleneckCells++;
            if (pipeline.stage5RegionalApprove > 0) totalActiveBottleneckCells++;
            if (pipeline.stage6DivisionApprove > 0) totalActiveBottleneckCells++;
            if (pipeline.stage7Invoice > 0) totalActiveBottleneckCells++;
            if (pipeline.stageSudahInvoiceBlmBayar > 0) totalActiveBottleneckCells++;

            totalPendingSlaTransactions += 
              (pipeline.stage2InAso || 0) +
              (pipeline.stage4ApproveSH || 0) +
              (pipeline.stage4ApproveKacab || 0) +
              (pipeline.stage5RegionalApprove || 0) +
              (pipeline.stage6DivisionApprove || 0) +
              (pipeline.stage7Invoice || 0) +
              (pipeline.stageSudahInvoiceBlmBayar || 0);

            totalPendingSlaValue +=
              (pipeline.stage2InAsoValue || 0) +
              (pipeline.stage4ApproveSHValue || 0) +
              (pipeline.stage4ApproveKacabValue || 0) +
              (pipeline.stage5RegionalApproveValue || 0) +
              (pipeline.stage6DivisionApproveValue || 0) +
              (pipeline.stage7InvoiceValue || 0) +
              (pipeline.stageSudahInvoiceBlmBayarValue || 0);
          });

          return (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div 
                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({}))}
                  className="bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 hover:border-orange-300 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
                  title={`Klik untuk melihat semua transaksi terfilter (${totalFilteredTransactions} Transaksi - ${formatRupiah(totalFilteredValue)})`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Volume Terfilter</span>
                    <span className="text-sm font-black text-slate-900 block">{totalFilteredTransactions} Transaksi</span>
                    <span className="text-[9px] text-slate-500 font-bold block">{formatRupiah(totalFilteredValue)}</span>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Titik Hambatan Aktif</span>
                    <span className="text-sm font-black text-amber-600 block">{totalActiveBottleneckCells} Tahapan Terhenti</span>
                    <span className="text-[9px] text-amber-600/80 font-bold block">Memerlukan Tindak Lanjut</span>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Antrean Outstanding</span>
                    <span className="text-sm font-black text-rose-600 block">{totalPendingSlaTransactions} Pending</span>
                    <span className="text-[9px] text-rose-600/90 font-bold block" title={`Total Nilai Outstanding: ${formatRupiah(totalPendingSlaValue)}`}>
                      {totalPendingSlaTransactions > 0 ? 'Menunggu Penyelesaian' : 'Semua Antrean Selesai'}
                    </span>
                  </div>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div 
                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ statusPayment: 'Lunas' }))}
                  className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
                  title={`Klik untuk melihat transaksi lunas (${totalLunasTransactions} Transaksi - ${formatRupiah(totalLunasValue)})`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Total Pelunasan</span>
                    <span className="text-sm font-black text-emerald-700 block">{totalLunasTransactions} Lunas</span>
                    <span className="text-[9px] text-emerald-600/90 font-bold block">
                      {totalLunasTransactions > 0 ? 'Telah Berhasil Dilunasi' : 'Belum Ada Pelunasan'}
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 rounded-xl transition-all">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Data Grid / 4-Panel Workflow Pipeline Layout matching reference image */}
              <div className="bg-[#F4F7F9] p-4 sm:p-5 rounded-3xl shadow-inner border border-slate-200/80">
                <div className="overflow-x-auto pb-2">
                  {filteredCategories.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center min-w-[700px]">
                      <p className="text-xs font-bold text-slate-400">
                        Tidak ada kategori backcharge yang sesuai dengan filter pencarian.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-stretch gap-2.5 sm:gap-3 min-w-[1400px]">
                      {/* PANEL 0: KATEGORI BACKCHARGE (Left Panel) */}
                      <div className="w-[230px] shrink-0 flex flex-col justify-between">
                        {/* Header */}
                        <div className="h-[58px] flex flex-col justify-center px-3.5 bg-slate-100/90 rounded-xl border border-slate-200/80">
                          <span className="block text-[11px] font-black text-slate-800 uppercase tracking-wider">
                            KATEGORI BACKCHARGE
                          </span>
                          <span className="block text-[8.5px] text-slate-500 font-semibold mt-0.5">
                            Kategori &amp; Volume
                          </span>
                        </div>

                        {/* Category Rows */}
                        <div className="flex-1 flex flex-col justify-between py-1 divide-y divide-slate-200/50">
                          {filteredCategories.map((cat) => {
                            const colors = getCategoryColorClass(cat);
                            const count = categoryStats[cat]?.count || 0;
                            const catValue = categoryStats[cat]?.value || 0;

                            return (
                              <div
                                key={cat}
                                onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat }))}
                                className="h-[76px] flex flex-col justify-center px-3.5 hover:bg-white/80 rounded-xl transition-all cursor-pointer group"
                                title={`Klik untuk melihat semua data kategori ${cat}`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.bg}`}></span>
                                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide truncate group-hover:text-indigo-600 transition-colors">
                                    {cat}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className={`inline-block ${colors.lightBg} ${colors.text} px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border ${colors.border}`}>
                                    {count} Transaksi
                                  </span>
                                  <span className="text-[10px] font-black text-slate-900 truncate">
                                    {formatRupiah(catValue)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer Total Kategori */}
                        <div
                          onClick={() => onSelectDashboardFilter?.(getPipelineFilter({}))}
                          className="h-[76px] flex flex-col justify-center px-3.5 bg-slate-200/80 border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-300/80 transition-colors"
                          title="Klik untuk menyaring seluruh data yang terfilter"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-800"></span>
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                              TOTAL SEMUA KATEGORI
                            </span>
                            <Layers className="w-3.5 h-3.5 text-slate-700" />
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-block bg-slate-800 text-white px-1.5 py-0.5 rounded-full text-[9px] font-extrabold">
                              {totalFilteredTransactions} Transaksi
                            </span>
                            <span className="text-[10px] font-black text-slate-900 truncate">
                              {formatRupiah(totalFilteredValue)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* PANEL 1: DOCUMENT FLOW & FINAL STATUS (6 Sub-columns in 1 border) */}
                      <div className="flex-1 min-w-[720px] flex flex-col border-2 border-[#1A1D20] rounded-2xl shadow-md bg-white overflow-hidden">
                        {/* Dark Header with centered badge and 6 sub-headers */}
                        <div className="h-[58px] bg-[#1A1D20] text-white flex flex-col justify-between shrink-0">
                          <div className="flex items-center justify-center pt-1.5 pb-0.5 px-3">
                            <span className="inline-flex items-center gap-1.5 bg-[#2A2E33] border border-slate-600/80 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                              <span>📄</span> DOCUMENT FLOW &amp; FINAL STATUS
                            </span>
                          </div>
                          <div className="grid grid-cols-6 text-center divide-x divide-slate-800/80 pb-1 text-[8px] sm:text-[8.5px] font-black tracking-wider uppercase">
                            <span className="text-rose-300">1. BERKAS ASO</span>
                            <span className="text-orange-300">2. BERKAS ADMIN</span>
                            <span className="text-teal-300">3. BLM INVOICE</span>
                            <span className="text-blue-300">4. INV. BLUM BAYAR</span>
                            <span className="text-emerald-400">5. REALISASI LUNAS</span>
                            <span className="text-rose-400">6. REJECT DOKUMEN</span>
                          </div>
                        </div>

                        {/* Rows */}
                        <div className="flex-1 flex flex-col justify-between py-1 divide-y divide-slate-100">
                          {filteredCategories.map((cat) => {
                            const pipeline = categoryPipelines[cat] || {
                              stage2InAso: 0,
                              stage2InAsoValue: 0,
                              stage3AtAdmin: 0,
                              stage3AtAdminValue: 0,
                              stage7Invoice: 0,
                              stage7InvoiceValue: 0,
                              stageSudahInvoiceBlmBayar: 0,
                              stageSudahInvoiceBlmBayarValue: 0,
                              stage8Lunas: 0,
                              stage8LunasValue: 0,
                              stageReject: 0,
                              stageRejectValue: 0,
                            };

                            return (
                              <div key={cat} className="h-[76px] grid grid-cols-6 gap-1.5 p-1.5">
                                {/* 1. Berkas ASO */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '1_handover' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage2InAso > 0
                                      ? 'bg-[#FFF0F3] border-[#FED7DE] hover:border-rose-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} fisik di ASO (${formatRupiah(pipeline.stage2InAsoValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-rose-700 uppercase tracking-wider truncate">BERKAS ASO</span>
                                    <Info className="w-2.5 h-2.5 text-rose-400 opacity-70 shrink-0" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage2InAso}
                                    </span>
                                    {pipeline.stage2InAso > 0 && (
                                      <span className="text-[6.5px] font-black bg-[#FFE2E7] text-rose-800 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-rose-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage2InAsoValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                 {/* 2. Berkas Admin */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '2_confirm' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage3AtAdmin > 0
                                      ? 'bg-[#FFF7ED] border-orange-200 hover:border-orange-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} di Admin (${formatRupiah(pipeline.stage3AtAdminValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-orange-700 uppercase tracking-wider truncate">BERKAS ADMIN</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage3AtAdmin}
                                    </span>
                                    {pipeline.stage3AtAdmin > 0 && (
                                      <span className="text-[6.5px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Proses
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-orange-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage3AtAdminValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 3. Blm Invoice */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '4_invoice' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage7Invoice > 0
                                      ? 'bg-[#E6F9F6] border-[#BEEFE8] hover:border-teal-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Belum Cetak Invoice (${formatRupiah(pipeline.stage7InvoiceValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-teal-700 uppercase tracking-wider truncate">BLM INVOICE</span>
                                    <Info className="w-2.5 h-2.5 text-teal-400 opacity-70 shrink-0" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage7Invoice}
                                    </span>
                                    {pipeline.stage7Invoice > 0 && (
                                      <span className="text-[6.5px] font-black bg-[#CEF5EE] text-teal-800 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Proses
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-teal-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage7InvoiceValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 4. INV. BLUM BAYAR */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '5_payment' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stageSudahInvoiceBlmBayar > 0
                                      ? 'bg-[#EFF6FF] border-[#BFDBFE] hover:border-blue-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Sudah Invoice tapi Belum Bayar (${formatRupiah(pipeline.stageSudahInvoiceBlmBayarValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-blue-700 uppercase tracking-wider truncate">INV B. BAYAR</span>
                                    <Info className="w-2.5 h-2.5 text-blue-400 opacity-70 shrink-0" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {Number.isFinite(pipeline.stageSudahInvoiceBlmBayar) ? pipeline.stageSudahInvoiceBlmBayar : 0}
                                    </span>
                                    {pipeline.stageSudahInvoiceBlmBayar > 0 && (
                                      <span className="text-[6.5px] font-black bg-[#DBEAFE] text-blue-800 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-blue-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(Number.isFinite(pipeline.stageSudahInvoiceBlmBayarValue) ? pipeline.stageSudahInvoiceBlmBayarValue : 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 5. Realisasi Lunas */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, statusPayment: 'Lunas' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage8Lunas > 0
                                      ? 'bg-[#ECFDF5] border-[#A7F3D0] hover:border-emerald-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} yang sudah Lunas (${pipeline.stage8Lunas} Transaksi - ${formatRupiah(pipeline.stage8LunasValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-emerald-800 uppercase tracking-wider truncate">LUNAS</span>
                                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500 opacity-70 shrink-0" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage8Lunas}
                                    </span>
                                    <span className={`text-[6.5px] font-black px-1 py-0.2 rounded uppercase tracking-wider ${
                                      pipeline.stage8Lunas > 0 ? 'bg-[#D1FAE5] text-emerald-900' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {pipeline.stage8Lunas > 0 ? 'Lunas' : 'Nihil'}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-emerald-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {pipeline.stage8Lunas > 0 ? formatRupiah(pipeline.stage8LunasValue || 0) : 'Rp 0'}
                                    </span>
                                  </div>
                                </div>

                                {/* 6. Reject Dokumen */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '6_reject' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stageReject > 0
                                      ? 'bg-[#FFF1F2] border-[#FECDD3] hover:border-rose-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} yang Dokumen Ditolak/Reject (${pipeline.stageReject} Transaksi - ${formatRupiah(pipeline.stageRejectValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-black text-rose-800 uppercase tracking-wider truncate">REJECT</span>
                                    <AlertCircle className="w-2.5 h-2.5 text-rose-500 opacity-70 shrink-0" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stageReject}
                                    </span>
                                    <span className={`text-[6.5px] font-black px-1 py-0.2 rounded uppercase tracking-wider ${
                                      pipeline.stageReject > 0 ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {pipeline.stageReject > 0 ? 'Ditolak' : 'Nihil'}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-rose-200/60 flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">
                                      {pipeline.stageReject > 0 ? formatRupiah(pipeline.stageRejectValue || 0) : 'Rp 0'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer Totals */}
                        <div className="h-[76px] grid grid-cols-6 gap-1.5 p-1.5 bg-slate-50/90 border-t-2 border-slate-200 shrink-0">
                          {/* Total ASO */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '1_handover' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage1Aso > 0
                                ? 'bg-rose-100/80 border-rose-300 hover:border-rose-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Berkas ASO (${formatRupiah(totalStage1AsoVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-rose-800 uppercase tracking-wider truncate">TOTAL ASO</span>
                              <Info className="w-2.5 h-2.5 text-rose-500 opacity-80 shrink-0" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage1Aso}
                              </span>
                              {totalStage1Aso > 0 && (
                                <span className="text-[6.5px] font-black bg-rose-200 text-rose-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-rose-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage1AsoVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total Admin */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '2_confirm' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage2Admin > 0
                                ? 'bg-orange-100/80 border-orange-300 hover:border-orange-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Berkas Admin (${formatRupiah(totalStage2AdminVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-orange-800 uppercase tracking-wider truncate">TOTAL ADMIN</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0"></span>
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage2Admin}
                              </span>
                              {totalStage2Admin > 0 && (
                                <span className="text-[6.5px] font-black bg-orange-200 text-indigo-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Proses
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-orange-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage2AdminVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total Blm Inv */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '4_invoice' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage6Inv > 0
                                ? 'bg-teal-100/80 border-teal-300 hover:border-teal-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Invoice (${formatRupiah(totalStage6InvVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-teal-800 uppercase tracking-wider truncate">TOTAL BLM INV</span>
                              <Info className="w-2.5 h-2.5 text-teal-500 opacity-80 shrink-0" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage6Inv}
                              </span>
                              {totalStage6Inv > 0 && (
                                <span className="text-[6.5px] font-black bg-teal-200 text-teal-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Proses
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-teal-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage6InvVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total Inv B. Bayar */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '5_payment' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStageSudahInv > 0
                                ? 'bg-blue-100/80 border-blue-300 hover:border-blue-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Lunas Backcharge (${formatRupiah(totalStageSudahInvVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-blue-800 uppercase tracking-wider truncate">TOTAL B. BAYAR</span>
                              <Info className="w-2.5 h-2.5 text-blue-500 opacity-80 shrink-0" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStageSudahInv}
                              </span>
                              {totalStageSudahInv > 0 && (
                                <span className="text-[6.5px] font-black bg-blue-200 text-blue-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-blue-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStageSudahInvVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total Lunas */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ statusPayment: 'Lunas' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalLunasTransactions > 0
                                ? 'bg-emerald-100/80 border-emerald-300 hover:border-emerald-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Transaksi Lunas (${formatRupiah(totalLunasValue)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-emerald-800 uppercase tracking-wider truncate">TOTAL LUNAS</span>
                              <CheckCircle className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalLunasTransactions}
                              </span>
                              {totalLunasTransactions > 0 && (
                                <span className="text-[6.5px] font-black bg-emerald-200 text-emerald-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Lunas
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-emerald-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalLunasValue)}
                              </span>
                            </div>
                          </div>

                          {/* Total Reject */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '6_reject' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalRejectTransactions > 0
                                ? 'bg-rose-100/80 border-rose-300 hover:border-rose-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Transaksi Dokumen Ditolak/Reject (${formatRupiah(totalRejectValue)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[7.5px] font-black text-rose-800 uppercase tracking-wider truncate">TOTAL REJECT</span>
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalRejectTransactions}
                              </span>
                              {totalRejectTransactions > 0 && (
                                <span className="text-[6.5px] font-black bg-rose-200 text-rose-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Ditolak
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-rose-200 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalRejectValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* PANEL 2: APPROVAL (4 Sub-columns) */}
                      <div className="flex-1 min-w-[460px] flex flex-col border-2 border-[#1A1D20] rounded-2xl shadow-md bg-white overflow-hidden">
                        {/* Dark Header with centered badge and 4 sub-headers */}
                        <div className="h-[58px] bg-[#1A1D20] text-white flex flex-col justify-between shrink-0">
                          <div className="flex items-center justify-center pt-1.5 pb-0.5 px-3">
                            <span className="inline-flex items-center gap-1.5 bg-[#2A2E33] border border-slate-600/80 text-orange-300 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                              <span>☑️</span> APPROVAL FLOW BERJENJANG ATAS BERKAS DI ADMIN
                            </span>
                          </div>
                          <div className="grid grid-cols-4 text-center divide-x divide-slate-800/80 pb-1 text-[8.5px] font-black tracking-wider uppercase">
                            <span className="text-orange-300">2.1 BELUM APPR. SH</span>
                            <span className="text-orange-300">2.2 BELUM APPR. KACAB</span>
                            <span className="text-orange-300">2.3 BELUM APPR. RH</span>
                            <span className="text-orange-300">2.4 BELUM APPR. DH</span>
                          </div>
                        </div>

                        {/* Rows */}
                        <div className="flex-1 flex flex-col justify-between py-1 divide-y divide-slate-100">
                          {filteredCategories.map((cat) => {
                            const pipeline = categoryPipelines[cat] || {
                              stage4ApproveSH: 0,
                              stage4ApproveSHValue: 0,
                              stage4ApproveKacab: 0,
                              stage4ApproveKacabValue: 0,
                              stage5RegionalApprove: 0,
                              stage5RegionalApproveValue: 0,
                              stage6DivisionApprove: 0,
                              stage6DivisionApproveValue: 0,
                            };

                            return (
                              <div key={cat} className="h-[76px] grid grid-cols-4 gap-1.5 p-1.5">
                                 {/* 1. Belum Appr. SH */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '3_sap_sh' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage4ApproveSH > 0
                                      ? 'bg-[#FFF7ED] border-orange-200 hover:border-orange-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Belum Approve SH (${formatRupiah(pipeline.stage4ApproveSHValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black text-orange-700 uppercase tracking-wider">BELUM APPR. SH</span>
                                    <Info className="w-2.5 h-2.5 text-orange-400 opacity-70" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage4ApproveSH}
                                    </span>
                                    {pipeline.stage4ApproveSH > 0 && (
                                      <span className="text-[7px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-orange-200/60 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage4ApproveSHValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 2. Belum Appr. Kacab */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '3_sap_kacab' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage4ApproveKacab > 0
                                      ? 'bg-[#FFF7ED] border-orange-200 hover:border-orange-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Belum Approve Kacab (${formatRupiah(pipeline.stage4ApproveKacabValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black text-orange-700 uppercase tracking-wider">BELUM APPR. KACAB</span>
                                    <Info className="w-2.5 h-2.5 text-orange-400 opacity-70" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage4ApproveKacab}
                                    </span>
                                    {pipeline.stage4ApproveKacab > 0 && (
                                      <span className="text-[7px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-orange-200/60 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage4ApproveKacabValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 3. Belum Appr. RH */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '3_sap_rh' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage5RegionalApprove > 0
                                      ? 'bg-[#FFF7ED] border-orange-200 hover:border-orange-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Belum Approve Regional Head (${formatRupiah(pipeline.stage5RegionalApproveValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black text-orange-700 uppercase tracking-wider">BELUM APPR. RH</span>
                                    <Info className="w-2.5 h-2.5 text-orange-400 opacity-70" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage5RegionalApprove}
                                    </span>
                                    {pipeline.stage5RegionalApprove > 0 && (
                                      <span className="text-[7px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-orange-200/60 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage5RegionalApproveValue || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* 4. Belum Appr. DH */}
                                <div
                                  onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ category: cat, stage: '3_sap_dh' }))}
                                  className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                                    pipeline.stage6DivisionApprove > 0
                                      ? 'bg-[#FFF7ED] border-orange-200 hover:border-orange-300 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                  title={`Klik untuk menyaring kategori ${cat} Belum Approve Division Head (${formatRupiah(pipeline.stage6DivisionApproveValue || 0)})`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black text-orange-700 uppercase tracking-wider">BELUM APPR. DH</span>
                                    <Info className="w-2.5 h-2.5 text-orange-400 opacity-70" />
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                      {pipeline.stage6DivisionApprove}
                                    </span>
                                    {pipeline.stage6DivisionApprove > 0 && (
                                      <span className="text-[7px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-orange-200/60 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-800 tracking-tight truncate">
                                      {formatRupiah(pipeline.stage6DivisionApproveValue || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer Totals */}
                        <div className="h-[76px] grid grid-cols-4 gap-1.5 p-1.5 bg-slate-50/90 border-t-2 border-slate-200 shrink-0">
                          {/* Total SH */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '3_sap_sh' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage3SH > 0
                                ? 'bg-orange-100/80 border-orange-300 hover:border-orange-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Approve SH (${formatRupiah(totalStage3SHVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black text-orange-800 uppercase tracking-wider">TOTAL SH</span>
                              <Info className="w-2.5 h-2.5 text-indigo-600 opacity-80" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage3SH}
                              </span>
                              {totalStage3SH > 0 && (
                                <span className="text-[7px] font-black bg-orange-200 text-indigo-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-orange-200 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage3SHVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total Kacab */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '3_sap_kacab' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage3Kacab > 0
                                ? 'bg-orange-100/80 border-orange-300 hover:border-orange-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Approve KACAB (${formatRupiah(totalStage3KacabVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black text-orange-800 uppercase tracking-wider">TOTAL KACAB</span>
                              <Info className="w-2.5 h-2.5 text-indigo-600 opacity-80" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage3Kacab}
                              </span>
                              {totalStage3Kacab > 0 && (
                                <span className="text-[7px] font-black bg-orange-200 text-indigo-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-orange-200 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage3KacabVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total RH */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '3_sap_rh' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage4RH > 0
                                ? 'bg-orange-100/80 border-orange-300 hover:border-orange-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Approve RH (${formatRupiah(totalStage4RHVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black text-orange-800 uppercase tracking-wider">TOTAL RH</span>
                              <Info className="w-2.5 h-2.5 text-indigo-600 opacity-80" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage4RH}
                              </span>
                              {totalStage4RH > 0 && (
                                <span className="text-[7px] font-black bg-orange-200 text-indigo-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-orange-200 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage4RHVal)}
                              </span>
                            </div>
                          </div>

                          {/* Total DH */}
                          <div
                            onClick={() => onSelectDashboardFilter?.(getPipelineFilter({ stage: '3_sap_dh' }))}
                            className={`rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all border ${
                              totalStage5DH > 0
                                ? 'bg-orange-100/80 border-orange-300 hover:border-orange-400 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                            }`}
                            title={`Klik untuk menyaring seluruh Belum Approve DH (${formatRupiah(totalStage5DHVal)})`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black text-orange-800 uppercase tracking-wider">TOTAL DH</span>
                              <Info className="w-2.5 h-2.5 text-indigo-600 opacity-80" />
                            </div>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                                {totalStage5DH}
                              </span>
                              {totalStage5DH > 0 && (
                                <span className="text-[7px] font-black bg-orange-200 text-indigo-900 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 pt-0.5 border-t border-orange-200 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-900 tracking-tight truncate">
                                {formatRupiah(totalStage5DHVal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>


                    </div>
                  )}
                </div>
              </div>
          </div>
        );
      })()}
    </div>

      {/* 4. DISTRIBUSI KATEGORI & regional BREAKDOWN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RANKING BEST PERFORMANCE PELUNASAN BACKCHARGE (Full Width) - Hidden for Admin role */}
        {!isAdmin && (
          <div className="lg:col-span-12 bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-5 flex flex-col justify-between">
            
            {/* Header Title & Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Map className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Breakdown Performa &amp; Otoritas Cabang
                </h3>
                <p className="text-[11px] text-slate-400">Peringkat kinerja penagihan, nominal outstanding, dan rasio penyelesaian per cabang.</p>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Cari cabang..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-36 transition-all"
                  />
                </div>

                <select
                  value={branchSort}
                  onChange={(e: any) => setBranchSort(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="top3-value-asc">TOP 1, 2, 3 → Nominal Terkecil (Default)</option>
                  <option value="total-desc">Transaksi (Tinggi-Rendah)</option>
                  <option value="total-asc">Transaksi (Rendah-Tinggi)</option>
                  <option value="value-desc">Nilai Terbesar</option>
                  <option value="value-asc">Nilai Terkecil</option>
                  <option value="ratio-desc">Pelunasan Tertinggi</option>
                </select>
              </div>
            </div>

            {/* 1. Executive Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50/60 border border-slate-200/50 rounded-2xl p-4 flex items-center space-x-3.5 transition-all hover:bg-slate-50/90 hover:shadow-xs">
                <div className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl">
                  <Map className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Cabang Aktif</span>
                  <span className="text-base font-black text-slate-900 block">{totalActiveBranchesCount} Kota</span>
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-200/50 rounded-2xl p-4 flex items-center space-x-3.5 transition-all hover:bg-slate-50/90 hover:shadow-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Tagihan Otoritas</span>
                  <span className="text-base font-black text-slate-900 block">{formatRupiah(totalBranchesValueSum)}</span>
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-200/50 rounded-2xl p-4 flex items-center space-x-3.5 transition-all hover:bg-slate-50/90 hover:shadow-xs">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Rata-rata Pelunasan</span>
                  <span className="text-base font-black text-indigo-600 block">{avgNationalSettlementRatio}%</span>
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-200/50 rounded-2xl p-4 flex items-center space-x-3.5 transition-all hover:bg-slate-50/90 hover:shadow-xs">
                <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl">
                  <Award className="w-4 h-4 text-amber-500 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Cabang Terbaik</span>
                  <span className="text-sm font-extrabold text-amber-800 block truncate max-w-[170px]" title={topBranchObj ? `${topBranchObj.name}: ${topBranchObj.ratio}%` : ''}>
                    {topBranchObj ? `${topBranchObj.name} (${topBranchObj.ratio}%)` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Saring Performa:</span>
              <button
                type="button"
                onClick={() => setBranchPerformanceFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                  branchPerformanceFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Cabang ({baseBranchStatsList.length})
              </button>
              <button
                type="button"
                onClick={() => setBranchPerformanceFilter('low')}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  branchPerformanceFilter === 'low'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-200/30'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                SLA Rendah &lt;10% ({baseBranchStatsList.filter(b => b.ratio < 10).length})
              </button>
              <button
                type="button"
                onClick={() => setBranchPerformanceFilter('top10')}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  branchPerformanceFilter === 'top10'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/30'
                }`}
              >
                <Award className="w-3 h-3" />
                Top 10 Pelunasan
              </button>
            </div>

            {/* 3. Enhanced Data Table with Heatmaps & Status Tags */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-inner bg-slate-50/20">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <th className="p-3 pl-4">CABANG KOTA</th>
                    <th className="p-3 text-center min-w-[110px]">TOTAL TRANSAKSI</th>
                    <th className="p-3 text-left min-w-[170px]">TOTAL NILAI TAGIHAN</th>
                    <th className="p-3 text-right min-w-[210px]">RASIO PELUNASAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700 bg-white">
                  {processedBranches.map((b, bIdx) => {
                    const isTop1 = absoluteTop3Names[0] === b.name;
                    const isTop2 = absoluteTop3Names[1] === b.name;
                    const isTop3 = absoluteTop3Names[2] === b.name;
                    
                    const absoluteMaxCases = Math.max(...baseBranchStatsList.map(x => x.totalCases), 1);
                    const absoluteMaxValue = Math.max(...baseBranchStatsList.map(x => x.totalValue), 1);
                    const casesPercentage = absoluteMaxCases > 0 && !isNaN(b.totalCases) ? Math.min(100, Math.max(0, Math.round((b.totalCases / absoluteMaxCases) * 100))) : 0;
                    const valuePercentage = absoluteMaxValue > 0 && !isNaN(b.totalValue) ? Math.min(100, Math.max(0, Math.round((b.totalValue / absoluteMaxValue) * 100))) : 0;

                    let ratioTheme = {
                      barBg: 'bg-rose-500',
                      text: 'text-rose-700 bg-rose-50 border-rose-100',
                      label: 'Low Settlement'
                    };
                    if (b.ratio >= 50) {
                      ratioTheme = {
                        barBg: 'bg-emerald-500',
                        text: 'text-emerald-700 bg-emerald-50 border-emerald-100',
                        label: 'Excellent'
                      };
                    } else if (b.ratio >= 10) {
                      ratioTheme = {
                        barBg: 'bg-amber-500',
                        text: 'text-amber-700 bg-amber-50 border-amber-100',
                        label: 'On Alert'
                      };
                    }

                    const badgeColors = getBranchBadgeColor(b.name);

                    return (
                      <tr 
                        key={b.name} 
                        onClick={() => setSelectedDrillDownBranch(b.name)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        title="Klik baris cabang untuk drill-down detail transaksi"
                      >
                        {/* City Column */}
                        <td className="p-3 pl-4 text-slate-800 flex items-center space-x-2.5 min-h-[52px]">
                          <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase font-mono border ${badgeColors.bg} ${badgeColors.hoverBg} transition-all`}>
                            {b.name.substring(0,3).toUpperCase()}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800 group-hover:text-indigo-700 transition-colors text-xs">{b.name}</span>
                            {isTop1 && (
                              <span className="text-[8px] font-black text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.2 uppercase tracking-wider flex items-center gap-0.5 mt-0.5 shadow-xs w-fit">
                                🏆 TOP 1
                              </span>
                            )}
                            {isTop2 && (
                              <span className="text-[8px] font-black text-slate-700 bg-slate-100 border border-slate-300 rounded px-1.5 py-0.2 uppercase tracking-wider flex items-center gap-0.5 mt-0.5 shadow-xs w-fit">
                                🥈 TOP 2
                              </span>
                            )}
                            {isTop3 && (
                              <span className="text-[8px] font-black text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2 uppercase tracking-wider flex items-center gap-0.5 mt-0.5 shadow-xs w-fit">
                                🥉 TOP 3
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cases Count Heatmap Column */}
                        <td className="p-3 text-center text-slate-700 align-middle relative overflow-hidden">
                          {/* Proportional background bar */}
                          <div 
                            className="absolute right-0 top-0 bottom-0 bg-blue-500/[0.04] transition-all duration-500 pointer-events-none" 
                            style={{ width: `${casesPercentage}%` }}
                          />
                          <span className="font-extrabold text-xs relative z-10 text-slate-800">{b.totalCases}</span>
                          <span className="block text-[7.5px] text-slate-400 font-bold relative z-10">
                            {b.resolved} Lunas / {b.pending} Pending
                          </span>
                        </td>

                        {/* Value Tagihan Heatmap Column */}
                        <td className="p-3 text-left text-slate-900 align-middle relative overflow-hidden">
                          {/* Proportional background bar */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-emerald-500/[0.03] transition-all duration-500 pointer-events-none" 
                            style={{ width: `${valuePercentage}%` }}
                          />
                          <span className="font-black text-xs text-slate-900 relative z-10">{formatRupiah(b.totalValue)}</span>
                          <span className="block text-[7.5px] text-slate-400 font-bold relative z-10">
                            Rata-rata: {formatRupiah(b.totalCases > 0 ? Math.round(b.totalValue / b.totalCases) : 0)} / Kasus
                          </span>
                        </td>

                        {/* Settlement Ratio Redesign */}
                        <td className="p-3 align-middle text-right">
                          <div className="flex items-center justify-end space-x-3">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border leading-none tracking-wider ${ratioTheme.text}`}>
                              {ratioTheme.label}
                            </span>
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden flex-shrink-0 relative">
                              <div className={`${ratioTheme.barBg} h-full rounded-full transition-all duration-500`} style={{ width: `${b.ratio}%` }}></div>
                            </div>
                            <span className={`text-[11px] font-black font-mono w-10 text-right ${b.ratio >= 50 ? 'text-emerald-600' : b.ratio >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {b.ratio}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {processedBranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">Tidak ada data cabang yang cocok dengan saringan performa.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
              <span className="text-[9px] text-slate-400 italic font-semibold flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                Klik baris cabang di atas untuk melihat detail drill-down daftar transaksi di bawah.
              </span>
              <span className="text-[9px] text-slate-400 font-bold">
                Menampilkan {processedBranches.length} dari {baseBranchStatsList.length} total cabang
              </span>
            </div>
          </div>
        )}

      </div>



      {/* 5. INSIGHTS & REAL TREND GRAPHS ROW (7. INSIGHT & TREND) */}
      {!isCleanExecutive && !isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GRAPH 1: TREN TRANSAKSI (Left - 4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Tren Transaksi
              </h3>
              <p className="text-[10px] text-slate-400">Perbandingan jumlah transaksi per periode.</p>
            </div>

            <div className="h-52 w-full pt-2 flex items-center justify-center">
              {trendData.length === 0 ? (
                <div className="text-center p-4 flex flex-col items-center">
                  <BarChart3 className="w-8 h-8 text-slate-300 mb-1.5" />
                  <p className="text-[11px] text-slate-400 font-bold">Tidak Ada Data Tren</p>
                  <p className="text-[9px] text-slate-400">Data masukan belum tersedia pada periode ini.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} stroke="#e2e8f0" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} stroke="#e2e8f0" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Jumlah Transaksi"
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      dot={{ stroke: '#2563eb', strokeWidth: 1, r: 3, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* GRAPH 2: TREN NILAI BACKCHARGE (Middle - 4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Tren Nilai Backcharge (Rp)
              </h3>
              <p className="text-[10px] text-slate-400">Perbandingan nilai backcharge per periode.</p>
            </div>

            <div className="h-52 w-full pt-2 flex items-center justify-center">
              {trendData.length === 0 ? (
                <div className="text-center p-4 flex flex-col items-center">
                  <BarChart3 className="w-8 h-8 text-slate-300 mb-1.5" />
                  <p className="text-[11px] text-slate-400 font-bold">Tidak Ada Data Tren</p>
                  <p className="text-[9px] text-slate-400">Data masukan belum tersedia pada periode ini.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} stroke="#e2e8f0" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} stroke="#e2e8f0" unit=" Jt" />
                    <Tooltip 
                      formatter={(value: any) => [`${value} Juta IDR`, 'Nilai Tagihan']}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="valueInMillions" 
                      name="Nilai (Juta IDR)"
                      stroke="#10b981" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      dot={{ stroke: '#10b981', strokeWidth: 1, r: 3, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* TABLE: TOP 5 CUSTOMERS DENGAN NILAI TERTINGGI (Right - 4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  Top 5 Customer dengan Nilai Tertinggi
                </h3>
                <p className="text-[10px] text-slate-400">Daftar 5 mitra/customer dengan total akumulasi tagihan terbesar.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] font-bold">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[8px]">
                      <th className="pb-1.5">NO</th>
                      <th className="pb-1.5">NAMA CUSTOMER</th>
                      <th className="pb-1.5 text-center">KASUS</th>
                      <th className="pb-1.5">CABANG</th>
                      <th className="pb-1.5 text-right">TOTAL TAGIHAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {topCustomers.map((c, idx) => (
                      <tr 
                        key={c.name} 
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        <td className="py-2.5 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[110px]" title={c.name}>
                          {c.name}
                        </td>
                        <td className="py-2.5 text-center text-slate-500 font-mono font-black">{c.casesCount}x</td>
                        <td className="py-2.5">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase font-mono">
                            {c.branch.substring(0, 3).toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-900 font-extrabold">{formatRupiah(c.totalValue)}</td>
                      </tr>
                    ))}
                    {topCustomers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">Tidak ada data customer ditemukan.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[8px] bg-slate-50 text-slate-500 p-2 rounded-xl border border-slate-100 font-semibold mt-2">
              Daftar 5 mitra dengan akumulasi nilai tagihan tertinggi memerlukan prioritas penagihan &amp; koordinasi berkala.
            </p>
          </div>

        </div>
      )}

      {/* 6. BOTTOM TOOLBAR: QUICK ACTIONS & UPDATE INFORMATION (8. & 9.) - HIDDEN AS REQUESTED */}
      <div className="hidden bg-slate-50 border border-slate-200 p-4 rounded-3xl shadow-sm flex-col md:flex-row justify-between md:items-center gap-4">
        
        {/* Quick action buttons row (8. Action Cepat) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1 */}
          <button
            onClick={handlePrintPDF}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-2xl flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            <span>Unduh Laporan (PDF)</span>
          </button>

          {/* Action 2 */}
          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-2xl flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Data (Excel)</span>
          </button>
        </div>

        {/* Update timestamp (9. Informasi Data) */}
        <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-bold self-end md:self-auto">
          <span>Data terakhir diperbarui: {lastUpdatedTime}</span>
        </div>

      </div>


      {/* INTERACTIVE DRILL-DOWN MODAL FOR REGIONAL BRANCH */}
      {selectedDrillDownBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex justify-between items-center flex-shrink-0">
              <div>
                <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
                  Drill-Down Analisis
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
                  <Map className="w-5 h-5 text-indigo-600" />
                  Daftar Transaksi Backcharge Cabang {selectedDrillDownBranch}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Menampilkan seluruh Backcharge aktif & lunas untuk wilayah regional ini.</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedDrillDownBranch(null);
                  setDrillDownSearch('');
                }}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Filter & Search bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 flex-shrink-0">
              <div className="relative w-full md:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Cari ID / Mitra / No Polis..."
                  value={drillDownSearch}
                  onChange={(e) => setDrillDownSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="text-xs font-bold text-slate-500 flex flex-wrap items-center gap-2">
                <span>Total Ditemukan: <span className="text-indigo-600 font-black">{drillDownTransactions.length} Transaksi</span></span>
                <button
                  onClick={() => {
                    if (selectedDrillDownBranch) {
                      onSelectDashboardFilter?.({ branch: selectedDrillDownBranch });
                      setSelectedDrillDownBranch(null);
                      setDrillDownSearch('');
                    }
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm"
                  title={`Lihat semua data Backcharge Cabang ${selectedDrillDownBranch} di menu Basis Data`}
                >
                  Buka di Basis Data ↗
                </button>
              </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[450px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                      <th className="p-3">ID TRANSAKSI</th>
                      <th className="p-3">KATEGORI</th>
                      <th className="p-3">NAMA MITRA / CUSTOMER</th>
                      <th className="p-3">NO POLIS</th>
                      <th className="p-3">NILAI (IDR)</th>
                      <th className="p-3">STATUS PEMBAYARAN</th>
                      <th className="p-3 text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {drillDownTransactions.map((t) => {
                      let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                      if (t.status_payment === 'Lunas') {
                        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (t.status_confirm === 'Ditolak / Negosiasi Ulang') {
                        badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                      }

                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-slate-900">{t.id}</td>
                          <td className="p-3">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black">
                              {t.category}
                            </span>
                          </td>
                          <td className="p-3 text-slate-900">{t.customer_name}</td>
                          <td className="p-3 font-mono text-slate-500">{t.license_plate}</td>
                          <td className="p-3 text-slate-950">{formatRupiah(t.value)}</td>
                          <td className="p-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}>
                              {t.status_payment}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedDrillDownBranch(null);
                                setDrillDownSearch('');
                                if (onSelectTransaction) onSelectTransaction(t.id);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-100 rounded-lg text-indigo-700 text-[10px] font-black transition-all cursor-pointer"
                            >
                              Buka Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {drillDownTransactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">Tidak ada transaksi Backcharge ditemukan.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 flex-shrink-0">
              <button 
                onClick={() => {
                  setSelectedDrillDownBranch(null);
                  setDrillDownSearch('');
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}


      {/* INTERACTIVE EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">Kirim Ringkasan Eksekutif</h3>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmailReport}>
              <div className="p-5 space-y-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Email Penerima</label>
                  <input 
                    type="email"
                    required
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="nama.manajer@company.id"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Pesan Tambahan (Opsional)</label>
                  <textarea 
                    placeholder="Halo pak, ini adalah laporan Backcharge regional PT ASSA per hari ini. Mohon ditinjau kembali."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20 resize-none"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-700 leading-relaxed font-semibold">
                  📧 Sistem akan menyusun draf ringkasan PDF serta metrik utama Backcharge dan melampirkannya langsung ke email.
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-black rounded-xl shadow transition-all flex items-center space-x-1 cursor-pointer"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 mr-1" />
                      <span>Kirim Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Ganti Password</span>
              </h3>
              <button 
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordError(null);
                  setCurrentPasswordInput('');
                  setNewPasswordInput('');
                  setConfirmNewPasswordInput('');
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-bold">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  PASSWORD SAAT INI <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  required
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  PASSWORD BARU <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Min 6 karakter"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  KONFIRMASI PASSWORD BARU <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  required
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  placeholder="Masukkan kembali password baru"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 mt-5">
                <button 
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setPasswordError(null);
                    setCurrentPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmNewPasswordInput('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
