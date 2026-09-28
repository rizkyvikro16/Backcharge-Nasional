import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, CheckCircle, Clock, Map, 
  Layers, ShieldAlert, ArrowRight, Award,
  Calendar, FileSpreadsheet, Search,
  Mail, FileText, Info, ArrowUpRight, ArrowDownRight, Lock, Loader2,
  AlertCircle, BarChart3, X, AlertTriangle, History
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Backcharge, Profile, DashboardFilter, BRANCH_LIST, MEGABRANCH_LIST, ALL_SYSTEM_BRANCHES, getUserBranches, isNationalOrAllBranches, BackchargeCategory, hasRole, isRegionalHeadRole } from '../types';

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

  // Branch mapping - filtered according to user role / branch access
  const userBranches = useMemo(() => {
    return currentUser?.branch && currentUser?.branch !== 'Nasional'
      ? getUserBranches(currentUser.branch)
      : null;
  }, [currentUser]);

  const branchList = useMemo(() => {
    const availableBranchOptionsVal = userBranches && userBranches.length > 0
      ? (ALL_SYSTEM_BRANCHES.filter(b => userBranches.some(ub => ub.toLowerCase() === b.toLowerCase())).length > 0
          ? ALL_SYSTEM_BRANCHES.filter(b => userBranches.some(ub => ub.toLowerCase() === b.toLowerCase()))
          : userBranches)
      : ALL_SYSTEM_BRANCHES;
    return availableBranchOptionsVal;
  }, [userBranches]);

  const availableBranchOptions = branchList;

  // Local/global settings
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('');
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
      if (currentUser.branch && currentUser.branch !== 'Nasional') {
        const branches = getUserBranches(currentUser.branch);
        if (branches.length === 1) {
          // Default to their only branch if they only handle exactly 1 branch
          setSelectedBranchFilter(branches[0]);
        } else {
          // If they handle multiple branches (e.g., Regional, Megabranch, or custom list), show consolidated data
          setSelectedBranchFilter('');
        }
      } else {
        setSelectedBranchFilter('');
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
      if (selectedBranchFilter) {
        const isAllSelected = isNationalOrAllBranches(selectedBranchFilter);
        if (!isAllSelected) {
          const allowedBranches = getUserBranches(selectedBranchFilter);
          matchesBranch = allowedBranches.includes(t.branch) || Boolean(t.branch && t.branch.toLowerCase() === selectedBranchFilter.toLowerCase());
        } else {
          matchesBranch = true;
        }
      } else if (userBranches && userBranches.length > 0 && !isNationalOrAllBranches(currentUser?.branch, currentUser?.role)) {
        matchesBranch = userBranches.some(ub => ub.toLowerCase() === t.branch?.toLowerCase());
      }
      
      return matchesStartDate && matchesEndDate && matchesBranch;
    });
  }, [transactions, startDate, endDate, selectedBranchFilter, userBranches]);

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
        if (selectedBranchFilter) {
          const allowedBranches = getUserBranches(selectedBranchFilter);
          matchesBranch = allowedBranches.includes(t.branch) || Boolean(t.branch && t.branch.toLowerCase() === selectedBranchFilter.toLowerCase());
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
        if (selectedBranchFilter) {
          const allowedBranches = getUserBranches(selectedBranchFilter);
          matchesBranch = allowedBranches.includes(t.branch) || Boolean(t.branch && t.branch.toLowerCase() === selectedBranchFilter.toLowerCase());
        } else if (userBranches && userBranches.length > 0) {
          matchesBranch = userBranches.some(ub => ub.toLowerCase() === t.branch?.toLowerCase());
        }
        return matchesDate && matchesBranch;
      });
      
      pCount = prev30.length;
      pValue = prev30.reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    }

    return { activeCount: actCount, activeValue: actValue, priorCount: pCount, priorValue: pValue };
  }, [transactions, startDate, endDate, selectedBranchFilter, filteredTransactions, userBranches]);

  // 2B. Period Segmentation Calculation: Cutoff (Pre-Current Month) vs Current Month
  const periodStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan, ..., 8 = Sep, etc.

    // Start of current month (e.g. 2026-09-01)
    const currentMonthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    
    // Cut-off date: last day of previous month (e.g. 2026-08-31)
    const lastDayPrevMonthObj = new Date(currentYear, currentMonth, 0);
    const cutoffDateStr = `${lastDayPrevMonthObj.getFullYear()}-${String(lastDayPrevMonthObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonthObj.getDate()).padStart(2, '0')}`;
    
    // End of current month (e.g. 2026-09-30)
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

    // 1. Cutoff (Pre-current month) Transactions (Card 1 & Card 2)
    let cutoffCount = 0;
    let cutoffValue = 0;
    let cutoffLunasCount = 0;
    let cutoffLunasValue = 0;
    let cutoffOsCount = 0;
    let cutoffOsValue = 0;

    // 2. Current Month Transactions (Card 3 & Card 4)
    let currentMonthCount = 0;
    let currentMonthValue = 0;
    let currentMonthLunasCount = 0;
    let currentMonthLunasValue = 0;
    let currentMonthOsCount = 0;
    let currentMonthOsValue = 0;

    // 3. Grand Total (Card 5)
    let grandTotalCount = 0;
    let grandTotalValue = 0;
    let grandTotalLunasCount = 0;
    let grandTotalLunasValue = 0;
    let grandTotalOsCount = 0;
    let grandTotalOsValue = 0;

    filteredTransactions.forEach(t => {
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
          tDate = t.tanggal;
        }
      } else if (t.created_at) {
        tDate = t.created_at.split('T')[0];
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

      // Check if transaction is in Cutoff (Before current month start) or Current Month
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

    const cutoffSettlementRatio = cutoffValue > 0 ? Math.round((cutoffLunasValue / cutoffValue) * 100) : 0;
    const currentMonthSettlementRatio = currentMonthValue > 0 ? Math.round((currentMonthLunasValue / currentMonthValue) * 100) : 0;
    const grandSettlementRatio = grandTotalValue > 0 ? Math.round((grandTotalLunasValue / grandTotalValue) * 100) : 0;

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
      cutoffSettlementRatio,
      currentMonthCount,
      currentMonthValue,
      currentMonthLunasCount,
      currentMonthLunasValue,
      currentMonthOsCount,
      currentMonthOsValue,
      currentMonthSettlementRatio,
      grandTotalCount,
      grandTotalValue,
      grandTotalLunasCount,
      grandTotalLunasValue,
      grandTotalOsCount,
      grandTotalOsValue,
      grandSettlementRatio
    };
  }, [filteredTransactions]);

  const getPercentChange = (current: number, prior: number) => {
    if (prior === 0) {
      return current > 0 ? { percent: 100, isUp: true } : { percent: 0, isUp: true };
    }
    const diff = current - prior;
    const pct = Math.round((diff / prior) * 100);
    return { percent: Math.abs(pct), isUp: pct >= 0 };
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
      selectedBranchFilter === 'Megabranch' ||
      MEGABRANCH_LIST.some(mb => mb.toLowerCase() === selectedBranchFilter.toLowerCase());
  }, [currentUser, selectedBranchFilter]);

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
    stage4ApproveL1,
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

    // Pipeline stage counters (8 stages)
    let s1Input = 0;
    let s2InAso = 0;
    let s4ApproveL1 = 0;
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
      stage4ApproveL1: number;
      stage4ApproveL1Value: number;
      stage5RegionalApprove: number;
      stage5RegionalApproveValue: number;
      stage6DivisionApprove: number;
      stage6DivisionApproveValue: number;
      stage7Invoice: number;
      stage7InvoiceValue: number;
    }> = {
      'Own Risk': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'Maintenance': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'Ekspedisi': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'ETLE': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'TPL': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'Unclaimable Insurance': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 },
      'Dokumen Kendaraan': { stage1Input: 0, stage1InputValue: 0, stage2InAso: 0, stage2InAsoValue: 0, stage3AtAdmin: 0, stage3AtAdminValue: 0, stage4ApproveL1: 0, stage4ApproveL1Value: 0, stage5RegionalApprove: 0, stage5RegionalApproveValue: 0, stage6DivisionApprove: 0, stage6DivisionApproveValue: 0, stage7Invoice: 0, stage7InvoiceValue: 0 }
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
      if (t.status_payment === 'Lunas') {
        lCount++;
        lValue += val;
      } else if (
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

      const isPendingL1 = !t.status_approval || t.status_approval === 'Belum Approval' || t.status_approval === 'Pending';
      const isL1Approved = t.status_approval === 'Disetujui';
      const isRegionalApproved = !isRegionalHeadReq || t.regional_approval_status === 'Disetujui';

      const stepInvoice = t.no_invoice && t.no_invoice !== '-' && t.no_invoice !== '';
      const stepPayment = t.status_payment === 'Lunas';
      const isNotBill = t.status_sap === 'Not Bill';

      // Populate Category Pipeline (Counts & Values)
      if (catPipelines[cat]) {
        catPipelines[cat].stage1Input++;
        catPipelines[cat].stage1InputValue += transVal;
        if (t.status_handover === 'Pending') {
          catPipelines[cat].stage2InAso++;
          catPipelines[cat].stage2InAsoValue += transVal;
        } else if (stepInvoice || stepPayment || isNotBill) {
          // Excluded from stage 4 to 7 bottleneck but counted in stage1Input
        } else if (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin') {
          if (isPendingL1) {
            catPipelines[cat].stage4ApproveL1++;
            catPipelines[cat].stage4ApproveL1Value += transVal;
          } else if (isL1Approved && isRegionalHeadReq && (!t.regional_approval_status || t.regional_approval_status === 'Belum Approval')) {
            catPipelines[cat].stage5RegionalApprove++;
            catPipelines[cat].stage5RegionalApproveValue += transVal;
          } else if (isL1Approved && isRegionalApproved && isDivisionHeadReq && (!t.division_approval_status || t.division_approval_status === 'Belum Approval')) {
            catPipelines[cat].stage6DivisionApprove++;
            catPipelines[cat].stage6DivisionApproveValue += transVal;
          } else {
            catPipelines[cat].stage7Invoice++;
            catPipelines[cat].stage7InvoiceValue += transVal;
          }
        } else {
          catPipelines[cat].stage7Invoice++;
          catPipelines[cat].stage7InvoiceValue += transVal;
        }
      }

      if (t.status_handover === 'Pending') {
        s2InAso++;
      } else if (stepInvoice || stepPayment) {
        s8Payment++;
      } else if (isNotBill) {
        // Not Bill items do not count as outstanding invoice for Admin (stage 7)
      } else if (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin') {
        if (isPendingL1) {
          s4ApproveL1++;
        } else if (isL1Approved && isRegionalHeadReq && (!t.regional_approval_status || t.regional_approval_status === 'Belum Approval')) {
          s5RegionalApprove++;
        } else if (isL1Approved && isRegionalApproved && isDivisionHeadReq && (!t.division_approval_status || t.division_approval_status === 'Belum Approval')) {
          s6DivisionApprove++;
        } else {
          s7Invoice++;
        }
      } else {
        s7Invoice++;
      }
    });

    // Stage 3: Berkas di Admin = Total Input ASO - Berkas di ASO (s2InAso)
    const s3AtAdmin = s1Input - s2InAso;

    // Calculate category s3AtAdmin (Berkas Admin = Total Input ASO - Berkas di ASO)
    Object.keys(catPipelines).forEach(catKey => {
      const k = catKey as BackchargeCategory;
      catPipelines[k].stage3AtAdmin = catPipelines[k].stage1Input - catPipelines[k].stage2InAso;
      catPipelines[k].stage3AtAdminValue = Math.max(0, catPipelines[k].stage1InputValue - catPipelines[k].stage2InAsoValue);
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
      stage4ApproveL1: s4ApproveL1,
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
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
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
        if (selectedBranchFilter) {
          return branch.toLowerCase() === selectedBranchFilter.toLowerCase();
        }
        if (!userBranches || userBranches.length === 0) return true;
        return userBranches.some(ub => ub.toLowerCase() === branch.toLowerCase());
      })
      .map(branch => {
        const stats = branchStats[branch];
        const ratio = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
        return {
          name: branch,
          totalCases: stats.total,
          totalValue: stats.value,
          resolved: stats.resolved,
          pending: stats.pending,
          ratio
        };
      });
  }, [branchStats, selectedBranchFilter, userBranches]);

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
      { bg: 'bg-indigo-50 border-indigo-200 text-indigo-700', hoverBg: 'group-hover:bg-indigo-100 group-hover:text-indigo-800' },
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
              {selectedBranchFilter && (
                <span className="bg-indigo-600 text-white font-black px-2.5 py-0.5 rounded-full text-[10px] shadow-sm">
                  Saringan Aktif: Cabang {selectedBranchFilter}
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
          {(startDate || endDate || selectedBranchFilter) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedBranchFilter(''); }}
              className="text-xs font-extrabold text-red-500 hover:text-red-600 hover:underline transition-all cursor-pointer self-start sm:self-auto"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Branch Dropdown Filter */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Map className="w-3.5 h-3.5 text-indigo-600 inline" />
              Cabang Otoritas:
            </span>
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="w-full bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200/80 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
            >
              <option value="">
                {currentUser?.branch === 'Nasional' || !currentUser?.branch
                  ? 'Semua Cabang (Nasional)'
                  : currentUser?.branch === 'Megabranch' || hasRole(currentUser?.role, 'ASO Megabranch')
                  ? 'Semua BSO Megabranch (8 BSO)'
                  : availableBranchOptions.length === 1 
                    ? `Cabang ${availableBranchOptions[0]}`
                    : `Semua Cabang Otoritas (${availableBranchOptions.length} Cabang)`}
              </option>
              {availableBranchOptions.map((b) => (
                <option key={b} value={b}>
                  {`Cabang ${b}`}
                </option>
              ))}
            </select>
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

      {/* 2. EXECUTIVE KPI CARDS GRID (3. KPI TAMBAHAN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4.5">
        {/* CARD 1: TRANSAKSI TGL AWAL S.D. CUTOFF SEBELUM BULAN BERJALAN */}
        <div 
          onClick={() => onSelectDashboardFilter?.({ endDate: periodStats.cutoffDateStr })}
          className="bg-white p-4.5 rounded-3xl border border-slate-200 border-t-4 border-t-blue-500 shadow-md hover:shadow-xl hover:border-blue-300 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transform"
          title={`Klik untuk menyaring transaksi s.d. cut-off ${periodStats.cutoffDateLabel}`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1 min-w-0 pr-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-sans group-hover:text-blue-600 transition-colors flex items-center gap-1">
                <span>S.D. CUTOFF BULAN LALU</span>
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{periodStats.cutoffCount}</h3>
              <p className="text-xs font-black text-blue-700 truncate mt-0.5">{formatRupiah(periodStats.cutoffValue)}</p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-600 flex items-center truncate">
              <History className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
              Cutoff {periodStats.cutoffMonthName}
            </span>
            <span className="text-[8.5px] text-slate-400 font-semibold truncate">s.d. {periodStats.cutoffDateLabel}</span>
          </div>
        </div>

        {/* CARD 2: REALISASI & OS S.D. CUTOFF */}
        <div 
          onClick={() => onSelectDashboardFilter?.({ statusPayment: 'Lunas', endDate: periodStats.cutoffDateStr })}
          className="bg-emerald-50/30 p-4.5 rounded-3xl border border-emerald-200/80 border-t-4 border-t-emerald-500 shadow-md hover:shadow-xl hover:border-emerald-400 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transform"
          title={`Klik untuk melihat rincian terbayar & OS s.d. cutoff ${periodStats.cutoffDateLabel}`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5 min-w-0 pr-1">
              <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider font-sans group-hover:text-emerald-600 transition-colors">
                TERBAYAR &amp; OS S.D. CUTOFF
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 truncate">{formatRupiah(periodStats.cutoffLunasValue)}</h3>
              <p className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                <CheckCircle className="w-3 h-3 flex-shrink-0" />
                {periodStats.cutoffLunasCount} Transaksi Lunas
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[8px] font-black text-amber-800 uppercase tracking-wider block">OS Belum Bayar:</span>
              <span className="text-[11px] font-black text-amber-700 block truncate">{formatRupiah(periodStats.cutoffOsValue)} ({periodStats.cutoffOsCount} OS)</span>
            </div>
            <span className="px-1.5 py-0.5 text-[8.5px] font-black rounded-md bg-emerald-100 text-emerald-800 flex-shrink-0">
              {periodStats.cutoffSettlementRatio}% Lunas
            </span>
          </div>
        </div>

        {/* CARD 3: TOTAL BULAN BERJALAN */}
        <div 
          onClick={() => onSelectDashboardFilter?.({ startDate: periodStats.currentMonthStartStr, endDate: periodStats.currentMonthEndStr })}
          className="bg-purple-50/20 p-4.5 rounded-3xl border border-purple-200/80 border-t-4 border-t-purple-500 shadow-md hover:shadow-xl hover:border-purple-300 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transform"
          title={`Klik untuk menyaring transaksi bulan berjalan (${periodStats.currentMonthLabel})`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1 min-w-0 pr-1">
              <p className="text-[9px] font-black text-purple-900 uppercase tracking-wider font-sans group-hover:text-purple-700 transition-colors flex items-center gap-1">
                <span>TOTAL BULAN BERJALAN</span>
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{periodStats.currentMonthCount}</h3>
              <p className="text-xs font-black text-purple-700 truncate mt-0.5">{formatRupiah(periodStats.currentMonthValue)}</p>
            </div>
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-purple-700 flex items-center truncate">
              <Calendar className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
              {periodStats.currentMonthName}
            </span>
            <span className="text-[8.5px] text-slate-400 font-semibold truncate">1 - ${periodStats.lastDayCurrMonth} ${periodStats.currentMonthName}</span>
          </div>
        </div>

        {/* CARD 4: REALISASI & OS BULAN BERJALAN */}
        <div 
          onClick={() => onSelectDashboardFilter?.({ statusPayment: 'Belum Bayar', startDate: periodStats.currentMonthStartStr })}
          className="bg-amber-50/30 p-4.5 rounded-3xl border border-amber-200/80 border-t-4 border-t-amber-500 shadow-md hover:shadow-xl hover:border-amber-300 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transform"
          title={`Klik untuk melihat rincian terbayar & OS bulan berjalan (${periodStats.currentMonthLabel})`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5 min-w-0 pr-1">
              <p className="text-[9px] font-black text-amber-900 uppercase tracking-wider font-sans group-hover:text-amber-700 transition-colors">
                TERBAYAR &amp; OS BULAN BERJALAN
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 truncate">{formatRupiah(periodStats.currentMonthLunasValue)}</h3>
              <p className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                <CheckCircle className="w-3 h-3 flex-shrink-0" />
                {periodStats.currentMonthLunasCount} Transaksi Lunas
              </p>
            </div>
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
              <Clock className="w-4 h-4 animate-spin-slow" />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[8px] font-black text-amber-900 uppercase tracking-wider block">OS Belum Bayar:</span>
              <span className="text-[11px] font-black text-rose-700 block truncate">{formatRupiah(periodStats.currentMonthOsValue)} ({periodStats.currentMonthOsCount} OS)</span>
            </div>
            <span className="px-1.5 py-0.5 text-[8.5px] font-black rounded-md bg-amber-100 text-amber-900 flex-shrink-0">
              {periodStats.currentMonthSettlementRatio}% Lunas
            </span>
          </div>
        </div>

        {/* CARD 5: TOTAL NILAI TAGIHAN & OS AKUMULASI */}
        <div 
          onClick={() => onSelectDashboardFilter?.({ statusPayment: 'Belum Bayar' })}
          className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-4.5 rounded-3xl border border-indigo-700 border-t-4 border-t-indigo-400 shadow-xl hover:shadow-2xl transition-all duration-300 relative group overflow-hidden flex flex-col justify-between col-span-1 sm:col-span-2 lg:col-span-1 cursor-pointer active:scale-[0.98] transform ring-2 ring-indigo-400/30"
          title="Klik untuk melihat rincian seluruh tagihan dan total outstanding akumulasi"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5 min-w-0 pr-1">
              <p className="text-[9px] font-black text-indigo-200 uppercase tracking-wider font-sans">
                TOTAL NILAI TAGIHAN &amp; OS
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 drop-shadow-sm truncate">{formatRupiah(periodStats.grandTotalValue)}</h3>
              <p className="text-[10px] font-extrabold text-indigo-100 truncate mt-0.5">
                OS: {formatRupiah(periodStats.grandTotalOsValue)} ({periodStats.grandTotalOsCount} OS)
              </p>
            </div>
            <div className="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-2xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
              <span className="font-black text-xs">Rp</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-indigo-500/50 flex items-center justify-between">
            <span className="text-[10px] text-indigo-100 font-extrabold flex items-center truncate">
              <TrendingUp className="w-3.5 h-3.5 inline mr-0.5 flex-shrink-0" />
              Total {periodStats.grandTotalCount} Kasus
            </span>
            <span className="text-[8.5px] text-indigo-200 font-semibold flex-shrink-0">{periodStats.grandSettlementRatio}% Rasio</span>
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
            <p className="text-[11px] text-slate-400">Analisis matriks hambatan proses secara real-time berdasarkan divisi penanggung jawab dan tenggat SLA (Tahap 1 - 7).</p>
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

          // Metrics calculations
          let totalFilteredTransactions = 0;
          let totalFilteredValue = 0;
          let totalActiveBottleneckCells = 0;
          let totalPendingSlaTransactions = 0;
          let totalPendingSlaValue = 0;

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
              stage4ApproveL1: 0,
              stage4ApproveL1Value: 0,
              stage5RegionalApprove: 0,
              stage5RegionalApproveValue: 0,
              stage6DivisionApprove: 0,
              stage6DivisionApproveValue: 0,
              stage7Invoice: 0,
              stage7InvoiceValue: 0,
            };

            if (pipeline.stage2InAso > 0) totalActiveBottleneckCells++;
            if (pipeline.stage3AtAdmin > 0) totalActiveBottleneckCells++;
            if (pipeline.stage4ApproveL1 > 0) totalActiveBottleneckCells++;
            if (pipeline.stage5RegionalApprove > 0) totalActiveBottleneckCells++;
            if (pipeline.stage6DivisionApprove > 0) totalActiveBottleneckCells++;
            if (pipeline.stage7Invoice > 0) totalActiveBottleneckCells++;

            totalPendingSlaTransactions += 
              (pipeline.stage2InAso || 0) +
              (pipeline.stage3AtAdmin || 0) +
              (pipeline.stage4ApproveL1 || 0) +
              (pipeline.stage5RegionalApprove || 0) +
              (pipeline.stage6DivisionApprove || 0) +
              (pipeline.stage7Invoice || 0);

            totalPendingSlaValue +=
              (pipeline.stage2InAsoValue || 0) +
              (pipeline.stage3AtAdminValue || 0) +
              (pipeline.stage4ApproveL1Value || 0) +
              (pipeline.stage5RegionalApproveValue || 0) +
              (pipeline.stage6DivisionApproveValue || 0) +
              (pipeline.stage7InvoiceValue || 0);
          });

          return (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Volume Terfilter</span>
                    <span className="text-sm font-black text-slate-900 block">{totalFilteredTransactions} Transaksi</span>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Titik Hambatan Aktif</span>
                    <span className="text-sm font-black text-amber-600 block">{totalActiveBottleneckCells} Tahapan Terhenti</span>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Antrean Outstanding</span>
                    <span className="text-sm font-black text-rose-600 block">{totalPendingSlaTransactions} Pending</span>
                  </div>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Data Grid / Matrix Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-left border-collapse">
                  <thead className="bg-slate-50/75 backdrop-blur-sm sticky top-0">
                    <tr className="divide-x divide-slate-200/50">
                      <th scope="col" className="px-3.5 py-3 text-left">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Kategori Backcharge</span>
                        <span className="block text-[7.5px] text-slate-500 font-semibold mt-0.5">Kategori &amp; Volume</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[110px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">1. Berkas ASO</span>
                        <span className="inline-block bg-purple-50 text-purple-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: ASO</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[110px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">2. Berkas Admin</span>
                        <span className="inline-block bg-indigo-50 text-indigo-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: ADMIN</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[115px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">3. Belum Appr. SH / KACAB</span>
                        <span className="inline-block bg-amber-50 text-amber-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: SH / KACAB</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[115px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">4. Belum Appr. RH</span>
                        <span className="inline-block bg-orange-50 text-orange-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: REGIONAL HEAD</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[115px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">5. Belum Appr. DH</span>
                        <span className="inline-block bg-rose-50 text-rose-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: DIVISION HEAD</span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-center min-w-[110px]">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">6. Blm Invoice</span>
                        <span className="inline-block bg-cyan-50 text-cyan-700 font-black text-[7px] px-1 py-0.2 rounded mt-0.5">ROLE: ADMIN</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                          Tidak ada kategori backcharge yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => {
                        const colors = getCategoryColorClass(cat);
                        const count = categoryStats[cat]?.count || 0;
                        const catValue = categoryStats[cat]?.value || 0;
                        const pipeline = categoryPipelines[cat] || {
                          stage1Input: 0,
                          stage1InputValue: 0,
                          stage2InAso: 0,
                          stage2InAsoValue: 0,
                          stage3AtAdmin: 0,
                          stage3AtAdminValue: 0,
                          stage4ApproveL1: 0,
                          stage4ApproveL1Value: 0,
                          stage5RegionalApprove: 0,
                          stage5RegionalApproveValue: 0,
                          stage6DivisionApprove: 0,
                          stage6DivisionApproveValue: 0,
                          stage7Invoice: 0,
                          stage7InvoiceValue: 0,
                        };

                        return (
                          <tr key={cat} className="hover:bg-slate-50/30 divide-x divide-slate-100 transition-colors">
                            {/* Category Header Cell */}
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="flex items-center space-x-2.5">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.bg}`}></span>
                                <div className="min-w-0">
                                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide truncate">{cat}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`inline-block ${colors.lightBg} ${colors.text} px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border ${colors.border}`}>
                                      {count} Transaksi
                                    </span>
                                    <span className="text-[10px] font-extrabold text-slate-600 truncate">
                                      {formatRupiah(catValue)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 1. Berkas ASO (Flow 1) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '1_handover' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage2InAso > 0 
                                    ? 'bg-rose-50 hover:bg-rose-100/70 border border-rose-200 hover:border-rose-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} fisik di ASO (${formatRupiah(pipeline.stage2InAsoValue || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-rose-500 uppercase">Berkas ASO</span>
                                  {pipeline.stage2InAso > 0 && <AlertCircle className="w-2.5 h-2.5 text-rose-500 animate-pulse" />}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage2InAso > 0 ? 'text-rose-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage2InAso}
                                  </span>
                                  {pipeline.stage2InAso > 0 && (
                                    <span className="text-[7px] font-black bg-rose-100 text-rose-800 px-1 py-0.2 rounded uppercase">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-rose-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage2InAso > 0 ? 'text-rose-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage2InAsoValue || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. Berkas Admin (Flow 2) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '2_confirm' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage3AtAdmin > 0 
                                    ? 'bg-indigo-50/55 hover:bg-indigo-100/50 border border-indigo-200 hover:border-indigo-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} di Admin (${formatRupiah(pipeline.stage3AtAdminValue || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-indigo-500 uppercase">Berkas Admin</span>
                                  {pipeline.stage3AtAdmin > 0 && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage3AtAdmin > 0 ? 'text-indigo-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage3AtAdmin}
                                  </span>
                                  {pipeline.stage3AtAdmin > 0 && (
                                    <span className="text-[7px] font-black bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded uppercase">
                                      Proses
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-indigo-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage3AtAdmin > 0 ? 'text-indigo-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage3AtAdminValue || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 3. Belum Approve BM/Kacab (Flow 3) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '3_sap_l1' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage4ApproveL1 > 0 
                                    ? 'bg-amber-50 hover:bg-amber-100/50 border border-amber-200 hover:border-amber-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} Belum Approve L1 (${formatRupiah(pipeline.stage4ApproveL1Value || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-amber-500 uppercase">Belum Appr. SH/Kacab</span>
                                  {pipeline.stage4ApproveL1 > 0 && <Clock className="w-2.5 h-2.5 text-amber-500 animate-pulse" />}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage4ApproveL1 > 0 ? 'text-amber-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage4ApproveL1}
                                  </span>
                                  {pipeline.stage4ApproveL1 > 0 && (
                                    <span className="text-[7px] font-black bg-amber-100 text-amber-800 px-1 py-0.2 rounded uppercase">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-amber-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage4ApproveL1 > 0 ? 'text-amber-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage4ApproveL1Value || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 4. Belum Approve RH (Flow 4) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '3_sap_rh' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage5RegionalApprove > 0 
                                    ? 'bg-orange-50 hover:bg-orange-100/50 border border-orange-200 hover:border-orange-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} Belum Approve Regional Head (${formatRupiah(pipeline.stage5RegionalApproveValue || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-orange-500 uppercase font-sans">Belum Appr. RH</span>
                                  {pipeline.stage5RegionalApprove > 0 && <Clock className="w-2.5 h-2.5 text-orange-500 animate-pulse" />}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage5RegionalApprove > 0 ? 'text-orange-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage5RegionalApprove}
                                  </span>
                                  {pipeline.stage5RegionalApprove > 0 && (
                                    <span className="text-[7px] font-black bg-orange-100 text-orange-800 px-1 py-0.2 rounded uppercase">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-orange-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage5RegionalApprove > 0 ? 'text-orange-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage5RegionalApproveValue || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 5. Belum Approve DH (Flow 5) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '3_sap_dh' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage6DivisionApprove > 0 
                                    ? 'bg-rose-50 hover:bg-rose-100/50 border border-rose-200 hover:border-rose-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} Belum Approve Division Head (${formatRupiah(pipeline.stage6DivisionApproveValue || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-rose-500 uppercase font-sans">Belum Appr. DH</span>
                                  {pipeline.stage6DivisionApprove > 0 && <Clock className="w-2.5 h-2.5 text-rose-500 animate-pulse" />}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage6DivisionApprove > 0 ? 'text-rose-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage6DivisionApprove}
                                  </span>
                                  {pipeline.stage6DivisionApprove > 0 && (
                                    <span className="text-[7px] font-black bg-rose-100 text-rose-800 px-1 py-0.2 rounded uppercase">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-rose-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage6DivisionApprove > 0 ? 'text-rose-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage6DivisionApproveValue || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 6. Belum Cetak Invoice (Flow 6) */}
                            <td className="p-1">
                              <div 
                                onClick={() => onSelectDashboardFilter?.({ category: cat, stage: '4_invoice' })}
                                className={`group h-full min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all ${
                                  pipeline.stage7Invoice > 0 
                                    ? 'bg-cyan-50 hover:bg-cyan-100/50 border border-cyan-200 hover:border-cyan-400 shadow-sm' 
                                    : 'opacity-40 hover:opacity-100 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={`Klik untuk menyaring kategori ${cat} Belum Cetak Invoice (${formatRupiah(pipeline.stage7InvoiceValue || 0)})`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-cyan-500 uppercase font-sans">Blm Invoice</span>
                                  {pipeline.stage7Invoice > 0 && <AlertCircle className="w-2.5 h-2.5 text-cyan-500 animate-pulse" />}
                                </div>
                                <div className="flex items-baseline justify-between mt-0.5">
                                  <span className={`text-base font-black ${pipeline.stage7Invoice > 0 ? 'text-cyan-950' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {pipeline.stage7Invoice}
                                  </span>
                                  {pipeline.stage7Invoice > 0 && (
                                    <span className="text-[7px] font-black bg-cyan-100 text-cyan-800 px-1 py-0.2 rounded uppercase">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-cyan-100/80 flex items-center justify-between">
                                  <span className={`text-[9px] font-extrabold truncate ${pipeline.stage7Invoice > 0 ? 'text-cyan-700' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formatRupiah(pipeline.stage7InvoiceValue || 0)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 4. DISTRIBUSI KATEGORI & regional BREAKDOWN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* BREAKDOWN PERFORM & OTORITAS CABANG (Full Width) - Hidden for Admin role */}
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
                    const casesPercentage = Math.min(100, Math.round((b.totalCases / absoluteMaxCases) * 100));
                    const valuePercentage = Math.min(100, Math.round((b.totalValue / absoluteMaxValue) * 100));

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
