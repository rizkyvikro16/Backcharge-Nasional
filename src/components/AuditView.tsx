import React, { useState } from 'react';
import { Search, Clock, FileText, User, Info } from 'lucide-react';
import { ActivityLog } from '../types';

interface AuditViewProps {
  logs: ActivityLog[];
}

export default function AuditView({ logs }: AuditViewProps) {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    return log.transaction_id.toLowerCase().includes(q) || 
           log.performed_by.toLowerCase().includes(q) || 
           log.action_description.toLowerCase().includes(q);
  });

  const formatDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.getFullYear() + "-" + 
             ("0" + (d.getMonth() + 1)).slice(-2) + "-" + 
             ("0" + d.getDate()).slice(-2) + " " + 
             ("0" + d.getHours()).slice(-2) + ":" + 
             ("0" + d.getMinutes()).slice(-2) + ":" + 
             ("0" + d.getSeconds()).slice(-2);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative flex-grow max-w-md w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari log ID, pelaku denda, rincian aktivitas..." 
            className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center space-x-1.5 flex-shrink-0">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>Maksimal 300 aktivitas log denda mutakhir</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3 w-36">Timestamp</th>
                <th className="p-3 w-28">ID Transaksi</th>
                <th className="p-3 w-48">Eksekutor</th>
                <th className="p-3">Detail Kegiatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 border-b border-slate-100">
                  <td className="p-3 text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatDateStr(log.timestamp)}</span>
                    </span>
                  </td>
                  <td className="p-3 text-blue-600 font-extrabold">{log.transaction_id}</td>
                  <td className="p-3 text-slate-900 font-extrabold">
                    <span className="flex items-center space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-600 border font-black">
                        {log.performed_by ? log.performed_by.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="truncate max-w-[150px]" title={log.performed_by}>{log.performed_by}</span>
                    </span>
                  </td>
                  <td className="p-3 text-slate-800 font-semibold leading-relaxed">
                    {log.action_description}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                    Belum ada aktivitas log audit nasional tercatat matching kriteria Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
