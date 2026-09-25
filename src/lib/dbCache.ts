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
