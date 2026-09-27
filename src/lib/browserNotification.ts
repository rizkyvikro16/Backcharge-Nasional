// Web Browser & Mobile (PWA/HP) Notification Service
// Provides real-time alerts, Web Audio chime synthesis, and smartphone vibration

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  txId?: string;
  url?: string;
  playSound?: boolean;
  vibrate?: boolean;
}

/** Check if Notification API is supported by the current browser/device */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Get the current notification permission state */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/** Request notification permission with browser native dialog */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      try {
        localStorage.setItem('backcharge_browser_notif_enabled', 'true');
      } catch {}
    }
    return res;
  } catch (e) {
    console.warn('Error requesting notification permission:', e);
    return Notification.permission;
  }
}

/** Synthesize a pleasant two-tone chime via Web Audio API (zero-latency, offline, no MP3 needed) */
export function playNotificationSound(): void {
  try {
    const isSoundMuted = localStorage.getItem('backcharge_notif_sound') === 'false';
    if (isSoundMuted) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Tone 1: High crisp bell (659.25 Hz - E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Tone 2: Harmonic resolving tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.24, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.52);
  } catch {
    // Non-fatal if audio context is blocked prior to user gesture
  }
}

/** Trigger device vibration for smartphones / HP */
export function triggerHapticVibrate(pattern: number[] = [250, 100, 250]): void {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

/**
 * Dispatch a real-time browser/mobile notification with chime sound & smartphone vibration.
 * Works natively on Mobile (Android PWA/Chrome, iOS 16.4+ standalone) and Desktop (Chrome, Edge, Safari, Firefox).
 */
export async function sendBrowserNotification(opts: BrowserNotificationOptions): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  // Sound and vibration alerts
  if (opts.playSound !== false) {
    playNotificationSound();
  }
  if (opts.vibrate !== false) {
    triggerHapticVibrate([200, 80, 200]);
  }

  const iconUrl = opts.icon || 'https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q';
  const notifOptions: NotificationOptions = {
    body: opts.body,
    tag: opts.tag || `bc-alert-${Date.now()}`,
    icon: iconUrl,
    badge: iconUrl,
    data: {
      txId: opts.txId,
      url: opts.url || window.location.href,
      timestamp: Date.now()
    }
  };

  let shownViaSW = false;

  // 1. Try Service Worker showNotification first (vital for Mobile Android & iOS PWA)
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(opts.title, notifOptions);
        shownViaSW = true;
      }
    }
  } catch (swErr) {
    console.warn('SW showNotification error, attempting standard Notification fallback:', swErr);
  }

  // 2. Fallback to standard window.Notification (desktop browsers)
  if (!shownViaSW) {
    try {
      const notif = new Notification(opts.title, notifOptions);
      notif.onclick = () => {
        window.focus();
        if (opts.txId) {
          window.dispatchEvent(new CustomEvent('open-backcharge-detail', {
            detail: { txId: opts.txId }
          }));
        }
        try { notif.close(); } catch {}
      };
    } catch (err) {
      console.warn('Standard Notification constructor error:', err);
    }
  }

  return true;
}

/** Send a test notification to verify audio, vibration, and visual appearance */
export async function sendTestBrowserNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') {
    return false;
  }
  return sendBrowserNotification({
    title: '🔔 Notifikasi Backcharge Aktif!',
    body: 'Sistem peringatan real-time untuk input baru, update status & approval berhasil terhubung ke perangkat ini.',
    tag: 'test-notification'
  });
}
