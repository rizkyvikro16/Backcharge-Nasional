/**
 * Offline-First Sync Queue & D1 Quota Fallback Manager
 * 
 * Manages graceful local persistence when Cloudflare D1 hits its daily 5M Rows Read limit
 * or when the user is working offline.
 * Changes are stored securely in IndexedDB and automatically pushed to Cloudflare D1
 * as soon as the quota resets or connection is re-established.
 */

import { getPersistentCache, setPersistentCache } from './dbCache';

export interface SyncQueueItem {
  id: string;
  operation: 'insert_backcharge' | 'update_backcharge' | 'delete_backcharge' | 'bulk_upsert_backcharges' | 'bulk_update_backcharges';
  params: any[];
  extraPayload: any;
  description: string;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'backcharge_sync_outbox_v1';
const QUOTA_STATUS_KEY = 'backcharge_d1_quota_limited';
const QUOTA_REASON_KEY = 'backcharge_d1_quota_reason';

// Helper: Get queue from storage
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const idbItems = await getPersistentCache<SyncQueueItem[]>(QUEUE_STORAGE_KEY);
    if (Array.isArray(idbItems) && idbItems.length > 0) {
      return idbItems;
    }
  } catch {}

  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}

  return [];
}

// Helper: Save queue to storage
async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  try {
    await setPersistentCache(QUEUE_STORAGE_KEY, queue);
  } catch {}
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new CustomEvent('backcharge-sync-queue-updated', { detail: { count: queue.length } }));
    }
  } catch {}
}

// Add an operation to the sync queue
export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<SyncQueueItem> {
  const fullItem: SyncQueueItem = {
    ...item,
    id: `sq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now()
  };

  const queue = await getSyncQueue();
  queue.push(fullItem);
  await saveSyncQueue(queue);
  return fullItem;
}

// Remove synced items from queue
export async function removeSyncItems(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const queue = await getSyncQueue();
  const remaining = queue.filter(item => !idSet.has(item.id));
  await saveSyncQueue(remaining);
}

// Check if Cloudflare D1 is currently flagged as Quota Limited
export function isD1QuotaLimited(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(QUOTA_STATUS_KEY) === 'true';
}

// Get the reason D1 was flagged as Quota Limited
export function getD1QuotaLimitedReason(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(QUOTA_REASON_KEY) || 'Batas kuota harian database Cloudflare D1 tercapai';
}

// Flag D1 as Quota Limited or Recovered
export function setD1QuotaLimited(limited: boolean, reason = ''): void {
  if (typeof window === 'undefined') return;
  if (limited) {
    localStorage.setItem(QUOTA_STATUS_KEY, 'true');
    if (reason) localStorage.setItem(QUOTA_REASON_KEY, reason);
  } else {
    localStorage.removeItem(QUOTA_STATUS_KEY);
    localStorage.removeItem(QUOTA_REASON_KEY);
  }
  window.dispatchEvent(new CustomEvent('backcharge-d1-quota-status-changed', { 
    detail: { limited, reason } 
  }));
}

/**
 * Check if an error message or HTTP status indicates D1 quota / row limit exceeded
 */
export function isQuotaLimitError(err: any): boolean {
  if (!err) return false;
  const str = String(err.message || err.error || err || '').toLowerCase();
  return (
    str.includes('row read limit') ||
    str.includes('quota exceeded') ||
    str.includes('exceeded d1') ||
    str.includes('free tier') ||
    str.includes('5m') ||
    str.includes('429') ||
    str.includes('rate limit') ||
    str.includes('d1_error') ||
    str.includes('limit reached') ||
    str.includes('maximum response size limit')
  );
}

/**
 * Replay all pending queue items into Cloudflare D1
 * Returns { success: boolean, syncedCount: number, error?: string }
 */
export async function processSyncQueue(
  executeD1Fn: (opId: string, params: any[], attempt?: number, extraPayload?: any) => Promise<any>
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  const successfullySyncedIds: string[] = [];

  for (const item of queue) {
    try {
      await executeD1Fn(item.operation, item.params || [], 1, item.extraPayload || {});
      successfullySyncedIds.push(item.id);
    } catch (err: any) {
      if (isQuotaLimitError(err)) {
        // Quota is still active; stop processing and keep remaining items in queue
        setD1QuotaLimited(true, err.message || 'Batas kuota D1 masih aktif');
        if (successfullySyncedIds.length > 0) {
          await removeSyncItems(successfullySyncedIds);
        }
        return { 
          success: false, 
          syncedCount: successfullySyncedIds.length, 
          error: "Kuota D1 masih mencapai batas harian. Data tetap tersimpan aman di perangkat lokal." 
        };
      }
      console.warn("Sync queue item replay notice:", item.description, err?.message || err);
    }
  }

  if (successfullySyncedIds.length > 0) {
    await removeSyncItems(successfullySyncedIds);
  }

  const remaining = await getSyncQueue();
  if (remaining.length === 0) {
    setD1QuotaLimited(false);
  }

  return { success: true, syncedCount: successfullySyncedIds.length };
}
