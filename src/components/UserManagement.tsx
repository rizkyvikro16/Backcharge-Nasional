import React, { useState } from 'react';
import { PlusCircle, Edit2, Trash2, ShieldCheck, Mail, MapPin, X, Key, Search, Lock, CheckSquare, Square } from 'lucide-react';
import { Profile, UserRole, BRANCH_LIST, isRegionalHeadRole } from '../types';

const WEST_BRANCHES = ['Lampung', 'Medan', 'Padang', 'Palembang', 'Pekanbaru'];
const CENTRAL_BRANCHES = ['Bandung', 'Jakarta', 'Pontianak'];
const EAST_BRANCHES = ['Bali', 'Balikpapan', 'Banjarmasin', 'Makassar', 'Malang', 'Semarang', 'Solo', 'Surabaya'];

interface UserManagementProps {
  profiles: Profile[];
  currentUser: Profile;
  onAddUser: (email: string, fullName: string, role: UserRole, branch: string, password?: string) => void;
  onUpdateUser: (id: string, updates: Partial<Profile>) => void;
  onDeleteUser: (id: string) => void;
}

export default function UserManagement({ 
  profiles, 
  currentUser, 
  onAddUser, 
  onUpdateUser, 
  onDeleteUser 
}: UserManagementProps) {

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('ASO / Staff');
  const [branch, setBranch] = useState('Jakarta');
  const [password, setPassword] = useState('');

  const filteredProfiles = profiles.filter(p => {
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || 
           p.email.toLowerCase().includes(q) || 
           p.branch.toLowerCase().includes(q) || 
           p.role.toLowerCase().includes(q);
  });

  const selectedBranchList = branch === 'Nasional'
    ? ['Nasional']
    : branch.split(',').map(s => s.trim()).filter(Boolean);

  const toggleBranchSelection = (bName: string) => {
    let currentList = selectedBranchList.filter(x => x !== 'Nasional');
    if (currentList.includes(bName)) {
      currentList = currentList.filter(x => x !== bName);
    } else {
      currentList.push(bName);
    }
    currentList.sort();
    setBranch(currentList.length > 0 ? currentList.join(', ') : 'Jakarta');
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (isRegionalHeadRole(newRole)) {
      if (newRole === 'Regional Head West') {
        setBranch(WEST_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head Central') {
        setBranch(CENTRAL_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head East') {
        setBranch(EAST_BRANCHES.join(', '));
      } else if (!branch.includes(',')) {
        setBranch(WEST_BRANCHES.join(', '));
      }
    } else if (branch.includes(',')) {
      setBranch('Jakarta');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) {
      setErrorMessage('Email dan Nama Lengkap wajib diisi!');
      return;
    }
    onAddUser(email.trim().toLowerCase(), fullName.trim(), role, branch, password.trim() || undefined);
    
    // Reset states
    setEmail('');
    setFullName('');
    setRole('ASO / Staff');
    setBranch('Jakarta');
    setPassword('');
    setShowForm(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const updates: Partial<Profile> = {
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: role,
      branch: branch
    };

    if (password.trim()) {
      updates.password = password.trim();
    }
    
    onUpdateUser(selectedUser.id, updates);

    setSelectedUser(null);
    setEmail('');
    setFullName('');
    setPassword('');
    setShowForm(null);
  };

  const openAddForm = () => {
    setEmail('');
    setFullName('');
    setRole('ASO / Staff');
    setBranch('Jakarta');
    setPassword('');
    setShowForm('add');
  };

  const openEditForm = (p: Profile) => {
    setSelectedUser(p);
    setEmail(p.email);
    setFullName(p.full_name);
    setRole(p.role);
    setBranch(p.branch);
    setPassword(p.password || '');
    setShowForm('edit');
  };

  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = (p: Profile) => {
    if (p.id === currentUser.id || p.email.toLowerCase() === currentUser.email.toLowerCase()) {
      setErrorMessage("Anda tidak bisa menghapus diri Anda sendiri!");
      return;
    }
    setUserToDelete(p);
  };

  return (
    <div className="space-y-4">
      
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative flex-grow max-w-md w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari email staf, nama, kota, peran..." 
            className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <button 
          onClick={openAddForm}
          className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all flex-shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Grid List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">Email Akun</th>
                <th className="p-3">Role Otoritas</th>
                <th className="p-3">Cabang</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 border-b border-slate-100">
                  <td className="p-3 text-slate-900 font-extrabold flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">
                      {p.full_name ? p.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span>{p.full_name}</span>
                  </td>
                  <td className="p-3 text-slate-500 font-semibold">{p.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {p.role}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-emerald-700">
                    {p.branch && p.branch.includes(',') ? (
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {p.branch.split(',').map(b => (
                          <span key={b.trim()} className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                            {b.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>{p.branch}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button 
                        onClick={() => openEditForm(p)}
                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors"
                        title="Edit Data Staf"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {currentUser.role === 'Administrator' && (
                        <button 
                          onClick={() => setUserToResetPassword(p)}
                          className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 rounded-lg transition-colors"
                          title="Reset Password ke password123"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(p)}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                        title="Hapus Staf"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                    Tidak ada staf terekam matching kriteria pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL: ADD / EDIT USER */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>{showForm === 'add' ? 'Tambah Pengguna Baru' : `Edit Staf: ${selectedUser?.email}`}</span>
              </h3>
              <button onClick={() => setShowForm(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={showForm === 'add' ? handleAddSubmit : handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Perusahaan</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staf@company.id"
                    className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aris Munandar"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {showForm === 'add' ? 'Password Akun' : 'Ubah Password'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Key className="w-3.5 h-3.5" />
                  </span>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={showForm === 'add' ? 'Masukkan password baru' : 'Kosongkan jika tidak ingin diubah'}
                    className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Otoritas Peran / Role</label>
                <select 
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ASO / Staff">ASO / Staff</option>
                  <option value="Sales Head">Sales Head</option>
                  <option value="BRO">BRO</option>
                  <option value="Admin">Admin</option>
                  <option value="Administrator">Administrator</option>
                  <option value="Kepala Cabang">Kepala Cabang</option>
                  <option value="Division Head">Division Head</option>
                  <option value="Regional Head West">Regional Head West</option>
                  <option value="Regional Head Central">Regional Head Central</option>
                  <option value="Regional Head East">Regional Head East</option>
                  <option value="Regional Head">Regional Head (General)</option>
                </select>
              </div>

              {isRegionalHeadRole(role) ? (
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cabang Dikelola ({selectedBranchList.length} Terpilih)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBranch(WEST_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                        title="Pilih Cabang Wilayah Barat"
                      >
                        West
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(CENTRAL_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded transition-colors"
                        title="Pilih Cabang Wilayah Tengah"
                      >
                        Central
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(EAST_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-colors"
                        title="Pilih Cabang Wilayah Timur"
                      >
                        East
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(BRANCH_LIST.join(', '))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                      >
                        Semua
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-1">
                    {BRANCH_LIST.map((bName) => {
                      const isChecked = selectedBranchList.includes(bName);
                      return (
                        <label
                          key={bName}
                          onClick={() => toggleBranchSelection(bName)}
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
                    * Regional Head dapat memilih banyak cabang sekaligus.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cabang</label>
                  <select 
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Nasional">Nasional (HQ/Pusat)</option>
                    {BRANCH_LIST.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-6 pt-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
                >
                  {showForm === 'add' ? 'Tambahkan Staf' : 'Perbarui Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Konfirmasi Hapus Pengguna</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akses denda untuk staf berikut?
            </p>
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <p className="font-extrabold text-slate-800">{userToDelete.full_name}</p>
              <p className="text-slate-500 font-mono mt-0.5">{userToDelete.email}</p>
              <p className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 px-2 py-0.5 rounded inline-block">
                {userToDelete.role} - {userToDelete.branch}
              </p>
            </div>
            <div className="flex justify-end space-x-2 mt-5">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  onDeleteUser(userToDelete.id);
                  setUserToDelete(null);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all"
              >
                Hapus Akses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM RESET PASSWORD MODAL */}
      {userToResetPassword && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Konfirmasi Reset Password</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mereset password untuk staf berikut ke password default <span className="font-bold text-slate-900">password123</span>?
            </p>
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-900">
              <p className="font-extrabold text-slate-800">{userToResetPassword.full_name}</p>
              <p className="text-slate-500 font-mono mt-0.5">{userToResetPassword.email}</p>
              <p className="text-[10px] text-amber-700 font-bold mt-1 bg-amber-100 px-2 py-0.5 rounded inline-block">
                {userToResetPassword.role} - {userToResetPassword.branch}
              </p>
            </div>
            <div className="flex justify-end space-x-2 mt-5">
              <button 
                onClick={() => setUserToResetPassword(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  onUpdateUser(userToResetPassword.id, { password: 'password123' });
                  setUserToResetPassword(null);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ERROR MESSAGE DIALOG */}
      {errorMessage && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-red-600 mb-2">Tindakan Tidak Diperbolehkan</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {errorMessage}
            </p>
            <div className="flex justify-end mt-4">
              <button 
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
