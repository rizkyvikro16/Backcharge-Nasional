import React, { useState } from 'react';
import { 
  PlusCircle, Search, Filter, Download, FileSpreadsheet, 
  Upload, FileText, Check, AlertCircle, Sparkles, RefreshCw, X, Trash2,
  Cloud, CloudOff, Loader2, Key
} from 'lucide-react';
import { Backcharge, BackchargeCategory, Profile, UserRole } from '../types';
import { initiateGoogleOAuth, checkGoogleToken, logoutGoogleDrive, uploadFileToDrive } from '../lib/googleDrive';

interface DatabaseViewProps {
  transactions: Backcharge[];
  currentUser: Profile;
  onAddTransaction: (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => void;
  onSelectTransaction: (id: string) => void;
  onDeleteTransaction?: (id: string) => void;
}

export default function DatabaseView({ 
  transactions, 
  currentUser, 
  onAddTransaction, 
  onSelectTransaction,
  onDeleteTransaction
}: DatabaseViewProps) {
  
  // Search & filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(currentUser.branch === 'Nasional' ? '' : currentUser.branch);

  // Pagination states
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Form states
  const [category, setCategory] = useState<BackchargeCategory>('Own Risk');
  const [branch, setBranch] = useState(currentUser.branch === 'Nasional' ? 'Jakarta' : currentUser.branch);
  const [noBak, setNoBak] = useState('');
  const [noSpk, setNoSpk] = useState('');
  const [noSap, setNoSap] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [value, setValue] = useState('');

  // Attachment states (Base64 data URLs or Google Drive URLs, and file names)
  const [fileBak, setFileBak] = useState<string | null>(null);
  const [fileBakName, setFileBakName] = useState('');
  const [fileHandoverAsoSales, setFileHandoverAsoSales] = useState<string | null>(null);
  const [fileHandoverAsoSalesName, setFileHandoverAsoSalesName] = useState('');
  const [fileHandoverSalesAdmin, setFileHandoverSalesAdmin] = useState<string | null>(null);
  const [fileHandoverSalesAdminName, setFileHandoverSalesAdminName] = useState('');

  // Google Drive integration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [uploadingToDrive, setUploadingToDrive] = useState<{ [key: string]: boolean }>({});
  const [customClientId, setCustomClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Check token on mount
  React.useEffect(() => {
    const token = checkGoogleToken();
    if (token) {
      setGoogleToken(token);
    }
  }, []);

  // Form error & success states
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Check role permission for writing
  const canWrite = currentUser.role === 'ASO / Staff' || currentUser.role === 'Administrator';

  // Upgraded file change handler with automatic Google Drive upload
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

    if (googleToken) {
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
  }, [search, selectedCategory, selectedBranch, pageSize]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    try {
      onAddTransaction({
        category,
        branch: currentUser.branch === 'Nasional' ? branch : currentUser.branch,
        no_bak: noBak.trim() || '-',
        no_spk: noSpk.trim() || '-',
        no_sap: noSap.trim() || '-',
        customer_name: customerName.trim(),
        license_plate: licensePlate.trim() || '-',
        value: Number(value),
        status_sap: category === 'Own Risk' ? 'N/A' : 'N/A',
        status_confirm: category === 'Ekspedisi' ? 'Telah Dikonfirmasi' : 'Belum Konfirmasi',
        status_handover: 'Pending',
        no_invoice: '-',
        status_payment: 'Belum Bayar',
        file_bak_url: fileBak,
        file_handover_aso_sales_url: fileHandoverAsoSales,
        file_handover_sales_admin_url: fileHandoverSalesAdmin
      });

      // Reset form
      setNoBak('');
      setNoSpk('');
      setNoSap('');
      setCustomerName('');
      setLicensePlate('');
      setValue('');
      setFileBak(null);
      setFileBakName('');
      setFileHandoverAsoSales(null);
      setFileHandoverAsoSalesName('');
      setFileHandoverSalesAdmin(null);
      setFileHandoverSalesAdminName('');
      
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan transaksi.');
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      t.id.toLowerCase().includes(searchLower) || 
      t.customer_name.toLowerCase().includes(searchLower) ||
      t.no_bak.toLowerCase().includes(searchLower) ||
      t.no_invoice.toLowerCase().includes(searchLower);

    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    const matchesBranch = !selectedBranch || t.branch === selectedBranch;

    return matchesSearch && matchesCategory && matchesBranch;
  });

  // Pagination computations
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedTransactions = filteredTransactions.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

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
              <th>Kategori</th>
              <th>Cabang Kota</th>
              <th>No BAK</th>
              <th>No SPK</th>
              <th>No SAP</th>
              <th>Nama Customer</th>
              <th>No Polisi</th>
              <th>Nilai Backcharge (Rp)</th>
              <th>Status SAP</th>
              <th>Status Konfirmasi</th>
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
          <td>${t.category}</td>
          <td>${t.branch}</td>
          <td>${t.no_bak || '-'}</td>
          <td>${t.no_spk || '-'}</td>
          <td>${t.no_sap || '-'}</td>
          <td>${t.customer_name}</td>
          <td style="font-family: monospace;">${t.license_plate || '-'}</td>
          <td class="number">${t.value}</td>
          <td>${t.status_sap || '-'}</td>
          <td>${t.status_confirm}</td>
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
                {['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar', 'Balikpapan', 'Bali', 'Solo', 'Semarang'].map(b => (
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

          {category !== 'Ekspedisi' && category !== 'ETLE' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. BAK (Berita Acara Kerusakan)</label>
              <input 
                type="text" 
                value={noBak}
                onChange={(e) => setNoBak(e.target.value)}
                placeholder="BAK/2026/XI/102" 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

          {category !== 'Own Risk' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                {category === 'Ekspedisi' ? 'No. SPK Ekspedisi' : category === 'ETLE' ? 'No. Surat Tilang' : 'No. SPK (Surat Perintah Kerja)'}
              </label>
              <input 
                type="text" 
                value={noSpk}
                onChange={(e) => setNoSpk(e.target.value)}
                placeholder="SPK-MAINT-492" 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

          {category === 'Own Risk' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Input SAP (Nomor BAK ERP)</label>
              <input 
                type="text" 
                value={noSap}
                onChange={(e) => setNoSap(e.target.value)}
                placeholder="SAP-OR-883" 
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

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

          {category !== 'Ekspedisi' && (
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
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nilai Backcharge (Rp)</label>
            <input 
              type="number" 
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nominal denda" 
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono font-bold"
            />
          </div>

          {/* ATTACHMENT PICKS */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            {/* GOOGLE DRIVE INTEGRATION HEADER */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span>Integrasi Google Drive</span>
                </span>
                {googleToken ? (
                  <span className="text-[8px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full uppercase">Aktif</span>
                ) : (
                  <span className="text-[8px] bg-slate-200 text-slate-600 font-extrabold px-1.5 py-0.5 rounded-full uppercase">Off</span>
                )}
              </div>
              
              <p className="text-[9px] text-slate-500 leading-tight">
                Hubungkan Google Drive agar lampiran berkas terunggah otomatis dan tidak membebani kapasitas database.
              </p>

              {googleToken ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] text-emerald-600 font-bold flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" /> Auto-Upload Aktif
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      logoutGoogleDrive();
                      setGoogleToken(null);
                    }}
                    className="text-[9px] font-bold text-red-600 hover:underline"
                  >
                    Putuskan Koneksi
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        initiateGoogleOAuth();
                      } catch (err: any) {
                        setShowConfig(true);
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5"
                  >
                    <Cloud className="w-3 h-3" />
                    <span>Hubungkan Google Drive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfig(!showConfig)}
                    className="text-[8px] font-bold text-slate-400 hover:text-slate-600 block text-center w-full"
                  >
                    {showConfig ? 'Sembunyikan Panduan ID' : 'Panduan Pengaturan Google Client ID'}
                  </button>
                </div>
              )}

              {showConfig && !googleToken && (
                <div className="pt-2 border-t border-slate-200 space-y-2 text-[9px] text-slate-600 bg-white p-2 rounded-lg">
                  <p className="font-bold font-sans">Langkah Integrasi Otomatis:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-500 font-sans">
                    <li>Buka <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Cloud Console</a>.</li>
                    <li>Aktifkan <strong>Google Drive API</strong>.</li>
                    <li>Buat kredensial <strong>OAuth Client ID</strong> (Web Application).</li>
                    <li>Tambahkan URL Authorized Redirect: <code className="bg-slate-100 p-0.5 rounded font-mono break-all">{window.location.origin}</code></li>
                    <li>Atur Client ID di file <code className="bg-slate-100 p-0.5 rounded font-mono">.env</code> dengan key <code className="font-bold">VITE_GOOGLE_CLIENT_ID</code>.</li>
                  </ol>
                  <div className="space-y-1 pt-1.5 border-t border-slate-100 font-sans">
                    <p className="font-bold">Atau masukkan Client ID Anda secara lokal:</p>
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        placeholder="Client ID..."
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        className="border border-slate-200 rounded px-1.5 py-1 text-[9px] font-mono flex-grow focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customClientId) return alert("Harap masukkan Client ID!");
                          initiateGoogleOAuth(customClientId);
                        }}
                        className="bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold"
                      >
                        Hubungkan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Unggah Lampiran Dokumen</span>
            
            {/* 1. File BAK */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase font-sans">1. File BAK (PDF / Gambar)</label>
              
              <div className="flex items-center space-x-2">
                <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-1.5 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  <span>{fileBakName ? 'Ubah File BAK' : 'Pilih File BAK'}</span>
                  <input 
                    type="file" 
                    accept="application/pdf,image/*" 
                    disabled={uploadingToDrive['bak']}
                    onChange={(e) => handleFileChange(e, setFileBak, setFileBakName, 'bak')}
                    className="hidden" 
                  />
                </label>
                {fileBak && (
                  <button 
                    type="button" 
                    onClick={() => { setFileBak(null); setFileBakName(''); }}
                    className="p-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {uploadingToDrive['bak'] && (
                <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-600 font-sans">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Mengunggah file ke Google Drive Anda...</span>
                </div>
              )}
              
              {fileBakName && (
                <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-sans">
                  <span className="font-mono truncate flex-grow max-w-[200px]">{fileBakName}</span>
                  {fileBak?.startsWith('https://drive.google.com') && (
                    <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[7px] font-black">Google Drive</span>
                  )}
                </div>
              )}
            </div>

            {/* 2. Foto ASO - Sales */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase font-sans">2. Foto Serah Terima ASO ke Sales</label>
              
              <div className="flex items-center space-x-2">
                <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-1.5 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  <span>{fileHandoverAsoSalesName ? 'Ubah Foto' : 'Pilih Foto Serah Terima'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    disabled={uploadingToDrive['handoverAsoSales']}
                    onChange={(e) => handleFileChange(e, setFileHandoverAsoSales, setFileHandoverAsoSalesName, 'handoverAsoSales')}
                    className="hidden" 
                  />
                </label>
                {fileHandoverAsoSales && (
                  <button 
                    type="button" 
                    onClick={() => { setFileHandoverAsoSales(null); setFileHandoverAsoSalesName(''); }}
                    className="p-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {uploadingToDrive['handoverAsoSales'] && (
                <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-600 font-sans">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Mengunggah foto ke Google Drive Anda...</span>
                </div>
              )}

              {fileHandoverAsoSalesName && (
                <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-sans">
                  <span className="font-mono truncate flex-grow max-w-[200px]">{fileHandoverAsoSalesName}</span>
                  {fileHandoverAsoSales?.startsWith('https://drive.google.com') && (
                    <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[7px] font-black">Google Drive</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 animate-pulse hover:animate-none"
          >
            <span>Simpan &amp; Kirim Notifikasi</span>
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: LIST AND FILTER TABLE */}
      <div className={`col-span-1 ${canWrite ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
        
        {/* Filters Panel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 flex-grow">
            {/* Debounced search */}
            <div className="relative flex-grow max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari ID, Customer, No Invoice, BAK..." 
                className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            >
              <option value="">Semua Kategori</option>
              <option value="Own Risk">Own Risk</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Ekspedisi">Ekspedisi</option>
              <option value="ETLE">ETLE</option>
              <option value="TPL">TPL</option>
            </select>

            {currentUser.branch === 'Nasional' && (
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value="">Semua Cabang</option>
                {['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar', 'Balikpapan', 'Bali', 'Solo', 'Semarang'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all flex-shrink-0 cursor-pointer"
            title="Export Spreadsheet Rekap Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Unduh Rekap Excel</span>
          </button>
        </div>

        {/* Database List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-3">ID / Kota</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Denda (Rp)</th>
                  <th className="p-3">Fisik Berkas</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Pembayaran</th>
                  {currentUser.role === 'Administrator' && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {paginatedTransactions.map((t) => {
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
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-100">
                      Belum
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
                        Reject
                      </span>
                    );
                  }

                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => onSelectTransaction(t.id)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-all duration-150 border-b border-slate-100"
                    >
                      <td className="p-3">
                        <p className="font-extrabold text-slate-950">{t.id}</p>
                        <p className="text-[9px] text-slate-400 font-bold">{t.branch}</p>
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
                      {currentUser.role === 'Administrator' && (
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={currentUser.role === 'Administrator' ? 8 : 7} className="p-8 text-center text-slate-400 italic font-medium">
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

    </div>
  );
}
