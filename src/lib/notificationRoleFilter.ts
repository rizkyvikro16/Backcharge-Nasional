import { Profile, Backcharge, getRoleAllowedBranches, isNationalOrAllBranches } from '../types';

export interface RoleNotificationDecision {
  shouldNotify: boolean;
  title: string;
  category: 'new_data' | 'approval' | 'status' | 'document' | 'general';
}

/**
 * Evaluates whether a live activity log should notify the current logged-in user
 * based on their specific Role, Regional/Branch authorization, and notification preferences.
 */
export function evaluateRoleNotification(
  currentUser: Profile,
  log: {
    id?: number | string;
    performed_by: string;
    action_description: string;
    transaction_id?: string;
  },
  tx?: Backcharge | null
): RoleNotificationDecision {
  // 1. Never notify user about their own actions
  if (log.performed_by && currentUser.email && log.performed_by.toLowerCase() === currentUser.email.toLowerCase()) {
    return { shouldNotify: false, title: '', category: 'general' };
  }

  const desc = log.action_description || '';
  const descLower = desc.toLowerCase();
  const role = currentUser.role || 'ASO';
  const userBranches = getRoleAllowedBranches(currentUser.role, currentUser.branch);
  const isNational = isNationalOrAllBranches(currentUser.branch, currentUser.role);

  // 2. Check if transaction branch is within user's allowed scope
  if (tx && tx.branch && !isNational) {
    const txBranchLower = tx.branch.toLowerCase().trim();
    const hasBranchAccess = userBranches.some(b => b.toLowerCase().trim() === txBranchLower);
    if (!hasBranchAccess) {
      return { shouldNotify: false, title: '', category: 'general' };
    }
  }

  // 3. Classify the action into a category
  let category: 'new_data' | 'approval' | 'status' | 'document' | 'general' = 'general';
  
  const isNewTx = descLower.includes('membuat backcharge') || 
                  descLower.includes('import data') || 
                  descLower.includes('menambahkan transaksi');

  const isApproval = descLower.includes('approval') || 
                     descLower.includes('menyetujui') || 
                     descLower.includes('menolak') || 
                     descLower.includes('review') ||
                     descLower.includes('tier 1') ||
                     descLower.includes('tier 2') ||
                     descLower.includes('tier 3');

  const isPaymentOrStatus = descLower.includes('lunas') || 
                            descLower.includes('bayar') || 
                            descLower.includes('kwitansi') || 
                            descLower.includes('status pembayaran') ||
                            descLower.includes('serah terima') ||
                            descLower.includes('invoice');

  const isDocument = descLower.includes('dokumen fisik') || 
                     descLower.includes('upload') || 
                     descLower.includes('surat') ||
                     descLower.includes('bak');

  if (isNewTx) category = 'new_data';
  else if (isApproval) category = 'approval';
  else if (isPaymentOrStatus) category = 'status';
  else if (isDocument) category = 'document';

  // 4. Check user preferences in LocalStorage
  if (category === 'new_data') {
    const pref = localStorage.getItem('backcharge_notif_new_data') !== 'false';
    if (!pref) return { shouldNotify: false, title: '', category };
  } else if (category === 'approval') {
    const pref = localStorage.getItem('backcharge_notif_approval') !== 'false';
    if (!pref) return { shouldNotify: false, title: '', category };
  } else if (category === 'status' || category === 'document') {
    const pref = localStorage.getItem('backcharge_notif_status') !== 'false';
    if (!pref) return { shouldNotify: false, title: '', category };
  }

  // 5. Role-Specific Notification Logic
  let title = '🔔 Aktivitas Backcharge';
  let shouldNotify = true;

  switch (role) {
    case 'ASO':
    case 'ASO Megabranch':
    case 'BRO':
      // ASO/BRO needs to know when their branch's denda is approved/rejected, paid, or has doc updates
      if (isApproval) {
        title = descLower.includes('menolak') ? '⚠️ Denda Memerlukan Revisi (Ditolak)' : '✅ Denda Cabang Anda Disetujui!';
      } else if (isPaymentOrStatus) {
        title = '💰 Update Pembayaran / Pelunasan Denda';
      } else if (isDocument) {
        title = '📄 Update Verifikasi Dokumen Fisik';
      } else if (isNewTx) {
        // Only notify if other staff in their same branch created a tx
        title = '📝 Transaksi Baru di Cabang Anda';
      }
      break;

    case 'Sales Head':
      // Sales Head needs to review new backcharges in their branch and see approval progression
      if (isNewTx) {
        title = '🚨 Input Denda Baru - Perlu Review Sales Head';
      } else if (isApproval) {
        title = '📋 Update Approval Denda Cabang';
      } else if (isPaymentOrStatus) {
        title = '💳 Status Pembayaran Denda Cabang';
      }
      break;

    case 'Kepala Cabang':
      // Kacab needs to approve Tier 1 and supervise branch denda
      if (isNewTx) {
        title = '🚨 Denda Baru Masuk Cabang Anda';
      } else if (isApproval) {
        title = '📋 Permohonan / Update Approval (Kepala Cabang)';
      } else if (isPaymentOrStatus) {
        title = '💰 Status Pelunasan Denda Cabang';
      }
      break;

    case 'Regional Head':
    case 'Regional Head West':
    case 'Regional Head Central':
    case 'Regional Head East':
      // Regional Heads focus on regional branch approvals and high-level progression
      if (isNewTx) {
        title = `📌 Denda Baru di Wilayah ${role.replace('Regional Head ', '') || 'Regional'}`;
      } else if (isApproval) {
        title = '📋 Permohonan Approval Regional Head (Tier 2)';
      } else if (isPaymentOrStatus) {
        title = '💰 Update Status Denda Wilayah Regional';
      }
      break;

    case 'Division Head':
      // Division Head focuses on Tier 3 and national escalations
      if (isApproval) {
        title = '🏢 Permohonan Approval Division Head (Tier 3)';
      } else if (isNewTx) {
        title = '🚨 Transaksi Backcharge Nasional Baru';
      } else if (isPaymentOrStatus) {
        title = '📊 Update Status Pelunasan Nasional';
      }
      break;

    case 'Admin':
    case 'Admin Head':
      // Admin handles physical documents, billing, kwitansi, payments
      if (isApproval && (descLower.includes('disetujui') || descLower.includes('menyetujui'))) {
        title = '🧾 Denda Disetujui - Siap Diproses Tagihan & Pembayaran';
      } else if (isPaymentOrStatus) {
        title = '💳 Update Pembayaran & Bukti Kwitansi';
      } else if (isDocument) {
        title = '📦 Update Penerimaan Dokumen Fisik';
      } else if (isNewTx) {
        title = '📝 Input Transaksi Denda Baru';
      }
      break;

    case 'Maintenance Center':
      // Maintenance center focuses on unit repair & technical updates
      title = '🔧 Update Denda Maintenance & Perbaikan Unit';
      break;

    case 'Administrator':
    default:
      // Administrator monitors all operational activities
      if (isNewTx) title = '🚨 Input Transaksi Baru';
      else if (isApproval) title = '📋 Update Approval Transaksi';
      else if (isPaymentOrStatus) title = '🔄 Perubahan Status / Pelunasan';
      else if (isDocument) title = '📄 Update Dokumen & Berkas';
      break;
  }

  return { shouldNotify, title, category };
}
