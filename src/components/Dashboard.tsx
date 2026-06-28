import React, { useState } from 'react';
import { 
  TrendingUp, CheckCircle, Clock, AlertTriangle, BarChart3, Map, 
  Layers, Package, ShieldAlert, ArrowRight, DollarSign, Award,
  Users, Activity, Calendar, Download, Eye, FileSpreadsheet, Search
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { Backcharge, BackchargeCategory, Profile, UserRole } from '../types';

interface DashboardProps {
  transactions: Backcharge[];
  currentUser?: Profile;
  onSelectTransaction?: (id: string) => void;
}

export default function Dashboard({ transactions, currentUser, onSelectTransaction }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // 1. Calculate general stats
  const totalCount = transactions.length;
  
  let lunasCount = 0;
  let lunasValue = 0;
  
  let pendingCount = 0;
  let pendingValue = 0;
  
  let rejectCount = 0;
  let rejectValue = 0;

  // Pipeline stage counters
  let stage1Confirm = 0;   // Pending Sales Confirm
  let stage2Sap = 0;       // Pending Sales Head SAP status
  let stage3Handover = 0;  // Pending Physical Handover (BRO)
  let stage4Invoice = 0;   // Pending Invoice issuing
  let stage5Payment = 0;   // Pending Customer Payment

  // Category counts & values
  const categoryStats: Record<BackchargeCategory, { count: number; value: number }> = {
    'Own Risk': { count: 0, value: 0 },
    'Maintenance': { count: 0, value: 0 },
    'Ekspedisi': { count: 0, value: 0 },
    'ETLE': { count: 0, value: 0 },
    'TPL': { count: 0, value: 0 }
  };

  // Branch statistics
  const branchList = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar', 'Balikpapan', 'Bali', 'Solo', 'Semarang'];
  const branchStats: Record<string, { total: number; value: number; resolved: number; pending: number }> = {};
  
  branchList.forEach(branch => {
    branchStats[branch] = { total: 0, value: 0, resolved: 0, pending: 0 };
  });

  // Today's transaction tracking
  const todayStr = new Date().toISOString().split('T')[0];
  let todayCount = 0;
  let todayValue = 0;

  transactions.forEach(t => {
    const val = Number(t.value) || 0;
    const cat = t.category;

    // Track Category counts
    if (categoryStats[cat]) {
      categoryStats[cat].count++;
      categoryStats[cat].value += val;
    }

    // Track Branch stats
    const branchName = t.branch;
    if (branchStats[branchName]) {
      branchStats[branchName].total++;
      branchStats[branchName].value += val;
      if (t.status_payment === 'Lunas') {
        branchStats[branchName].resolved++;
      } else {
        branchStats[branchName].pending++;
      }
    } else {
      branchStats[branchName] = { 
        total: 1, 
        value: val, 
        resolved: t.status_payment === 'Lunas' ? 1 : 0,
        pending: t.status_payment !== 'Lunas' ? 1 : 0
      };
    }

    // Daily metric
    if (t.created_at && t.created_at.startsWith(todayStr)) {
      todayCount++;
      todayValue += val;
    }

    // Classification of status
    if (t.status_payment === 'Lunas') {
      lunasCount++;
      lunasValue += val;
    } else if (t.status_confirm === 'Ditolak / Negosiasi Ulang') {
      rejectCount++;
      rejectValue += val;
    } else {
      pendingCount++;
      pendingValue += val;
    }

    // Pipeline status grouping
    if (t.status_payment !== 'Lunas') {
      if (cat !== 'Ekspedisi' && t.status_confirm === 'Belum Konfirmasi') {
        stage1Confirm++;
      } else if (cat === 'Own Risk' && t.status_confirm === 'Telah Dikonfirmasi' && (t.status_sap === 'N/A' || !t.status_sap)) {
        stage2Sap++;
      } else {
        let isReadyForHandover = false;
        if (cat === 'Own Risk' && t.status_confirm === 'Telah Dikonfirmasi' && t.status_sap && t.status_sap !== 'N/A') {
          isReadyForHandover = true;
        } else if (cat !== 'Own Risk' && cat !== 'Ekspedisi' && t.status_confirm === 'Telah Dikonfirmasi') {
          isReadyForHandover = true;
        } else if (cat === 'Ekspedisi') {
          isReadyForHandover = true;
        }

        if (isReadyForHandover && t.status_handover === 'Pending') {
          stage3Handover++;
        } else if (t.status_handover === 'Diserahkan ke Admin' && (t.no_invoice === '-' || !t.no_invoice)) {
          stage4Invoice++;
        } else if (t.no_invoice && t.no_invoice !== '-' && t.status_payment === 'Belum Bayar') {
          stage5Payment++;
        }
      }
    }
  });

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatShortRupiah = (num: number) => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)} M`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)} Jt`;
    }
    return formatRupiah(num);
  };

  // Recharts Data Formatters
  const categoryChartData = Object.keys(categoryStats).map(cat => ({
    name: cat,
    "Kasus": categoryStats[cat as BackchargeCategory].count,
    "Nilai (Juta)": Math.round(categoryStats[cat as BackchargeCategory].value / 1_000_000),
    "Nilai Asli": categoryStats[cat as BackchargeCategory].value,
  }));

  const pipelineChartData = [
    { stage: '1. Konfirmasi', 'Jumlah Kasus': stage1Confirm, fill: '#3b82f6' },
    { stage: '2. ERP SAP', 'Jumlah Kasus': stage2Sap, fill: '#8b5cf6' },
    { stage: '3. Serah Terima', 'Jumlah Kasus': stage3Handover, fill: '#f59e0b' },
    { stage: '4. Invoice', 'Jumlah Kasus': stage4Invoice, fill: '#6366f1' },
    { stage: '5. Penagihan', 'Jumlah Kasus': stage5Payment, fill: '#f43f5e' },
  ];

  const statusPieData = [
    { name: 'Lunas / Selesai', value: lunasCount, color: '#10b981' },
    { name: 'Sedang Berjalan', value: pendingCount, color: '#3b82f6' },
    { name: 'Ditolak / Nego', value: rejectCount, color: '#f43f5e' }
  ].filter(d => d.value > 0);

  // Filtered recent cases for quick executive review
  const urgentTransactions = transactions
    .filter(t => {
      const matchSearch = t.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.branch.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
      return matchSearch && matchCategory;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* 1. EXECUTIVE WELCOME BANNER WITH DYNAMIC GLOW */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-2xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-indigo-500/30 tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                PT Adi Sarana Armada, Tbk - Executive Portal
              </span>
              <span className="bg-slate-800 text-slate-300 text-[9px] font-mono font-bold px-2 py-1 rounded-md">
                Cabang: {currentUser?.branch || 'Nasional'}
              </span>
              <span className="bg-indigo-600/30 text-indigo-200 text-[9px] font-mono font-bold px-2 py-1 rounded-md">
                Role: {currentUser?.role || 'Guest'}
              </span>
            </div>
            <h2 className="text-xl md:text-3xl font-black tracking-tight font-sans">
              Dashboard Pemantauan Progres & Piutang Denda
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed font-sans">
              Halo, <span className="font-extrabold text-blue-400">{currentUser?.full_name || 'Rekan Kerja'}</span>. 
              Data disinkronkan secara real-time dari database pusat Supabase untuk memantau progress denda denda, koordinasi antardepartemen, dan penyelesaian invoice cabang Sosro secara nasional di wilayah <span className="underline font-bold text-emerald-400">{currentUser?.branch || 'Nasional'}</span>.
            </p>

            {/* Custom Role Checklist */}
            <div className="pt-3 border-t border-slate-800/80">
              <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                Rekomendasi Tindakan (Berdasarkan Peran Anda):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentUser?.role === 'ASO / Staff' && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Input Berkas Baru & Unggah</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Unggah berkas fisik atau sematkan Link Google Drive agar database tidak penuh.</p>
                    </div>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">2. Serahkan Fisik ke Sales</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Dapatkan persetujuan basah dan minta Sales merubah status konfirmasi.</p>
                    </div>
                  </>
                )}
                {currentUser?.role === 'Sales / Sales Head' && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Validasi Persetujuan Denda</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Periksa data tertunda di kota Anda dan ganti status ke "Telah Dikonfirmasi".</p>
                    </div>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">2. Serah Terima ke Admin Pusat</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Kirim berkas basah ke Admin Keuangan agar nomor invoice dapat diterbitkan.</p>
                    </div>
                  </>
                )}
                {currentUser?.role === 'BRO' && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Pengecekan Fisik Lapangan</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Cocokkan nomor polis kendaraan denda dengan kondisi unit real di lapangan.</p>
                    </div>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">2. Bantu Dokumen Maintenance</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Lengkapi lampiran SPK perbaikan unit untuk klaim Own Risk / TPL.</p>
                    </div>
                  </>
                )}
                {currentUser?.role === 'Admin' && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Terbitkan & Input Invoice</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Input nomor invoice untuk data berstatus "Diserahkan ke Admin".</p>
                    </div>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">2. Rekonsiliasi Pelunasan</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Verifikasi pembayaran dari customer lalu ubah denda menjadi "Lunas".</p>
                    </div>
                  </>
                )}
                {currentUser?.role === 'Administrator' && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Monitor Log Audit Trail</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Gunakan tab Audit Trail untuk memantau integritas data operasional.</p>
                    </div>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">2. Kelola Operator Cabang</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Ubah hak akses dan registrasi operator baru jika terjadi perpindahan cabang.</p>
                    </div>
                  </>
                )}
                {!currentUser?.role && (
                  <>
                    <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <p className="text-xs font-bold text-slate-200">1. Monitoring Umum</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Pantau diagram performa nasional dan grafik tagihan outstanding.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Realtime Stats Badges */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
            <div className="bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <div className="w-9 h-9 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Input Hari Ini</p>
                <p className="text-sm font-black text-slate-100 mt-0.5">{todayCount} Berkas</p>
              </div>
            </div>
            
            <div className="bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <div className="w-9 h-9 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Nilai Hari Ini</p>
                <p className="text-sm font-black text-emerald-400 mt-0.5">{formatShortRupiah(todayValue)}</p>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center font-mono text-[10px] font-black">
                {currentUser?.branch === 'Nasional' ? 'ALL' : currentUser?.branch.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Cakupan Wilayah</p>
                <p className="text-sm font-black text-blue-400 mt-0.5 truncate">{currentUser?.branch || 'Nasional'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC CARD CAROUSEL/GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI CARD: TOTAL CASELOAD */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Total Volume Denda</p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-1.5">{totalCount}</h3>
              <div className="flex items-center space-x-1 mt-2">
                <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-full">Nasional</span>
                <span className="text-[9px] text-slate-400 font-bold">Seluruh Cabang</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* KPI CARD: TOTAL COLLECTED (LUNAS) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Total Dana Selesai (Lunas)</p>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-600 mt-1.5">{formatShortRupiah(lunasValue)}</h3>
              <div className="flex items-center space-x-1.5 mt-2">
                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  {lunasCount} Kasus Lunas
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {totalCount > 0 ? Math.round((lunasCount / totalCount) * 100) : 0}% Rasio
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* KPI CARD: TOTAL ACTIVE PROCESS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Dana outstanding aktif</p>
              <h3 className="text-2xl md:text-3xl font-black text-amber-600 mt-1.5">{formatShortRupiah(pendingValue)}</h3>
              <div className="flex items-center space-x-1.5 mt-2">
                <span className="text-[10px] text-amber-700 font-extrabold bg-amber-50 px-2 py-0.5 rounded-full">
                  {pendingCount} Dokumen Aktif
                </span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* KPI CARD: REJECTED / NEEDS ATTENTION */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50/50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Ditolak / Perlu Nego</p>
              <h3 className="text-2xl md:text-3xl font-black text-rose-600 mt-1.5">{formatShortRupiah(rejectValue)}</h3>
              <div className="flex items-center space-x-1.5 mt-2">
                <span className="text-[10px] text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded-full">
                  {rejectCount} Butuh Atensi
                </span>
              </div>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

      </div>

      {/* 3. CORE MANAGEMENT VISUALIZATIONS SECTION (RECHARTS CHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART 1: FINANCES AREA TREND (LEFT) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 lg:col-span-8">
          <div className="flex justify-between items-start pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Tren Nilai Finansial Backcharge Berdasarkan Kategori
              </h3>
              <p className="text-[11px] text-slate-400">Representasi total nominal denda dalam Rupiah (Juta) per kategori operasional.</p>
            </div>
            <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-full font-extrabold text-slate-600 uppercase">
              Financial Trend
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} stroke="#e2e8f0" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#e2e8f0" unit=" Jt" />
                <Tooltip 
                  formatter={(value: any) => [`${value} Juta IDR`, 'Total Tagihan']}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="Nilai (Juta)" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: BOTTLENECK WORKFLOW DISTRIBUTION (RIGHT) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Siklus Berkas Aktif
                </h3>
                <p className="text-[11px] text-slate-400">Sebaran berkas denda yang masih berproses.</p>
              </div>
            </div>

            <div className="h-56 w-full pt-4 flex items-center justify-center">
              {totalCount > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-slate-400 italic text-xs">Belum ada data visualisasi</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {statusPieData.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-slate-600">{entry.name}</span>
                </div>
                <span className="text-slate-900">{entry.value} Kasus ({Math.round((entry.value / totalCount) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. WORKFLOW PIPELINE FLOW & BOTTLENECK ANALYSIS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Workflow Pipeline & Bottleneck Analysis
            </h3>
            <p className="text-[11px] text-slate-400">Distribusi berkas denda (BAK) yang saat ini tertahan di setiap fase koordinasi untuk diakselerasi.</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold px-2.5 py-1 rounded-full">
            Proses Aktif
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {pipelineChartData.map((step, idx) => {
            const sumTotal = stage1Confirm + stage2Sap + stage3Handover + stage4Invoice + stage5Payment;
            const percentage = sumTotal > 0 ? Math.round((step['Jumlah Kasus'] / sumTotal) * 100) : 0;
            return (
              <div 
                key={idx} 
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between hover:scale-[1.02] hover:shadow-sm duration-200 relative overflow-hidden"
              >
                {/* Visual Accent Top line */}
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: step.fill }}></div>
                
                <div className="space-y-1 mt-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{step.stage}</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-slate-800">{step['Jumlah Kasus']}</span>
                    <span className="text-[10px] text-slate-400 font-bold">kasus</span>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                  <span>Kontribusi Bottleneck:</span>
                  <span className="font-extrabold" style={{ color: step.fill }}>{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. REGIONAL PERFORMANCE & BRANCH COORDINATION TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REGIONAL TABLE (LEFT - 7 COLS) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 lg:col-span-7">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Map className="w-4 h-4 text-indigo-600" />
                Matriks Performa & Otoritas Cabang Regional
              </h3>
              <p className="text-[11px] text-slate-400">Rekapitulasi total kasus denda, tagihan, dan persentase penyelesaian lunas di tiap cabang Sosro.</p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold px-3 py-1 rounded-full">
              {branchList.length} Regional
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                  <th className="p-3">Cabang Kota</th>
                  <th className="p-3 text-center">Total Kasus</th>
                  <th className="p-3">Total Tagihan</th>
                  <th className="p-3">Selesai vs Aktif</th>
                  <th className="p-3 text-right">Rasio Pelunasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {Object.keys(branchStats)
                  .filter(branch => branchStats[branch].total > 0)
                  .map(branch => {
                    const stats = branchStats[branch];
                    const lunasPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
                    return (
                      <tr key={branch} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-800 flex items-center space-x-2">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono">
                            {branch.substring(0,3).toUpperCase()}
                          </span>
                          <span className="font-extrabold">{branch}</span>
                        </td>
                        <td className="p-3 text-center text-slate-600">{stats.total}</td>
                        <td className="p-3 text-slate-950 font-mono font-bold">{formatRupiah(stats.value)}</td>
                        <td className="p-3">
                          <span className="text-[10px] text-slate-500 font-medium">
                            <span className="text-emerald-600 font-extrabold">{stats.resolved}</span> / <span className="text-amber-500 font-extrabold">{stats.pending}</span>
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end space-x-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${lunasPct}%` }}></div>
                            </div>
                            <span className="text-[10px] text-emerald-600 font-black font-mono w-8 text-right">{lunasPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT URGENT TRANSACTIONS GRID (RIGHT - 5 COLS) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 lg:col-span-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Review Cepat Dokumen Urgent
                </h3>
                <p className="text-[11px] text-slate-400">Pencarian kilat & klik untuk memeriksa detail dokumen penyerahan secara mendalam.</p>
              </div>
            </div>

            {/* Quick Search Widget */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Cari Mitra / Kota / No Dokumen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* List of Filtered Items */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {urgentTransactions.map((t) => {
                let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                if (t.status_payment === 'Lunas') {
                  badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (t.status_confirm === 'Ditolak / Negosiasi Ulang') {
                  badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                }

                return (
                  <div 
                    key={t.id}
                    onClick={() => onSelectTransaction?.(t.id)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[9px] font-mono text-slate-400 truncate">{t.id}</span>
                        <span className="text-[8px] font-black uppercase text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                          {t.branch}
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-800 truncate mt-0.5 group-hover:text-indigo-600 transition-colors">
                        {t.customer_name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-bold">{formatRupiah(t.value)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {t.status_payment === 'Lunas' ? 'LUNAS' : t.status_confirm === 'Ditolak / Negosiasi Ulang' ? 'DITOLAK' : 'PROSES'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
              {urgentTransactions.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada denda yang sesuai filter pencarian.</p>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/30 font-semibold mt-4">
            💡 <strong>Saran Manajemen:</strong> Klik baris di atas untuk langsung membuka panel Otoritas Dokumen dan mempercepat persetujuan.
          </div>
        </div>

      </div>

    </div>
  );
}
