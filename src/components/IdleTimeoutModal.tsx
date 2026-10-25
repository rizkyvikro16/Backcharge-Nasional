import React from 'react';
import { Clock, ShieldAlert, ArrowRight, LogOut } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export default function IdleTimeoutModal({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout
}: IdleTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Icon */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0 animate-pulse">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Peringatan Sesi Tidak Aktif</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Keamanan Akun Backcharge Nasional</p>
          </div>
        </div>

        {/* Security Notification */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mb-5 text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Tidak Ada Aktivitas Selama 58 Menit</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Demi melindungi data dan mencegah akses tanpa izin, sesi Anda akan otomatis diakhiri dalam:
          </p>
          
          {/* Large Countdown Display */}
          <div className="py-2 flex items-center justify-center">
            <div className="bg-white border-2 border-amber-400 rounded-2xl px-6 py-2.5 shadow-sm text-center">
              <span className="font-mono text-3xl font-black text-amber-600 tracking-wider">
                {formattedTime}
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                Menit : Detik
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Keluar Sekarang</span>
          </button>
          
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="flex-1 px-4 py-3 bg-slate-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            <span>Lanjutkan Sesi</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 mt-4">
          Menggerakkan kursor mouse atau mengetik akan otomatis memperpanjang sesi Anda selama 1 jam ke depan.
        </p>
      </div>
    </div>
  );
}
