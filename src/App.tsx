import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Mail, Users, Landmark, UserCheck, 
  Layers, CheckCircle, Clock, AlertTriangle, BarChart3, 
  Map, Download, FileSpreadsheet, Upload, FileText, 
  Check, AlertCircle, Sparkles, RefreshCw, X, LogOut, 
  Bell, HelpCircle, FileDown, Search, Filter, ShieldAlert,
  Sliders, UserX, Menu
} from 'lucide-react';

import { Profile, Backcharge, ActivityLog, AppNotification, UserRole } from './types';
import { supabase, isSupabaseConfigured, mockDb } from './supabaseClient';

import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import DatabaseView from './components/DatabaseView';
import DetailModal from './components/DetailModal';
import UserManagement from './components/UserManagement';
import AuditView from './components/AuditView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'database' | 'audit' | 'users'>('dashboard');
  
  // App data state
  const [transactions, setTransactions] = useState<Backcharge[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // UI states
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Toast trigger helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Restore login session on mount
  useEffect(() => {
    const session = localStorage.getItem('backcharge_session_profile');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch {
        localStorage.removeItem('backcharge_session_profile');
      }
    }
  }, []);

  // Fetch app data
  const fetchData = async () => {
    setLoading(true);
    
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch backcharges
        let query = supabase.from('backcharges').select('*').order('created_at', { ascending: false });
        
        // Apply branch filter if not national
        if (currentUser && currentUser.branch !== 'Nasional') {
          query = query.eq('branch', currentUser.branch);
        }
        
        const { data: bcData, error: bcError } = await query;
        if (bcError) throw bcError;
        setTransactions((bcData as Backcharge[]) || []);

        // 2. Fetch logs
        const { data: logsData, error: logsError } = await supabase
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(300);
        if (logsError) throw logsError;
        setLogs((logsData as ActivityLog[]) || []);

        // 3. Fetch profiles (for administrator)
        if (currentUser?.role === 'Administrator') {
          const { data: profsData, error: profsError } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });
          if (profsError) throw profsError;
          setProfiles((profsData as Profile[]) || []);
        }
      } catch (err: any) {
        addToast(`Gagal menyinkronkan data: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Fetch mock offline data
      setTimeout(() => {
        let bcs = mockDb.getBackcharges();
        if (currentUser && currentUser.branch !== 'Nasional') {
          bcs = bcs.filter(t => t.branch === currentUser.branch);
        }
        setTransactions(bcs);
        setLogs(mockDb.getLogs());
        setProfiles(mockDb.getProfiles());
        setLoading(false);
      }, 300);
    }
  };

  // Fetch data on login or session restore
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  // =========================================================================
  // SUPABASE REAL-TIME LISTENER FOR REAL-TIME NOTIFICATIONS
  // =========================================================================
  useEffect(() => {
    if (!currentUser) return;

    if (isSupabaseConfigured && supabase) {
      // Set up real-time postgres changes channel
      const channel = supabase
        .channel('backcharge-realtime-notif')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'backcharges' },
          (payload) => {
            // Trigger automatic background sync
            fetchData();

            const newRecord = payload.new as Backcharge;
            const oldRecord = payload.old as Backcharge;

            // Generate descriptive notifications
            if (payload.eventType === 'INSERT') {
              if (currentUser.branch === 'Nasional' || newRecord.branch === currentUser.branch) {
                const newNotif: AppNotification = {
                  id: Math.random().toString(),
                  transaction_id: newRecord.id,
                  customer_name: newRecord.customer_name,
                  category: newRecord.category,
                  branch: newRecord.branch,
                  description: `Denda baru ditambahkan untuk ${newRecord.customer_name} (${newRecord.id})`,
                  created_at: new Date().toISOString(),
                  read: false
                };
                setNotifications(prev => [newNotif, ...prev]);
                addToast(`Denda Baru: ${newRecord.id} - ${newRecord.customer_name}`, 'info');
              }
            } else if (payload.eventType === 'UPDATE') {
              if (currentUser.branch === 'Nasional' || newRecord.branch === currentUser.branch) {
                let changeMessage = '';
                if (oldRecord.status_confirm !== newRecord.status_confirm) {
                  changeMessage = `Status konfirmasi diperbarui menjadi "${newRecord.status_confirm}"`;
                } else if (oldRecord.status_sap !== newRecord.status_sap) {
                  changeMessage = `Status SAP diperbarui menjadi "${newRecord.status_sap}"`;
                } else if (oldRecord.status_handover !== newRecord.status_handover) {
                  changeMessage = `Status penyerahan berkas diperbarui menjadi "${newRecord.status_handover}"`;
                } else if (oldRecord.no_invoice !== newRecord.no_invoice) {
                  changeMessage = `Nomor Invoice diperbarui menjadi "${newRecord.no_invoice}"`;
                } else if (oldRecord.status_payment !== newRecord.status_payment) {
                  changeMessage = `Status pembayaran diperbarui menjadi "${newRecord.status_payment}"`;
                }

                if (changeMessage) {
                  const newNotif: AppNotification = {
                    id: Math.random().toString(),
                    transaction_id: newRecord.id,
                    customer_name: newRecord.customer_name,
                    category: newRecord.category,
                    branch: newRecord.branch,
                    description: `${newRecord.id}: ${changeMessage}`,
                    created_at: new Date().toISOString(),
                    read: false
                  };
                  setNotifications(prev => [newNotif, ...prev]);
                  addToast(`Status Diperbarui: ${newRecord.id}`, 'success');
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  // Login handler
  const handleLoginSuccess = (profile: Profile) => {
    setCurrentUser(profile);
    localStorage.setItem('backcharge_session_profile', JSON.stringify(profile));
    addToast(`Otentikasi Berhasil! Selamat datang, ${profile.full_name}.`, 'success');
  };

  // Logout handler
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('backcharge_session_profile');
    setShowLogoutConfirm(false);
    addToast("Berhasil logout dari sistem denda.", "info");
  };

  // 1. ADD NEW TRANSACTION WORKFLOW
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;

    // Generate unique ID: BC-YYYY-XXXX
    const year = new Date().getFullYear();
    const count = transactions.length + 1;
    const formatCount = String(count).padStart(4, '0');
    const newId = `BC-${year}-${formatCount}`;

    const creatorEmail = currentUser.email;
    const txObj: Backcharge = {
      ...newTx,
      id: newId,
      created_by: creatorEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('backcharges').insert([txObj]);
        if (error) throw error;
        
        addToast(`Transaksi denda ${newId} berhasil disimpan!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Server gagal menyimpan denda: ${err.message}`, 'error');
      }
    } else {
      // Mock Offline insertion
      mockDb.saveBackcharge(txObj, creatorEmail);
      
      // Emit trigger notification emulator
      const emulatedNotif: AppNotification = {
        id: Math.random().toString(),
        transaction_id: newId,
        customer_name: txObj.customer_name,
        category: txObj.category,
        branch: txObj.branch,
        description: `Denda baru dibuat: ${txObj.customer_name} (${newId})`,
        created_at: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [emulatedNotif, ...prev]);
      
      addToast(`Denda denda ${newId} sukses disimpan offline!`, 'success');
      fetchData();
    }
  };

  // 2. UPDATE TRANSACTION WORKFLOW STATUS
  const handleUpdateTransaction = async (id: string, updates: Partial<Backcharge>, logMessage: string) => {
    if (!currentUser) return;

    const targetTx = transactions.find(t => t.id === id);
    if (!targetTx) return;

    const updatedTx = {
      ...targetTx,
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('backcharges')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
        
        // Insert audit log explicitly (Trigger handles status but explicit details are logged nicely)
        await supabase.from('activity_logs').insert([{
          transaction_id: id,
          performed_by: currentUser.email,
          action_description: logMessage
        }]);

        addToast(`Transaksi ${id} diperbarui tervalidasi!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Server gagal memproses update: ${err.message}`, 'error');
      }
    } else {
      // Mock Offline update
      mockDb.saveBackcharge(updatedTx, currentUser.email);
      
      // Emit trigger notification emulator
      const emulatedNotif: AppNotification = {
        id: Math.random().toString(),
        transaction_id: id,
        customer_name: updatedTx.customer_name,
        category: updatedTx.category,
        branch: updatedTx.branch,
        description: `${id}: ${logMessage}`,
        created_at: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [emulatedNotif, ...prev]);

      addToast(`Status ${id} diperbarui offline!`, 'success');
      fetchData();
    }
  };

  // 2B. DELETE TRANSACTION WORKFLOW (ADMINISTRATOR ONLY)
  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') {
      addToast("Akses Ditolak: Hanya Administrator yang boleh menghapus data!", "error");
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus data Backcharge dengan ID ${id} secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Hapus log aktivitas terkait terlebih dahulu jika diperlukan
        await supabase.from('activity_logs').delete().eq('transaction_id', id);
        
        const { error } = await supabase
          .from('backcharges')
          .delete()
          .eq('id', id);

        if (error) throw error;

        addToast(`Denda ${id} berhasil dihapus permanen!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Server gagal menghapus denda: ${err.message}`, 'error');
      }
    } else {
      mockDb.deleteBackcharge(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      addToast(`Denda ${id} berhasil dihapus offline!`, 'success');
    }
  };

  // 3. ADMIN: ADD USER WORKFLOW
  const handleAddUser = async (email: string, fullName: string, role: UserRole, branch: string, password?: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    const newProfile: Profile = {
      id: Math.random().toString(36).substring(7),
      email,
      full_name: fullName,
      role,
      branch,
      created_at: new Date().toISOString(),
      password: password || 'password123'
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('profiles').insert([newProfile]);
        if (error) throw error;
        
        // Log explicitly
        await supabase.from('activity_logs').insert([{
          transaction_id: 'SYSTEM',
          performed_by: currentUser.email,
          action_description: `Menambahkan staf pengguna baru: ${fullName} (${email}) - ${role}`
        }]);

        addToast(`Staf ${fullName} sukses didaftarkan!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal menambahkan pengguna: ${err.message}`, 'error');
      }
    } else {
      mockDb.saveProfile(newProfile);
      mockDb.addLog('SYSTEM', currentUser.email, `Menambahkan staf pengguna baru: ${fullName} (${email}) - ${role}`);
      addToast(`Staf ${fullName} didaftarkan offline!`, 'success');
      fetchData();
    }
  };

  // 4. ADMIN: UPDATE USER WORKFLOW
  const handleUpdateUser = async (email: string, updates: Partial<Profile>) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('email', email);

        if (error) throw error;

        addToast(`Data pengguna ${email} diperbarui!`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal memperbarui pengguna: ${err.message}`, 'error');
      }
    } else {
      const profilesList = mockDb.getProfiles();
      const target = profilesList.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (target) {
        mockDb.saveProfile({ ...target, ...updates });
        mockDb.addLog('SYSTEM', currentUser.email, `Mengubah data pengguna ${email}`);
        addToast(`Data pengguna ${email} sukses diupdate offline!`, 'success');
        fetchData();
      }
    }
  };

  // 5. ADMIN: DELETE USER WORKFLOW
  const handleDeleteUser = async (email: string) => {
    if (!currentUser || currentUser.role !== 'Administrator') return;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('email', email);

        if (error) throw error;

        addToast(`Akses portal untuk ${email} dihapus.`, 'success');
        fetchData();
      } catch (err: any) {
        addToast(`Gagal menghapus pengguna: ${err.message}`, 'error');
      }
    } else {
      mockDb.deleteProfile(email);
      mockDb.addLog('SYSTEM', currentUser.email, `Menghapus akses pengguna: ${email}`);
      addToast(`Akses portal untuk ${email} dihapus offline.`, 'success');
      fetchData();
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setSelectedTransactionId(notif.transaction_id);
    setShowNotifDropdown(false);
    setCurrentTab('database');
  };

  const selectedTransaction = transactions.find(t => t.id === selectedTransactionId);

  // Authenticate screen guard
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Header texts
  const tabHeaders = {
    dashboard: { title: 'Dashboard Executive', subtitle: 'Memantau status dan performa denda secara real-time.' },
    database: { title: 'Database Backcharge', subtitle: 'Pencatatan kasus, tracking progres denda, dan audit berkas.' },
    audit: { title: 'Audit Trail Aktivitas', subtitle: 'Mutasi log penyerahan berkas fisik secara transparan seluruh cabang.' },
    users: { title: 'Manajemen Staf & Pengguna', subtitle: 'Hak akses otoritas dan wilayah denda nasional.' }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 pb-20 md:pb-0">
      
      {/* 1. TOAST ALERTS OVERLAY */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-xl text-xs font-bold transition-all duration-300 shadow-xl flex items-center justify-between mb-2 pointer-events-auto border animate-in fade-in slide-in-from-top-4 ${
              t.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : t.type === 'error' 
                  ? 'bg-red-600 text-white border-red-500' 
                  : 'bg-blue-600 text-white border-blue-500'
            }`}
          >
            <span>{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-3 font-black text-sm opacity-85 hover:opacity-100">×</button>
          </div>
        ))}
      </div>

      {/* 2. DESKTOP COLLAPSIBLE SIDEBAR */}
      <aside 
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        className={`hidden md:flex bg-slate-900 text-slate-300 flex-shrink-0 flex-col border-r border-slate-800 transition-all duration-300 ease-in-out z-40 ${
          sidebarHover ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4 group-hover:p-6 border-b border-slate-800 flex items-center justify-center overflow-hidden h-16 flex-shrink-0">
          <div className="flex items-center space-x-3 w-full justify-start pl-1">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-md flex-shrink-0">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className={`transition-all duration-300 ${sidebarHover ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 overflow-hidden'}`}>
              <h1 className="text-sm font-extrabold text-white leading-none truncate">BC Nasional</h1>
              <p className="text-[9px] text-slate-500 font-extrabold tracking-wide mt-0.5 uppercase">Workflow system</p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-3 bg-slate-800/40 rounded-2xl border border-slate-800/60 flex items-center space-x-3 overflow-hidden justify-start transition-all duration-300">
          <div className="w-10 h-10 bg-blue-500 text-white font-extrabold rounded-xl flex items-center justify-center text-sm shadow-md shadow-blue-500/10 flex-shrink-0">
            {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className={`transition-all duration-300 min-w-0 ${sidebarHover ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 overflow-hidden'}`}>
            <p className="text-xs font-black text-white truncate leading-tight">{currentUser.full_name}</p>
            <p className="text-[9px] font-bold text-blue-400 mt-0.5 truncate uppercase">{currentUser.role}</p>
            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded mt-1 inline-block border border-emerald-500/20 uppercase">
              {currentUser.branch}
            </span>
          </div>
        </div>

        {/* Navigations links */}
        <nav className="flex-grow px-3 py-2 space-y-1">
          <button 
            onClick={() => setCurrentTab('dashboard')} 
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
              currentTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Dashboard Executive</span>
          </button>

          <button 
            onClick={() => setCurrentTab('database')} 
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
              currentTab === 'database' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <Layers className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Database Backcharge</span>
          </button>

          {/* ADMIN ONLY TABS */}
          {currentUser.role === 'Administrator' && (
            <>
              <button 
                onClick={() => setCurrentTab('audit')} 
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                  currentTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                }`}
              >
                <Clock className="w-5 h-5 flex-shrink-0" />
                <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Audit Trail Activity</span>
              </button>

              <button 
                onClick={() => setCurrentTab('users')} 
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-xs font-bold transition-all justify-start ${
                  currentTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                }`}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Manajemen Pengguna</span>
              </button>
            </>
          )}
        </nav>

        {/* Bottom logout */}
        <div className="p-3 border-t border-slate-800 flex-shrink-0 h-16 flex items-center">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-start space-x-3 py-2.5 px-3 rounded-xl bg-red-950/20 hover:bg-red-900/40 text-xs font-bold text-red-400 transition-all border border-red-950/50"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarHover ? 'opacity-100' : 'opacity-0 hidden'}`}>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* 3. MOBILE BOTTOM FIXED BAR (ACCESSIBILITY FOR MOBILE PHONES) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-slate-400 shadow-2xl flex justify-around py-3 z-40">
        <button 
          onClick={() => setCurrentTab('dashboard')} 
          className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
            currentTab === 'dashboard' ? 'text-blue-500' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
        <button 
          onClick={() => setCurrentTab('database')} 
          className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
            currentTab === 'database' ? 'text-blue-500' : 'text-slate-400'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>Database</span>
        </button>
        
        {currentUser.role === 'Administrator' && (
          <>
            <button 
              onClick={() => setCurrentTab('audit')} 
              className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
                currentTab === 'audit' ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Audit</span>
            </button>
            <button 
              onClick={() => setCurrentTab('users')} 
              className={`flex flex-col items-center space-y-1 text-[10px] font-bold w-1/4 transition-colors ${
                currentTab === 'users' ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>User</span>
            </button>
          </>
        )}
      </nav>

      {/* 4. MAIN CONTAINER CONTENT */}
      <div className="flex-grow flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header status bar */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm md:hidden">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-extrabold text-slate-900 leading-none">
                {tabHeaders[currentTab].title}
              </h2>
              <p className="text-[9px] md:text-xs text-slate-400 font-bold mt-1 leading-none">
                {tabHeaders[currentTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 relative">
            
            {/* Sync Global Button */}
            <button 
              onClick={fetchData} 
              disabled={loading}
              className={`p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 ${loading ? 'animate-spin' : ''}`}
              title="Sinkronkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Notification drop indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                )}
              </button>

              {/* Notification Dropdown Box */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <span className="text-xs font-black text-slate-800">Notifikasi Real-Time</span>
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-extrabold">
                      {notifications.filter(n => !n.read).length} Baru
                    </span>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100 text-xs">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col space-y-1 ${n.read ? 'opacity-60' : 'bg-blue-50/20 font-semibold'}`}
                      >
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{n.transaction_id}</span>
                          <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-bold uppercase">{n.branch}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">{n.description}</p>
                        <span className="text-[8px] text-slate-400 font-mono text-right">{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}

                    {notifications.length === 0 && (
                      <p className="p-4 text-center text-slate-400 italic">Tidak ada notifikasi baru.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile logout */}
            <button 
              onClick={handleLogout}
              className="md:hidden p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-50"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 5. JENDELA AREA TAB KONTEN */}
        <main className="p-4 md:p-6 flex-grow space-y-6 pb-24 md:pb-6">
          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-xl flex items-center space-x-2 animate-pulse justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Menyelaraskan data real-time dengan database...</span>
            </div>
          )}

          {currentTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions} 
              currentUser={currentUser}
              onSelectTransaction={(id) => {
                setSelectedTransactionId(id);
                setCurrentTab('database');
              }}
            />
          )}

          {currentTab === 'database' && (
            <DatabaseView 
              transactions={transactions}
              currentUser={currentUser}
              onAddTransaction={handleAddTransaction}
              onSelectTransaction={setSelectedTransactionId}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={logs} />
          )}

          {currentTab === 'users' && (
            <UserManagement 
              profiles={profiles}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>

      {/* 6. GLOBAL DETAIL MODAL FOR TRANSACTION STEPS */}
      {selectedTransactionId && selectedTransaction && (
        <DetailModal 
          transaction={selectedTransaction}
          currentUser={currentUser}
          onClose={() => setSelectedTransactionId(null)}
          onUpdateStatus={handleUpdateTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-red-500" />
              Konfirmasi Keluar
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin keluar dari Portal Manajemen Backcharge PT Adi Sarana Armada, Tbk? Sesi Anda akan diakhiri.
            </p>
            <div className="flex justify-end space-x-2 mt-5">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={confirmLogout}
                className="px-3.5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all"
              >
                Keluar Portal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
