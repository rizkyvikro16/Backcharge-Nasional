/**
 * Zero-dependency IndexedDB cache helper with localStorage fallback.
 * Capable of storing large datasets (e.g. 50,000+ backcharge rows) without 5MB quota errors.
 */

const DB_NAME = "backcharge_local_store";
const STORE_NAME = "app_cache";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

export async function setPersistentCache<T = any>(key: string, value: T): Promise<void> {
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB is unavailable
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (lsErr) {
      console.warn("Storage quota reached on fallback localStorage:", lsErr);
    }
  }
}

export async function getPersistentCache<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage
    try {
      if (typeof window !== "undefined") {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch {
      return null;
    }
    return null;
  }
}

export async function removePersistentCache(key: string): Promise<void> {
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Cache Keys used across the application
 */
export const CACHE_KEYS = {
  TXS: 'backcharge_cache_txs',
  LOGS: 'backcharge_cache_logs',
  PROFS: 'backcharge_cache_profs',
  INQUIRIES: 'backcharge_cache_inquiries',
  TIME: 'backcharge_cache_time_v2',
  MAX_UPDATED: 'backcharge_cache_max_updated',
  MAX_CREATED: 'backcharge_cache_max_created'
};

/**
 * Save complete application datasets to IndexedDB and sync lean fallback to localStorage
 */
export async function saveAppCache(payload: {
  txs?: any[];
  logs?: any[];
  profiles?: any[];
  inquiries?: any[];
  maxUpdated?: string;
}): Promise<void> {
  const promises: Promise<any>[] = [];

  if (payload.txs) {
    promises.push(setPersistentCache(CACHE_KEYS.TXS, payload.txs));
    try {
      if (typeof window !== "undefined") {
        // Keep localStorage lean (max 30 items for emergency fallback) to never hit 5MB quota
        localStorage.setItem(CACHE_KEYS.TXS, JSON.stringify(payload.txs.slice(0, 30)));
      }
    } catch {}
  }

  if (payload.logs) {
    promises.push(setPersistentCache(CACHE_KEYS.LOGS, payload.logs));
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEYS.LOGS, JSON.stringify(payload.logs));
      }
    } catch {}
  }

  if (payload.profiles) {
    promises.push(setPersistentCache(CACHE_KEYS.PROFS, payload.profiles));
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEYS.PROFS, JSON.stringify(payload.profiles));
      }
    } catch {}
  }

  if (payload.inquiries) {
    promises.push(setPersistentCache(CACHE_KEYS.INQUIRIES, payload.inquiries));
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEYS.INQUIRIES, JSON.stringify(payload.inquiries));
      }
    } catch {}
  }

  if (payload.maxUpdated) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEYS.MAX_UPDATED, payload.maxUpdated);
      }
    } catch {}
  }

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(CACHE_KEYS.TIME, String(Date.now()));
    }
  } catch {}

  await Promise.all(promises);
}

/**
 * Load complete application datasets from IndexedDB with fast fallback to localStorage
 */
export async function loadAppCache(): Promise<{
  txs: any[] | null;
  logs: any[] | null;
  profiles: any[] | null;
  inquiries: any[] | null;
}> {
  const [txs, logs, profiles, inquiries] = await Promise.all([
    getPersistentCache<any[]>(CACHE_KEYS.TXS),
    getPersistentCache<any[]>(CACHE_KEYS.LOGS),
    getPersistentCache<any[]>(CACHE_KEYS.PROFS),
    getPersistentCache<any[]>(CACHE_KEYS.INQUIRIES),
  ]);

  return { txs, logs, profiles, inquiries };
}
