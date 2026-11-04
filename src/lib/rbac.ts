/**
 * Role-Based Access Control (RBAC) Engine
 * Manages dynamic menu visibility and action permissions across all user roles.
 */

import { useState, useEffect, useCallback } from 'react';

export const ALL_SYSTEM_ROLES = [
  'Administrator',
  'Division Head',
  'Regional Head',
  'Regional Head West',
  'Regional Head Central',
  'Regional Head East',
  'Kepala Cabang',
  'Sales Head',
  'ASO',
  'ASO Megabranch',
  'Maintenance Center',
  'BRO',
  'Admin',
  'Admin Head'
] as const;

export type SystemRole = typeof ALL_SYSTEM_ROLES[number];

export interface MenuPermission {
  id: string;
  label: string;
  description: string;
}

export const SYSTEM_MENUS: MenuPermission[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Statistik, analitik grafis, dan ringkasan performa' },
  { id: 'database', label: 'Data Backcharge', description: 'Tabel transaksi, pencarian, dan audit data' },
  { id: 'audit', label: 'Audit Trail Aktivitas', description: 'Log riwayat seluruh mutasi dan aktivitas sistem' },
  { id: 'users', label: 'Manajemen Staf & Pengguna', description: 'Pengelolaan akun pengguna dan pengaturan RBAC' },
  { id: 'complaints', label: 'Hub Keluhan & Masukan', description: 'Pusat aspirasi, masukan, dan pengaduan' }
];

export interface ActionPermission {
  id: string;
  label: string;
  description: string;
}

export const SYSTEM_ACTIONS: ActionPermission[] = [
  { id: 'create', label: 'Tambah Transaksi', description: 'Membuat entri Backcharge baru di sistem' },
  { id: 'update', label: 'Ubah Data & Berkas', description: 'Update status, unggah dokumen, no invoice & pelunasan' },
  { id: 'approve', label: 'Approval Transaksi', description: 'Memberikan persetujuan (Kacab, RH, DH)' },
  { id: 'delete', label: 'Hapus Transaksi', description: 'Menghapus data transaksi dari sistem' },
  { id: 'export', label: 'Ekspor Data Excel', description: 'Mengunduh laporan rekapitulasi data Backcharge' },
  { id: 'manage_users', label: 'Kelola Staf & RBAC', description: 'Tambah/edit pengguna dan ubah hak akses' }
];

export type RolePermissionSet = {
  menus: string[];
  actions: string[];
};

export type RbacConfig = Record<string, RolePermissionSet>;

export const DEFAULT_RBAC_CONFIG: RbacConfig = {
  'Administrator': {
    menus: ['dashboard', 'database', 'audit', 'users', 'complaints'],
    actions: ['create', 'update', 'approve', 'delete', 'export', 'manage_users']
  },
  'Division Head': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Regional Head': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Regional Head West': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Regional Head Central': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Regional Head East': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Kepala Cabang': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'Sales Head': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'approve', 'export']
  },
  'ASO': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'export']
  },
  'ASO Megabranch': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'export']
  },
  'Maintenance Center': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'export']
  },
  'BRO': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'export']
  },
  'Admin': {
    menus: ['dashboard', 'database', 'complaints'],
    actions: ['create', 'update', 'export']
  },
  'Admin Head': {
    menus: ['dashboard', 'database', 'audit', 'complaints'],
    actions: ['create', 'update', 'export']
  }
};

const STORAGE_KEY = 'backcharge_rbac_config';

/**
 * Normalizes user role string variations into standard system role names.
 */
export function normalizeRoleName(rawRole: string): string {
  if (!rawRole) return '';
  const trimmed = rawRole.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'administrator' || lower === 'admin system' || lower === 'super admin' || lower === 'admin pusat') return 'Administrator';
  if (lower === 'division head' || lower === 'dh') return 'Division Head';
  if (lower === 'regional head west' || lower === 'rh west') return 'Regional Head West';
  if (lower === 'regional head central' || lower === 'rh central') return 'Regional Head Central';
  if (lower === 'regional head east' || lower === 'rh east') return 'Regional Head East';
  if (lower === 'regional head' || lower === 'rh' || lower === 'rbu') return 'Regional Head';
  if (lower === 'kepala cabang' || lower === 'kacab') return 'Kepala Cabang';
  if (lower === 'sales head' || lower === 'sales / sales head' || lower === 'sh') return 'Sales Head';
  if (lower === 'aso') return 'ASO';
  if (lower === 'aso megabranch' || lower === 'megabranch') return 'ASO Megabranch';
  if (lower === 'maintenance center' || lower.includes('maintenance')) return 'Maintenance Center';
  if (lower === 'bro' || lower === 'broker') return 'BRO';
  if (lower === 'admin head') return 'Admin Head';
  if (lower === 'admin') return 'Admin';

  const exactFound = ALL_SYSTEM_ROLES.find(r => r.toLowerCase() === lower);
  if (exactFound) return exactFound;

  return trimmed;
}

