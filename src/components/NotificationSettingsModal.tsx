import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  Send, 
  FilePlus, 
  RefreshCw, 
  CheckCheck
} from 'lucide-react';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendTestBrowserNotification,
  playNotificationSound,
  triggerHapticVibrate,
  NotificationPermissionStatus
} from '../lib/browserNotification';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onErrorToast
}) => {
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isTesting, setIsTesting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('backcharge_notif_sound') !== 'false';
  });
  const [vibrateEnabled, setVibrateEnabled] = useState<boolean>(() => {
    return localStorage.getItem('backcharge_notif_vibrate') !== 'false';
  });
  const [notifyNewData, setNotifyNewData] = useState<boolean>(() => {
    return localStorage.getItem('backcharge_notif_new_data') !== 'false';
  });
  const [notifyApproval, setNotifyApproval] = useState<boolean>(() => {
    return localStorage.getItem('backcharge_notif_approval') !== 'false';
  });
  const [notifyStatus, setNotifyStatus] = useState<boolean>(() => {
    return localStorage.getItem('backcharge_notif_status') !== 'false';
  });

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermission());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      if (onSuccessToast) onSuccessToast('Izin notifikasi browser & perangkat berhasil diaktifkan!');
      // Trigger a test alert right away so user sees it in action
      sendTestBrowserNotification();
    } else if (res === 'denied') {
      if (onErrorToast) onErrorToast('Izin notifikasi diblokir oleh browser. Silakan aktifkan di Pengaturan Izin Situs browser Anda.');
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      if (soundEnabled) playNotificationSound();
      if (vibrateEnabled) triggerHapticVibrate([200, 100, 200]);
      
      const sent = await sendTestBrowserNotification();
      if (sent) {
        if (onSuccessToast) onSuccessToast('Peringatan uji coba terkirim ke browser & layar notifikasi HP Anda!');
      } else {
        if (onErrorToast) onErrorToast('Gagal mengirim: Izin belum diberikan atau notifikasi diblokir.');
      }
    } catch (err: any) {
      if (onErrorToast) onErrorToast(err.message || 'Gagal mengirim notifikasi');
    } finally {
      setIsTesting(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('backcharge_notif_sound', String(next));
    if (next) playNotificationSound();
  };

  const toggleVibrate = () => {
    const next = !vibrateEnabled;
    setVibrateEnabled(next);
    localStorage.setItem('backcharge_notif_vibrate', String(next));
    if (next) triggerHapticVibrate([150]);
  };

  const toggleNewData = () => {
    const next = !notifyNewData;
    setNotifyNewData(next);
    localStorage.setItem('backcharge_notif_new_data', String(next));
  };

  const toggleApproval = () => {
    const next = !notifyApproval;
    setNotifyApproval(next);
    localStorage.setItem('backcharge_notif_approval', String(next));
  };

  const toggleStatus = () => {
    const next = !notifyStatus;
    setNotifyStatus(next);
    localStorage.setItem('backcharge_notif_status', String(next));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[220] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Bell className="w-5 h-5 text-amber-300 animate-bounce" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Pengaturan Notifikasi Real-Time</h2>
              <p className="text-xs text-blue-100/80 font-medium">Peringatan otomatis di Browser & Layar HP</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Box */}
          <div className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
            permission === 'granted'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : permission === 'denied'
              ? 'bg-red-50/80 border-red-200 text-red-900'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="mt-0.5">
              {permission === 'granted' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : permission === 'denied' ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : (
                <Bell className="w-5 h-5 text-amber-600 animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Status Izin Perangkat</span>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  permission === 'granted'
                    ? 'bg-emerald-600 text-white'
                    : permission === 'denied'
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}>
                  {permission === 'granted' ? 'Aktif' : permission === 'denied' ? 'Diblokir' : 'Menunggu Izin'}
                </span>
              </div>
              <p className="text-xs mt-1.5 leading-relaxed opacity-90">
                {permission === 'granted' && 'Notifikasi browser dan perangkat telah diizinkan. Anda akan menerima peringatan popup saat ada data baru atau update status.'}
                {permission === 'default' && 'Browser belum mengizinkan notifikasi. Klik tombol di bawah untuk mengaktifkan peringatan seketika.'}
                {permission === 'denied' && 'Notifikasi diblokir oleh browser. Untuk membuka: Klik ikon gembok/pengaturan di samping URL web, lalu ubah Notifikasi menjadi "Izinkan".'}
              </p>

              {permission !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="mt-3.5 w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Izinkan Notifikasi Sekarang</span>
                </button>
              )}
            </div>
          </div>

          {/* Test Alert Button */}
          {permission === 'granted' && (
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-slate-800">Uji Coba Notifikasi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Bunyikan chime & kirim notifikasi popup sekarang</p>
              </div>
              <button
                disabled={isTesting}
                onClick={handleTestNotification}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTesting ? 'Mengirim...' : 'Tes Notifikasi'}</span>
              </button>
            </div>
          )}

          {/* Preferences Category Toggles */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Kategori Peringatan Real-Time</h3>
            
            {/* Input Data Baru */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-slate-300 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FilePlus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Input Data Backcharge Baru</p>
                  <p className="text-[10px] text-slate-500">Peringatan saat staf menginput transaksi Backcharge baru</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyNewData}
                onChange={toggleNewData}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            {/* Update Approval */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-slate-300 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Update Approval (Tier 1, 2, 3)</p>
                  <p className="text-[10px] text-slate-500">Peringatan saat ada persetujuan dari Kacab, RH, atau DH</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyApproval}
                onChange={toggleApproval}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
            </div>

            {/* Perubahan Status Transaksi */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-slate-300 transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Perubahan Status & Pelunasan</p>
                  <p className="text-[10px] text-slate-500">Peringatan saat transaksi Lunas, serah terima, atau invoice terbit</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyStatus}
                onChange={toggleStatus}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Sound & Haptic Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Suara & Getar Perangkat</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all ${
                  soundEnabled 
                    ? 'bg-blue-50/70 border-blue-200 text-blue-900' 
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4" />}
                <div>
                  <p className="text-xs font-extrabold">Bunyi Chime</p>
                  <p className="text-[10px] opacity-75">{soundEnabled ? 'Aktif' : 'Mati'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={toggleVibrate}
                className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all ${
                  vibrateEnabled 
                    ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' 
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <Smartphone className={`w-4 h-4 ${vibrateEnabled ? 'text-indigo-600' : ''}`} />
                <div>
                  <p className="text-xs font-extrabold">Getar HP</p>
                  <p className="text-[10px] opacity-75">{vibrateEnabled ? 'Aktif' : 'Mati'}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Tips HP / Mobile Info */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-slate-700">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold">Tips untuk Pengguna Smartphone (HP)</span>
            </div>
            <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside leading-relaxed">
              <li><strong>Android (Chrome/Edge):</strong> Klik "Izinkan" saat browser meminta izin notifikasi. Notifikasi akan muncul di bilah status HP Anda.</li>
              <li><strong>iPhone / iOS (Safari):</strong> Buka menu Bagikan (Share) &rarr; pilih <em>"Tambah ke Layar Utama" (Add to Home Screen)</em> untuk mengaktifkan push notifikasi native.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
