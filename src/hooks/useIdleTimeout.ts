import { useState, useEffect, useRef, useCallback } from 'react';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 Jam tidak ada aktivitas
export const WARNING_DURATION_MS = 2 * 60 * 1000; // Peringatan 2 menit sebelum logout
export const WARNING_THRESHOLD_MS = IDLE_TIMEOUT_MS - WARNING_DURATION_MS; // Muncul di menit ke-58
const THROTTLE_MS = 10 * 1000; // Simpan aktivitas maksimal setiap 10 detik

interface UseIdleTimeoutOptions {
  enabled: boolean;
  onTimeout: (reason: string) => void;
}

export function useIdleTimeout({ enabled, onTimeout }: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Fungsi untuk menyegarkan timestamp aktivitas
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Throttle penyimpanan ke localStorage agar efisien
    if (now - lastThrottleRef.current > THROTTLE_MS) {
      lastThrottleRef.current = now;
      try {
        localStorage.setItem('backcharge_last_activity', String(now));
      } catch {}
    }

    // Jika modal peringatan sedang muncul, tutup karena pengguna sudah aktif kembali
    setShowWarning(false);
  }, []);

  // Inisialisasi timestamp saat login aktif
  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleRef.current = now;
    try {
      localStorage.setItem('backcharge_last_activity', String(now));
    } catch {}

    // Event listener untuk mendeteksi interaksi pengguna
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserInteraction = () => {
      recordActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Sinkronisasi lintas tab browser (Multi-Tab Sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'backcharge_last_activity' && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (!isNaN(remoteTime)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, remoteTime);
          setShowWarning(false);
        }
      } else if (e.key === 'backcharge_logout_event') {
        // Tab lain melakukan logout
        onTimeoutRef.current("Logout dari jendela browser lain.");
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Deteksi saat tab browser kembali dibuka / fokus (misal laptop baru dibuka kembali)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const stored = Number(localStorage.getItem('backcharge_last_activity') || lastActivityRef.current);
        const elapsed = Date.now() - stored;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          onTimeoutRef.current("Sesi Anda telah berakhir otomatis karena tidak ada aktivitas selama 1 jam.");
        } else {
          recordActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // Interval checker berkala (setiap 1 detik)
    const interval = setInterval(() => {
      const stored = Number(localStorage.getItem('backcharge_last_activity') || lastActivityRef.current);
      const effectiveLastTime = Math.max(lastActivityRef.current, isNaN(stored) ? 0 : stored);
      const elapsed = Date.now() - effectiveLastTime;

      // 1. Cek apakah sudah mencapai batas 1 jam
      if (elapsed >= IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        setShowWarning(false);
        try {
          localStorage.setItem('backcharge_logout_event', String(Date.now()));
        } catch {}
        onTimeoutRef.current("Sesi Anda telah berakhir otomatis karena tidak ada aktivitas selama 1 jam.");
        return;
      }

      // 2. Cek apakah masuk fase peringatan (58 - 60 menit)
      if (elapsed >= WARNING_THRESHOLD_MS) {
        setShowWarning(true);
        const remainingMs = IDLE_TIMEOUT_MS - elapsed;
        const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(remainingSec);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
      });
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [enabled, recordActivity]);

  return {
    showWarning,
    secondsRemaining,
    resetTimer: recordActivity
  };
}