/**
 * Retrieves the current RBAC configuration from LocalStorage or returns the default.
 */
export function getRbacMatrix(): RbacConfig {
  if (typeof window === 'undefined') return DEFAULT_RBAC_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: RbacConfig = { ...DEFAULT_RBAC_CONFIG, ...parsed };
      
      ALL_SYSTEM_ROLES.forEach(r => {
        if (!merged[r]) {
          merged[r] = DEFAULT_RBAC_CONFIG[r] || { menus: ['dashboard', 'database', 'complaints'], actions: ['update', 'export'] };
        } else {
          // Ensure menus and actions arrays exist
          merged[r] = {
            menus: Array.isArray(merged[r].menus) ? merged[r].menus : DEFAULT_RBAC_CONFIG[r]?.menus || ['dashboard', 'database', 'complaints'],
            actions: Array.isArray(merged[r].actions) ? merged[r].actions : DEFAULT_RBAC_CONFIG[r]?.actions || ['update', 'export']
          };
        }
      });
      return merged;
    }
  } catch (err) {
    console.warn('Error reading RBAC config from localStorage:', err);
  }
  return DEFAULT_RBAC_CONFIG;
}

/**
 * Persists the RBAC configuration to LocalStorage and dispatches an update event across windows and components.
 */
export function saveRbacMatrix(config: RbacConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    
    // Immediate synchronous event
    window.dispatchEvent(new Event('rbac-updated'));

    try {
      const channel = new BroadcastChannel('rbac_channel');
      channel.postMessage({ type: 'rbac-updated', config });
      channel.close();
    } catch {}

    setTimeout(() => {
      try {
        window.dispatchEvent(new Event('rbac-updated'));
      } catch {}
    }, 0);
  } catch (err) {
    console.error('Error saving RBAC config to localStorage:', err);
  }
}

/**
 * Resets the RBAC configuration back to factory defaults.
 */
export function resetRbacMatrix(): RbacConfig {
  saveRbacMatrix(DEFAULT_RBAC_CONFIG);
  return DEFAULT_RBAC_CONFIG;
}

/**
 * Parses user roles (handles single or comma-separated roles, normalized to standard system roles).
 */
export function parseUserRoles(roleStr?: string): string[] {
  if (!roleStr) return [];
  const parts = roleStr.split(',').map(s => s.trim()).filter(Boolean);
  const normalized = parts.map(r => normalizeRoleName(r));
  return Array.from(new Set(normalized));
}

/**
 * Checks if a user role has permission to view a specific menu.
 */
export function canViewMenu(roleStr: string | undefined, menuId: string): boolean {
  if (!roleStr) return false;
  const roles = parseUserRoles(roleStr);
  
  // Administrator always has access to everything
  if (roles.includes('Administrator')) return true;

  const matrix = getRbacMatrix();
  return roles.some(role => {
    // Exact match
    const perm = matrix[role];
    if (perm && Array.isArray(perm.menus) && perm.menus.includes(menuId)) return true;

    // Fuzzy matching for Regional Head roles
    if (role.toLowerCase().startsWith('regional head')) {
      const rhPerm = matrix['Regional Head'];
      if (rhPerm && Array.isArray(rhPerm.menus) && rhPerm.menus.includes(menuId)) return true;
    }
    return false;
  });
}

/**
 * Checks if a user role has permission to perform a specific action.
 */
export function canPerformAction(roleStr: string | undefined, actionId: string): boolean {
  if (!roleStr) return false;
  const roles = parseUserRoles(roleStr);

  // Administrator always has access to everything
  if (roles.includes('Administrator')) return true;

  const matrix = getRbacMatrix();
  return roles.some(role => {
    const perm = matrix[role];
    if (perm && Array.isArray(perm.actions) && perm.actions.includes(actionId)) return true;

    if (role.toLowerCase().startsWith('regional head')) {
      const rhPerm = matrix['Regional Head'];
      if (rhPerm && Array.isArray(rhPerm.actions) && rhPerm.actions.includes(actionId)) return true;
    }
    return false;
  });
}

/**
 * React hook to listen for live RBAC changes and re-render components reactively.
 */
export function useRbac() {
  const [matrix, setMatrix] = useState<RbacConfig>(() => getRbacMatrix());

  useEffect(() => {
    const handleUpdate = () => {
      setMatrix(getRbacMatrix());
    };

    window.addEventListener('rbac-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('rbac_channel');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'rbac-updated') {
          handleUpdate();
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('rbac-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (channel) channel.close();
    };
  }, []);

  const canView = useCallback((roleStr: string | undefined, menuId: string) => {
    return canViewMenu(roleStr, menuId);
  }, [matrix]);

  const canAction = useCallback((roleStr: string | undefined, actionId: string) => {
    return canPerformAction(roleStr, actionId);
  }, [matrix]);

  return {
    matrix,
    canView,
    canAction,
    save: saveRbacMatrix,
    reset: resetRbacMatrix
  };
}
