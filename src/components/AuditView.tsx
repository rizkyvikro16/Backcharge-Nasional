import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Clock, User, Info, Filter, X, Calendar, 
  RefreshCw, Download, ChevronLeft, ChevronRight, 
  ShieldCheck, FileText, CheckCircle2, AlertCircle, ArrowUpDown, Database
} from 'lucide-react';
import { ActivityLog, Profile } from '../types';
import { getApiUrl, getAuthHeaders } from '../lib/api';

interface AuditViewProps {
  logs: ActivityLog[];
  profiles?: Profile[];
  currentUser?: Profile;
  onRefreshLogs?: () => Promise<void>;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ACTION_CATEGORIES = [
  { id: 'ALL', label: 'Semua Kategori Aksi' },
  { id: 'APPROVAL', label: 'Approval (Disetujui / Ditolak)' },
  { id: 'SAP', label: 'Status SAP (Bill / Not Bill)' },
  { id: 'HANDOVER', label: 'Serah Terima Berkas' },
  { id: 'PAYMENT', label: 'Invoice & Pelunasan' },
  { id: 'BULK', label: 'Update Status Massal' },
  { id: 'CREATE', label: 'Pembuatan Transaksi Baru' },
  { id: 'DELETE', label: 'Penghapusan Transaksi' },
  { id: 'AUTH', label: 'Autentikasi & Kata Sandi' }
];

export default function AuditView({ logs, profiles = [], currentUser, onRefreshLogs, addToast }: AuditViewProps) {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [txIdFilter, setTxIdFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Server-side deep search state
  const [isServerSearching, setIsServerSearching] = useState(false);
  const [serverLogs, setServerLogs] = useState<ActivityLog[] | null>(null);

  // Extracted unique performers from logs & profiles for quick dropdown filter
  const uniquePerformers = useMemo(() => {
    const map = new Map<string, { email: string; name: string; role: string }>();
    
    // Add known profiles first
    profiles.forEach(p => {
      if (p.email) {
        map.set(p.email.toLowerCase(), {
          email: p.email,
          name: p.full_name || p.email,
          role: p.role || '-'
        });
      }
    });

    // Add unique performers from local logs
    logs.forEach(l => {
      if (l.performed_by && !map.has(l.performed_by.toLowerCase())) {
        map.set(l.performed_by.toLowerCase(), {
          email: l.performed_by,
          name: l.performed_by,
          role: '-'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, profiles]);

  // Combined active dataset (server search results or local props logs)
  const activeLogs = serverLogs || logs;

  // Filter application
  const filteredLogs = useMemo(() => {
    return activeLogs.filter(log => {
      const q = searchTerm.toLowerCase().trim();
      const performedBy = (log.performed_by || '').toLowerCase();
      const txId = (log.transaction_id || '').toLowerCase();
      const desc = (log.action_description || '').toLowerCase();
      const timeStr = (log.timestamp || '').split('T')[0];

      // 1. Transaction ID Filter
      if (txIdFilter.trim()) {
        const cleanTx = txIdFilter.toLowerCase().trim();
        if (!txId.includes(cleanTx)) return false;
      }

      // 2. User / Performer Filter
      if (userFilter.trim()) {
        const cleanUser = userFilter.toLowerCase().trim();
        if (!performedBy.includes(cleanUser)) {
          const profile = profiles.find(p => p.email && p.email.toLowerCase() === performedBy);
          const fullName = (profile?.full_name || '').toLowerCase();
          if (!fullName.includes(cleanUser)) return false;
        }
      }

      // 3. Date Range Filter
      if (startDate && timeStr) {
        if (timeStr < startDate) return false;
      }
      if (endDate && timeStr) {
        if (timeStr > endDate) return false;
      }

      // 4. Action Category Filter
      if (categoryFilter !== 'ALL') {
        switch (categoryFilter) {
          case 'APPROVAL':
            if (!desc.includes('approv') && !desc.includes('setujui') && !desc.includes('tolak')) return false;
            break;
          case 'SAP':
            if (!desc.includes('sap') && !desc.includes('bill')) return false;
            break;
          case 'HANDOVER':
            if (!desc.includes('serah') && !desc.includes('terima') && !desc.includes('berkas')) return false;
            break;
          case 'PAYMENT':
            if (!desc.includes('lunas') && !desc.includes('bayar') && !desc.includes('invoice')) return false;
            break;
          case 'BULK':
            if (!desc.includes('massal') && !desc.includes('bulk')) return false;
            break;
          case 'CREATE':
            if (!desc.includes('membuat') && !desc.includes('baru') && !desc.includes('insert') && !desc.includes('impor')) return false;
            break;
          case 'DELETE':
            if (!desc.includes('hapus') && !desc.includes('delete')) return false;
            break;
          case 'AUTH':
            if (!txId.includes('auth') && !desc.includes('login') && !desc.includes('sandi') && !desc.includes('masuk')) return false;
            break;
          default:
            break;
        }
      }

      // 5. Keyword search (Desc, User, Tx, Profile name, Role, Branch)
      if (q) {
        const profile = profiles.find(p => p.email && p.email.toLowerCase() === performedBy);
        const fullName = (profile?.full_name || '').toLowerCase();
        const role = (profile?.role || '').toLowerCase();
        const branch = (profile?.branch || '').toLowerCase();

        const match = txId.includes(q) || 
                      performedBy.includes(q) || 
                      desc.includes(q) ||
                      fullName.includes(q) ||
                      role.includes(q) ||
                      branch.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [activeLogs, searchTerm, txIdFilter, userFilter, startDate, endDate, categoryFilter, profiles]);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, txIdFilter, userFilter, startDate, endDate, categoryFilter, pageSize]);

  // Paginated view
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Deep search directly against Cloudflare D1 (10,000+ entries)
  const handleDeepServerSearch = async () => {
    setIsServerSearching(true);
    try {
      const response = await fetch(getApiUrl('/api/d1/execute'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          operationId: 'get_activity_logs',
          limit: 1000,
          search: searchTerm || undefined,
          transactionId: txIdFilter || undefined,
          performedBy: userFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.results)) {
        setServerLogs(resData.results);
        if (addToast) {
          addToast(`Pencarian mendalam D1 selesai: Ditemukan ${resData.results.length} log audit relevan dari database Cloudflare.`, 'success');
        }
      } else {
        throw new Error(resData.error || 'Format data respon tidak valid');
      }
    } catch (err: any) {
      console.error('Server search error:', err);
      if (addToast) {
        addToast(`Pencarian D1 dialihkan ke cache lokal: ${err.message}`, 'info');
      }
    } finally {
      setIsServerSearching(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setTxIdFilter('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
    setCategoryFilter('ALL');
    setServerLogs(null);
    setCurrentPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (txIdFilter.trim()) count++;
    if (userFilter.trim()) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (categoryFilter !== 'ALL') count++;
    return count;
  }, [searchTerm, txIdFilter, userFilter, startDate, endDate, categoryFilter]);

  const formatDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // CSV Export for filtered audit trail
  const handleExportAuditCsv = () => {
    if (filteredLogs.length === 0) return;
    const header = ['ID Log', 'Timestamp', 'ID Transaksi', 'Nama Pengguna', 'Email Eksekutor', 'Role', 'Cabang', 'Detail Kegiatan'];
    const rows = filteredLogs.map(log => {
      const p = profiles.find(pr => pr.email && log.performed_by && pr.email.toLowerCase() === log.performed_by.toLowerCase());
      return [
        log.id || '-',
        log.timestamp || '-',
        log.transaction_id || '-',
        p?.full_name || '-',
        log.performed_by || '-',
        p?.role || '-',
        p?.branch || '-',
        `"${(log.action_description || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Trail_ASSA_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast(`Berhasil mengunduh ${filteredLogs.length} riwayat log audit!`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Header Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Audit Trail &amp; Rekam Jejak Sistem
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full border border-emerald-400/30">
                  Real-time D1 Indexed
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Pencarian instan riwayat perubahan status, otorisasi approval, dan modifikasi data transaksi nasional (10.000+ entri).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDeepServerSearch}
            disabled={isServerSearching}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Cari riwayat mendalam langsung ke server database Cloudflare D1"
          >
            {isServerSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            <span>{isServerSearching ? 'Mencari di D1...' : 'Query Database D1'}</span>
          </button>

          <button
            onClick={handleExportAuditCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Ekspor hasil filter audit log ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Filter Pencarian Spesifik Log Audit
            </h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full">
                {activeFilterCount} Aktif
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset Semua Filter</span>
              </button>
            )}
            <span className="text-[11px] text-slate-400 font-medium">
              Menampilkan <span className="font-bold text-slate-800">{filteredLogs.length}</span> dari <span className="font-bold text-slate-800">{activeLogs.length}</span> log
            </span>
          </div>
        </div>

        {/* 4-Column Grid Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Keyword search */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Kata Kunci / Kegiatan
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari rincian aksi atau detail..."
                className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* 2. Specific Transaction ID Filter */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              ID Transaksi Spesifik
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                <FileText className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={txIdFilter}
                onChange={(e) => setTxIdFilter(e.target.value)}
                placeholder="Contoh: BC-2026-0001"
                className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800 uppercase"
              />
            </div>
          </div>

          {/* 3. Performer / User Filter */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Nama Pengguna / Pelaku
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                <User className="w-3.5 h-3.5" />
              </span>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 cursor-pointer"
              >
                <option value="">-- Semua Pengguna --</option>
                {uniquePerformers.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name} {p.role !== '-' ? `(${p.role})` : `(${p.email})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Action Category Filter */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Kategori Tindakan
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 cursor-pointer"
            >
              {ACTION_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Sub-Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex items-center gap-2 flex-grow">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
              Rentang Tanggal:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 font-bold text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Server Search Trigger button on mobile / quick action */}
          <button
            onClick={handleDeepServerSearch}
            disabled={isServerSearching}
            className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isServerSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Terapkan Pencarian</span>
          </button>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Filter Aktif:</span>
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10.5px] font-bold">
                Kata Kunci: "{searchTerm}"
                <X className="w-3 h-3 cursor-pointer hover:text-indigo-900" onClick={() => setSearchTerm('')} />
              </span>
            )}
            {txIdFilter.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[10.5px] font-mono font-bold">
                ID: {txIdFilter.toUpperCase()}
                <X className="w-3 h-3 cursor-pointer hover:text-blue-900" onClick={() => setTxIdFilter('')} />
              </span>
            )}
            {userFilter.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[10.5px] font-bold">
                Pengguna: {userFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-purple-900" onClick={() => setUserFilter('')} />
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10.5px] font-bold">
                Kategori: {categoryFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-emerald-900" onClick={() => setCategoryFilter('ALL')} />
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-[10.5px] font-bold">
                Tanggal: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
                <X className="w-3 h-3 cursor-pointer hover:text-amber-950" onClick={() => { setStartDate(''); setEndDate(''); }} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black uppercase text-[10.5px] tracking-wider">
                <th className="py-3 px-4 w-44">Waktu (WIB)</th>
                <th className="py-3 px-3 w-36">ID Transaksi</th>
                <th className="py-3 px-4 w-64">Nama &amp; Jabatan Eksekutor</th>
                <th className="py-3 px-4">Detail Kegiatan / Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {paginatedLogs.map((log) => {
                const profile = profiles.find(p => p.email && log.performed_by && p.email.toLowerCase() === log.performed_by.toLowerCase());
                const isAuth = (log.transaction_id || '').startsWith('AUTH');

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Timestamp */}
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateStr(log.timestamp)}</span>
                      </div>
                    </td>

                    {/* 2. Transaction ID */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isAuth ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-mono text-[10px] font-bold">
                          {log.transaction_id}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md font-mono text-[11px] font-black">
                          {log.transaction_id}
                        </span>
                      )}
                    </td>

                    {/* 3. User & Profile */}
                    <td className="py-3 px-4">
                      {profile ? (
                        <div className="space-y-0.5">
                          <div className="text-slate-900 font-bold flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0">
                              {profile.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[200px]" title={profile.full_name}>
                              {profile.full_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500 font-medium pl-6.5">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-bold uppercase text-[9.5px]">
                              {profile.role}
                            </span>
                            <span>•</span>
                            <span>{profile.branch === 'Nasional' ? 'Pusat' : profile.branch}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-800 font-bold flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black shrink-0">
                              {(log.performed_by || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[200px] text-[11px]" title={log.performed_by}>
                              {log.performed_by || 'Sistem Otomatis'}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 4. Action Description */}
                    <td className="py-3 px-4 text-slate-800 text-[11.5px] font-medium leading-relaxed">
                      {(() => {
                        const desc = log.action_description || '-';
                        if (desc.includes('Disetujui')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {desc}
                            </span>
                          );
                        }
                        if (desc.includes('Ditolak')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-rose-800 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              {desc}
                            </span>
                          );
                        }
                        return desc;
                      })()}
                    </td>
                  </tr>
                );
              })}

              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-10 h-10 text-slate-200" />
                      <p className="font-bold text-slate-600 text-sm">Tidak ada log aktivitas yang cocok</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Coba sesuaikan kata kunci pencarian, rentang tanggal, atau klik "Reset Semua Filter".
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                        Reset Filter
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer Bar */}
        {totalItems > 0 && (
          <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400">|</span>
              <span>
                Menampilkan <strong className="text-slate-900 font-bold">{((currentPage - 1) * pageSize) + 1}</strong> - <strong className="text-slate-900 font-bold">{Math.min(currentPage * pageSize, totalItems)}</strong> dari <strong className="text-slate-900 font-bold">{totalItems}</strong> log
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Halaman {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
