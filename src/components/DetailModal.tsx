import React, { useState } from 'react';
import { 
  X, Check, AlertTriangle, Upload, Download, FileText, 
  Image, Calendar, User, DollarSign, ArrowRight, Printer, Eye,
  Trash2, Cloud, Loader2
} from 'lucide-react';
import { Backcharge, Profile, UserRole, BackchargeCategory } from '../types';
import { checkGoogleToken, uploadFileToDrive } from '../lib/googleDrive';

interface DetailModalProps {
  transaction: Backcharge;
  currentUser: Profile;
  onClose: () => void;
  onUpdateStatus: (id: string, updates: Partial<Backcharge>, logMessage: string) => void;
  onDeleteTransaction?: (id: string) => void;
}

export default function DetailModal({ 
  transaction, 
  currentUser, 
  onClose, 
  onUpdateStatus,
  onDeleteTransaction
}: DetailModalProps) {
  
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionForm, setShowActionForm] = useState<'confirm' | 'sap' | 'invoice' | 'sales_admin_handover' | null>(null);

  // Form states for actions
  const [modalConfirmStatus, setModalConfirmStatus] = useState('Telah Dikonfirmasi');
  const [modalConfirmNotes, setModalConfirmNotes] = useState('');
  const [modalSAPStatus, setModalSAPStatus] = useState('Bill');
  const [modalInvoiceNo, setModalInvoiceNo] = useState('');

  // Individual file attachment update states
  const [localFileBak, setLocalFileBak] = useState<string | null>(null);
  const [localHandoverAso, setLocalHandoverAso] = useState<string | null>(null);
  const [localHandoverSalesAdmin, setLocalHandoverSalesAdmin] = useState<string | null>(null);
  
  // New States for Lightbox and Actions
  const [lightboxFile, setLightboxFile] = useState<{ url: string; title: string } | null>(null);
  const [localHandoverSalesAdminFile, setLocalHandoverSalesAdminFile] = useState<string | null>(null);
  const [localHandoverSalesAdminFileName, setLocalHandoverSalesAdminFileName] = useState('');

  // Google Drive integration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [uploadingSalesAdmin, setUploadingSalesAdmin] = useState(false);

  // Check token on mount
  React.useEffect(() => {
    const token = checkGoogleToken();
    if (token) {
      setGoogleToken(token);
    }
  }, []);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const kekata = (n: number): string => {
    const batasan = [
      "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
    ];
    if (n < 12) return batasan[n];
    if (n < 20) return kekata(n - 10) + " Belas";
    if (n < 100) return kekata(Math.floor(n / 10)) + " Puluh " + kekata(n % 10);
    if (n < 200) return "Seratus " + kekata(n - 100);
    if (n < 1000) return kekata(Math.floor(n / 100)) + " Ratus " + kekata(n % 100);
    if (n < 2000) return "Seribu " + kekata(n - 1000);
    if (n < 1000000) return kekata(Math.floor(n / 1000)) + " Ribu " + kekata(n % 1000);
    if (n < 1000000000) return kekata(Math.floor(n / 1000000)) + " Juta " + kekata(n % 1000000);
    return "";
  };

  const terbilang = (num: number): string => {
    if (num === 0) return "Nol";
    return kekata(num) + " Rupiah";
  };

  const getSteps = (t: Backcharge) => {
    const kat = t.category;
    
    if (kat === 'Own Risk') {
      const step1 = true;
      const step2 = t.status_confirm === 'Telah Dikonfirmasi';
      const step3 = step2 && t.status_sap !== 'N/A' && t.status_sap !== '';
      const step4 = step3 && (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin');
      const step5 = step4 && t.no_invoice && t.no_invoice !== '-';
      const step6 = step5 && t.status_payment === 'Lunas';

      return [
        { label: "Buat BAK & Input SAP", pic: "ASO / Staff", completed: step1, active: !step2 },
        { label: "Konfirmasi Customer", pic: "Sales", completed: step2, active: step1 && !step2 },
        { label: "Update SAP (Bill/No)", pic: "Sales Head", completed: step3, active: step2 && !step3 },
        { label: "Serah Terima Berkas", pic: "BRO", completed: step4, active: step3 && !step4 },
        { label: "Cetak & Kirim Invoice", pic: "Admin", completed: step5, active: step4 && !step5 },
        { label: "Pelunasan Denda", pic: "Customer", completed: step6, active: step5 && !step6 }
      ];
    }
    
    if (kat === 'Maintenance' || kat === 'ETLE' || kat === 'TPL') {
      const step1 = true;
      const step2 = t.status_confirm === 'Telah Dikonfirmasi';
      const step3 = step2 && (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin');
      const step4 = step3 && t.no_invoice && t.no_invoice !== '-';
      const step5 = step4 && t.status_payment === 'Lunas';

      const pic1 = kat === 'Maintenance' ? 'SA' : kat === 'ETLE' ? 'VRO' : 'SA';
      return [
        { label: "Inisiasi Berkas", pic: pic1, completed: step1, active: !step2 },
        { label: "Konfirmasi Denda/Biaya", pic: "Sales", completed: step2, active: step1 && !step2 },
        { label: "Serah Terima Berkas", pic: "BRO", completed: step3, active: step2 && !step3 },
        { label: "Cetak & Kirim Invoice", pic: "Admin", completed: step4, active: step3 && !step4 },
        { label: "Pelunasan Denda", pic: "Customer", completed: step5, active: step4 && !step5 }
      ];
    }

    if (kat === 'Ekspedisi') {
      const step1 = true;
      const step2 = t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin';
      const step3 = step2 && t.no_invoice && t.no_invoice !== '-';
      const step4 = step3 && t.status_payment === 'Lunas';

      return [
        { label: "Buat Order Ekspedisi", pic: "ASO / Staff", completed: step1, active: !step2 },
        { label: "Serah Terima Bukti", pic: "ASO / Staff", completed: step2, active: step1 && !step2 },
        { label: "Cetak & Kirim Invoice", pic: "Admin", completed: step3, active: step2 && !step3 },
        { label: "Pelunasan Denda", pic: "Customer", completed: step4, active: step3 && !step4 }
      ];
    }
    return [];
  };

  const steps = getSteps(transaction);

  // File download helper (handles both Base64 and standard links)
  const downloadFile = (fileData: string | null | undefined, defaultName: string) => {
    if (!fileData) {
      alert("Tidak ada file lampiran!");
      return;
    }
    
    // Check if it's base64 data URL
    if (fileData.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = fileData;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Simulate dummy file download
      const element = document.createElement("a");
      const file = new Blob(["File simulation content"], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = defaultName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  // Upload new attachment file on detail view
  const uploadNewFile = (
    e: React.ChangeEvent<HTMLInputElement>, 
    fieldName: 'file_bak_url' | 'file_handover_aso_sales_url' | 'file_handover_sales_admin_url',
    description: string
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onUpdateStatus(
          transaction.id, 
          { [fieldName]: base64 }, 
          `Mengupload file lampiran baru: ${description}`
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Actions trigger handlers
  const handleSalesConfirm = () => {
    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { status_confirm: modalConfirmStatus },
      `Sales memverifikasi status konfirmasi customer: ${modalConfirmStatus}. Catatan: ${modalConfirmNotes || '-'}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleSAPStatus = () => {
    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { status_sap: modalSAPStatus },
      `Sales Head menyetujui status SAP: ${modalSAPStatus}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleInvoiceInput = () => {
    if (!modalInvoiceNo.trim()) {
      alert('Nomor invoice wajib diisi!');
      return;
    }
    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { no_invoice: modalInvoiceNo.trim(), status_handover: 'Diterima Admin' },
      `Admin menerbitkan Invoice No: ${modalInvoiceNo.trim()} dan mengonfirmasi berkas lengkap`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleSalesAdminHandoverSubmit = () => {
    if (!localHandoverSalesAdminFile) {
      alert('Bukti serah terima wajib diunggah!');
      return;
    }
    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { file_handover_sales_admin_url: localHandoverSalesAdminFile },
      `Sales/Admin mengunggah Foto Bukti Serah Terima Sales ke Admin`
    );
    setActionLoading(false);
    setShowActionForm(null);
    setLocalHandoverSalesAdminFile(null);
    setLocalHandoverSalesAdminFileName('');
  };

  const handleHandoverCourier = () => {
    const pengirim = transaction.category === 'Ekspedisi' ? 'ASO' : 'BRO';
    onUpdateStatus(
      transaction.id,
      { status_handover: 'Diserahkan ke Admin' },
      `${pengirim} menyerahkan fisik berkas denda lengkap ke departemen Admin`
    );
  };

  const handleSetPaid = () => {
    onUpdateStatus(
      transaction.id,
      { status_payment: 'Lunas' },
      `Admin mengonfirmasi pelunasan pembayaran tagihan dari Customer`
    );
  };

  // Check roles permission
  const isSales = currentUser.role === 'Sales / Sales Head' || currentUser.role === 'Administrator';
  const isBro = currentUser.role === 'BRO' || currentUser.role === 'Administrator';
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Administrator';
  const isAso = currentUser.role === 'ASO / Staff' || currentUser.role === 'Administrator';

  // Print specific transaction details (Rekapitulasi Dokumen)
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 relative print:p-0 print:border-none print:shadow-none print:max-h-full print:overflow-visible">
        
        <div className="print:hidden space-y-6 flex flex-col w-full">
          {/* Close button (hidden during print) */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-50 hover:bg-slate-100 rounded-xl print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col space-y-1.5 border-b border-slate-100 pb-4 pr-10">
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase bg-blue-600 text-white tracking-wider">
              {transaction.category}
            </span>
            <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase bg-emerald-500 text-white tracking-wider">
              {transaction.branch}
            </span>
          </div>
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-black text-slate-900">
              Detail & Alur Kerja: {transaction.id}
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium print:hidden">
            Informasi komparasi dokumen fisik & langkah pelacakan alur denda nasional.
          </p>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Kolom Kiri: Metadata Detail */}
          <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Informasi Transaksi</span>
              <span className="font-mono text-[9px] text-slate-400">Created: {transaction.created_at.split('T')[0]}</span>
            </h4>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nama Customer</span>
                <span className="font-extrabold text-slate-900 text-sm block mt-0.5">{transaction.customer_name}</span>
              </div>
              
              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nilai Backcharge</span>
                <span className="font-black text-blue-600 text-lg font-mono block mt-0.5">{formatRupiah(transaction.value)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {transaction.no_bak !== '-' && (
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor BAK</span>
                    <span className="font-bold text-slate-700 block mt-0.5">{transaction.no_bak}</span>
                  </div>
                )}
                {transaction.no_spk !== '-' && (
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor SPK</span>
                    <span className="font-bold text-slate-700 block mt-0.5">{transaction.no_spk}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {transaction.no_sap !== '-' && (
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor ERP/SAP</span>
                    <span className="font-bold text-slate-700 block mt-0.5">{transaction.no_sap}</span>
                  </div>
                )}
                {transaction.license_plate !== '-' && (
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">No. Polisi</span>
                    <span className="font-bold text-slate-700 block mt-0.5">{transaction.license_plate}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Lampiran Dokumen</span>
                
                {/* 1. File BAK */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        if (transaction.file_bak_url) {
                          setLightboxFile({ url: transaction.file_bak_url, title: `Berkas BAK: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_BAK', title: `Simulasi Dokumen BAK: ${transaction.id}` });
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-blue-600 hover:underline"
                    >
                      {transaction.file_bak_url ? 'File_BAK.pdf/img' : 'Belum Ada BAK (Klik untuk Simulasi)'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        if (transaction.file_bak_url) {
                          setLightboxFile({ url: transaction.file_bak_url, title: `Berkas BAK: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_BAK', title: `Simulasi Dokumen BAK: ${transaction.id}` });
                        }
                      }}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.file_bak_url ? (
                      <button 
                        onClick={() => downloadFile(transaction.file_bak_url, `BAK_${transaction.id}.png`)}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File BAK"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      isAso && (
                        <label className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer border border-slate-200 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <input 
                            type="file" 
                            accept="application/pdf,image/*"
                            onChange={(e) => uploadNewFile(e, 'file_bak_url', 'Lampiran File BAK')}
                            className="hidden" 
                          />
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* 2. Handover ASO - Sales */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Image className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        if (transaction.file_handover_aso_sales_url) {
                          setLightboxFile({ url: transaction.file_handover_aso_sales_url, title: `Foto Serah Terima ASO ke Sales: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_HANDOVER_ASO_SALES', title: `Simulasi Serah Terima ASO ke Sales: ${transaction.id}` });
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-purple-600 hover:underline"
                    >
                      {transaction.file_handover_aso_sales_url ? 'Foto_ASO_Sales.img' : 'Belum Ada Foto ASO-Sales (Klik Simulasi)'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        if (transaction.file_handover_aso_sales_url) {
                          setLightboxFile({ url: transaction.file_handover_aso_sales_url, title: `Foto Serah Terima ASO ke Sales: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_HANDOVER_ASO_SALES', title: `Simulasi Serah Terima ASO ke Sales: ${transaction.id}` });
                        }
                      }}
                      className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.file_handover_aso_sales_url ? (
                      <button 
                        onClick={() => downloadFile(transaction.file_handover_aso_sales_url, `Foto_Handover_ASO_Sales_${transaction.id}.png`)}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh Foto ASO-Sales"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      isSales && (
                        <label className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer border border-slate-200 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => uploadNewFile(e, 'file_handover_aso_sales_url', 'Foto Serah Terima ASO ke Sales')}
                            className="hidden" 
                          />
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* 3. Handover Sales - Admin */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Image className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        if (transaction.file_handover_sales_admin_url) {
                          setLightboxFile({ url: transaction.file_handover_sales_admin_url, title: `Foto Serah Terima Sales ke Admin: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_HANDOVER_SALES_ADMIN', title: `Simulasi Serah Terima Sales ke Admin: ${transaction.id}` });
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-emerald-600 hover:underline"
                    >
                      {transaction.file_handover_sales_admin_url ? 'Foto_Sales_Admin.img' : 'Belum Ada Foto Sales-Admin (Klik Simulasi)'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        if (transaction.file_handover_sales_admin_url) {
                          setLightboxFile({ url: transaction.file_handover_sales_admin_url, title: `Foto Serah Terima Sales ke Admin: ${transaction.id}` });
                        } else {
                          setLightboxFile({ url: 'MOCK_HANDOVER_SALES_ADMIN', title: `Simulasi Serah Terima Sales ke Admin: ${transaction.id}` });
                        }
                      }}
                      className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.file_handover_sales_admin_url && (
                      <button 
                        onClick={() => downloadFile(transaction.file_handover_sales_admin_url, `Foto_Handover_Sales_Admin_${transaction.id}.png`)}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh Foto Sales-Admin"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Tracking Visual & Tindakan Otoritas */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visual Stepper Section */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-inner">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-4 flex justify-between items-center">
                <span>Alur Proses Penyelesaian</span>
                <span className="text-[9px] bg-slate-800 text-blue-400 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {transaction.status_payment === 'Lunas' ? 'LUNAS / SELESAI' : 'AKTIF'}
                </span>
              </h4>
              
              <div className="flex flex-col space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {steps.map((step, idx) => {
                  let badgeColor = "bg-slate-800 text-slate-500 border-slate-700";
                  let textColor = "text-slate-400";
                  let icon = `${idx + 1}`;

                  if (step.completed) {
                    badgeColor = "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/10";
                    textColor = "text-slate-200 font-bold";
                    icon = "✓";
                  } else if (step.active) {
                    badgeColor = "bg-blue-600 text-white border-blue-400 ring-4 ring-blue-500/20";
                    textColor = "text-white font-extrabold";
                  }

                  return (
                    <div key={idx} className="flex items-start space-x-3 p-2 bg-slate-800/40 rounded-xl border border-slate-800/60">
                      <div className={`w-5.5 h-5.5 rounded-full border ${badgeColor} flex items-center justify-center text-[10px] font-black flex-shrink-0`}>
                        {icon}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs ${textColor} truncate`}>{step.label}</p>
                          <span className="text-[8px] bg-slate-800 text-slate-300 font-extrabold px-1.5 py-0.2 rounded border border-slate-700">
                            {step.pic}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {step.completed ? 'Tahap sukses diselesaikan' : step.active ? 'Menunggu penyelesaian Anda' : 'Menunggu tahap sebelumnya'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION PANEL (print:hidden) */}
            <div className="bg-blue-50/70 rounded-2xl border border-blue-100 p-5 flex flex-col space-y-4 print:hidden">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Tindakan Otoritas</span>
              </div>

              {/* Action options buttons */}
              {showActionForm === null && (
                <div className="flex flex-wrap gap-2 pt-1">
                  
                  {/* 1. Sales Confirm trigger */}
                  {transaction.category !== 'Ekspedisi' && transaction.status_confirm === 'Belum Konfirmasi' && isSales && (
                    <button 
                      onClick={() => setShowActionForm('confirm')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>✔️ Konfirmasi Customer</span>
                    </button>
                  )}

                  {/* 2. Sales Head SAP Status trigger (Own Risk category only) */}
                  {transaction.category === 'Own Risk' && transaction.status_confirm === 'Telah Dikonfirmasi' && transaction.status_sap === 'N/A' && isSales && (
                    <button 
                      onClick={() => setShowActionForm('sap')}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>⚙️ Set Status SAP (Bill/Not)</span>
                    </button>
                  )}

                  {/* 3. BRO/ASO Handover paperwork dispatch */}
                  {((transaction.category === 'Own Risk' && transaction.status_confirm === 'Telah Dikonfirmasi' && transaction.status_sap !== 'N/A') ||
                    (transaction.category !== 'Own Risk' && transaction.category !== 'Ekspedisi' && transaction.status_confirm === 'Telah Dikonfirmasi') ||
                    (transaction.category === 'Ekspedisi')) && transaction.status_handover === 'Pending' && (isBro || (transaction.category === 'Ekspedisi' && isAso)) && (
                    <button 
                      onClick={handleHandoverCourier}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>📦 Serahkan Fisik Berkas</span>
                    </button>
                  )}

                  {/* 4. Admin Invoice issuing */}
                  {transaction.status_handover === 'Diserahkan ke Admin' && (transaction.no_invoice === '-' || !transaction.no_invoice) && isAdmin && (
                    <button 
                      onClick={() => {
                        setModalInvoiceNo('');
                        setShowActionForm('invoice');
                      }}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>📝 Input Nomor Invoice</span>
                    </button>
                  )}

                  {/* 4.5 Upload Foto Serah Terima Sales ke Admin */}
                  {transaction.status_confirm === 'Telah Dikonfirmasi' && !transaction.file_handover_sales_admin_url && (isSales || isAdmin) && (
                    <button 
                      onClick={() => setShowActionForm('sales_admin_handover')}
                      className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>📸 Upload Foto Serah Terima Sales-Admin</span>
                    </button>
                  )}

                  {/* 5. Admin Set Paid */}
                  {transaction.no_invoice && transaction.no_invoice !== '-' && transaction.status_payment === 'Belum Bayar' && isAdmin && (
                    <button 
                      onClick={handleSetPaid}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1.5 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>💰 Set Status Lunas</span>
                    </button>
                  )}

                  {/* No active actions message */}
                  {transaction.status_payment === 'Lunas' && (
                    <div className="w-full p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                      🎉 Transaksi denda lunas & tuntas. Siklus dokumen selesai divalidasi.
                    </div>
                  )}

                  {transaction.status_payment !== 'Lunas' && (
                    <div className="text-[10px] text-slate-500 font-semibold w-full mt-2">
                      💡 Selesaikan tahap demi tahap berdasarkan otorisasi peran ({currentUser.role}) Anda.
                    </div>
                  )}
                </div>
              )}

              {/* ACTION FORM: Sales Confirm */}
              {showActionForm === 'confirm' && (
                <div className="space-y-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Form Konfirmasi Sales</span>
                    <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Persetujuan</label>
                      <select 
                        value={modalConfirmStatus}
                        onChange={(e) => setModalConfirmStatus(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="Telah Dikonfirmasi">Telah Dikonfirmasi (Setuju)</option>
                        <option value="Ditolak / Negosiasi Ulang">Ditolak / Negosiasi Ulang</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Catatan Negosiasi</label>
                      <textarea 
                        value={modalConfirmNotes}
                        onChange={(e) => setModalConfirmNotes(e.target.value)}
                        placeholder="Tulis detail kesepakatan dengan customer..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 h-16 focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={handleSalesConfirm}
                      disabled={actionLoading}
                      className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold"
                    >
                      Simpan Status Konfirmasi
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION FORM: SAP Status */}
              {showActionForm === 'sap' && (
                <div className="space-y-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Form Otorisasi SAP ERP</span>
                    <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Billing SAP</label>
                      <select 
                        value={modalSAPStatus}
                        onChange={(e) => setModalSAPStatus(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="Bill">Bill (Ditagihkan ke Customer)</option>
                        <option value="Not Bill">Not Bill (Ditanggung Internal)</option>
                      </select>
                    </div>
                    <button 
                      onClick={handleSAPStatus}
                      disabled={actionLoading}
                      className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold"
                    >
                      Simpan Status SAP
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION FORM: Invoice Input */}
              {showActionForm === 'invoice' && (
                <div className="space-y-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Form Penerbitan Invoice</span>
                    <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nomor Invoice Resmi</label>
                      <input 
                        type="text" 
                        value={modalInvoiceNo}
                        onChange={(e) => setModalInvoiceNo(e.target.value)}
                        placeholder="INV/2026/06/982"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={handleInvoiceInput}
                      disabled={actionLoading}
                      className="w-full bg-purple-600 text-white py-2 rounded-xl text-xs font-bold"
                    >
                      Terbitkan Invoice
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION FORM: Upload Foto Serah Terima Sales ke Admin */}
              {showActionForm === 'sales_admin_handover' && (
                <div className="space-y-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 font-sans">Form Serah Terima (Sales ke Admin)</span>
                    <button 
                      onClick={() => {
                        setShowActionForm(null);
                        setLocalHandoverSalesAdminFile(null);
                        setLocalHandoverSalesAdminFileName('');
                      }} 
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold font-sans"
                    >
                      Batal
                    </button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed font-sans">
                      {googleToken 
                        ? "Pilih foto bukti serah terima. Berkas akan otomatis diunggah ke Google Drive Anda secara instan." 
                        : "Unggah foto bukti serah terima berkas penyerahan denda dari Sales kepada Admin Piutang."
                      }
                    </p>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Pilih File Foto Bukti</label>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-2 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                          <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                          <span>{localHandoverSalesAdminFileName ? 'Ubah Foto' : 'Pilih Foto Serah Terima'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            disabled={uploadingSalesAdmin}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setLocalHandoverSalesAdminFileName(file.name);
                              
                              if (googleToken) {
                                setUploadingSalesAdmin(true);
                                try {
                                  const driveUrl = await uploadFileToDrive(file, file.name, googleToken);
                                  setLocalHandoverSalesAdminFile(driveUrl);
                                } catch (err: any) {
                                  console.error("Gagal mengunggah ke Google Drive:", err);
                                  alert("Gagal mengunggah otomatis ke Google Drive. Disimpan secara lokal.");
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setLocalHandoverSalesAdminFile(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                } finally {
                                  setUploadingSalesAdmin(false);
                                }
                              } else {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setLocalHandoverSalesAdminFile(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden" 
                          />
                        </label>
                        {localHandoverSalesAdminFile && (
                          <button 
                            type="button" 
                            onClick={() => { setLocalHandoverSalesAdminFile(null); setLocalHandoverSalesAdminFileName(''); }}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {uploadingSalesAdmin && (
                        <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-600 font-sans">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Mengunggah foto bukti ke Google Drive...</span>
                        </div>
                      )}

                      {localHandoverSalesAdminFileName && (
                        <div className="flex items-center space-x-1.5 text-[8px] text-slate-500 font-sans">
                          <span className="font-mono truncate flex-grow max-w-[200px]">{localHandoverSalesAdminFileName}</span>
                          {localHandoverSalesAdminFile?.startsWith('https://drive.google.com') && (
                            <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[7px] font-black uppercase">Google Drive</span>
                          )}
                        </div>
                      )}
                    </div>

                    {localHandoverSalesAdminFile && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 flex flex-col items-center justify-center max-h-32">
                        {localHandoverSalesAdminFile.startsWith('data:') ? (
                          <img src={localHandoverSalesAdminFile} alt="Preview serah terima" className="object-contain max-h-28" />
                        ) : (
                          <div className="text-center py-2 text-[10px] text-emerald-600 font-bold flex flex-col items-center">
                            <Cloud className="w-6 h-6 mb-1 text-emerald-500" />
                            <span>Berkas Aman Terunggah ke Google Drive</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={handleSalesAdminHandoverSubmit}
                      disabled={actionLoading || uploadingSalesAdmin || !localHandoverSalesAdminFile}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-bold transition-all shadow font-sans cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <span>Kirim &amp; Simpan ke Otoritas</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        </div>

        {/* PRINT ONLY SECTION (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
        <div className="hidden print:block text-slate-900 space-y-6 p-4 font-sans text-xs">
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-slate-950 pb-3">
            <div>
              <h1 className="text-lg font-black tracking-tight text-blue-900">PT ADI SARANA ARMADA, Tbk</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">National Rental Fleet &amp; Backcharge Management</p>
              <p className="text-[8px] text-slate-400 mt-0.5">Gedung ASA, Jl. Raya Serpong, Banten | Cabang: {transaction.branch}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-400 block">DOKUMEN INTEGRASI</span>
              <span className="text-sm font-black font-mono text-slate-950 block">{transaction.id}</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1 py-1">
            <h2 className="text-sm font-black uppercase tracking-wide">BERITA ACARA KLARIFIKASI DENDA OPERASIONAL (BACKCHARGE)</h2>
            <p className="text-[9px] text-slate-500">Ref ID: {transaction.id} | Kategori Kasus: {transaction.category}</p>
          </div>

          {/* Table Details */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-[10px] text-left border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50 w-1/3">Nama Customer / Penyewa</td>
                  <td className="p-2 font-bold">{transaction.customer_name}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor Polisi Kendaraan</td>
                  <td className="p-2 font-mono font-bold">{transaction.license_plate || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor BAK (Berita Acara Kerusakan)</td>
                  <td className="p-2 font-mono">{transaction.no_bak || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor SPK Perbaikan</td>
                  <td className="p-2 font-mono">{transaction.no_spk || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor SAP (Klaim ERP)</td>
                  <td className="p-2 font-mono">{transaction.no_sap || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor Invoice Resmi</td>
                  <td className="p-2 font-mono font-bold">{transaction.no_invoice || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nilai Tuntutan Denda (IDR)</td>
                  <td className="p-2 font-mono font-black text-blue-900 text-sm">
                    {formatRupiah(transaction.value)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-extrabold bg-slate-50">Terbilang (Spelled-Out)</td>
                  <td className="p-2 italic font-bold text-slate-700">
                    {terbilang(transaction.value)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Status Tracker */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Status &amp; Verifikasi Alur Kerja</h3>
            <div className="grid grid-cols-4 gap-2 text-[9px]">
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">1. Konfirmasi</span>
                <span className="font-bold text-slate-900">{transaction.status_confirm}</span>
              </div>
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">2. Status SAP</span>
                <span className="font-bold text-slate-900">{transaction.status_sap || '-'}</span>
              </div>
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">3. Serah Terima</span>
                <span className="font-bold text-slate-900">{transaction.status_handover}</span>
              </div>
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">4. Pelunasan</span>
                <span className="font-bold text-slate-900">{transaction.status_payment}</span>
              </div>
            </div>
          </div>

          {/* Signatories Grid */}
          <div className="pt-6">
            <p className="text-[9px] text-slate-500 mb-4 text-right">Dicetak otomatis dari portal nasional pada: {new Date().toLocaleString('id-ID')}</p>
            <div className="grid grid-cols-3 gap-6 text-center text-[9px]">
              <div className="space-y-10">
                <p className="font-extrabold text-slate-400 uppercase">DIBUAT OLEH (ASO)</p>
                <div className="border-t border-slate-300 pt-1.5 font-bold">
                  <p className="text-slate-900">{transaction.created_by.split('@')[0].toUpperCase()}</p>
                  <p className="text-slate-400">Staff Cabang {transaction.branch}</p>
                </div>
              </div>
              <div className="space-y-10">
                <p className="font-extrabold text-slate-400 uppercase">DIVALIDASI OLEH (SALES)</p>
                <div className="border-t border-slate-300 pt-1.5 font-bold">
                  <p className="text-slate-900">SALES HEAD / BRO</p>
                  <p className="text-slate-400">Wilayah {transaction.branch}</p>
                </div>
              </div>
              <div className="space-y-10">
                <p className="font-extrabold text-slate-400 uppercase">DISETUJUI OLEH (ADMIN)</p>
                <div className="border-t border-slate-300 pt-1.5 font-bold">
                  <p className="text-slate-900">ADMINISTRATOR PUSAT</p>
                  <p className="text-slate-400">Keuangan ASA HQ</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* LIGHTBOX / IN-APP FILE PREVIEW MODAL */}
      {lightboxFile && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 md:p-6 print:hidden">
          
          {/* Lightbox Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-extrabold text-white font-sans">{lightboxFile.title}</h4>
            </div>
            <div className="flex items-center space-x-2">
              {lightboxFile.url && !lightboxFile.url.startsWith('MOCK_') && (
                <button 
                  onClick={() => downloadFile(lightboxFile.url, `Berkas_${transaction.id}.png`)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                  title="Unduh Berkas"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setLightboxFile(null)} 
                className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Content Body */}
          <div className="flex-grow flex items-center justify-center overflow-auto py-6">
            {lightboxFile.url.startsWith('data:image/') ? (
              <img 
                src={lightboxFile.url} 
                alt={lightboxFile.title} 
                className="max-w-full max-h-[75vh] object-contain rounded-xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200" 
              />
            ) : lightboxFile.url.startsWith('data:application/pdf') ? (
              <iframe 
                src={lightboxFile.url} 
                className="w-full max-w-4xl h-[75vh] rounded-xl border border-slate-800 bg-white" 
                title="PDF Viewer"
              />
            ) : (
              /* Simulated Document Renderer (MOCK_BAK or MOCK_HANDOVER etc) */
              <div className="bg-white text-slate-800 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 font-sans relative">
                {/* Watermark Stamp */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none select-none border-4 border-emerald-500/30 text-emerald-500/30 font-black text-4xl md:text-6xl px-6 py-2 uppercase rounded-xl tracking-widest flex items-center justify-center">
                  APPROVED
                </div>

                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h3 className="text-md font-black text-slate-900 tracking-tight uppercase">PT Sinar Sosro Indonesia Tbk</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Departemen Operasional & Manajemen Logistik Nasional</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                      DOKUMEN RESMI
                    </span>
                    <p className="text-[10px] font-bold text-slate-800 mt-1">{transaction.id}</p>
                  </div>
                </div>

                {/* Title */}
                <div className="my-6 text-center">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide underline">
                    {lightboxFile.url === 'MOCK_BAK' ? 'BERITA ACARA KERUSAKAN (BAK)' : 'BERITA ACARA SERAH TERIMA DOKUMEN'}
                  </h4>
                  <p className="text-[9px] text-slate-500 mt-1 font-mono">Ref No: {transaction.no_bak !== '-' ? transaction.no_bak : 'BAK-AUTO/' + transaction.id}</p>
                </div>

                {/* Metadata Table */}
                <div className="space-y-3.5 text-xs">
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Dengan ini dinyatakan secara sah dan sadar mengenai penyerahan berkas denda kecelakaan/pemeliharaan kendaraan operasional cabang:
                  </p>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Nama Mitra / Customer</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">{transaction.customer_name}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Cabang Wilayah</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">{transaction.branch}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Nilai Tuntutan Denda</span>
                      <span className="font-bold text-blue-600 mt-0.5 block font-mono">{formatRupiah(transaction.value)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor Polisi Armada</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">{transaction.license_plate}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Catatan Keterangan</span>
                    <p className="text-[10px] bg-slate-50/50 p-2.5 rounded-lg border border-dashed border-slate-200 text-slate-600 leading-relaxed italic">
                      {lightboxFile.url === 'MOCK_BAK' 
                        ? "Kerusakan fisik armada terkonfirmasi oleh tim surveyor ASO di lapangan. Melakukan klaim pertanggungjawaban asuransi/biaya denda maintenance sesuai ketentuan asuransi nasional Sosro." 
                        : lightboxFile.url === 'MOCK_HANDOVER_ASO_SALES'
                          ? "Foto bukti fisik serah terima dari tim operasional ASO kepada Sales Keuangan telah diverifikasi. Lembaran dokumen fisik tercatat dalam status aktif."
                          : "Dokumen fisik denda berupa Surat BAK asli, Surat SPK, Estimasi Bengkel, dan surat tilang ETLE telah diserahkan dari unit Sales Keuangan kepada Admin Piutang dalam kondisi lengkap dan tervalidasi."
                      }
                    </p>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-2 pt-8 text-center text-[10px]">
                    <div>
                      <p className="text-slate-400 font-bold uppercase">Pihak I (ASO/BRO)</p>
                      <div className="h-10 flex items-end justify-center">
                        <span className="text-[8px] text-slate-300 font-mono italic">SIGNED DIGITAL</span>
                      </div>
                      <p className="font-black text-slate-700 mt-1 border-t border-slate-200 pt-1">Staff Cabang</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase">Pihak II (Sales)</p>
                      <div className="h-10 flex items-end justify-center">
                        {transaction.status_confirm === 'Telah Dikonfirmasi' ? (
                          <span className="text-[8px] text-emerald-600 font-mono font-bold border border-emerald-300 px-1 py-0.2 rounded bg-emerald-50">CONFIRMED</span>
                        ) : (
                          <span className="text-[8px] text-slate-300 font-mono italic">PENDING</span>
                        )}
                      </div>
                      <p className="font-black text-slate-700 mt-1 border-t border-slate-200 pt-1">Sales Head</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase">Penerima (Admin)</p>
                      <div className="h-10 flex items-end justify-center">
                        {transaction.status_handover === 'Diterima Admin' ? (
                          <span className="text-[8px] text-blue-600 font-mono font-bold border border-blue-300 px-1 py-0.2 rounded bg-blue-50">RECEIVED</span>
                        ) : (
                          <span className="text-[8px] text-slate-300 font-mono italic">PENDING RECEIPT</span>
                        )}
                      </div>
                      <p className="font-black text-slate-700 mt-1 border-t border-slate-200 pt-1">Admin Piutang</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lightbox Footer */}
          <div className="text-center text-[10px] text-slate-500 font-semibold border-t border-slate-800 pt-3">
            Pratinjau Sistem denda Terpadu Nasional © 2026. Klik [X] di atas untuk kembali ke detail.
          </div>

        </div>
      )}

    </div>
  );
}
