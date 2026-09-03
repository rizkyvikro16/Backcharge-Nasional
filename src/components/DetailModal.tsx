import React, { useState } from 'react';
import { 
  X, Upload, Download, FileText, 
  Image, Eye,
  Cloud, Loader2, ExternalLink
} from 'lucide-react';
import { Backcharge, Profile, isRegionalHeadRole, hasRole } from '../types';
import { checkGoogleToken, uploadFileToDrive, checkServiceAccountStatus, checkAppsScriptStatus } from '../lib/googleDrive';

interface DetailModalProps {
  transaction: Backcharge;
  currentUser: Profile;
  onClose: () => void;
  onUpdateStatus: (id: string, updates: Partial<Backcharge>, logMessage: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const getDrivePreviewUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
  }
  return url;
};

export default function DetailModal({ 
  transaction, 
  currentUser, 
  onClose, 
  onUpdateStatus,
  addToast
}: DetailModalProps) {
  
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionForm, setShowActionForm] = useState<'sap' | 'invoice' | 'sales_admin_handover' | 'handover_courier' | 'approval' | 'regional_approval' | 'division_approval' | 'paid' | null>(null);

  // Form states for actions
  const [modalSAPStatus, setModalSAPStatus] = useState('Bill');
  const [modalInvoiceNo, setModalInvoiceNo] = useState('');
  const [modalApprovalStatus, setModalApprovalStatus] = useState<string>('Disetujui');
  const [approvalAttachment1, setApprovalAttachment1] = useState<string | null>(null);
  const [approvalAttachment2, setApprovalAttachment2] = useState<string | null>(null);
  const [approvalAttachment3, setApprovalAttachment3] = useState<string | null>(null);
  const [approvalAttachment1Name, setApprovalAttachment1Name] = useState<string>('');
  const [approvalAttachment2Name, setApprovalAttachment2Name] = useState<string>('');
  const [approvalAttachment3Name, setApprovalAttachment3Name] = useState<string>('');
  const [uploadingAttachment1, setUploadingAttachment1] = useState(false);
  const [uploadingAttachment2, setUploadingAttachment2] = useState(false);
  const [uploadingAttachment3, setUploadingAttachment3] = useState(false);
  const [modalApprovalNotes, setModalApprovalNotes] = useState<string>('');
  const [modalRegionalApprovalStatus, setModalRegionalApprovalStatus] = useState<string>('Disetujui');
  const [modalRegionalApprovalNotes, setModalRegionalApprovalNotes] = useState<string>('');
  const [modalDivisionApprovalStatus, setModalDivisionApprovalStatus] = useState<string>('Disetujui');
  const [modalDivisionApprovalNotes, setModalDivisionApprovalNotes] = useState<string>('');
  const [modalPaymentDate, setModalPaymentDate] = useState<string>('');

  // Individual file attachment update states
  const [localFileBak, setLocalFileBak] = useState<string | null>(transaction.file_bak_url || null);
  const [localFileBakName, setLocalFileBakName] = useState(transaction.file_bak_url ? 'File BAK' : '');
  const [uploadingBak, setUploadingBak] = useState(false);

  const [localUploadDokPendukung, setLocalUploadDokPendukung] = useState<string | null>(transaction.upload_dok_pendukung || null);
  const [localUploadDokPendukungName, setLocalUploadDokPendukungName] = useState(transaction.upload_dok_pendukung ? 'Dokumen Pendukung' : '');
  const [uploadingDokPendukung, setUploadingDokPendukung] = useState(false);

  const [localDokPendukungAlasan, setLocalDokPendukungAlasan] = useState(transaction.dok_pendukung_alasan === '-' ? '' : (transaction.dok_pendukung_alasan || ''));
  
  // New States for Lightbox and Actions
  const [lightboxFile, setLightboxFile] = useState<{ url: string; title: string; docName?: string } | null>(null);
  const [localHandoverSalesAdminFile, setLocalHandoverSalesAdminFile] = useState<string | null>(null);
  const [localHandoverSalesAdminFileName, setLocalHandoverSalesAdminFileName] = useState('');

  // Helper to generate standard file name: [nama lampiran dokumen]_[id bc]_[nopol]_[customer]
  const getFormattedFileName = (
    docName: string,
    tx: Backcharge,
    fileUrl?: string | null
  ): string => {
    const sanitize = (str: string | null | undefined, fallback: string) => {
      if (!str || str.trim() === '' || str.trim() === '-') return fallback;
      return str
        .trim()
        .replace(/[/\\?%*:|"<>#]/g, '')
        .replace(/\s+/g, '_');
    };

    const cleanDoc = sanitize(docName, 'Lampiran_Dokumen');
    const cleanId = sanitize(tx.id, 'BC-000');
    const cleanNopol = sanitize(tx.license_plate, 'NOPOL');
    const cleanCustomer = sanitize(tx.customer_name, 'CUSTOMER');

    let baseName = `${cleanDoc}_${cleanId}_${cleanNopol}_${cleanCustomer}`;

    let ext = '.png';
    if (fileUrl) {
      if (fileUrl.startsWith('data:image/jpeg') || fileUrl.startsWith('data:image/jpg')) {
        ext = '.jpg';
      } else if (fileUrl.startsWith('data:image/png')) {
        ext = '.png';
      } else if (fileUrl.startsWith('data:image/webp')) {
        ext = '.webp';
      } else if (fileUrl.startsWith('data:application/pdf')) {
        ext = '.pdf';
      } else if (fileUrl.toLowerCase().includes('.pdf')) {
        ext = '.pdf';
      } else if (fileUrl.toLowerCase().includes('.jpg') || fileUrl.toLowerCase().includes('.jpeg')) {
        ext = '.jpg';
      }
    }

    return `${baseName}${ext}`;
  };

  // Google Drive integration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [serviceAccountActive, setServiceAccountActive] = useState(false);
  const [appsScriptActive, setAppsScriptActive] = useState(false);
  const [uploadingSalesAdmin, setUploadingSalesAdmin] = useState(false);

  // Check token, service account, and apps script on mount
  React.useEffect(() => {
    const token = checkGoogleToken();
    if (token) {
      setGoogleToken(token);
    }

    setAppsScriptActive(checkAppsScriptStatus());

    checkServiceAccountStatus().then(active => {
      setServiceAccountActive(active);
    });
  }, []);

  // Sync state when transaction prop changes
  React.useEffect(() => {
    if (transaction) {
      setModalSAPStatus(transaction.status_sap === 'N/A' ? 'Bill' : (transaction.status_sap || 'Bill'));
      setLocalFileBak(transaction.file_bak_url || null);
      setLocalFileBakName(transaction.file_bak_url ? 'File BAK Tersimpan' : '');
      setLocalUploadDokPendukung(transaction.upload_dok_pendukung || null);
      setLocalUploadDokPendukungName(transaction.upload_dok_pendukung ? 'Dokumen Pendukung Tersimpan' : '');
      setLocalDokPendukungAlasan(transaction.dok_pendukung_alasan === '-' ? '' : (transaction.dok_pendukung_alasan || ''));
      setModalApprovalStatus(transaction.status_approval === 'Disetujui' ? 'Disetujui' : 'Disetujui');
      setModalApprovalNotes(transaction.approval_note || '');
      setApprovalAttachment1(transaction.approval_attachment_1_url || null);
      setApprovalAttachment2(transaction.approval_attachment_2_url || null);
      setApprovalAttachment3(transaction.approval_attachment_3_url || null);
      setApprovalAttachment1Name(transaction.approval_attachment_1_url ? 'Lampiran 1 Tersimpan' : '');
      setApprovalAttachment2Name(transaction.approval_attachment_2_url ? 'Lampiran 2 Tersimpan' : '');
      setApprovalAttachment3Name(transaction.approval_attachment_3_url ? 'Lampiran 3 Tersimpan' : '');
      setModalRegionalApprovalStatus(transaction.regional_approval_status === 'Disetujui' ? 'Disetujui' : (transaction.regional_approval_status || 'Disetujui'));
      setModalRegionalApprovalNotes(transaction.regional_approval_note || '');
      setModalDivisionApprovalStatus(transaction.division_approval_status === 'Disetujui' ? 'Disetujui' : (transaction.division_approval_status || 'Disetujui'));
      setModalDivisionApprovalNotes(transaction.division_approval_note || '');
    }
  }, [transaction]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

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

  const getFileLabels = (category: string) => {
    if (category === 'Own Risk') {
      return {
        bak: "Berkas BAK & Input SAP",
        asoSales: "Foto Serah Terima ASO ke Admin",
        salesAdmin: "Foto Serah Terima BRO ke Admin"
      };
    }
    if (category === 'Maintenance' || category === 'ETLE' || category === 'TPL' || category === 'Unclaimable Insurance' || category === 'Dokumen Kendaraan') {
      const initName = (category === 'Maintenance' || category === 'Unclaimable Insurance' || category === 'Dokumen Kendaraan' || category === 'TPL') ? 'SA' : category === 'ETLE' ? 'VRO' : 'SA';
      return {
        bak: `Berkas Inisiasi (${initName})`,
        asoSales: `Foto Serah Terima ${initName} ke Admin`,
        salesAdmin: "Foto Serah Terima BRO ke Admin"
      };
    }
    if (category === 'Ekspedisi') {
      return {
        bak: "Berkas Order Ekspedisi",
        asoSales: "Foto Serah Terima ASO ke Admin",
        salesAdmin: "Foto Serah Terima ASO ke Admin"
      };
    }
    return {
      bak: "Berkas BAK / Inisiasi",
      asoSales: "Foto Serah Terima ASO ke Admin",
      salesAdmin: "Foto Serah Terima BRO ke Admin"
    };
  };

  const getSteps = (t: Backcharge) => {
    const kat = t.category;
    const val = t.value || 0;
    
    const step1 = true;
    const stepHandover = t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin';
    const stepSap = kat === 'Own Risk' ? (t.status_sap !== 'N/A' && t.status_sap !== '' && t.status_sap !== undefined) : true;
    const stepApproval = t.status_approval === 'Disetujui';

    const isMaintenance = kat === 'Maintenance';
    const isRegionalHeadReq = isMaintenance ? (val > 7500000) : (val > 5000000);
    const isDivisionHeadReq = val > 15000000;

    const stepRegionalApproval = t.regional_approval_status === 'Disetujui';
    const stepDivisionApproval = t.division_approval_status === 'Disetujui';

    const stepInvoice = t.no_invoice && t.no_invoice !== '-';
    const stepPayment = t.status_payment === 'Lunas';

    const approvalPic = (kat === 'Maintenance' || kat === 'TPL' || kat === 'Unclaimable Insurance' || kat === 'Dokumen Kendaraan') ? 'Kacab' : 'Sales Head';

    let stepsArr: Array<{ label: string; pic: string; completed: boolean; active: boolean }> = [];

    if (kat === 'Own Risk') {
      stepsArr.push(
        { label: "Buat BAK & Input SAP", pic: "ASO", completed: step1, active: !stepHandover },
        { label: "Serah Terima Berkas (ASO ke Admin)", pic: "ASO", completed: stepHandover, active: !stepHandover },
        { label: "Update SAP (Bill/No)", pic: "Sales Head", completed: stepSap, active: stepHandover && !stepSap },
        { label: "Approval Backcharge", pic: "Sales Head", completed: stepApproval, active: stepHandover && stepSap && !stepApproval }
      );
    } else if (kat === 'Ekspedisi') {
      stepsArr.push(
        { label: "Buat Order Ekspedisi", pic: "ASO", completed: step1, active: !stepHandover },
        { label: "Serah Terima Berkas (ASO ke Admin)", pic: "ASO", completed: stepHandover, active: !stepHandover },
        { label: "Verifikasi Berkas & Dokumen", pic: "BRO / Admin", completed: stepHandover, active: stepHandover && !stepApproval },
        { label: "Approval Backcharge", pic: "Sales Head", completed: stepApproval, active: stepHandover && !stepApproval }
      );
    } else if (kat === 'ETLE') {
      stepsArr.push(
        { label: "Inisiasi Berkas (VRO)", pic: "VRO", completed: step1, active: !stepHandover },
        { label: "Serah Terima Berkas (ASO ke Admin)", pic: "ASO", completed: stepHandover, active: !stepHandover },
        { label: "Verifikasi Berkas & Dokumen", pic: "BRO / Admin", completed: stepHandover, active: stepHandover && !stepApproval },
        { label: "Approval Backcharge", pic: "Sales Head", completed: stepApproval, active: stepHandover && !stepApproval }
      );
    } else {
      stepsArr.push(
        { label: "Inisiasi Berkas (SA)", pic: "SA", completed: step1, active: !stepHandover },
        { label: "Serah Terima Berkas (ASO ke Admin)", pic: "ASO", completed: stepHandover, active: !stepHandover },
        { label: "Verifikasi Berkas & Dokumen", pic: "BRO / Admin", completed: stepHandover, active: stepHandover && !stepApproval },
        { label: "Approval Backcharge", pic: approvalPic, completed: stepApproval, active: stepHandover && !stepApproval }
      );
    }

    if (isRegionalHeadReq || isDivisionHeadReq) {
      stepsArr.push({
        label: "Approval Regional Head",
        pic: "Regional Head",
        completed: stepRegionalApproval,
        active: stepApproval && !stepRegionalApproval
      });
    }

    if (isDivisionHeadReq) {
      stepsArr.push({
        label: "Approval Division Head",
        pic: "Division Head",
        completed: stepDivisionApproval,
        active: stepRegionalApproval && !stepDivisionApproval
      });
    }

    const lastApprovalCompleted = isDivisionHeadReq ? stepDivisionApproval : (isRegionalHeadReq ? stepRegionalApproval : stepApproval);

    stepsArr.push(
      { label: "Cetak & Kirim Invoice", pic: "Admin", completed: stepInvoice, active: stepHandover && lastApprovalCompleted && !stepInvoice },
      { label: "Pelunasan Backcharge", pic: "Customer", completed: stepPayment, active: stepHandover && lastApprovalCompleted && stepInvoice && !stepPayment }
    );

    return stepsArr;
  };

  const steps = getSteps(transaction);

  // Overall workflow status mapper ('Pending', 'In Progress', 'Completed')
  const getOverallStatus = () => {
    if (transaction.status_payment === 'Lunas') {
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm',
        dotClass: 'bg-emerald-500',
        text: 'Lunas / Selesai'
      };
    }
    if (transaction.status_handover === 'Pending') {
      return {
        label: 'Pending',
        badgeClass: 'bg-amber-50 border border-amber-200 text-amber-700 shadow-sm',
        dotClass: 'bg-amber-500',
        text: 'Menunggu Berkas'
      };
    }
    return {
      label: 'In Progress',
      badgeClass: 'bg-blue-50 border border-blue-200 text-blue-700 shadow-sm',
      dotClass: 'bg-blue-500 animate-pulse',
      text: 'Sedang Diproses'
    };
  };

  const overallStatus = getOverallStatus();

  // Helper to generate crisp, uncorrupted official document image for mock/placeholder URLs
  const generateMockDocumentCanvas = (
    docType: string,
    docTitleCustom?: string
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background - Crisp White Paper
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1600);

    // Border & Margin Frame
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 1120, 1520);

    // Outer Header Bar (Navy Blue)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(40, 40, 1120, 140);

    // Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PT ADI SARANA ARMADA, Tbk', 80, 100);

    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('PORTAL MANAJEMEN BACKCHARGE NASIONAL — DOKUMEN BUKTI RESMI', 80, 135);

    // Document Title
    const isBak = docType.includes('BAK') || docType === 'MOCK_BAK';
    const docTitle = docTitleCustom || (isBak ? 'BERITA ACARA KERUSAKAN (BAK)' : 'BERITA ACARA SERAH TERIMA BERKAS');

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(docTitle.toUpperCase(), 600, 240);

    // Underline
    ctx.beginPath();
    ctx.moveTo(250, 255);
    ctx.lineTo(950, 255);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2563eb';
    ctx.stroke();

    // Ref & Date
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`ID Transaksi: ${transaction.id}  |  Tanggal: ${formatDateOnly(transaction.tanggal)}`, 600, 290);

    ctx.textAlign = 'left';

    // Info Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(80, 330, 1040, 520);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 330, 1040, 520);

    const fields = [
      { label: 'ID TRANSAKSI', val: transaction.id },
      { label: 'KATEGORI DOKUMEN', val: transaction.category },
      { label: 'NAMA CUSTOMER', val: transaction.customer_name },
      { label: 'CABANG WILAYAH', val: transaction.branch },
      { label: 'NOMOR POLISI (ARMADA)', val: transaction.license_plate || '-' },
      { label: 'NOMOR BAK / SPK', val: `${transaction.no_bak || '-'} / ${transaction.no_spk || '-'}` },
      { label: 'NILAI TUNTUTAN BACKCHARGE', val: formatRupiah(transaction.value) },
      { label: 'STATUS SERAH TERIMA', val: transaction.status_handover || 'Pending' },
      { label: 'STATUS PEMBAYARAN', val: transaction.status_payment || 'Belum Bayar' },
      { label: 'NOMOR INVOICE', val: transaction.no_invoice || 'Belum Terbit' },
    ];

    let y = 380;
    fields.forEach((f, idx) => {
      const isRight = idx % 2 === 1;
      const x = isRight ? 620 : 120;
      
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(f.label, x, y);

      ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = f.label.includes('NILAI') ? '#1e3a8a' : '#0f172a';
      ctx.fillText(f.val, x, y + 26);

      if (isRight) y += 80;
    });

    // Description area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, 880, 1040, 180);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(80, 880, 1040, 180);

    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('CATATAN KETERANGAN & VERIFIKASI DOKUMEN:', 110, 920);

    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    const descText = isBak 
      ? `Dokumen Kerusakan & Inisiasi fisik Backcharge kendaraan ${transaction.license_plate} milik customer ${transaction.customer_name} telah diverifikasi secara sah di Cabang ${transaction.branch}.`
      : `Dokumen fisik serah terima berkas penyerahan backcharge (${transaction.id}) telah diverifikasi secara digital dan fisik oleh tim operasional ASSA.`;
    ctx.fillText(descText, 110, 960);

    // Watermark Stamp
    ctx.save();
    ctx.translate(900, 1180);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(-160, -45, 320, 90);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(-160, -45, 320, 90);

    ctx.font = '900 28px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED & VALID', 0, 8);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PT ADI SARANA ARMADA TBK', 0, 30);
    ctx.restore();

    // Signatures Section
    const sigY = 1200;
    ctx.textAlign = 'center';

    // Signature 1
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('DIBUAT OLEH (ASO)', 250, sigY);
    ctx.beginPath();
    ctx.moveTo(150, sigY + 120);
    ctx.lineTo(350, sigY + 120);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`Staff ASO ${transaction.branch}`, 250, sigY + 145);

    // Signature 2
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('DIVALIDASI OLEH (BRO)', 600, sigY);
    ctx.beginPath();
    ctx.moveTo(500, sigY + 120);
    ctx.lineTo(700, sigY + 120);
    ctx.stroke();
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`BRO Cabang ${transaction.branch}`, 600, sigY + 145);

    // Signature 3
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('DISETUJUI (ADMIN)', 950, sigY);
    ctx.beginPath();
    ctx.moveTo(850, sigY + 120);
    ctx.lineTo(1050, sigY + 120);
    ctx.stroke();
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Admin Piutang ASSA', 950, sigY + 145);

    // Footer note
    ctx.textAlign = 'center';
    ctx.font = 'italic 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Dicetak otomatis dari Portal Backcharge Terpadu ASSA pada ${new Date().toLocaleString('id-ID')}`, 600, 1530);

    return canvas.toDataURL('image/png');
  };

  // File download helper (handles Base64, Google Drive, and mock document rendering without corruption)
  const downloadFile = (fileData: string | null | undefined, defaultName: string, title?: string) => {
    if (!fileData) {
      if (addToast) {
        addToast("Tidak ada file lampiran!", "error");
      } else {
        alert("Tidak ada file lampiran!");
      }
      return;
    }
    
    let fileName = defaultName;

    // 1. Check if it's base64 data URL
    if (fileData.startsWith('data:')) {
      if (fileData.startsWith('data:image/jpeg') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".jpg";
      } else if (fileData.startsWith('data:image/png') && !fileName.endsWith('.png')) {
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".png";
      } else if (fileData.startsWith('data:application/pdf') && !fileName.endsWith('.pdf')) {
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".pdf";
      }

      const link = document.createElement('a');
      link.href = fileData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 2. If it's a web link or Google Drive URL
    if (fileData.startsWith('http://') || fileData.startsWith('https://')) {
      let downloadUrl = fileData;
      if (fileData.includes('drive.google.com')) {
        const fileIdMatch = fileData.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || fileData.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 3. For mock / placeholder identifiers, render a high-res 1200x1600 official document PNG
    const canvasDataUrl = generateMockDocumentCanvas(fileData, title || defaultName);
    if (canvasDataUrl) {
      if (!fileName.endsWith('.png')) {
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".png";
      }
      const link = document.createElement('a');
      link.href = canvasDataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        const updates: Partial<Backcharge> = { [fieldName]: base64 };
        let logMsg = `Mengupload file lampiran baru: ${description}`;

        if (fieldName === 'file_handover_aso_sales_url') {
          updates.status_handover = 'Diserahkan ke Admin';
          updates.file_handover_sales_admin_url = base64;
          updates.tanggal_handover = transaction.tanggal_handover || new Date().toLocaleString('id-ID');
          logMsg = `ASO mengunggah Foto Bukti Serah Terima ASO ke Admin dan menyerahkan fisik berkas Backcharge lengkap ke departemen Admin`;
        }

        onUpdateStatus(
          transaction.id, 
          updates, 
          logMsg
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Actions trigger handlers
  const handleSAPStatus = () => {
    const confirmMessage = `Konfirmasi Status Billing SAP:\nApakah Anda yakin ingin memperbarui Status SAP menjadi "${modalSAPStatus}"?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { 
        status_sap: modalSAPStatus
      },
      `Sales Head menyetujui status SAP: ${modalSAPStatus}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleInvoiceInput = () => {
    if (!modalInvoiceNo.trim()) {
      if (addToast) {
        addToast('Nomor invoice wajib diisi!', 'error');
      } else {
        alert('Nomor invoice wajib diisi!');
      }
      return;
    }
    const confirmMessage = `Konfirmasi Penerbitan Invoice:\nApakah Anda yakin ingin menerbitkan Invoice No: ${modalInvoiceNo.trim()}?`;
    if (!window.confirm(confirmMessage)) {
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
      if (addToast) {
        addToast('Bukti serah terima wajib diunggah!', 'error');
      } else {
        alert('Bukti serah terima wajib diunggah!');
      }
      return;
    }
    const confirmMessage = `Konfirmasi Serah Terima Berkas:\nApakah Anda yakin ingin mengunggah Foto Bukti Serah Terima Sales ke Admin?`;
    if (!window.confirm(confirmMessage)) {
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



  const handleSetPaid = () => {
    const confirmMessage = `Konfirmasi Status Lunas:\nApakah Anda yakin ingin mengubah status pembayaran transaksi ini menjadi "Lunas"? Tindakan ini akan menyelesaikan alur transaksi Backcharge.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    onUpdateStatus(
      transaction.id,
      { status_payment: 'Lunas' },
      `Admin mengonfirmasi pelunasan pembayaran tagihan dari Customer`
    );
  };

  const handleApprovalSubmit = () => {
    const isKacabUser = hasRole(currentUser.role, 'Kepala Cabang') || hasRole(currentUser.role, 'kacab');
    const isSHUser = hasRole(currentUser.role, 'Sales Head') || hasRole(currentUser.role, 'Sales / Sales Head');
    const roleTitle = isKacabUser ? 'Kepala Cabang' : isSHUser ? 'Sales Head' : currentUser.role;

    const confirmMessage = `PERINGATAN STATUS KRITIS!\n\nApakah Anda yakin ingin menyimpan keputusan Approval Backcharge ini dengan status: "${modalApprovalStatus.toUpperCase()}"?\n\nPerubahan ini akan dicatat secara resmi atas nama ${currentUser.full_name || currentUser.email} (${roleTitle}).`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      { 
        status_approval: modalApprovalStatus,
        approved_by: `${currentUser.full_name || currentUser.email} (${roleTitle})`,
        approved_at: new Date().toLocaleString('id-ID'),
        approval_note: modalApprovalNotes.trim() || null,
        approval_attachment_1_url: approvalAttachment1,
        approval_attachment_2_url: approvalAttachment2,
        approval_attachment_3_url: approvalAttachment3
      },
      `${roleTitle} memproses Approval Backcharge kategori ${transaction.category}: ${modalApprovalStatus}.${modalApprovalNotes.trim() ? ` Catatan: ${modalApprovalNotes.trim()}` : ''}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleRegionalApprovalSubmit = () => {
    const confirmMessage = `PERINGATAN STATUS KRITIS!\n\nApakah Anda yakin ingin menyimpan keputusan Approval Regional Head ini dengan status: "${modalRegionalApprovalStatus.toUpperCase()}"?\n\nPerubahan ini akan dicatat atas nama ${currentUser.full_name || currentUser.email} (Regional Head).`;
    if (!window.confirm(confirmMessage)) return;

    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      {
        regional_approval_status: modalRegionalApprovalStatus,
        regional_approved_by: `${currentUser.full_name || currentUser.email} (${currentUser.role})`,
        regional_approved_at: new Date().toLocaleString('id-ID'),
        regional_approval_note: modalRegionalApprovalNotes.trim() || null
      },
      `Regional Head memproses Approval Regional Head: ${modalRegionalApprovalStatus}.${modalRegionalApprovalNotes.trim() ? ` Catatan: ${modalRegionalApprovalNotes.trim()}` : ''}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  const handleDivisionApprovalSubmit = () => {
    const confirmMessage = `PERINGATAN STATUS KRITIS!\n\nApakah Anda yakin ingin menyimpan keputusan Approval Division Head ini dengan status: "${modalDivisionApprovalStatus.toUpperCase()}"?\n\nPerubahan ini akan dicatat atas nama ${currentUser.full_name || currentUser.email} (Division Head).`;
    if (!window.confirm(confirmMessage)) return;

    setActionLoading(true);
    onUpdateStatus(
      transaction.id,
      {
        division_approval_status: modalDivisionApprovalStatus,
        division_approved_by: `${currentUser.full_name || currentUser.email} (${currentUser.role})`,
        division_approved_at: new Date().toLocaleString('id-ID'),
        division_approval_note: modalDivisionApprovalNotes.trim() || null
      },
      `Division Head memproses Approval Division Head: ${modalDivisionApprovalStatus}.${modalDivisionApprovalNotes.trim() ? ` Catatan: ${modalDivisionApprovalNotes.trim()}` : ''}`
    );
    setActionLoading(false);
    setShowActionForm(null);
  };

  // Check roles permission
  const isKacabRole = hasRole(currentUser.role, 'Kepala Cabang') || hasRole(currentUser.role, 'kacab') || hasRole(currentUser.role, 'Administrator');
  const isSalesHeadRole = hasRole(currentUser.role, 'Sales Head') || hasRole(currentUser.role, 'Sales / Sales Head') || hasRole(currentUser.role, 'Administrator');
  const isSales = hasRole(currentUser.role, 'Sales Head') || hasRole(currentUser.role, 'Kepala Cabang') || hasRole(currentUser.role, 'Sales / Sales Head') || hasRole(currentUser.role, 'kacab') || hasRole(currentUser.role, 'Administrator');
  const isBro = hasRole(currentUser.role, 'BRO');
  const isAdmin = hasRole(currentUser.role, 'Admin') || hasRole(currentUser.role, 'Administrator');
  const isAdminView = isAdmin || hasRole(currentUser.role, 'Admin Head');
  const isAso = hasRole(currentUser.role, 'ASO') || hasRole(currentUser.role, 'Maintenance Center') || hasRole(currentUser.role, 'ASO Megabranch') || hasRole(currentUser.role, 'Administrator');

  const txValue = transaction.value || 0;
  const isRegionalHeadView = isRegionalHeadRole(currentUser.role as string);
  const isDivisionHeadView = hasRole(currentUser.role, 'Division Head');

  const expectedApproverLabel = 
    (transaction.category === 'Maintenance' || transaction.category === 'TPL') ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)';

  const isMaintenance = transaction.category === 'Maintenance';
  const isTPL = transaction.category === 'TPL';
  const isOtherCat = transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan';

  const isAuthorizedApprover = 
    hasRole(currentUser.role, 'Administrator') ||
    (isKacabRole && (isMaintenance || isTPL)) ||
    (isSalesHeadRole && isOtherCat) ||
    (isRegionalHeadView && ((isMaintenance && txValue > 7500000) || (!isMaintenance && txValue > 5000000))) ||
    (isDivisionHeadView && txValue > 15000000);

  const isSuperAdmin = hasRole(currentUser.role, 'Administrator');
  const isRegionalHeadUser = isRegionalHeadView;
  const isDivisionHeadUser = isDivisionHeadView;
  const isKacabUser = isKacabRole && !isRegionalHeadUser && !isDivisionHeadUser;
  const isSalesHeadUser = isSalesHeadRole && !isRegionalHeadUser && !isDivisionHeadUser;
  const isAdminUser = isAdminView && !isRegionalHeadUser && !isDivisionHeadUser && !isKacabRole && !isSalesHeadRole;

  const isRegionalHeadReq = isMaintenance 
    ? (txValue > 7500000) 
    : (txValue > 5000000);

  const isDivisionHeadReq = txValue > 15000000;
  const isFullyApproved = 
    transaction.status_approval === 'Disetujui' &&
    (!isRegionalHeadReq || transaction.regional_approval_status === 'Disetujui') &&
    (!isDivisionHeadReq || transaction.division_approval_status === 'Disetujui');

  const showBlockSAP = isSuperAdmin || (isSalesHeadUser && transaction.category === 'Own Risk');
  const showBlockApprovalL1 = isSuperAdmin || ((isKacabUser && (isMaintenance || isTPL)) || (isSalesHeadUser && isOtherCat));
  const showBlockRegionalApproval = isSuperAdmin || (isRegionalHeadUser && isRegionalHeadReq);
  const showBlockDivisionApproval = isSuperAdmin || (isDivisionHeadUser && txValue > 15000000);
  const showBlockInvoice = isSuperAdmin || (isAdminUser && isFullyApproved);

  const showActionPanel = isSuperAdmin || !isAdminUser || isFullyApproved;

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
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase bg-blue-600 text-white tracking-wider">
              {transaction.category}
            </span>
            <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase bg-emerald-500 text-white tracking-wider">
              {transaction.branch}
            </span>
            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${overallStatus.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${overallStatus.dotClass}`}></span>
              <span>{overallStatus.label}</span>
              <span className="text-slate-400 font-semibold normal-case">({overallStatus.text})</span>
            </span>
          </div>
          <div className="flex items-center justify-between w-full gap-3 flex-wrap">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>Detail & Alur Kerja: {transaction.id}</span>
              {transaction.customer_name && transaction.customer_name !== '-' && (
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  {transaction.customer_name}
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium print:hidden">
            Informasi komparasi dokumen fisik & langkah pelacakan alur Backcharge nasional.
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
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Status Alur Kerja</span>
                <span className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black mt-1 ${overallStatus.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${overallStatus.dotClass}`}></span>
                  <span className="uppercase tracking-wider">{overallStatus.label}</span>
                  <span className="text-[10px] opacity-75 font-bold">({overallStatus.text})</span>
                </span>
              </div>

              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Status Approval Backcharge</span>
                <div className="space-y-2.5">
                  {/* Level 1 Approval */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-800">
                        {isMaintenance || isTPL ? '1. Approval Kacab' : '1. Approval Sales Head'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                        transaction.status_approval === 'Disetujui'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : transaction.status_approval === 'Ditolak'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {transaction.status_approval === 'Disetujui' ? '✅ Disetujui' : transaction.status_approval === 'Ditolak' ? '❌ Ditolak' : '⏳ Belum'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold">Wewenang: {isMaintenance || isTPL ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)'}</p>
                    {transaction.approved_by && (
                      <p className="text-[9px] text-slate-600">Oleh: <strong className="text-slate-700">{transaction.approved_by}</strong> {transaction.approved_at ? `(${transaction.approved_at})` : ''}</p>
                    )}
                    {transaction.approval_note && (
                      <p className="text-[9px] text-slate-600 italic">"{transaction.approval_note}"</p>
                    )}
                  </div>

                  {/* Regional Head Approval (if required) */}
                  {isRegionalHeadReq && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-800">2. Approval Regional Head</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          transaction.regional_approval_status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : transaction.regional_approval_status === 'Ditolak'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {transaction.regional_approval_status === 'Disetujui' ? '✅ Disetujui' : transaction.regional_approval_status === 'Ditolak' ? '❌ Ditolak' : '⏳ Belum'}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold">Wewenang: Regional Head</p>
                      {transaction.regional_approved_by && (
                        <p className="text-[9px] text-slate-600">Oleh: <strong className="text-slate-700">{transaction.regional_approved_by}</strong> {transaction.regional_approved_at ? `(${transaction.regional_approved_at})` : ''}</p>
                      )}
                      {transaction.regional_approval_note && (
                        <p className="text-[9px] text-slate-600 italic">"{transaction.regional_approval_note}"</p>
                      )}
                    </div>
                  )}

                  {/* Division Head Approval (if required) */}
                  {txValue > 15000000 && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-800">3. Approval Division Head</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          transaction.division_approval_status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : transaction.division_approval_status === 'Ditolak'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {transaction.division_approval_status === 'Disetujui' ? '✅ Disetujui' : transaction.division_approval_status === 'Ditolak' ? '❌ Ditolak' : '⏳ Belum'}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold">Wewenang: Division Head</p>
                      {transaction.division_approved_by && (
                        <p className="text-[9px] text-slate-600">Oleh: <strong className="text-slate-700">{transaction.division_approved_by}</strong> {transaction.division_approved_at ? `(${transaction.division_approved_at})` : ''}</p>
                      )}
                      {transaction.division_approval_note && (
                        <p className="text-[9px] text-slate-600 italic">"{transaction.division_approval_note}"</p>
                      )}
                    </div>
                  )}
                </div>

                {(transaction.approval_attachment_1_url || transaction.approval_attachment_2_url || transaction.approval_attachment_3_url) && (
                  <div className="mt-3.5 space-y-1.5 p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                    <span className="block text-[8px] font-black text-amber-800 uppercase tracking-wider mb-1">Akses Pratinjau Instan</span>
                    <div className="flex flex-wrap gap-2">
                      {transaction.approval_attachment_1_url && (
                        <button 
                          type="button"
                          onClick={() => {
                            setLightboxFile({ 
                              url: transaction.approval_attachment_1_url!, 
                              title: `Lampiran Pendukung 1 (Approval): ${transaction.id}`, 
                              docName: "Lampiran_Approval_1" 
                            });
                          }}
                          className="flex items-center space-x-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 border border-amber-200/60 rounded-lg text-[9px] font-black transition-colors"
                        >
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>Lampiran 1</span>
                        </button>
                      )}
                      {transaction.approval_attachment_2_url && (
                        <button 
                          type="button"
                          onClick={() => {
                            setLightboxFile({ 
                              url: transaction.approval_attachment_2_url!, 
                              title: `Lampiran Pendukung 2 (Approval): ${transaction.id}`, 
                              docName: "Lampiran_Approval_2" 
                            });
                          }}
                          className="flex items-center space-x-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 border border-amber-200/60 rounded-lg text-[9px] font-black transition-colors"
                        >
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>Lampiran 2</span>
                        </button>
                      )}
                      {transaction.approval_attachment_3_url && (
                        <button 
                          type="button"
                          onClick={() => {
                            setLightboxFile({ 
                              url: transaction.approval_attachment_3_url!, 
                              title: `Lampiran Pendukung 3 (Approval): ${transaction.id}`, 
                              docName: "Lampiran_Approval_3" 
                            });
                          }}
                          className="flex items-center space-x-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 border border-amber-200/60 rounded-lg text-[9px] font-black transition-colors"
                        >
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>Lampiran 3</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nama Customer</span>
                <span className="font-extrabold text-slate-900 text-sm block mt-0.5">{transaction.customer_name}</span>
              </div>
              
              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nilai Backcharge</span>
                <span className="font-black text-blue-600 text-lg font-mono block mt-0.5">{formatRupiah(transaction.value)}</span>
              </div>

              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Tanggal BAK</span>
                <span className="font-bold text-slate-800 text-sm block mt-0.5">{formatDateOnly(transaction.tanggal)}</span>
              </div>

              <div>
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Tanggal & Waktu Penyerahan</span>
                <span className="font-bold text-slate-800 text-sm block mt-0.5">{transaction.tanggal_handover || '-'}</span>
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

              {transaction.category === 'ETLE' && transaction.no_tilang && transaction.no_tilang !== '-' && (
                <div className="pt-1">
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor Surat Tilang</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{transaction.no_tilang}</span>
                </div>
              )}

              {transaction.license_plate !== '-' && (
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">No. Polisi</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{transaction.license_plate}</span>
                </div>
              )}

              {transaction.bro_name && transaction.bro_name !== '-' && (
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Nama BRO</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{transaction.bro_name}</span>
                </div>
              )}

              {transaction.dok_pendukung_alasan && transaction.dok_pendukung_alasan !== '-' && (
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Dokumen Pendukung & Alasan</span>
                  <p className="text-slate-700 font-medium block mt-0.5 p-2.5 bg-slate-100/50 rounded-xl whitespace-pre-wrap leading-relaxed">{transaction.dok_pendukung_alasan}</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Lampiran Dokumen</span>
                
                {/* 1. File BAK */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        const labels = getFileLabels(transaction.category);
                        if (transaction.file_bak_url) {
                          setLightboxFile({ url: transaction.file_bak_url, title: `${labels.bak}: ${transaction.id}`, docName: labels.bak });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-blue-600 hover:underline"
                    >
                      {transaction.file_bak_url ? `${getFileLabels(transaction.category).bak}.pdf/img` : `Belum Ada ${getFileLabels(transaction.category).bak} (Klik untuk cek)`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        const labels = getFileLabels(transaction.category);
                        if (transaction.file_bak_url) {
                          setLightboxFile({ url: transaction.file_bak_url, title: `${labels.bak}: ${transaction.id}`, docName: labels.bak });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.file_bak_url ? (
                      <button 
                        onClick={() => downloadFile(
                          transaction.file_bak_url, 
                          getFormattedFileName(getFileLabels(transaction.category).bak, transaction, transaction.file_bak_url),
                          getFileLabels(transaction.category).bak
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File"
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
                            onChange={(e) => uploadNewFile(e, 'file_bak_url', getFileLabels(transaction.category).bak)}
                            className="hidden" 
                          />
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* 2. Handover ASO - Admin */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Image className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        const labels = getFileLabels(transaction.category);
                        if (transaction.file_handover_aso_sales_url) {
                          setLightboxFile({ url: transaction.file_handover_aso_sales_url, title: `${labels.asoSales}: ${transaction.id}`, docName: labels.asoSales });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-purple-600 hover:underline"
                    >
                      {transaction.file_handover_aso_sales_url ? `${getFileLabels(transaction.category).asoSales}.img` : `Belum Ada ${getFileLabels(transaction.category).asoSales} (Klik untuk cek)`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        const labels = getFileLabels(transaction.category);
                        if (transaction.file_handover_aso_sales_url) {
                          setLightboxFile({ url: transaction.file_handover_aso_sales_url, title: `${labels.asoSales}: ${transaction.id}`, docName: labels.asoSales });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.file_handover_aso_sales_url && (
                      <button 
                        onClick={() => downloadFile(
                          transaction.file_handover_aso_sales_url, 
                          getFormattedFileName(getFileLabels(transaction.category).asoSales, transaction, transaction.file_handover_aso_sales_url),
                          getFileLabels(transaction.category).asoSales
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh Foto"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Dokumen Pendukung */}
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span 
                      onClick={() => {
                        if (transaction.upload_dok_pendukung) {
                          setLightboxFile({ url: transaction.upload_dok_pendukung, title: `Dokumen Pendukung: ${transaction.id}`, docName: "Dokumen_Pendukung" });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-amber-600 hover:underline"
                    >
                      {transaction.upload_dok_pendukung ? "Dokumen Pendukung (File / Foto)" : "Belum Ada Dokumen Pendukung (Klik untuk cek)"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => {
                        if (transaction.upload_dok_pendukung) {
                          setLightboxFile({ url: transaction.upload_dok_pendukung, title: `Dokumen Pendukung: ${transaction.id}`, docName: "Dokumen_Pendukung" });
                        } else {
                          alert("file atau foto belum di upload");
                        }
                      }}
                      className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                      title="Lihat Langsung"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {transaction.upload_dok_pendukung && (
                      <button 
                        onClick={() => downloadFile(
                          transaction.upload_dok_pendukung, 
                          getFormattedFileName("Dokumen_Pendukung", transaction, transaction.upload_dok_pendukung),
                          "Dokumen Pendukung"
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Lampiran Pendukung 1 (Approval) */}
                {transaction.approval_attachment_1_url && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_1_url!, 
                            title: `Lampiran Pendukung 1 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_1" 
                          });
                        }}
                        className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-rose-600 hover:underline"
                      >
                        Lampiran Pendukung 1 (Approval)
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_1_url!, 
                            title: `Lampiran Pendukung 1 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_1" 
                          });
                        }}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                        title="Lihat Langsung"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => downloadFile(
                          transaction.approval_attachment_1_url!, 
                          getFormattedFileName("Lampiran_Approval_1", transaction, transaction.approval_attachment_1_url),
                          "Lampiran Approval 1"
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 6. Lampiran Pendukung 2 (Approval) */}
                {transaction.approval_attachment_2_url && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_2_url!, 
                            title: `Lampiran Pendukung 2 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_2" 
                          });
                        }}
                        className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-rose-600 hover:underline"
                      >
                        Lampiran Pendukung 2 (Approval)
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_2_url!, 
                            title: `Lampiran Pendukung 2 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_2" 
                          });
                        }}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                        title="Lihat Langsung"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => downloadFile(
                          transaction.approval_attachment_2_url!, 
                          getFormattedFileName("Lampiran_Approval_2", transaction, transaction.approval_attachment_2_url),
                          "Lampiran Approval 2"
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 7. Lampiran Pendukung 3 (Approval) */}
                {transaction.approval_attachment_3_url && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_3_url!, 
                            title: `Lampiran Pendukung 3 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_3" 
                          });
                        }}
                        className="text-[10px] font-bold text-slate-700 truncate cursor-pointer hover:text-rose-600 hover:underline"
                      >
                        Lampiran Pendukung 3 (Approval)
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          setLightboxFile({ 
                            url: transaction.approval_attachment_3_url!, 
                            title: `Lampiran Pendukung 3 (Approval): ${transaction.id}`, 
                            docName: "Lampiran_Approval_3" 
                          });
                        }}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                        title="Lihat Langsung"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => downloadFile(
                          transaction.approval_attachment_3_url!, 
                          getFormattedFileName("Lampiran_Approval_3", transaction, transaction.approval_attachment_3_url),
                          "Lampiran Approval 3"
                        )}
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Unduh File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

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
                        <p className="text-[9px] text-slate-500 mt-0.5 font-medium">
                          {step.label.includes("Serah Terima Berkas") 
                            ? (step.completed 
                                ? `Dokumen baru telah di-input oleh ASO & berkas fisik Backcharge diserahkan langsung ke Admin${transaction.tanggal_handover ? ` pada ${transaction.tanggal_handover}` : ''}` 
                                : step.active 
                                  ? "Menunggu unggahan Foto Serah Terima ASO ke Admin untuk memproses penyerahan berkas" 
                                  : "Menunggu tahap sebelumnya")
                            : (step.completed 
                                ? 'Tahap sukses diselesaikan' 
                                : step.active 
                                  ? 'Menunggu penyelesaian Anda' 
                                  : 'Menunggu tahap sebelumnya')
                          }
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION PANEL (print:hidden) */}
            {showActionPanel && (
              <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-5 flex flex-col space-y-4 print:hidden">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></div>
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Tindakan Otoritas Alur Backcharge</span>
                </div>
                <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  Peran Anda: {currentUser.role}
                </span>
              </div>

              {/* Serah Terima Berkas Banner (If Pending) */}
              {isAso && transaction.status_handover === 'Pending' && showActionForm === null && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-extrabold text-indigo-900">📦 Serah Terima Berkas (ASO ke Admin)</h5>
                    <p className="text-[10px] text-indigo-700 font-medium">Serahkan berkas fisik Backcharge ke Admin untuk melanjutkan alur invoice.</p>
                  </div>
                  <button 
                    onClick={() => setShowActionForm('handover_courier')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg shadow cursor-pointer transition-all shrink-0"
                  >
                    Proses Serah Terima
                  </button>
                </div>
              )}

              {/* Top status notification if Lunas */}
              {transaction.status_payment === 'Lunas' && (
                <div className="w-full p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center space-x-2">
                  <span>🎉</span>
                  <span>Transaksi Backcharge lunas &amp; tuntas. Seluruh siklus dokumen telah selesai divalidasi.</span>
                </div>
              )}

              {/* 3 SEPARATED AUTHORITY BLOCKS (FILTERED BY ROLE PERMISSION) */}
              <div className="grid grid-cols-1 gap-3">

                {/* BLOCK 1: UPDATE SAP (BILL / NOT BILL) - Visible for Sales Head when Own Risk */}
                {showBlockSAP && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    showActionForm === 'sap' 
                      ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">⚙️</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">1. Update SAP (Bill/No)</h5>
                          <span className="text-[9px] text-slate-500 font-bold">Wewenang: Sales Head</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        transaction.status_sap === 'Bill'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : transaction.status_sap === 'Not Bill'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {transaction.status_sap ? `Status: ${transaction.status_sap}` : 'Belum Set (N/A)'}
                      </span>
                    </div>

                    {showActionForm === 'sap' ? (
                      <div className="space-y-3 border-t border-blue-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Otorisasi SAP ERP</span>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Billing SAP</label>
                            <select 
                              value={modalSAPStatus}
                              onChange={(e) => setModalSAPStatus(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white mb-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="Bill">Bill (Ditagihkan ke Customer)</option>
                              <option value="Not Bill">Not Bill (Ditanggung Internal)</option>
                            </select>
                          </div>
                          <button 
                            onClick={handleSAPStatus}
                            disabled={actionLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
                          >
                            Simpan Status SAP
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-slate-500">
                          {transaction.category === 'Own Risk' 
                            ? 'Atur pembebanan billing Backcharge di SAP ERP (Bill vs Not Bill).' 
                            : 'Kategori Non-Own Risk terproses otomatis di SAP.'}
                        </p>
                        {transaction.category === 'Own Risk' && isSalesHeadRole && (
                          <button 
                            onClick={() => setShowActionForm('sap')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer shrink-0"
                          >
                            Update Status SAP
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCK 2: APPROVAL BACKCHARGE - Visible for Kacab (Maintenance/TPL) or Sales Head (OR/Ekspedisi/ETLE) */}
                {showBlockApprovalL1 && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    showActionForm === 'approval' 
                      ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">⚡</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">2. Approval Backcharge</h5>
                          <span className="text-[9px] text-slate-500 font-bold">
                            Wewenang: {expectedApproverLabel}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        transaction.status_approval === 'Disetujui'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : transaction.status_approval === 'Ditolak'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {transaction.status_approval === 'Disetujui' ? '✅ Disetujui' : transaction.status_approval === 'Ditolak' ? '❌ Tidak Disetujui (Not Approved)' : '⏳ Belum Approval'}
                      </span>
                    </div>

                    {showActionForm === 'approval' ? (
                      <div className="space-y-3 border-t border-amber-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-800">Form Persetujuan Approval Backcharge</span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold uppercase">
                              Wewenang {expectedApproverLabel}
                            </span>
                          </div>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                        </div>
                        
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Keputusan Approval</label>
                            <select 
                              value={modalApprovalStatus}
                              onChange={(e) => setModalApprovalStatus(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="Disetujui">✅ Disetujui (Approved)</option>
                              <option value="Ditolak">❌ Tidak Disetujui (Not Approved)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Catatan / Keterangan Persetujuan</label>
                            <textarea 
                              value={modalApprovalNotes}
                              onChange={(e) => setModalApprovalNotes(e.target.value)}
                              placeholder="Tuliskan catatan persetujuan atau instruksi khusus..."
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                              rows={2}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lampiran Pendukung (Maks. 3)</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {[
                                { 
                                  state: approvalAttachment1, 
                                  setter: setApprovalAttachment1, 
                                  label: 'Lampiran 1', 
                                  uploading: uploadingAttachment1, 
                                  setUploading: setUploadingAttachment1, 
                                  name: approvalAttachment1Name, 
                                  setName: setApprovalAttachment1Name 
                                },
                                { 
                                  state: approvalAttachment2, 
                                  setter: setApprovalAttachment2, 
                                  label: 'Lampiran 2', 
                                  uploading: uploadingAttachment2, 
                                  setUploading: setUploadingAttachment2, 
                                  name: approvalAttachment2Name, 
                                  setName: setApprovalAttachment2Name 
                                },
                                { 
                                  state: approvalAttachment3, 
                                  setter: setApprovalAttachment3, 
                                  label: 'Lampiran 3', 
                                  uploading: uploadingAttachment3, 
                                  setUploading: setUploadingAttachment3, 
                                  name: approvalAttachment3Name, 
                                  setName: setApprovalAttachment3Name 
                                }
                              ].map((item, idx) => {
                                const isUploading = item.uploading;
                                return (
                                  <div key={idx} className="flex items-center space-x-1 w-full min-w-0">
                                    <label className={`flex flex-1 items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-2 py-2 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all min-w-0 ${isUploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}>
                                      {isUploading ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 text-blue-600 animate-spin flex-shrink-0" />
                                      ) : (
                                        <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600 flex-shrink-0" />
                                      )}
                                      <span className="truncate max-w-[80px] font-sans">
                                        {isUploading 
                                          ? 'Mengunggah...' 
                                          : item.state 
                                            ? (item.name ? item.name : 'Ubah ' + item.label) 
                                            : item.label
                                        }
                                      </span>
                                      <input 
                                        type="file" 
                                        accept="application/pdf,image/*" 
                                        disabled={isUploading}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            item.setName(file.name);
                                            const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;
                                            if (isDriveActive) {
                                              item.setUploading(true);
                                              try {
                                                const docName = `Lampiran_Approval_${idx + 1}`;
                                                const fileNameToUpload = getFormattedFileName(docName, transaction, file.name);
                                                const driveUrl = await uploadFileToDrive(file, fileNameToUpload, googleToken);
                                                item.setter(driveUrl);
                                              } catch (err: any) {
                                                console.error("Gagal mengunggah ke Google Drive:", err);
                                                alert("Gagal mengunggah otomatis ke Google Drive. Disimpan secara lokal.");
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                  item.setter(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                              } finally {
                                                item.setUploading(false);
                                              }
                                            } else {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                item.setter(reader.result as string);
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }
                                        }}
                                        className="hidden" 
                                      />
                                    </label>
                                    {item.state && !isUploading && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setLightboxFile({
                                            url: item.state!,
                                            title: `Lampiran ${idx + 1}: ${transaction.id}`,
                                            docName: `Lampiran_Approval_${idx + 1}`
                                          });
                                        }}
                                        className="p-1.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors flex-shrink-0"
                                        title="Lihat Langsung"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <button 
                            onClick={handleApprovalSubmit}
                            disabled={actionLoading}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-extrabold transition-all shadow cursor-pointer"
                          >
                            Simpan Keputusan Approval
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500">
                          {transaction.approved_by ? (
                            <span>Disetujui oleh: <strong className="text-slate-700">{transaction.approved_by}</strong></span>
                          ) : (
                            <span>Membutuhkan persetujuan pejabat berwenang sebelum penerbitan invoice.</span>
                          )}
                        </div>
                        {(isAuthorizedApprover || hasRole(currentUser.role, 'Administrator')) && (
                          <button 
                            onClick={() => {
                              setModalApprovalStatus(transaction.status_approval === 'Disetujui' ? 'Disetujui' : 'Disetujui');
                              setModalApprovalNotes(transaction.approval_note || '');
                              setShowActionForm('approval');
                            }}
                            className={`px-3 py-1.5 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer shrink-0 ${
                              transaction.status_approval === 'Disetujui' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                            }`}
                          >
                            {transaction.status_approval === 'Disetujui' ? 'Ubah Approval' : 'Proses Approval'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCK 2B: APPROVAL REGIONAL HEAD (If required by value & category) */}
                {showBlockRegionalApproval && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    showActionForm === 'regional_approval' 
                      ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🌐</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">Approval Regional Head</h5>
                          <span className="text-[9px] text-slate-500 font-bold">Wewenang: Regional Head</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        transaction.regional_approval_status === 'Disetujui'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : transaction.regional_approval_status === 'Ditolak'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {transaction.regional_approval_status === 'Disetujui' ? '✅ Disetujui' : transaction.regional_approval_status === 'Ditolak' ? '❌ Tidak Disetujui' : '⏳ Belum Approval RH'}
                      </span>
                    </div>

                    {showActionForm === 'regional_approval' ? (
                      <div className="space-y-3 border-t border-amber-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Persetujuan Regional Head</span>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                        </div>
                        <div className="space-y-3 text-xs">
                          {/* View of Level 1 approval notes & attachments */}
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="block text-[9px] font-extrabold text-slate-500 uppercase">Catatan & Lampiran Level 1 (Kacab / Sales Head):</span>
                            {transaction.approval_note ? (
                              <p className="text-xs text-slate-700 italic">"{transaction.approval_note}"</p>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">Tidak ada catatan dari Level 1.</p>
                            )}
                            {(transaction.approval_attachment_1_url || transaction.approval_attachment_2_url || transaction.approval_attachment_3_url) && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {transaction.approval_attachment_1_url && (
                                  <a href={transaction.approval_attachment_1_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 1</span>
                                  </a>
                                )}
                                {transaction.approval_attachment_2_url && (
                                  <a href={transaction.approval_attachment_2_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 2</span>
                                  </a>
                                )}
                                {transaction.approval_attachment_3_url && (
                                  <a href={transaction.approval_attachment_3_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 3</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Keputusan Approval</label>
                            <select 
                              value={modalRegionalApprovalStatus}
                              onChange={(e) => setModalRegionalApprovalStatus(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="Disetujui">✅ Disetujui (Approved)</option>
                              <option value="Ditolak">❌ Tidak Disetujui (Not Approved)</option>
                            </select>
                          </div>
                          <button 
                            onClick={handleRegionalApprovalSubmit}
                            disabled={actionLoading || transaction.status_approval !== 'Disetujui'}
                            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-extrabold transition-all shadow cursor-pointer"
                          >
                            Simpan Approval Regional Head
                          </button>
                          {transaction.status_approval !== 'Disetujui' && (
                            <p className="text-[10px] text-amber-700 font-semibold text-center">ℹ️ Approval Level 1 (Kacab/SH) harus disetujui terlebih dahulu.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500">
                          {transaction.regional_approved_by ? (
                            <span>Disetujui oleh: <strong className="text-slate-700">{transaction.regional_approved_by}</strong></span>
                          ) : (
                            <span>Membutuhkan persetujuan Regional Head (Nominal menengah).</span>
                          )}
                        </div>
                        {(isRegionalHeadView || hasRole(currentUser.role, 'Administrator')) && (
                          <button 
                            onClick={() => {
                              setModalRegionalApprovalStatus(transaction.regional_approval_status === 'Disetujui' ? 'Disetujui' : 'Disetujui');
                              setModalRegionalApprovalNotes(transaction.regional_approval_note || '');
                              setShowActionForm('regional_approval');
                            }}
                            disabled={transaction.status_approval !== 'Disetujui'}
                            className={`px-3 py-1.5 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                              transaction.regional_approval_status === 'Disetujui' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                            }`}
                          >
                            {transaction.regional_approval_status === 'Disetujui' ? 'Ubah Approval RH' : 'Proses Approval RH'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCK 2C: APPROVAL DIVISION HEAD (If txValue > 15000000) */}
                {showBlockDivisionApproval && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    showActionForm === 'division_approval' 
                      ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🏢</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">Approval Division Head</h5>
                          <span className="text-[9px] text-slate-500 font-bold">Wewenang: Division Head</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        transaction.division_approval_status === 'Disetujui'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : transaction.division_approval_status === 'Ditolak'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {transaction.division_approval_status === 'Disetujui' ? '✅ Disetujui' : transaction.division_approval_status === 'Ditolak' ? '❌ Tidak Disetujui' : '⏳ Belum Approval DH'}
                      </span>
                    </div>

                    {showActionForm === 'division_approval' ? (
                      <div className="space-y-3 border-t border-amber-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Persetujuan Division Head</span>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Batal</button>
                        </div>
                        <div className="space-y-3 text-xs">
                          {/* View of Level 1 approval notes & attachments */}
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="block text-[9px] font-extrabold text-slate-500 uppercase">Catatan & Lampiran Level 1 (Kacab / Sales Head):</span>
                            {transaction.approval_note ? (
                              <p className="text-xs text-slate-700 italic">"{transaction.approval_note}"</p>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">Tidak ada catatan dari Level 1.</p>
                            )}
                            {(transaction.approval_attachment_1_url || transaction.approval_attachment_2_url || transaction.approval_attachment_3_url) && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {transaction.approval_attachment_1_url && (
                                  <a href={transaction.approval_attachment_1_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 1</span>
                                  </a>
                                )}
                                {transaction.approval_attachment_2_url && (
                                  <a href={transaction.approval_attachment_2_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 2</span>
                                  </a>
                                )}
                                {transaction.approval_attachment_3_url && (
                                  <a href={transaction.approval_attachment_3_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                    <FileText className="w-3 h-3" />
                                    <span>Lampiran 3</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Keputusan Approval</label>
                            <select 
                              value={modalDivisionApprovalStatus}
                              onChange={(e) => setModalDivisionApprovalStatus(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="Disetujui">✅ Disetujui (Approved)</option>
                              <option value="Ditolak">❌ Tidak Disetujui (Not Approved)</option>
                            </select>
                          </div>
                          <button 
                            onClick={handleDivisionApprovalSubmit}
                            disabled={actionLoading || transaction.status_approval !== 'Disetujui' || transaction.regional_approval_status !== 'Disetujui'}
                            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-extrabold transition-all shadow cursor-pointer"
                          >
                            Simpan Approval Division Head
                          </button>
                          {(transaction.status_approval !== 'Disetujui' || transaction.regional_approval_status !== 'Disetujui') && (
                            <p className="text-[10px] text-amber-700 font-semibold text-center">ℹ️ Approval Level 1 dan Regional Head harus disetujui terlebih dahulu.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500">
                          {transaction.division_approved_by ? (
                            <span>Disetujui oleh: <strong className="text-slate-700">{transaction.division_approved_by}</strong></span>
                          ) : (
                            <span>Membutuhkan persetujuan Division Head (Nominal &gt; 15 Juta).</span>
                          )}
                        </div>
                        {(isDivisionHeadView || hasRole(currentUser.role, 'Administrator')) && (
                          <button 
                            onClick={() => {
                              setModalDivisionApprovalStatus(transaction.division_approval_status === 'Disetujui' ? 'Disetujui' : 'Disetujui');
                              setModalDivisionApprovalNotes(transaction.division_approval_note || '');
                              setShowActionForm('division_approval');
                            }}
                            disabled={transaction.status_approval !== 'Disetujui' || transaction.regional_approval_status !== 'Disetujui'}
                            className={`px-3 py-1.5 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                              transaction.division_approval_status === 'Disetujui' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                            }`}
                          >
                            {transaction.division_approval_status === 'Disetujui' ? 'Ubah Approval DH' : 'Proses Approval DH'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCK 3: CETAK & KIRIM INVOICE - Visible for Admin / Administrator */}
                {showBlockInvoice && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    showActionForm === 'invoice' 
                      ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-500/20 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-purple-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📝</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">3. Cetak &amp; Kirim Invoice</h5>
                          <span className="text-[9px] text-slate-500 font-bold">Wewenang: Admin</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          transaction.no_invoice && transaction.no_invoice !== '-' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {transaction.no_invoice && transaction.no_invoice !== '-' ? `No: ${transaction.no_invoice}` : 'Belum Terbit'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          transaction.status_payment === 'Lunas' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {transaction.status_payment === 'Lunas' ? (transaction.payment_date ? `Lunas (${transaction.payment_date})` : 'Lunas') : 'Belum Bayar'}
                        </span>
                      </div>
                    </div>

                    {showActionForm === 'invoice' ? (
                      <div className="space-y-3 border-t border-purple-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Penerbitan Invoice</span>
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
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <button 
                            onClick={handleInvoiceInput}
                            disabled={actionLoading}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
                          >
                            Terbitkan Invoice
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-slate-500">
                          {transaction.no_invoice && transaction.no_invoice !== '-' 
                            ? `Invoice ${transaction.no_invoice} telah diterbitkan.` 
                            : 'Terbitkan nomor invoice setelah persetujuan Backcharge diselesaikan.'}
                        </p>
                        <div className="flex items-center space-x-2 shrink-0">
                          {(!transaction.no_invoice || transaction.no_invoice === '-') && isAdmin && (
                            <button 
                              onClick={() => {
                                setModalInvoiceNo('');
                                setShowActionForm('invoice');
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer"
                            >
                              Input No Invoice
                            </button>
                          )}
                          {transaction.no_invoice && transaction.no_invoice !== '-' && transaction.status_payment === 'Belum Bayar' && isAdmin && (
                            <button 
                              onClick={() => setShowActionForm('paid')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer"
                            >
                              💰 Set Status Lunas
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {showActionForm === 'paid' && (
                      <div className="space-y-3 border-t border-emerald-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Konfirmasi Pelunasan</span>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">Batal</button>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block text-slate-600 font-semibold mb-1">Tanggal Bayar Customer <span className="text-rose-500">*</span></label>
                            <input 
                              type="date"
                              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={modalPaymentDate}
                              onChange={(e) => setModalPaymentDate(e.target.value)}
                            />
                          </div>
                          <button 
                            onClick={handleSetPaid}
                            disabled={actionLoading || !modalPaymentDate}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
                          >
                            Konfirmasi Lunas
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* NO ACTIONABLE AUTHORITY MESSAGE */}
                {!(isSales || isBro || isAdminView) &&
                 !((isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||
                   (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan')) ||
                   hasRole(currentUser.role, 'Administrator')) &&
                 !isAdminView && (
                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-slate-600">
                      ℹ️ Peran Anda (<strong>{currentUser.role}</strong>) tidak memiliki tindakan otoritas langsung pada alur kategori {transaction.category} ini.
                    </p>
                  </div>
                )}

              </div>

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
                      {appsScriptActive
                        ? "Pilih foto bukti serah terima. Berkas akan otomatis diunggah ke Google Drive Anda via Google Apps Script secara instan."
                        : serviceAccountActive
                        ? "Pilih foto bukti serah terima. Berkas akan otomatis diunggah ke Google Drive Perusahaan via Service Account secara instan."
                        : googleToken 
                        ? "Pilih foto bukti serah terima. Berkas akan otomatis diunggah ke Google Drive Anda secara instan." 
                        : "Unggah foto bukti serah terima berkas penyerahan Backcharge dari Sales kepada Admin Piutang."
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
                              
                              const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;
                              
                              if (isDriveActive) {
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
                          <img src={localHandoverSalesAdminFile} alt="Preview serah terima" loading="lazy" decoding="async" className="object-contain max-h-28" />
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

              {/* ACTION FORM: Serahkan Fisik Berkas & Upload Foto Serah Terima */}
              {showActionForm === 'handover_courier' && (
                <div className="space-y-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 font-sans">
                      Form Serah Terima Fisik Berkas &amp; Dokumen Lampiran
                    </span>
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
                      Lengkapi unggahan dokumen lampiran dan foto bukti penyerahan berkas Backcharge dari ASO kepada Admin.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Tanggal &amp; Waktu Penyerahan (Otomatis)</label>
                        <input 
                          type="text" 
                          value={transaction.tanggal_handover || new Date().toLocaleString('id-ID')} 
                          readOnly 
                          disabled
                          className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl px-3 py-2 font-mono text-[11px] select-none cursor-not-allowed focus:outline-none"
                        />
                      </div>

                      {/* 1. File BAK */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase font-sans">1. File BAK (PDF / Gambar)</label>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-1.5 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                            <span>{localFileBakName ? 'Ubah File BAK' : 'Pilih File BAK'}</span>
                            <input 
                              type="file" 
                              accept="application/pdf,image/*" 
                              disabled={uploadingBak}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLocalFileBakName(file.name);
                                const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;
                                if (isDriveActive) {
                                  setUploadingBak(true);
                                  try {
                                    const driveUrl = await uploadFileToDrive(file, file.name, googleToken);
                                    setLocalFileBak(driveUrl);
                                  } catch (err) {
                                    console.error("Gagal mengunggah ke Drive:", err);
                                    const reader = new FileReader();
                                    reader.onloadend = () => setLocalFileBak(reader.result as string);
                                    reader.readAsDataURL(file);
                                  } finally {
                                    setUploadingBak(false);
                                  }
                                } else {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setLocalFileBak(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden" 
                            />
                          </label>
                          {localFileBak && (
                            <button 
                              type="button" 
                              onClick={() => { setLocalFileBak(null); setLocalFileBakName(''); }}
                              className="p-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {uploadingBak && (
                          <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-600 font-sans">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Mengunggah file ke Google Drive...</span>
                          </div>
                        )}
                        {localFileBakName && (
                          <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-sans">
                            <span className="font-mono truncate flex-grow max-w-[200px]">{localFileBakName}</span>
                            {localFileBak?.startsWith('https://drive.google.com') && (
                              <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[7px] font-black">Google Drive</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Dokumen Pendukung File/Foto */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase font-sans">2. Dokumen Pendukung (File / Foto)</label>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-1.5 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                            <span>{localUploadDokPendukungName ? 'Ubah Dokumen Pendukung' : 'Pilih Dokumen Pendukung'}</span>
                            <input 
                              type="file" 
                              accept="application/pdf,image/*" 
                              disabled={uploadingDokPendukung}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLocalUploadDokPendukungName(file.name);
                                const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;
                                if (isDriveActive) {
                                  setUploadingDokPendukung(true);
                                  try {
                                    const driveUrl = await uploadFileToDrive(file, file.name, googleToken);
                                    setLocalUploadDokPendukung(driveUrl);
                                  } catch (err) {
                                    console.error("Gagal mengunggah ke Drive:", err);
                                    const reader = new FileReader();
                                    reader.onloadend = () => setLocalUploadDokPendukung(reader.result as string);
                                    reader.readAsDataURL(file);
                                  } finally {
                                    setUploadingDokPendukung(false);
                                  }
                                } else {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setLocalUploadDokPendukung(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden" 
                            />
                          </label>
                          {localUploadDokPendukung && (
                            <button 
                              type="button" 
                              onClick={() => { setLocalUploadDokPendukung(null); setLocalUploadDokPendukungName(''); }}
                              className="p-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {uploadingDokPendukung && (
                          <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-600 font-sans">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Mengunggah file ke Google Drive...</span>
                          </div>
                        )}
                        {localUploadDokPendukungName && (
                          <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-sans">
                            <span className="font-mono truncate flex-grow max-w-[200px]">{localUploadDokPendukungName}</span>
                            {localUploadDokPendukung?.startsWith('https://drive.google.com') && (
                              <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[7px] font-black">Google Drive</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Dokumen Pendukung & Alasan Konfirmasi Dokumen Sah */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase font-sans">Dokumen Pendukung &amp; Alasan Konfirmasi Dokumen Sah</label>
                        <textarea 
                          value={localDokPendukungAlasan}
                          onChange={(e) => setLocalDokPendukungAlasan(e.target.value)}
                          placeholder="Tuliskan detail dokumen pendukung (misal: STNK, Surat Jalan, dll.) beserta penjelasan mengapa dokumen dianggap sah sebagai bukti backcharge..." 
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
                          rows={3}
                        />
                      </div>

                      {/* 4. Foto Bukti Serah Terima (Wajib) */}
                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Pilih File Foto Bukti Serah Terima (Wajib)</label>
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
                                
                                const isDriveActive = googleToken || serviceAccountActive || appsScriptActive;
                                
                                if (isDriveActive) {
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
                            <img src={localHandoverSalesAdminFile} alt="Preview serah terima" loading="lazy" decoding="async" className="object-contain max-h-28" />
                          ) : (
                            <div className="text-center py-2 text-[10px] text-emerald-600 font-bold flex flex-col items-center">
                              <Cloud className="w-6 h-6 mb-1 text-emerald-500" />
                              <span>Berkas Aman Terunggah ke Google Drive</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        if (!localHandoverSalesAdminFile) {
                          alert('Foto bukti serah terima wajib diunggah!');
                          return;
                        }
                        setActionLoading(true);
                        onUpdateStatus(
                          transaction.id,
                          { 
                            file_handover_aso_sales_url: localHandoverSalesAdminFile,
                            file_handover_sales_admin_url: localHandoverSalesAdminFile,
                            status_handover: 'Diserahkan ke Admin',
                            tanggal_handover: transaction.tanggal_handover || new Date().toLocaleString('id-ID'),
                            file_bak_url: localFileBak || transaction.file_bak_url,
                            upload_dok_pendukung: localUploadDokPendukung || transaction.upload_dok_pendukung,
                            dok_pendukung_alasan: localDokPendukungAlasan.trim() || transaction.dok_pendukung_alasan || '-',
                            alasan: localDokPendukungAlasan.trim() || transaction.alasan || '-'
                          },
                          `ASO melengkapi dokumen lampiran dan mengunggah Foto Bukti Serah Terima ASO ke Admin`
                        );
                        setActionLoading(false);
                        setShowActionForm(null);
                        setLocalHandoverSalesAdminFile(null);
                        setLocalHandoverSalesAdminFileName('');
                      }}
                      disabled={actionLoading || uploadingSalesAdmin || uploadingBak || uploadingDokPendukung || !localHandoverSalesAdminFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-bold transition-all shadow font-sans cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <span>📦 Kirim &amp; Serahkan Fisik Berkas</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
            )}
          </div>

        </div>

        </div>

        {/* PRINT ONLY SECTION (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
        <div className={`hidden ${lightboxFile ? 'print:hidden' : 'print:block'} text-slate-900 space-y-6 p-4 font-sans text-xs`}>
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-slate-950 pb-3">
            <div>
              <h1 className="text-lg font-black tracking-tight text-blue-900">PT ADI SARANA ARMADA, Tbk</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Backcharge Management</p>
              <p className="text-[8px] text-slate-400 mt-0.5">Gedung Samudera Kirana, Jl. Yos Sudarso No.88, Sunter Kec. Tj. Priok, Jkt Utara, DKI Jakarta | Cabang: {transaction.branch}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-400 block">DOKUMEN INTEGRASI</span>
              <span className="text-sm font-black font-mono text-slate-950 block">{transaction.id}</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1 py-1">
            <h2 className="text-sm font-black uppercase tracking-wide">BERITA ACARA SERAH TERIMA (BACKCHARGE)</h2>
            <p className="text-[9px] text-slate-500">Ref ID: {transaction.id} | Kategori Transaksi: {transaction.category}</p>
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
                {transaction.category === 'ETLE' && transaction.no_tilang && transaction.no_tilang !== '-' && (
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-extrabold bg-slate-50">Nomor Surat Tilang</td>
                    <td className="p-2 font-mono">{transaction.no_tilang}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor SPK Perbaikan</td>
                  <td className="p-2 font-mono">{transaction.no_spk || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nomor Invoice Resmi</td>
                  <td className="p-2 font-mono font-bold">{transaction.no_invoice || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-extrabold bg-slate-50">Nilai Tuntutan Backcharge (IDR)</td>
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
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">1. Serah Terima</span>
                <span className="font-bold text-slate-900">{transaction.status_handover}</span>
              </div>
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">2. Status SAP</span>
                <span className="font-bold text-slate-900">{transaction.status_sap || '-'}</span>
              </div>
              <div className="border border-slate-200 p-2 rounded bg-slate-50">
                <span className="block text-slate-400 font-extrabold uppercase">3. Pelunasan</span>
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
                <p className="font-extrabold text-slate-400 uppercase">DIVALIDASI OLEH (BRO)</p>
                <div className="border-t border-slate-300 pt-1.5 font-bold">
                  <p className="text-slate-900">BRO</p>
                  <p className="text-slate-400">Cabang {transaction.branch}</p>
                </div>
              </div>
              <div className="space-y-10">
                <p className="font-extrabold text-slate-400 uppercase">DISETUJUI OLEH (ADMIN)</p>
                <div className="border-t border-slate-300 pt-1.5 font-bold">
                  <p className="text-slate-900">ADMIN</p>
                  <p className="text-slate-400">Admin ASSA</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* LIGHTBOX / IN-APP FILE PREVIEW MODAL */}
      {lightboxFile && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 md:p-6 print:absolute print:inset-0 print:bg-white print:text-slate-950 print:p-0 print:flex">
          
          {/* Lightbox Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:hidden">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-extrabold text-white font-sans">{lightboxFile.title}</h4>
            </div>
            <div className="flex items-center space-x-2">
              {lightboxFile.url && (
                <button 
                  onClick={() => downloadFile(
                    lightboxFile.url, 
                    getFormattedFileName(
                      lightboxFile.docName || lightboxFile.title.split(':')[0] || 'Lampiran_Dokumen',
                      transaction,
                      lightboxFile.url
                    ),
                    lightboxFile.title
                  )}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Unduh Berkas Langsung"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Berkas</span>
                </button>
              )}

              {lightboxFile.url && lightboxFile.url.startsWith('http') && (
                <a 
                  href={lightboxFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-1 transition-all cursor-pointer"
                  title="Buka Dokumen di Tab Baru"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Buka di Tab Baru</span>
                </a>
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
          <div className="flex-grow flex items-center justify-center overflow-auto py-6 print:py-0 print:block print:overflow-visible">
            {lightboxFile.url.startsWith('data:image/') ? (
              <img 
                src={lightboxFile.url} 
                alt={lightboxFile.title} 
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-[75vh] object-contain rounded-xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200" 
              />
            ) : lightboxFile.url.startsWith('data:application/pdf') ? (
              <iframe 
                src={lightboxFile.url} 
                className="w-full max-w-4xl h-[75vh] rounded-xl border border-slate-800 bg-white" 
                title="PDF Viewer"
              />
            ) : lightboxFile.url.startsWith('http') ? (
              <div className="w-full max-w-4xl h-[75vh] flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <div className="flex-grow bg-slate-950 relative">
                  <iframe 
                    src={getDrivePreviewUrl(lightboxFile.url)} 
                    className="w-full h-full border-0 bg-white" 
                    title="Google Drive Document Viewer"
                    allow="autoplay"
                  />
                  {/* Floating helpful banner */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 text-slate-300 text-[10px] px-3 py-1.5 rounded-full border border-slate-800 shadow-xl backdrop-blur-sm pointer-events-none text-center font-sans max-w-xs sm:max-w-md font-medium leading-normal">
                    💡 Berkas tersimpan di Google Drive. Jika pratinjau tidak muncul secara otomatis, silakan klik tombol <b>Buka di Tab Baru</b> atau <b>Unduh Berkas</b>.
                  </div>
                </div>
              </div>
            ) : (
              /* Simulated Document Renderer (MOCK_BAK or MOCK_HANDOVER etc) */
              <div className="bg-white text-slate-800 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 font-sans relative">
                
                {/* Download Action Bar on Preview Card */}
                <div className="flex justify-end mb-3 print:hidden">
                  <button
                    onClick={() => downloadFile(
                      lightboxFile.url,
                      getFormattedFileName(
                        lightboxFile.docName || lightboxFile.title.split(':')[0] || 'Lampiran_Dokumen',
                        transaction,
                        lightboxFile.url
                      ),
                      lightboxFile.title
                    )}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Berkas Resmi (Gambar PNG HD)</span>
                  </button>
                </div>

                {/* Watermark Stamp */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none select-none border-4 border-emerald-500/30 text-emerald-500/30 font-black text-4xl md:text-6xl px-6 py-2 uppercase rounded-xl tracking-widest flex items-center justify-center">
                  APPROVED
                </div>

                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h3 className="text-md font-black text-slate-900 tracking-tight uppercase">PT Adi Sarana Armada Tbk</h3>
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
                    Dengan ini dinyatakan secara sah dan sadar mengenai penyerahan berkas Backcharge kecelakaan/pemeliharaan kendaraan operasional cabang ASSA :
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
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Nilai Tuntutan Backcharge</span>
                      <span className="font-bold text-blue-600 mt-0.5 block font-mono">{formatRupiah(transaction.value)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Nomor Polisi Armada</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">{transaction.license_plate}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Tanggal Kejadian</span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block">{formatDateOnly(transaction.tanggal)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Catatan Keterangan</span>
                    <p className="text-[10px] bg-slate-50/50 p-2.5 rounded-lg border border-dashed border-slate-200 text-slate-600 leading-relaxed italic">
                      {lightboxFile.url === 'MOCK_BAK' 
                        ? "Kerusakan fisik armada terkonfirmasi oleh tim surveyor ASO di lapangan. Melakukan klaim pertanggungjawaban asuransi/biaya Backcharge maintenance sesuai ketentuan asuransi nasional ASSA." 
                        : lightboxFile.url === 'MOCK_HANDOVER_ASO_SALES'
                          ? "Foto bukti fisik serah terima dari tim operasional ASO kepada BRO telah diverifikasi. Lembaran dokumen fisik tercatat dalam status aktif."
                          : "Dokumen fisik Backcharge berupa Surat BAK asli, Surat SPK, Estimasi Bengkel, dan surat tilang ETLE telah diserahkan dari unit BRO kepada Admin Piutang dalam kondisi lengkap dan tervalidasi."
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
                      <p className="text-slate-400 font-bold uppercase">Pihak II (BRO)</p>
                      <div className="h-10 flex items-end justify-center">
                        {transaction.id ? (
                          <span className="text-[8px] text-emerald-600 font-mono font-bold border border-emerald-300 px-1 py-0.2 rounded bg-emerald-50">SUBMITTED</span>
                        ) : (
                          <span className="text-[8px] text-slate-300 font-mono italic">PENDING</span>
                        )}
                      </div>
                      <p className="font-black text-slate-700 mt-1 border-t border-slate-200 pt-1">BRO</p>
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
          <div className="text-center text-[10px] text-slate-500 font-semibold border-t border-slate-800 pt-3 print:hidden">
            Pratinjau Sistem Backcharge Terpadu Nasional © 2026. Klik [X] di atas untuk kembali ke detail.
          </div>

        </div>
      )}

    </div>
  );
}
