import React, { useState } from 'react';
import { Key, Mail, User, MapPin, UserCheck, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Profile, UserRole, BRANCH_LIST, WEST_BRANCHES, CENTRAL_BRANCHES, EAST_BRANCHES, isRegionalHeadRole } from '../types';
import { supabase, isSupabaseConfigured, mockDb } from '../supabaseClient';

interface AuthScreenProps {
  onLoginSuccess: (profile: Profile) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('ASO / Staff');
  const [regBranch, setRegBranch] = useState('Jakarta');
  const [regPassword, setRegPassword] = useState('');

  const selectedBranchList = regBranch === 'Nasional' 
    ? BRANCH_LIST 
    : regBranch.split(',').map(s => s.trim()).filter(Boolean);

  const toggleRegBranchSelection = (bName: string) => {
    let currentList = regBranch === 'Nasional' ? [...BRANCH_LIST] : regBranch.split(',').map(s => s.trim()).filter(Boolean);
    if (currentList.includes(bName)) {
      currentList = currentList.filter(x => x !== bName);
    } else {
      currentList.push(bName);
    }
    currentList.sort();
    setRegBranch(currentList.length > 0 ? currentList.join(', ') : 'Jakarta');
  };

  const handleRegRoleChange = (newRole: UserRole) => {
    setRegRole(newRole);
    if (isRegionalHeadRole(newRole) || newRole === 'Maintenance Center') {
      if (newRole === 'Regional Head West') {
        setRegBranch(WEST_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head Central') {
        setRegBranch(CENTRAL_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head East') {
        setRegBranch(EAST_BRANCHES.join(', '));
      } else if (!regBranch.includes(',')) {
        setRegBranch(WEST_BRANCHES.join(', '));
      }
    } else if (regBranch.includes(',')) {
      setRegBranch('Jakarta');
    }
  };

  // UI Utilities
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Available roles requested for self-registration form
  const availableRoles: { value: UserRole; label: string }[] = [
    { value: 'ASO / Staff', label: 'ASO / Staff' },
    { value: 'Maintenance Center', label: 'Maintenance Center' },
    { value: 'Admin', label: 'Admin' },
    { value: 'BRO', label: 'BRO' },
    { value: 'Sales Head', label: 'Sales Head' },
    { value: 'Admin Head', label: 'Admin Head' },
    { value: 'Kepala Cabang', label: 'Kepala Cabang' },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const emailTrim = email.trim().toLowerCase();
    
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. First check if a profile exists with this email in public.profiles table
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', emailTrim)
          .maybeSingle();

        if (dbProfile) {
          // If a profile exists, verify the password
          const dbPassword = dbProfile.password || 'password123';
          if (dbPassword === password) {
            onLoginSuccess(dbProfile as Profile);
            setLoading(false);
            return;
          }
        }

        // 2. Fallback to standard Supabase Auth if table-password didn't match or profile doesn't exist
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: password,
        });

        if (authError) {
          throw new Error('Kombinasi Email atau Password salah! Periksa kembali.');
        }

        if (authData.user) {
          // Fetch profile info
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profileData) {
            onLoginSuccess(profileData as Profile);
          } else {
            // Create fallback profile if not found
            const fallbackProfile: Profile = {
              id: authData.user.id,
              email: emailTrim,
              full_name: emailTrim.split('@')[0].toUpperCase(),
              role: 'ASO / Staff',
              branch: 'Jakarta',
              created_at: new Date().toISOString()
            };
            onLoginSuccess(fallbackProfile);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Gagal login. Periksa kembali email dan password.');
      } finally {
        setLoading(false);
      }
    } else {
      // Offline Local Storage Login Fallback
      setTimeout(() => {
        const profiles = mockDb.getProfiles();
        const found = profiles.find(p => p.email.toLowerCase() === emailTrim);
        
        if (found && (password === 'password123' || password === found.password || emailTrim.includes('company.id'))) {
          onLoginSuccess(found);
        } else if (emailTrim && password) {
          // Auto-register new users on the fly if testing other accounts
          const newProfile: Profile = {
            id: Math.random().toString(36).substring(7),
            email: emailTrim,
            full_name: emailTrim.split('@')[0].toUpperCase() + ' (Staff)',
            role: 'ASO / Staff',
            branch: 'Jakarta',
            created_at: new Date().toISOString()
          };
          mockDb.saveProfile(newProfile);
          onLoginSuccess(newProfile);
        } else {
          setError('Email atau Password salah! (Default password: password123)');
        }
        setLoading(false);
      }, 500);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const emailTrim = regEmail.trim().toLowerCase();
    const fullNameTrim = regFullName.trim();
    const passwordTrim = regPassword.trim();

    // 1. Validation
    if (!fullNameTrim) {
      setError('Nama Lengkap wajib diisi!');
      setLoading(false);
      return;
    }
    if (!emailTrim) {
      setError('Email Perusahaan wajib diisi!');
      setLoading(false);
      return;
    }
    if (!emailTrim.includes('@')) {
      setError('Format email tidak valid! Harap masukkan email yang benar.');
      setLoading(false);
      return;
    }
    if (!passwordTrim) {
      setError('Password wajib diisi!');
      setLoading(false);
      return;
    }
    if (passwordTrim.length < 6) {
      setError('Password minimal harus berisi 6 karakter demi keamanan akun.');
      setLoading(false);
      return;
    }

    const newProfile: Profile = {
      id: 'USR-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      email: emailTrim,
      full_name: fullNameTrim,
      role: regRole,
      branch: regBranch,
      password: passwordTrim,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        // Insert into backend profiles table
        const { error: dbError } = await supabase
          .from('profiles')
          .insert([
            {
              id: newProfile.id,
              email: newProfile.email,
              full_name: newProfile.full_name,
              role: newProfile.role,
              branch: newProfile.branch,
              password: newProfile.password,
              created_at: newProfile.created_at
            }
          ]);

        if (dbError) {
          throw new Error('Email sudah terdaftar atau gagal menyimpan profil: ' + dbError.message);
        }

        // Keep local storage synchronized
        mockDb.saveProfile(newProfile);

        setSuccess(`Registrasi akun untuk "${fullNameTrim}" berhasil! Silakan masuk di tab Masuk.`);
        setEmail(emailTrim);
        setPassword(passwordTrim);
        setRegFullName('');
        setRegEmail('');
        setRegPassword('');
        setActiveTab('login');
      } catch (err: any) {
        setError(err.message || 'Gagal mendaftarkan akun baru.');
      } finally {
        setLoading(false);
      }
    } else {
      // Local storage offline registration
      setTimeout(() => {
        const profiles = mockDb.getProfiles();
        const exists = profiles.find(p => p.email.toLowerCase() === emailTrim);
        if (exists) {
          setError('Email ini sudah terdaftar di dalam sistem!');
          setLoading(false);
          return;
        }

        mockDb.saveProfile(newProfile);
        setSuccess(`Registrasi berhasil! Akun "${fullNameTrim}" siap digunakan. Silakan masuk.`);
        setEmail(emailTrim);
        setPassword(passwordTrim);
        setRegFullName('');
        setRegEmail('');
        setRegPassword('');
        setActiveTab('login');
        setLoading(false);
      }, 600);
    }
  };

  return (
    <div 
      id="authScreen" 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/d/1PP2MXYbGYevbSqguwrPBYjKxLjR2B5tL')" }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      {/* Decorative ambient background gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl z-10 relative transition-all duration-300">
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <img 
              src="https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q" 
              alt="ASSA Logo" 
              loading="lazy"
              decoding="async"
              className="h-14 object-contain"
            />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Sistem Backcharge Nasional</h2>
          <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider">PT ADI SARANA ARMADA TBK</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'login'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Masuk Aplikasi
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Daftar Akun Baru
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium animate-pulse flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl font-semibold flex items-start gap-2">
            <span className="flex-shrink-0">✨</span>
            <span>{success}</span>
          </div>
        )}

        {/* TAB 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Email Perusahaan</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@company.id"
                  className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-10 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 hover:bg-black disabled:opacity-50 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Menghubungkan...' : 'Masuk Aplikasi'}</span>
            </button>
            
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="w-full text-center text-[10px] font-extrabold text-slate-400 hover:text-slate-900 transition-colors pt-1"
            >
              Lupa Password?
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Nama Lengkap</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Nama Lengkap Karyawan"
                  className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Email Perusahaan</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nama.karyawan@assarent.co.id"
                  className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Role Otoritas</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                  <UserCheck className="w-3.5 h-3.5" />
                </span>
                <select
                  value={regRole}
                  onChange={(e) => handleRegRoleChange(e.target.value as UserRole)}
                  className="w-full text-[11px] text-slate-900 border border-slate-200 rounded-xl pl-8 pr-2 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold appearance-none cursor-pointer"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isRegionalHeadRole(regRole) || regRole === 'Maintenance Center' ? (
              <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cabang Dikelola ({selectedBranchList.length} Terpilih)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRegBranch(WEST_BRANCHES.join(', '))}
                      className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                      title="Pilih Cabang Wilayah Barat"
                    >
                      West
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegBranch(CENTRAL_BRANCHES.join(', '))}
                      className="text-[9px] font-bold px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded transition-colors"
                      title="Pilih Cabang Wilayah Tengah"
                    >
                      Central
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegBranch(EAST_BRANCHES.join(', '))}
                      className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-colors"
                      title="Pilih Cabang Wilayah Timur"
                    >
                      East
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegBranch('Nasional')}
                      className="text-[9px] font-bold px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded transition-colors"
                      title="Pilih Seluruh Indonesia / Nasional"
                    >
                      Nasional
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegBranch(BRANCH_LIST.join(', '))}
                      className="text-[9px] font-bold px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                    >
                      Semua
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-1">
                  {BRANCH_LIST.map((bName) => {
                    const isChecked = selectedBranchList.includes(bName) || regBranch === 'Nasional';
                    return (
                      <label
                        key={bName}
                        onClick={() => {
                          if (regBranch === 'Nasional') {
                            setRegBranch(bName);
                          } else {
                            toggleRegBranchSelection(bName);
                          }
                        }}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{bName}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  * Maintenance Center dan Regional Head dapat memilih banyak cabang sekaligus atau klik 'Nasional'.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Cabang Kantor</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <select
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    className="w-full text-[11px] text-slate-900 border border-slate-200 rounded-xl pl-8 pr-2 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold appearance-none cursor-pointer"
                  >
                    {BRANCH_LIST.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Password Baru</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Pilih password kuat"
                  className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-10 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 hover:bg-black disabled:opacity-50 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Baru'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Lupa Password?</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Hubungi Administrator untuk mereset password.<br/><br/>
              Administrator akan mereset password Anda ke password default <span className="font-bold text-slate-900">password123</span>. Setelah login, segera ganti password melalui menu "icon gembok" Ganti Password.
            </p>
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-3 rounded-xl transition-all"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

