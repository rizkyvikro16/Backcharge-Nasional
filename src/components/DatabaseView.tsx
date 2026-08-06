import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Download, 
  Upload, FileText, Check, AlertCircle, AlertTriangle, RefreshCw, X, Trash2,
  Loader2, Edit
} from 'lucide-react';
import { Backcharge, BackchargeCategory, Profile, DashboardFilter, BRANCH_LIST } from '../types';
import { checkGoogleToken, uploadFileToDrive, checkServiceAccountStatus, checkAppsScriptStatus } from '../lib/googleDrive';

interface DatabaseViewProps {
  transactions: Backcharge[];
  currentUser: Profile;
  isLoading?: boolean;
  onAddTransaction: (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<void>;
  onSelectTransaction: (id: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Backcharge>, logMessage: string) => Promise<void> | void;
  activeAlertFilter?: 'due' | 'pending' | 'high_value' | '';
  onClearAlertFilter?: () => void;
  activeDashboardFilter?: DashboardFilter | null;
  onClearDashboardFilter?: () => void;
}

export default function DatabaseView({ 
  transactions, 
  currentUser, 
  isLoading = false,
  onAddTransaction, 
  onSelectTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  activeAlertFilter,
  onClearAlertFilter,
  activeDashboardFilter,
  onClearDashboardFilter
}: DatabaseViewProps) {
  
  // Role permissions
  const userRole = currentUser.role as string;
  const isAsoUser = userRole === 'ASO / Staff';
  const isSalesHeadUser = userRole === 'Sales Head' || userRole === 'Sales / Sales Head';
  const isKacabUser = userRole === 'Kepala Cabang' || userRole === 'kacab';
  const isBroUser = userRole === 'BRO';
  const isAdminUser = userRole === 'Admin';
  const isSuperAdmin = userRole === 'Administrator';

  // Search & filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const isNasional = currentUser.branch === 'Nasional' || 
    currentUser.branch.includes(',') || 
    currentUser.role === 'Administrator' || 
    currentUser.role === 'Division Head' || 
    currentUser.role.startsWith('Regional Head');
  const userBranchList = currentUser.branch && currentUser.branch !== 'Nasional'
    ? currentUser.branch.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const availableBranchOptions = userBranchList && userBranchList.length > 0
    ? BRANCH_LIST.filter(b => userBranchList.some(ub => ub.toLowerCase() === b.toLowerCase()))
    : BRANCH_LIST;
  const [selectedBranch, setSelectedBranch] = useState(isNasional ? '' : currentUser.branch);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');

  // Synchronize dashboard filters with local state
  useEffect(() => {
    if (activeDashboardFilter) {
      if (activeDashboardFilter.category !== undefined) {
        setSelectedCategory(activeDashboardFilter.category);
      }
      if (activeDashboardFilter.stage !== undefined) {
        setSelectedStage(activeDashboardFilter.stage);
      }
      if (activeDashboardFilter.branch !== undefined) {
        setSelectedBranch(activeDashboardFilter.branch);
      }
      if (activeDashboardFilter.statusPayment !== undefined) {
        setSelectedPaymentStatus(activeDashboardFilter.statusPayment);
      }
    }
  }, [activeDashboardFilter]);

  // Pagination states
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Form states
  const [category, setCategory] = useState<BackchargeCategory>('Own Risk');
  const [branch, setBranch] = useState(isNasional ? 'Jakarta' : currentUser.branch);
  const [noBak, setNoBak] = useState('');
  const [noSpk, setNoSpk] = useState('');
  const [noSap, setNoSap] = useState('');
  const [noTilang, setNoTilang] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [value, setValue] = useState('');
  const [broName, setBroName] = useState('');
  const [dokPendukungAlasan, setDokPendukungAlasan] = useState('');
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const justDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const parts = justDate.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
      }
      if (parts[2].length === 4) {
        return `${parts[0]}/${parts[1]}/${parts[2]}`; // DD/MM/YYYY
      }
    }
    return justDate;
  };

  // Attachment states (Base64 data URLs or Google Drive URLs, and file names)
  const [fileBak, setFileBak] = useState<string | null>(null);
  const [fileBakName, setFileBakName] = useState('');
  const [fileHandoverAsoSales, setFileHandoverAsoSales] = useState<string | null>(null);
  const [fileHandoverAsoSalesName, setFileHandoverAsoSalesName] = useState('');
  const [fileHandoverSalesAdmin, setFileHandoverSalesAdmin] = useState<string | null>(null);
  const [fileHandoverSalesAdminName, setFileHandoverSalesAdminName] = useState('');
  const [uploadDokPendukung, setUploadDokPendukung] = useState<string | null>(null);
  const [uploadDokPendukungName, setUploadDokPendukungName] = useState('');

  // Google Drive integration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [serviceAccountActive, setServiceAccountActive] = useState(false);
  const [appsScriptActive, setAppsScriptActive] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState<{ [key: string]: boolean }>({});

  // Check token, service account, and apps script on mount
  React.useEffect(() => {
    const token = checkGoogleToken();
    if (token) {
      setGoogleToken(token);
    }

    // Check Google Apps Script Web App
    setAppsScriptActive(checkAppsScriptStatus());

    // Check if backend Google Drive Service Account is active
    checkServiceAccountStatus().then(active => {
      setServiceAccountActive(active);
    });
  }, []);

  // Form error & success states
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check role permission for writing
  const canWrite = currentUser.role === 'ASO / Staff' || currentUser.role === 'Administrator';

  // Upgraded file change handler with automatic Google Drive upload (either Service Account or Client OAuth)
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setFile: React.Dispatch<React.SetStateAction<string | null>>, 
    setName: React.Dispatch<React.SetStateAction<string>>,
    uploadKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran file maksimal adalah 15MB");
      return;
    }

    setName(file.name);

    const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;

    if (isDriveActive) {
      setUploadingToDrive(prev => ({ ...prev, [uploadKey]: true }));
      try {
        const driveUrl = await uploadFileToDrive(file, file.name, googleToken);
        setFile(driveUrl);
        setFormError(null);
      } catch (err: any) {
        console.error("Auto Google Drive upload failed, falling back to local base64.", err);
        // Fallback to local Base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setFile(reader.result as string);
        };
        reader.readAsDataURL(file);
        alert("Gagal mengunggah otomatis ke Google Drive. File disimpan secara lokal.");
      } finally {
        setUploadingToDrive(prev => ({ ...prev, [uploadKey]: false }));
      }
    } else {
      // Standard local Base64 storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset page whenever filter or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedBranch, filterStartDate, filterEndDate, selectedStage, pageSize]);

  // Bulk selection & update states
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatusHandover, setBulkStatusHandover] = useState<string>('');
  const [bulkFileHandover, setBulkFileHandover] = useState<string | null>(null);
  const [bulkFileHandoverName, setBulkFileHandoverName] = useState<string>('');
  const [bulkTanggalHandover, setBulkTanggalHandover] = useState<string>('');
  const [bulkStatusSap, setBulkStatusSap] = useState<string>('');
  const [bulkStatusPayment, setBulkStatusPayment] = useState<string>('');
  const [bulkStatusApproval, setBulkStatusApproval] = useState<string>('');
  const [bulkLogReason, setBulkLogReason] = useState<string>('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);
  const [bulkErrorMessage, setBulkErrorMessage] = useState<string | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setFormSuccess(false);

    if (!customerName.trim()) {
      setFormError('Nama Customer wajib diisi!');
      return;
    }
    if (!value || Number(value) <= 0) {
      setFormError('Nilai Backcharge harus lebih besar dari 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddTransaction({
        category,
        branch: currentUser.branch === 'Nasional' ? branch : currentUser.branch,
        no_bak: category === 'Own Risk' ? (noBak.trim() || '-') : '-',
        no_spk: noSpk.trim() || '-',
        no_sap: category === 'Own Risk' ? (noSap.trim() || '-') : '-',
        no_tilang: category === 'ETLE' ? (noTilang.trim() || '-') : '-',
        customer_name: customerName.trim(),
        license_plate: licensePlate.trim() || '-',
        value: Number(value),
        status_sap: 'N/A',
        status_confirm: 'Telah Dikonfirmasi',
        status_handover: 'Pending',
        no_invoice: '-',
        status_payment: 'Belum Bayar',
        file_bak_url: fileBak,
        file_handover_aso_sales_url: fileHandoverAsoSales,
        file_handover_sales_admin_url: fileHandoverSalesAdmin,
        tanggal: tanggal || null,
        bro_name: broName.trim() || '-',
        nama_bro: broName.trim() || '-',
        dok_pendukung_alasan: dokPendukungAlasan.trim() || '-',
        alasan: dokPendukungAlasan.trim() || '-',
        upload_dok_pendukung: uploadDokPendukung
      });

      // Reset form on success only
      setNoBak('');
      setNoSpk('');
      setNoSap('');
      setNoTilang('');
      setCustomerName('');
      setLicensePlate('');
      setValue('');
      setBroName('');
      setDokPendukungAlasan('');
      setFileBak(null);
      setFileBakName('');
      setFileHandoverAsoSales(null);
      setFileHandoverAsoSalesName('');
      setFileHandoverSalesAdmin(null);
      setFileHandoverSalesAdminName('');
      setUploadDokPendukung(null);
      setUploadDokPendukungName('');
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setTanggal(`${yyyy}-${mm}-${dd}`);
      
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan transaksi ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // EDIT TRANSACTION FEATURE STATES & HANDLERS
  // ==========================================
  const [editingTransaction, setEditingTransaction] = useState<Backcharge | null>(null);
  const [editCategory, setEditCategory] = useState<BackchargeCategory>('Own Risk');
  const [editBranch, setEditBranch] = useState('Jakarta');
  const [editNoBak, setEditNoBak] = useState('');
  const [editNoSpk, setEditNoSpk] = useState('');
  const [editNoSap, setEditNoSap] = useState('');
  const [editNoTilang, setEditNoTilang] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editBroName, setEditBroName] = useState('');
  const [editDokPendukungAlasan, setEditDokPendukungAlasan] = useState('');
  const [editTanggal, setEditTanggal] = useState('');

  const [editFileBak, setEditFileBak] = useState<string | null>(null);
  const [editFileBakName, setEditFileBakName] = useState('');
  const [editFileHandoverAsoSales, setEditFileHandoverAsoSales] = useState<string | null>(null);
  const [editFileHandoverAsoSalesName, setEditFileHandoverAsoSalesName] = useState('');
  const [editFileHandoverSalesAdmin, setEditFileHandoverSalesAdmin] = useState<string | null>(null);
  const [editFileHandoverSalesAdminName, setEditFileHandoverSalesAdminName] = useState('');
  const [editUploadDokPendukung, setEditUploadDokPendukung] = useState<string | null>(null);
  const [editUploadDokPendukungName, setEditUploadDokPendukungName] = useState('');

  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const handleEditFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setFile: React.Dispatch<React.SetStateAction<string | null>>, 
    setName: React.Dispatch<React.SetStateAction<string>>,
    uploadKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran file maksimal adalah 15MB");
      return;
    }

    setName(file.name);

    const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;

    if (isDriveActive) {
      setUploadingToDrive(prev => ({ ...prev, [uploadKey]: true }));
      try {
        const driveUrl = await uploadFileToDrive(file, file.name, googleToken);
        setFile(driveUrl);
      } catch (err: any) {
        console.error("Auto Google Drive upload failed, falling back to local base64.", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFile(reader.result as string);
        };
        reader.readAsDataURL(file);
        alert("Gagal mengunggah otomatis ke Google Drive. File disimpan secara lokal.");
      } finally {
        setUploadingToDrive(prev => ({ ...prev, [uploadKey]: false }));
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEdit = (t: Backcharge) => {
    setEditingTransaction(t);
    setEditCategory(t.category);
    setEditBranch(t.branch);
    setEditNoBak(t.no_bak === '-' ? '' : t.no_bak);
    setEditNoSpk(t.no_spk === '-' ? '' : t.no_spk);
    setEditNoSap(t.no_sap === '-' ? '' : t.no_sap);
    setEditNoTilang(t.no_tilang === '-' ? '' : t.no_tilang);
    setEditCustomerName(t.customer_name);
    setEditLicensePlate(t.license_plate === '-' ? '' : t.license_plate);
    setEditValue(String(t.value));
    setEditBroName(t.bro_name === '-' ? '' : (t.bro_name || ''));
    setEditDokPendukungAlasan(t.dok_pendukung_alasan === '-' ? '' : (t.dok_pendukung_alasan || ''));
    
    const formattedDate = t.tanggal ? (t.tanggal.includes('T') ? t.tanggal.split('T')[0] : t.tanggal.split(' ')[0]) : '';
    setEditTanggal(formattedDate);

    setEditFileBak(t.file_bak_url || null);
    setEditFileBakName(t.file_bak_url ? 'file_bak_exist' : '');
    setEditFileHandoverAsoSales(t.file_handover_aso_sales_url || null);
    setEditFileHandoverAsoSalesName(t.file_handover_aso_sales_url ? 'file_handover_aso_sales_exist' : '');
    setEditFileHandoverSalesAdmin(t.file_handover_sales_admin_url || null);
    setEditFileHandoverSalesAdminName(t.file_handover_sales_admin_url ? 'file_handover_sales_admin_exist' : '');
    setEditUploadDokPendukung(t.upload_dok_pendukung || null);
    setEditUploadDokPendukungName(t.upload_dok_pendukung ? 'file_dok_pendukung_exist' : '');
    
    setEditError(null);
    setEditSuccess(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    if (isEditSubmitting) return;

    setEditError(null);
    setEditSuccess(false);

    if (!editCustomerName.trim()) {
      setEditError('Nama Customer wajib diisi!');
      return;
    }
    if (!editValue || Number(editValue) <= 0) {
      setEditError('Nilai Backcharge harus lebih besar dari 0!');
      return;
    }

    const confirmMsg = `Konfirmasi Revisi Data:\nApakah Anda yakin ingin menyimpan perubahan data denda transaksi ${editingTransaction.id} (${editCustomerName.trim()})?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsEditSubmitting(true);
    try {
      if (onUpdateTransaction) {
        const updates: Partial<Backcharge> = {
          category: editCategory,
          branch: editBranch,
          no_bak: editCategory === 'Own Risk' ? (editNoBak.trim() || '-') : '-',
          no_spk: editNoSpk.trim() || '-',
          no_sap: editCategory === 'Own Risk' ? (editNoSap.trim() || '-') : '-',
          no_tilang: editCategory === 'ETLE' ? (editNoTilang.trim() || '-') : '-',
          customer_name: editCustomerName.trim(),
          license_plate: editLicensePlate.trim() || '-',
          value: Number(editValue),
          tanggal: editTanggal || null,
          bro_name: editBroName.trim() || '-',
          nama_bro: editBroName.trim() || '-',
          dok_pendukung_alasan: editDokPendukungAlasan.trim() || '-',
          alasan: editDokPendukungAlasan.trim() || '-',
          file_bak_url: editFileBak,
          file_handover_aso_sales_url: editFileHandoverAsoSales,
          file_handover_sales_admin_url: editFileHandoverSalesAdmin,
          upload_dok_pendukung: editUploadDokPendukung
        };

        const logMsg = `Merevisi data denda ${editingTransaction.id} (${editCustomerName})`;
        await onUpdateTransaction(editingTransaction.id, updates, logMsg);
        setEditSuccess(true);
        setTimeout(() => {
          setEditingTransaction(null);
        }, 1000);
      }
    } catch (err: any) {
      setEditError(err.message || 'Gagal mengubah data');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Auto reset pagination page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedBranch, filterStartDate, filterEndDate, selectedStage, selectedPaymentStatus, activeAlertFilter, activeDashboardFilter]);

  // Memoized transactions filtering for optimal rendering performance & minimal re-computations
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        t.id.toLowerCase().includes(searchLower) || 
        t.customer_name.toLowerCase().includes(searchLower) ||
        t.no_bak.toLowerCase().includes(searchLower) ||
        t.no_invoice.toLowerCase().includes(searchLower);

      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      const matchesBranch = !selectedBranch || 
        t.branch === selectedBranch || 
        (selectedBranch.includes(',') && selectedBranch.split(',').map(s => s.trim()).includes(t.branch));
      const matchesPaymentStatus = !selectedPaymentStatus || t.status_payment === selectedPaymentStatus;

      let matchesDateRange = true;
      if (filterStartDate || filterEndDate) {
        if (!t.tanggal) {
          matchesDateRange = false;
        } else {
          const tDate = t.tanggal.split('T')[0].split(' ')[0];
          if (filterStartDate && tDate < filterStartDate) {
            matchesDateRange = false;
          }
          if (filterEndDate && tDate > filterEndDate) {
            matchesDateRange = false;
          }
        }
      }

      let matchesStage = true;
      if (selectedStage) {
        const stepInvoice = t.no_invoice && t.no_invoice !== '-';
        const stepPayment = t.status_payment === 'Lunas';

        if (selectedStage === '1_handover') {
          matchesStage = t.status_handover === 'Pending';
        } else if (selectedStage === '2_confirm' || selectedStage === '2_admin') {
          matchesStage = t.status_handover === 'Diserahkan ke Admin';
        } else if (selectedStage === '3_sap') {
          const isPendingApproval = !t.status_approval || t.status_approval === 'Belum Approval';
          let matchesAuthApproval = (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin') && isPendingApproval && !stepInvoice && !stepPayment;
          if (isKacabUser && !isSuperAdmin) {
            matchesAuthApproval = matchesAuthApproval && (t.category === 'Maintenance' || t.category === 'TPL');
          } else if (isSalesHeadUser && !isSuperAdmin) {
            matchesAuthApproval = matchesAuthApproval && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE');
          }
          matchesStage = matchesAuthApproval;
        } else if (selectedStage === '4_invoice') {
          matchesStage = t.status_handover !== 'Pending' && !stepInvoice && !stepPayment && !((!t.status_approval || t.status_approval === 'Belum Approval'));
        } else if (selectedStage === '5_payment') {
          matchesStage = stepInvoice || stepPayment;
        } else if (selectedStage === '6_done') {
          matchesStage = stepPayment;
        }
      }

      let matchesAlertFilter = true;
      const combinedAlert = activeAlertFilter || activeDashboardFilter?.alert;
      if (combinedAlert) {
        const ageMs = new Date().getTime() - new Date(t.created_at).getTime();
        if (combinedAlert === 'due') {
          matchesAlertFilter = t.status_payment === 'Belum Bayar' && ageMs > 15 * 24 * 3600 * 1000;
        } else if (combinedAlert === 'pending') {
          matchesAlertFilter = t.status_payment === 'Belum Bayar' && ageMs > 3 * 24 * 3600 * 1000;
        } else if (combinedAlert === 'high_value') {
          matchesAlertFilter = t.status_payment === 'Belum Bayar' && ageMs > 30 * 24 * 3600 * 1000;
        }
      }

      return matchesSearch && matchesCategory && matchesBranch && matchesDateRange && matchesStage && matchesPaymentStatus && matchesAlertFilter;
    });
  }, [transactions, search, selectedCategory, selectedBranch, filterStartDate, filterEndDate, selectedStage, selectedPaymentStatus, activeAlertFilter, activeDashboardFilter]);

  // Pagination computations
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedTransactions = filteredTransactions.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

  // Bulk selection & update permissions based on role
  const canUpdateHandover = isAsoUser || isSuperAdmin;
  const canUpdateSap = isSalesHeadUser || isSuperAdmin;
  const canUpdatePayment = isAdminUser || isSuperAdmin;
  const canUpdateApproval = isSalesHeadUser || isKacabUser || isSuperAdmin;

  // BRO and read-only roles cannot perform bulk update
  const canBulkUpdate = !isBroUser && (canUpdateHandover || canUpdateSap || canUpdatePayment || canUpdateApproval);

  // Bulk selection & update handlers
  const allPaginatedIds = paginatedTransactions.map(t => t.id);
  const isAllPageSelected = allPaginatedIds.length > 0 && allPaginatedIds.every(id => selectedTxIds.includes(id));

  const handleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedTxIds(prev => prev.filter(id => !allPaginatedIds.includes(id)));
    } else {
      setSelectedTxIds(prev => Array.from(new Set([...prev, ...allPaginatedIds])));
    }
  };

  const handleToggleSelectTx = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedTxIds(filteredTransactions.map(t => t.id));
  };

  const handleClearSelection = () => {
    setSelectedTxIds([]);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTxIds.length === 0 || isBulkSubmitting || !canBulkUpdate) return;

    const updates: Partial<Backcharge> = {};
    if (canUpdateHandover) {
      if (bulkStatusHandover) updates.status_handover = bulkStatusHandover;
      if (bulkFileHandover) {
        updates.file_handover_sales_admin_url = bulkFileHandover;
        updates.file_handover_aso_sales_url = bulkFileHandover;
        if (!bulkStatusHandover) {
          updates.status_handover = 'Diserahkan ke Admin';
        }
      }
      if (bulkTanggalHandover) {
        updates.tanggal_handover = bulkTanggalHandover;
      } else if (bulkFileHandover || bulkStatusHandover) {
        updates.tanggal_handover = new Date().toLocaleString('id-ID');
      }
    }
    if (canUpdateSap && bulkStatusSap) updates.status_sap = bulkStatusSap;
    if (canUpdatePayment && bulkStatusPayment) updates.status_payment = bulkStatusPayment;

    if (Object.keys(updates).length === 0 && (!canUpdateApproval || !bulkStatusApproval)) {
      setBulkErrorMessage('Pilih setidaknya satu status atau unggah dokumen serah terima!');
      return;
    }

    const updatesList: string[] = [];
    if (bulkStatusApproval) updatesList.push(`• Status Approval: ${bulkStatusApproval}`);
    if (bulkStatusSap) updatesList.push(`• Status SAP: ${bulkStatusSap}`);
    if (bulkStatusPayment) updatesList.push(`• Status Pembayaran: ${bulkStatusPayment}`);
    if (bulkStatusHandover) updatesList.push(`• Status Serah Terima: ${bulkStatusHandover}`);
    if (bulkFileHandover) updatesList.push(`• Lampiran Dokumen Serah Terima Massal: ${bulkFileHandoverName || 'Berkas Terlampir'}`);
    if (bulkTanggalHandover) updatesList.push(`• Tanggal Serah Terima: ${bulkTanggalHandover}`);

    const confirmMessage = `PERINGATAN UPDATE MASSAL!\n\nAnda akan melakukan Update Status & Dokumen Massal untuk ${selectedTxIds.length} transaksi sekaligus:\n${updatesList.join('\n')}\n\nApakah Anda yakin ingin menerapkan perubahan ini?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsBulkSubmitting(true);
    setBulkErrorMessage(null);
    setBulkSuccessMessage(null);

    try {
      const reason = bulkLogReason.trim() || `Update status & dokumen massal (${selectedTxIds.length} transaksi) oleh ${currentUser.full_name || currentUser.email} (${currentUser.role})`;
      
      if (onUpdateTransaction) {
        for (const id of selectedTxIds) {
          const item = transactions.find(t => t.id === id);
          const itemUpdates: Partial<Backcharge> = { ...updates };

          if (bulkStatusApproval && item) {
            const isKacab = currentUser.role === 'Kepala Cabang' || (currentUser.role as string) === 'kacab';
            const isSH = currentUser.role === 'Sales Head' || (currentUser.role as string) === 'Sales / Sales Head';
            const isAdmin = currentUser.role === 'Administrator';

            let canApproveThisItem = isAdmin;
            if (isKacab && (item.category === 'Maintenance' || item.category === 'TPL')) canApproveThisItem = true;
            if (isSH && (item.category === 'Own Risk' || item.category === 'Ekspedisi' || item.category === 'ETLE')) canApproveThisItem = true;

            if (canApproveThisItem) {
              itemUpdates.status_approval = bulkStatusApproval;
              itemUpdates.approved_by = `${currentUser.full_name || currentUser.email} (${currentUser.role})`;
              itemUpdates.approved_at = new Date().toLocaleString('id-ID');
            }
          }

          if (Object.keys(itemUpdates).length > 0) {
            await onUpdateTransaction(id, itemUpdates, `${reason} - Transaksi ${id}`);
          }
        }
      }

      setBulkSuccessMessage(`Berhasil memperbarui ${selectedTxIds.length} transaksi!`);
      setTimeout(() => {
        setShowBulkModal(false);
        setSelectedTxIds([]);
        setBulkStatusHandover('');
        setBulkFileHandover(null);
        setBulkFileHandoverName('');
        setBulkTanggalHandover('');
        setBulkStatusSap('');
        setBulkStatusPayment('');
        setBulkStatusApproval('');
        setBulkLogReason('');
      }, 1500);
    } catch (err: any) {
      setBulkErrorMessage(err.message || 'Gagal memperbarui status secara massal.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Export visible transactions to Excel (styled XML spreadsheet format)
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    let excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Rekap Backcharge</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; }
          .header { background-color: #1e3a8a; color: white; font-weight: bold; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          .title { font-size: 16px; font-weight: bold; color: #1e3a8a; text-align: center; }
          .subtitle { font-size: 11px; color: #475569; text-align: center; margin-bottom: 20px; }
          .number { mso-number-format: "\\#\\,\\#\\#0"; text-align: right; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="15" class="title">REKAPITULASI DATA BACKCHARGE - PT ADI SARANA ARMADA, TBK</td>
          </tr>
          <tr>
            <td colspan="15" class="subtitle">Unduh Tanggal: ${new Date().toLocaleDateString('id-ID')} | Total Item: ${filteredTransactions.length}</td>
          </tr>
          <tr><td colspan="15"></td></tr>
          <thead>
            <tr class="header">
              <th>ID Transaksi</th>
              <th>Tanggal BAK</th>
              <th>Kategori</th>
              <th>Cabang Kota</th>
              <th>No BAK</th>
              <th>No Surat Tilang</th>
              <th>No SPK</th>
              <th>No SAP</th>
              <th>Nama Customer</th>
              <th>No Polisi</th>
              <th>Nilai Backcharge (Rp)</th>
              <th>Status SAP</th>
              <th>Status Serah Terima</th>
              <th>No Invoice</th>
              <th>Status Payment</th>
              <th>Tanggal Input</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredTransactions.forEach(t => {
      excelTemplate += `
        <tr>
          <td style="font-weight: bold;">${t.id}</td>
          <td>${formatDateOnly(t.tanggal)}</td>
          <td>${t.category}</td>
          <td>${t.branch}</td>
          <td>${t.no_bak || '-'}</td>
          <td>${t.no_tilang || '-'}</td>
          <td>${t.no_spk || '-'}</td>
          <td>${t.no_sap || '-'}</td>
          <td>${t.customer_name}</td>
          <td style="font-family: monospace;">${t.license_plate || '-'}</td>
          <td class="number">${t.value}</td>
          <td>${t.status_sap || '-'}</td>
          <td>${t.status_handover}</td>
          <td>${t.no_invoice || '-'}</td>
          <td style="font-weight: bold;">${t.status_payment}</td>
          <td>${new Date(t.created_at).toLocaleString('id-ID')}</td>
        </tr>
      `;
    });

    excelTemplate += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_Backcharge_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: TRANSACTION INPUT FORM (GUARDS ACCORDING TO ROLE) */}
      <div className={`lg:col-span-4 ${canWrite ? 'block' : 'hidden lg:hidden'} bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
            <span>Input Backcharge Baru</span>
          </h3>
          <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded uppercase">
            {currentUser.role}
          </span>
        </div>

        {formSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl font-medium flex items-center space-x-2 animate-bounce">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Denda denda sukses disimpan & ditransmisikan!</span>
          </div>
        )}

        {formError && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {currentUser.branch === 'Nasional' ? (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cabang Kota</label>
              <select 
                value={branch} 
                onChange={(e) => setBranch(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BRANCH_LIST.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cabang Kota</label>
              <input 
                type="text" 
                disabled 
                value={currentUser.branch} 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-100 font-bold text-slate-500" 
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kategori Backcharge</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value as BackchargeCategory)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="Own Risk">Own Risk</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Ekspedisi">Ekspedisi</option>
              <option value="ETLE">ETLE</option>
              <option value="TPL">TPL</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal BAK</label>
            <input 
              type="date" 
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold bg-slate-50/50"
            />
          </div>

          {category === 'Own Risk' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. BAK (Berita Acara Kejadian)</label>
              <input 
                type="text" 
                value={noBak}
                onChange={(e) => setNoBak(e.target.value)}
                placeholder="BAK/2026/XI/102" 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

          {category === 'ETLE' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Surat Tilang</label>
              <input 
                type="text" 
                value={noTilang}
                onChange={(e) => setNoTilang(e.target.value)}
                placeholder="TILANG/ETLE/9281" 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. SPK (Surat Perintah Kerja)</label>
            <input 
              type="text" 
              value={noSpk}
              onChange={(e) => setNoSpk(e.target.value)}
              placeholder="SPK-MAINT-492" 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Customer</label>
            <input 
              type="text" 
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="PT Indonesia Gemilang" 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Polisi Kendaraan</label>
            <input 
              type="text" 
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="B 1234 ABC" 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama BRO</label>
            <input 
              type="text" 
              value={broName}
              onChange={(e) => setBroName(e.target.value)}
              placeholder="Nama BRO..." 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nilai Backcharge (Rp)</label>
            <input 
              type="number" 
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nominal" 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono font-bold"
            />
          </div>

          {/* ATTACHMENT PICKS SECTION REMOVED - MOVED TO HANDOVER STEP */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 ${isSubmitting ? '' : 'animate-pulse hover:animate-none'}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan &amp; Sinkronisasi...</span>
              </>
            ) : (
              <span>Simpan &amp; Kirim Notifikasi</span>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: LIST AND FILTER TABLE */}
      <div className={`col-span-1 ${canWrite ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
        
        {(activeAlertFilter || activeDashboardFilter) && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span>
                Menampilkan data terfilter dari Dashboard:{' '}
                <strong className="font-extrabold uppercase text-indigo-950">
                  {activeAlertFilter === 'due' && 'Jatuh Tempo Dalam 7 Hari (SLA > 15 Hari)'}
                  {activeAlertFilter === 'pending' && 'Pending > 3 Hari'}
                  {activeAlertFilter === 'high_value' && 'Lead Time OS > 30 Hari'}
                  {activeDashboardFilter?.category && `Kategori: ${activeDashboardFilter.category}`}
                  {activeDashboardFilter?.stage && `Tahap: ${activeDashboardFilter.stage === '1_handover' ? 'Fisik di ASO' : activeDashboardFilter.stage === '2_confirm' ? 'Berkas di Admin' : activeDashboardFilter.stage === '3_sap' ? 'Approval' : activeDashboardFilter.stage === '4_invoice' ? 'Cetak Invoice' : 'Kolektif Bayar'}`}
                  {activeDashboardFilter?.branch && `Cabang: ${activeDashboardFilter.branch}`}
                  {activeDashboardFilter?.statusPayment && `Status Bayar: ${activeDashboardFilter.statusPayment}`}
                  {activeDashboardFilter?.statusConfirm && `Status Konfirmasi: ${activeDashboardFilter.statusConfirm}`}
                  {activeDashboardFilter?.alert && `Alert: ${activeDashboardFilter.alert === 'due' ? 'Jatuh Tempo 7 Hari' : activeDashboardFilter.alert === 'pending' ? 'Pending > 3 Hari' : 'Lead Time OS > 30 Hari'}`}
                </strong>
              </span>
            </div>
            <button 
              onClick={() => {
                onClearAlertFilter?.();
                onClearDashboardFilter?.();
                setSearch('');
                setSelectedCategory('');
                setSelectedBranch(isNasional ? '' : currentUser.branch);
                setSelectedStage('');
                setSelectedPaymentStatus('');
              }}
              className="flex items-center gap-1.5 bg-white hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-indigo-200 transition-all cursor-pointer shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              Reset Saringan
            </button>
          </div>
        )}

        {/* Filters Panel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-2 flex-grow">
            {/* Debounced search */}
            <div className="relative flex-grow max-w-md animate-in fade-in duration-350">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari ID, Customer, No Invoice, BAK..." 
                className="w-full text-xs border border-slate-200 rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 hover:bg-slate-100/50 transition-all font-semibold text-slate-700 placeholder-slate-400 shadow-sm"
              />
            </div>

            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
            >
              <option value="">Semua Kategori</option>
              <option value="Own Risk">Own Risk</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Ekspedisi">Ekspedisi</option>
              <option value="ETLE">ETLE</option>
              <option value="TPL">TPL</option>
            </select>

            {isNasional && (
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="text-xs border border-slate-200 rounded-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
              >
                <option value="">Semua Cabang</option>
                {availableBranchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            <select 
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="text-xs border border-slate-200 rounded-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
            >
              <option value="">Semua Tahap Proses</option>
              <option value="1_handover">1. Menunggu Serah Terima Berkas</option>
              <option value="2_admin">2. Berkas di Admin / Menunggu Approval</option>
              <option value="3_sap">3. Menunggu Approval (Sales Head / Kacab)</option>
              <option value="4_invoice">4. Menunggu Cetak &amp; Kirim Invoice</option>
              <option value="5_payment">5. Menunggu Pelunasan Denda</option>
              <option value="6_done">6. Selesai (Lunas)</option>
            </select>

            <select 
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
            >
              <option value="">Semua Status Bayar</option>
              <option value="Belum Bayar">Belum Bayar</option>
              <option value="Lunas">Lunas</option>
            </select>

            {/* Date Range Filter */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Filter Tanggal BAK</span>
              <div className="flex items-center gap-2 w-full">
                {/* Mulai */}
                <div className="flex-1 min-w-[120px] sm:w-36">
                  <input 
                    type="date" 
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm text-center"
                    title="Mulai Tanggal"
                  />
                </div>
                
                <span className="text-slate-400 font-bold text-[10px] px-1">s/d</span>

                {/* Sampai */}
                <div className="flex-1 min-w-[120px] sm:w-36">
                  <input 
                    type="date" 
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm text-center"
                    title="Sampai Tanggal"
                  />
                </div>

                {(filterStartDate || filterEndDate) && (
                  <button 
                    type="button"
                    onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                    className="text-slate-400 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-full cursor-pointer flex-shrink-0"
                    title="Hapus Filter Tanggal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
 
          <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold px-5 py-2.5 rounded-full shadow-sm transition-all flex-shrink-0 cursor-pointer self-stretch sm:self-auto"
            title="Export Spreadsheet Rekap Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Unduh Rekap Excel</span>
          </button>
        </div>

        {/* Database List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* Skeleton Sync Bar */}
          {isLoading && (
            <div className="bg-blue-50/80 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between text-blue-700 text-xs font-bold animate-pulse">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                <span>Menyinkronkan data transaksi dari server...</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-extrabold shrink-0">
                Singkronisasi Real-Time
              </span>
            </div>
          )}

          {/* Floating Bulk Action Bar */}
          {selectedTxIds.length > 0 && (
            <div className="bg-slate-900 text-white p-3.5 px-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg">
                  {selectedTxIds.length} Terpilih
                </span>
                <span className="text-xs font-bold text-slate-200">
                  {selectedTxIds.length} transaksi dipilih untuk tindakan massal
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {filteredTransactions.length > selectedTxIds.length && (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Pilih Semua ({filteredTransactions.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkStatusHandover('');
                    setBulkStatusSap('');
                    setBulkStatusPayment('');
                    setBulkStatusApproval('');
                    setBulkLogReason('');
                    setBulkFileHandover(null);
                    setBulkFileHandoverName('');
                    setBulkTanggalHandover('');
                    setBulkErrorMessage(null);
                    setBulkSuccessMessage(null);
                    setShowBulkModal(true);
                  }}
                  className="px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Update Status Massal ({selectedTxIds.length})</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-3 text-center w-10">
                    <input 
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={handleSelectAllPage}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Pilih/Batal Semua di halaman ini"
                    />
                  </th>
                  <th className="p-3 whitespace-nowrap">ID / Kota</th>
                  <th className="p-3 whitespace-nowrap text-slate-500">TGL BAK</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Denda (Rp)</th>
                  <th className="p-3">Fisik Berkas</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Pembayaran</th>
                  {canWrite && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {isLoading ? (
                  Array.from({ length: pageSize > 10 ? 10 : Math.max(pageSize, 5) }).map((_, idx) => (
                    <tr key={`skel-row-${idx}`} className="animate-pulse border-b border-slate-100/80 bg-white">
                      <td className="p-3 text-center">
                        <div className="w-4 h-4 bg-slate-200/80 rounded mx-auto" />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <div className="h-4 bg-slate-200/80 rounded w-20" />
                          <span className="text-slate-200">/</span>
                          <div className="h-3 bg-slate-200/60 rounded w-10" />
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="h-4 bg-slate-200/70 rounded w-16" />
                      </td>
                      <td className="p-3">
                        <div className="h-5 bg-slate-200/80 rounded-md w-16" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 bg-slate-200/80 rounded w-28" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 bg-slate-200/80 rounded w-24" />
                      </td>
                      <td className="p-3">
                        <div className="h-5 bg-slate-200/70 rounded w-16" />
                      </td>
                      <td className="p-3">
                        <div className="h-5 bg-slate-200/70 rounded w-20" />
                      </td>
                      <td className="p-3">
                        <div className="h-5 bg-slate-200/70 rounded w-14" />
                      </td>
                      {canWrite && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <div className="w-6 h-6 bg-slate-200/70 rounded-lg" />
                            {currentUser.role === 'Administrator' && (
                              <div className="w-6 h-6 bg-slate-200/70 rounded-lg" />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  paginatedTransactions.map((t) => {
                    const createdDate = new Date(t.created_at || t.tanggal).getTime();
                    const ageDays = Math.floor((new Date().getTime() - createdDate) / (1000 * 60 * 60 * 24));
                    const isUnpaid = t.status_payment === 'Belum Bayar';
                    const isOver30DaysUnpaid = isUnpaid && ageDays > 30;
                    const isOver7DaysUnpaid = isUnpaid && ageDays > 7;

                    let handoverBadge = (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600">
                        Pending
                      </span>
                    );
                    if (t.status_handover === 'Diserahkan ke Admin') {
                      handoverBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-indigo-50 text-indigo-600">
                          Diserahkan
                        </span>
                      );
                    } else if (t.status_handover === 'Diterima Admin') {
                      handoverBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-50 text-emerald-600">
                          Diterima
                        </span>
                      );
                    }

                    const invoiceText = t.no_invoice && t.no_invoice !== '-' ? (
                      <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {t.no_invoice}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">Belum Terbit</span>
                    );

                    let paymentBadge = (
                      <span 
                        className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                          isOver30DaysUnpaid 
                            ? 'bg-rose-100 text-rose-700 border border-rose-300 font-extrabold inline-flex items-center gap-1 shadow-sm' 
                            : isOver7DaysUnpaid
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold inline-flex items-center gap-1 shadow-sm'
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}
                        title={
                          isOver30DaysUnpaid 
                            ? `PERINGATAN TINGGI: Belum Bayar > 30 Hari (${ageDays} Hari)` 
                            : isOver7DaysUnpaid 
                              ? `PERINGATAN: Belum Bayar > 7 Hari (${ageDays} Hari)` 
                              : undefined
                        }
                      >
                        {isOver30DaysUnpaid && <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse flex-shrink-0" />}
                        {!isOver30DaysUnpaid && isOver7DaysUnpaid && <AlertCircle className="w-3 h-3 text-amber-600 animate-pulse flex-shrink-0" />}
                        <span>{isUnpaid && ageDays > 7 ? `Belum (${ageDays}hr)` : 'Belum'}</span>
                      </span>
                    );
                    if (t.status_payment === 'Lunas') {
                      paymentBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">
                          Lunas
                        </span>
                      );
                    } else if (t.status_confirm === 'Ditolak / Negosiasi Ulang') {
                      paymentBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-700">
                          Backcharge tidak tertagih
                        </span>
                      );
                    }

                    const isSelected = selectedTxIds.includes(t.id);

                    return (
                      <tr 
                        key={t.id} 
                        onClick={() => onSelectTransaction(t.id)}
                        className={`hover:bg-slate-50/70 cursor-pointer transition-all duration-150 border-b border-slate-100 ${
                          isSelected 
                            ? 'bg-blue-50/40 hover:bg-blue-50/60' 
                            : isOver30DaysUnpaid 
                              ? 'bg-rose-50/20 hover:bg-rose-50/40' 
                              : isOver7DaysUnpaid
                                ? 'bg-amber-50/20 hover:bg-amber-50/40'
                                : ''
                        }`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelectTx(t.id, e)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 whitespace-nowrap">
                            {isOver30DaysUnpaid ? (
                              <span 
                                title={`PERINGATAN TINGGI: Belum Bayar > 30 Hari (${ageDays} Hari)`} 
                                className="inline-flex items-center text-rose-600 animate-bounce"
                              >
                                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                              </span>
                            ) : isOver7DaysUnpaid ? (
                              <span 
                                title={`PERINGATAN: Belum Bayar > 7 Hari (${ageDays} Hari)`} 
                                className="inline-flex items-center text-amber-600"
                              >
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              </span>
                            ) : null}
                            <span className={`font-extrabold ${isOver30DaysUnpaid ? 'text-rose-700 font-mono' : isOver7DaysUnpaid ? 'text-amber-800 font-mono' : 'text-slate-950'}`}>
                              {t.id}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="text-[10px] text-slate-500 font-bold">{t.branch}</span>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-950 font-bold">
                          {formatDateOnly(t.tanggal)}
                        </td>
                        <td className="p-3">
                          <span className="text-[9px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded uppercase">
                            {t.category}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-950 truncate max-w-[120px]" title={t.customer_name}>
                          {t.customer_name}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-950">
                          {formatRupiah(t.value)}
                        </td>
                        <td className="p-3">{handoverBadge}</td>
                        <td className="p-3">{invoiceText}</td>
                        <td className="p-3">{paymentBadge}</td>
                        {canWrite && (
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(t)}
                                className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-all cursor-pointer"
                                title="Edit Data Backcharge"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {currentUser.role === 'Administrator' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onDeleteTransaction) {
                                      onDeleteTransaction(t.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-all cursor-pointer"
                                  title="Hapus Data Backcharge"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}

                {!isLoading && filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 10 : 9} className="p-8 text-center text-slate-400 italic font-medium">
                      Tidak ada data transaksi ditemukan matching kriteria pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls bar */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 font-bold text-xs select-none">
            <div className="flex items-center space-x-2">
              <span>Tampilkan:</span>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {[5, 10, 15, 25, 50].map(size => (
                  <option key={size} value={size}>{size} data</option>
                ))}
              </select>
              <span className="text-slate-400 font-medium">
                | Menampilkan {totalItems > 0 ? (activePage - 1) * pageSize + 1 : 0} - {Math.min(activePage * pageSize, totalItems)} dari {totalItems} data denda
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={activePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={`px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-black hover:bg-slate-50 transition-all ${activePage === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                Prev
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (activePage > 3 && totalPages > 5) {
                  pageNum = activePage - 3 + i;
                  if (pageNum + (4 - i) > totalPages) {
                    pageNum = totalPages - 4 + i;
                  }
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg border font-bold transition-all ${activePage === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={activePage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className={`px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-black hover:bg-slate-50 transition-all ${activePage === totalPages || totalPages === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* EDIT MODAL FOR REVISING DATA */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 my-8 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-10 flex-shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                  Revisi Data Backcharge - {editingTransaction.id}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Revisi data apabila terjadi kesalahan input awal.</p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEditSubmit} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {editSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl font-medium flex items-center space-x-2 animate-bounce">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Perubahan data sukses disimpan!</span>
                </div>
              )}

              {editError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Cabang */}
              {currentUser.role === 'Administrator' ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cabang Kota</label>
                  <select 
                    value={editBranch} 
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BRANCH_LIST.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cabang Kota</label>
                  <input 
                    type="text" 
                    disabled 
                    value={editBranch} 
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-100 font-bold text-slate-500" 
                  />
                </div>
              )}

              {/* Kategori */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kategori Backcharge</label>
                <select 
                  value={editCategory} 
                  onChange={(e) => setEditCategory(e.target.value as BackchargeCategory)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="Own Risk">Own Risk</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Ekspedisi">Ekspedisi</option>
                  <option value="ETLE">ETLE</option>
                  <option value="TPL">TPL</option>
                </select>
              </div>

              {/* Tanggal BAK */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal BAK</label>
                <input 
                  type="date" 
                  value={editTanggal}
                  onChange={(e) => setEditTanggal(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold bg-slate-50/50"
                />
              </div>

              {/* No. BAK (Own Risk only) */}
              {editCategory === 'Own Risk' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. BAK (Berita Acara Kejadian)</label>
                  <input 
                    type="text" 
                    value={editNoBak}
                    onChange={(e) => setEditNoBak(e.target.value)}
                    placeholder="BAK/2026/XI/102" 
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                  />
                </div>
              )}

              {/* No. Tilang (ETLE only) */}
              {editCategory === 'ETLE' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Surat Tilang</label>
                  <input 
                    type="text" 
                    value={editNoTilang}
                    onChange={(e) => setEditNoTilang(e.target.value)}
                    placeholder="TILANG/ETLE/9281" 
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                  />
                </div>
              )}

              {/* No. SPK */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. SPK (Surat Perintah Kerja)</label>
                <input 
                  type="text" 
                  value={editNoSpk}
                  onChange={(e) => setEditNoSpk(e.target.value)}
                  placeholder="SPK-MAINT-492" 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Nama Customer */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Customer</label>
                <input 
                  type="text" 
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="PT Indonesia Gemilang" 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-900 bg-slate-50/20"
                />
              </div>

              {/* No Polisi */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Polisi Kendaraan</label>
                <input 
                  type="text" 
                  value={editLicensePlate}
                  onChange={(e) => setEditLicensePlate(e.target.value)}
                  placeholder="B 1234 ABC" 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Nama BRO */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama BRO</label>
                <input 
                  type="text" 
                  value={editBroName}
                  onChange={(e) => setEditBroName(e.target.value)}
                  placeholder="Nama BRO..." 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Nilai Backcharge */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nilai Backcharge (Rp)</label>
                <input 
                  type="number" 
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Nominal" 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono font-bold"
                />
              </div>

              {/* Dokumen Pendukung & Alasan */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dokumen Pendukung & Alasan Konfirmasi Dokumen Sah</label>
                <textarea 
                  value={editDokPendukungAlasan}
                  onChange={(e) => setEditDokPendukungAlasan(e.target.value)}
                  placeholder="Tuliskan detail dokumen pendukung beserta penjelasan mengapa dokumen dianggap sah..." 
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
                  rows={3}
                />
              </div>

              {/* File Uploads */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Berkas Lampiran Pendukung (Optional)</span>
                
                {/* 1. File BAK */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500">Scan Berkas Berita Acara (BAK)</label>
                    {editFileBak && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">Eksis</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="file" 
                      accept="application/pdf,image/*"
                      onChange={(e) => handleEditFileChange(e, setEditFileBak, setEditFileBakName, 'editFileBak')}
                      className="hidden" 
                      id="edit-file-bak-input" 
                    />
                    <label 
                      htmlFor="edit-file-bak-input" 
                      className={`flex-grow border ${uploadingToDrive['editFileBak'] ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50'} border-dashed rounded-xl px-3 py-2.5 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all text-xs font-semibold text-slate-500 flex items-center justify-center space-x-1.5`}
                    >
                      {uploadingToDrive['editFileBak'] ? (
                        <>
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                          <span>Mengupload ke Drive...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-blue-500" />
                          <span className="truncate max-w-[200px]">{editFileBakName || 'Ganti Berkas Scan BAK'}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* 2. File Handover Aso Admin */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500">Scan Tanda Terima Berkas ASO ke Admin</label>
                    {editFileHandoverAsoSales && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">Eksis</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="file" 
                      accept="application/pdf,image/*"
                      onChange={(e) => handleEditFileChange(e, setEditFileHandoverAsoSales, setEditFileHandoverAsoSalesName, 'editFileHandoverAsoSales')}
                      className="hidden" 
                      id="edit-file-handover-aso-sales-input" 
                    />
                    <label 
                      htmlFor="edit-file-handover-aso-sales-input" 
                      className={`flex-grow border ${uploadingToDrive['editFileHandoverAsoSales'] ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50'} border-dashed rounded-xl px-3 py-2.5 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all text-xs font-semibold text-slate-500 flex items-center justify-center space-x-1.5`}
                    >
                      {uploadingToDrive['editFileHandoverAsoSales'] ? (
                        <>
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                          <span>Mengupload ke Drive...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-blue-500" />
                          <span className="truncate max-w-[200px]">{editFileHandoverAsoSalesName || 'Ganti Berkas ASO ke Admin'}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* 4. Dokumen Pendukung */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500">Berkas/Foto Dokumen Pendukung</label>
                    {editUploadDokPendukung && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">Eksis</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="file" 
                      accept="application/pdf,image/*"
                      onChange={(e) => handleEditFileChange(e, setEditUploadDokPendukung, setEditUploadDokPendukungName, 'editUploadDokPendukung')}
                      className="hidden" 
                      id="edit-upload-dok-pendukung-input" 
                    />
                    <label 
                      htmlFor="edit-upload-dok-pendukung-input" 
                      className={`flex-grow border ${uploadingToDrive['editUploadDokPendukung'] ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50'} border-dashed rounded-xl px-3 py-2.5 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all text-xs font-semibold text-slate-500 flex items-center justify-center space-x-1.5`}
                    >
                      {uploadingToDrive['editUploadDokPendukung'] ? (
                        <>
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                          <span>Mengupload ke Drive...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-blue-500" />
                          <span className="truncate max-w-[200px]">{editUploadDokPendukungName === 'file_dok_pendukung_exist' ? 'Dokumen Pendukung Tersimpan' : (editUploadDokPendukungName || 'Ganti Dokumen Pendukung')}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

              </div>
            </form>

            {/* Footer Buttons */}
            <div className="p-5 border-t border-slate-100 flex justify-end space-x-2 bg-slate-50 rounded-b-3xl sticky bottom-0 z-10 flex-shrink-0">
              <button 
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleEditSubmit}
                disabled={isEditSubmitting || Object.values(uploadingToDrive).some(Boolean)}
                className="px-5 py-2.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK STATUS UPDATE MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 my-8 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-10 flex-shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></span>
                  Update Status Massal ({selectedTxIds.length} Transaksi)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Ubah status beberapa transaksi sekaligus secara cepat.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleBulkSubmit} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {bulkSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl font-medium flex items-center space-x-2 animate-bounce">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{bulkSuccessMessage}</span>
                </div>
              )}

              {bulkErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{bulkErrorMessage}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-900 space-y-1">
                <div className="flex justify-between items-center">
                  <p className="font-extrabold">Transaksi Terpilih ({selectedTxIds.length}):</p>
                  <span className="text-[9px] bg-blue-200 text-blue-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Role: {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-blue-700 font-mono flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pt-1">
                  {selectedTxIds.map(id => (
                    <span key={id} className="bg-blue-100/80 text-blue-800 px-1.5 py-0.5 rounded font-bold">{id}</span>
                  ))}
                </div>
                <p className="text-[10px] text-blue-600 italic mt-1 font-normal">* Hanya bidang status sesuai wewenang role Anda yang dapat diubah.</p>
              </div>

              {!canBulkUpdate && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    Otorisasi Tidak Mencukupi
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Role Anda (<strong>{currentUser.role}</strong>) tidak memiliki otorisasi untuk melakukan perubahan status massal.
                  </p>
                </div>
              )}

              {/* 1. Status Fisik Berkas / Handover & Dokumen Lampiran Massal */}
              {canUpdateHandover && (
                <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Serah Terima Berkas & Dokumen Lampiran Massal
                    </span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">
                      Otorisasi ASO / Admin
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Select Status Handover */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Status Serah Terima
                      </label>
                      <select 
                        value={bulkStatusHandover}
                        onChange={(e) => setBulkStatusHandover(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                      >
                        <option value="">-- Tidak Diubah --</option>
                        <option value="Diserahkan ke Admin">Diserahkan ke Admin</option>
                        <option value="Pending">Pending (Berkas Masih di ASO)</option>
                      </select>
                    </div>

                    {/* Select Tanggal Handover */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Tanggal Serah Terima
                      </label>
                      <input 
                        type="date"
                        value={bulkTanggalHandover}
                        onChange={(e) => setBulkTanggalHandover(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Upload Dokumen Serah Terima Massal */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      <span>Upload Dokumen / Berkas Bukti Serah Terima Massal</span>
                      <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        {selectedTxIds.length} Transaksi Terpilih
                      </span>
                    </label>

                    {bulkFileHandover ? (
                      <div className="flex items-center justify-between p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs">
                        <div className="flex items-center space-x-2.5 truncate">
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="truncate">
                            <p className="font-bold text-slate-900 truncate">{bulkFileHandoverName || 'Dokumen Serah Terima Massal Terlampir'}</p>
                            <p className="text-[10px] text-emerald-700 font-medium">Dokumen siap dilampirkan ke seluruh {selectedTxIds.length} transaksi</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkFileHandover(null);
                            setBulkFileHandoverName('');
                          }}
                          className="p-1.5 hover:bg-emerald-100 rounded-lg text-slate-500 hover:text-red-600 transition-colors cursor-pointer flex-shrink-0"
                          title="Hapus Lampiran Dokumen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className={`relative border-2 border-dashed ${uploadingToDrive['bulk_handover'] ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:border-blue-400 bg-white'} rounded-xl p-3 text-center transition-all group`}>
                        <input 
                          type="file" 
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileChange(e, setBulkFileHandover, setBulkFileHandoverName, 'bulk_handover')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className="flex flex-col items-center justify-center space-y-1 py-1">
                          {uploadingToDrive['bulk_handover'] ? (
                            <>
                              <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
                              <p className="text-xs font-bold text-amber-700">Mengunggah ke Google Drive...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                              <p className="text-xs font-bold text-slate-700">Pilih / Unggah Berkas Bukti Serah Terima (PDF / Foto)</p>
                              <p className="text-[10px] text-slate-400">File ini akan otomatis dilampirkan ke {selectedTxIds.length} transaksi yang ditumpuk sekaligus</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Status SAP (Sales Head & Administrator) */}
              {canUpdateSap && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>Status SAP / ERP Claim</span>
                    <span className="text-[8px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-extrabold">Wewenang Sales Head</span>
                  </label>
                  <select 
                    value={bulkStatusSap}
                    onChange={(e) => setBulkStatusSap(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">-- Tidak Diubah --</option>
                    <option value="N/A">N/A</option>
                    <option value="Bill">Bill (Dapat Ditagihkan)</option>
                    <option value="Not Bill">Not Bill (Tidak Ditagihkan)</option>
                  </select>
                </div>
              )}

              {/* 4. Status Pembayaran (Admin & Administrator) */}
              {canUpdatePayment && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>Status Pelunasan Pembayaran</span>
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold">Wewenang Admin</span>
                  </label>
                  <select 
                    value={bulkStatusPayment}
                    onChange={(e) => setBulkStatusPayment(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">-- Tidak Diubah --</option>
                    <option value="Belum Bayar">Belum Bayar</option>
                    <option value="Lunas">Lunas</option>
                  </select>
                </div>
              )}

              {/* 5. Status Approval Backcharge (Sales Head, Kacab & Administrator) */}
              {canUpdateApproval && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>Status Approval Backcharge</span>
                    <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-extrabold">
                      {isSalesHeadUser && !isSuperAdmin ? 'Wewenang Sales Head (OR, Ekspedisi, ETLE)' :
                       isKacabUser && !isSuperAdmin ? 'Wewenang Kacab (Maintenance & TPL)' :
                       'Wewenang Kacab & Sales Head'}
                    </span>
                  </label>
                  <select 
                    value={bulkStatusApproval}
                    onChange={(e) => setBulkStatusApproval(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">-- Tidak Diubah --</option>
                    <option value="Disetujui">✅ Disetujui (Approved)</option>
                    <option value="Ditolak">❌ Tidak Disetujui (Not Approved)</option>
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1 font-medium">
                    {isSalesHeadUser && !isSuperAdmin && '* Pilihan ini hanya akan memproses denda kategori Own Risk, Ekspedisi, & ETLE.'}
                    {isKacabUser && !isSuperAdmin && '* Pilihan ini hanya akan memproses denda kategori Maintenance & TPL.'}
                    {isSuperAdmin && '* Role Kepala Cabang (Kacab) memproses denda Maintenance & TPL. Role Sales Head (SH) memproses denda Own Risk, Ekspedisi & ETLE.'}
                  </p>
                </div>
              )}

              {/* 5. Catatan Log */}
              {canBulkUpdate && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Catatan Audit / Keterangan Update Massal
                  </label>
                  <input 
                    type="text"
                    value={bulkLogReason}
                    onChange={(e) => setBulkLogReason(e.target.value)}
                    placeholder={`Update status massal oleh ${currentUser.full_name || currentUser.email} (${currentUser.role})`}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                  />
                </div>
              )}

            </form>

            {/* Footer Buttons */}
            <div className="p-5 border-t border-slate-100 flex justify-end space-x-2 bg-slate-50 rounded-b-3xl sticky bottom-0 z-10 flex-shrink-0">
              <button 
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting || !canBulkUpdate}
                className="px-5 py-2.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Terapkan Ke {selectedTxIds.length} Transaksi</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
