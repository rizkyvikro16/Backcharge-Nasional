import React, { useState } from 'react';
import { PlusCircle, Edit2, Trash2, ShieldCheck, Mail, MapPin, X, Key, Search, Lock, CheckSquare, Square } from 'lucide-react';
import { Profile, UserRole, BRANCH_LIST, MEGABRANCH_LIST, ALL_SYSTEM_BRANCHES, isRegionalHeadRole, WEST_BRANCHES, CENTRAL_BRANCHES, EAST_BRANCHES } from '../types';

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
  const [role, setRole] = useState<UserRole>('ASO');
  const [branch, setBranch] = useState(ALL_SYSTEM_BRANCHES[0]);
  const [password, setPassword] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [branchTab, setBranchTab] = useState<'all' | 'reguler' | 'megabranch'>('all');

  const filteredProfiles = profiles.filter(p => {
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || 
           p.email.toLowerCase().includes(q) || 
           p.branch.toLowerCase().includes(q) || 
           p.role.toLowerCase().includes(q);
  });

  const selectedBranchList = branch === 'Nasional'
    ? ALL_SYSTEM_BRANCHES
    : branch ? branch.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggleBranchSelection = (bName: string) => {
    let currentList = branch === 'Nasional'
      ? ALL_SYSTEM_BRANCHES.filter(x => x !== bName)
      : branch.split(',').map(s => s.trim()).filter(Boolean);

    if (currentList.includes(bName)) {
      currentList = currentList.filter(x => x !== bName);
    } else {
      currentList.push(bName);
    }
    currentList.sort();
    setBranch(currentList.join(', '));
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'ASO Megabranch') {
      setBranch(MEGABRANCH_LIST.join(', '));
      setBranchTab('megabranch');
    } else if (isRegionalHeadRole(newRole) || newRole === 'Maintenance Center') {
      if (newRole === 'Regional Head West') {
        setBranch(WEST_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head Central') {
        setBranch(CENTRAL_BRANCHES.join(', '));
      } else if (newRole === 'Regional Head East') {
        setBranch(EAST_BRANCHES.join(', '));
      } else {
        setBranch(WEST_BRANCHES.join(', '));
      }
      setBranchTab('all');
    } else if (newRole === 'Administrator' || newRole === 'Division Head') {
      setBranch('Nasional');
      setBranchTab('all');
    } else if (branch === 'Nasional' || branch.includes(',')) {
      setBranch(ALL_SYSTEM_BRANCHES[0]);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) {
      setErrorMessage('Email dan Nama Lengkap wajib diisi!');
      return;
    }
    if (!branch || branch.trim() === '') {
      setErrorMessage('Wajib mencentang minimal 1 (satu) cabang kantor untuk staf ini!');
      return;
    }
    onAddUser(email.trim().toLowerCase(), fullName.trim(), role, branch, password.trim() || undefined);
    
    // Reset states
    setEmail('');
    setFullName('');
    setRole('ASO');
    setBranch(ALL_SYSTEM_BRANCHES[0]);
    setPassword('');
    setBranchSearch('');
    setBranchTab('all');
    setShowForm(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!branch || branch.trim() === '') {
      setErrorMessage('Wajib mencentang minimal 1 (satu) cabang kantor untuk staf ini!');
      return;
    }
    
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
    setBranchSearch('');
    setBranchTab('all');
    setShowForm(null);
  };

  const openAddForm = () => {
    setEmail('');
    setFullName('');
    setRole('ASO');
    setBranch(ALL_SYSTEM_BRANCHES[0]);
    setPassword('');
    setBranchSearch('');
    setBranchTab('all');
    setShowForm('add');
  };

  const openEditForm = (p: Profile) => {
    setSelectedUser(p);
    setEmail(p.email);
    setFullName(p.full_name);
    setRole(p.role);
    setBranch(p.branch);
    setPassword(p.password || '');
    setBranchSearch('');
    setBranchTab(p.role === 'ASO Megabranch' ? 'megabranch' : 'all');
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] sm:max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{showForm === 'add' ? 'Tambah Pengguna Baru' : `Edit Staf: ${selectedUser?.email}`}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowForm(null)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                title="Tutup formulir"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={showForm === 'add' ? handleAddSubmit : handleEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-3.5 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 tracking-wider">Email Perusahaan</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="staf@company.id"
                        className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 tracking-wider">Nama Lengkap</label>
                    <input 
                      type="text" 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aris Munandar"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 tracking-wider">
                      {showForm === 'add' ? 'Password Akun' : 'Ubah Password'}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                        <Key className="w-3.5 h-3.5" />
                      </span>
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={showForm === 'add' ? 'Password baru' : 'Kosongkan jika tetap'}
                        className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 tracking-wider">Otoritas Peran / Role</label>
                    <select 
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ASO">ASO</option>
                      <option value="Maintenance Center">Maintenance Center</option>
                      <option value="ASO Megabranch">ASO Megabranch</option>
                      <option value="Sales Head">Sales Head</option>
                      <option value="BRO">BRO</option>
                      <option value="Admin">Admin</option>
                      <option value="Admin Head">Admin Head</option>
                      <option value="Administrator">Administrator</option>
                      <option value="Kepala Cabang">Kepala Cabang</option>
                      <option value="Division Head">Division Head</option>
                      <option value="Regional Head West">Regional Head West</option>
                      <option value="Regional Head Central">Regional Head Central</option>
                      <option value="Regional Head East">Regional Head East</option>
                      <option value="Regional Head">Regional Head (General)</option>
                    </select>
                  </div>
                </div>

                {/* BRANCH SELECTION VIA CHECKBOXES (NO DROPDOWN) */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1.5 tracking-wider">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>Pilihan Cabang / BSO</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                        {branch === 'Nasional' ? 'Nasional' : `${selectedBranchList.length} Dipilih`}
                      </span>
                    </label>
                    
                    {/* Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBranch('Nasional')}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${
                          branch === 'Nasional' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                        title="Pilih seluruh cabang di Indonesia"
                      >
                        Nasional
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(MEGABRANCH_LIST.join(', '))}
                        className="text-[9px] font-bold px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition-all"
                        title="Pilih seluruh BSO Megabranch"
                      >
                        Semua BSO
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(WEST_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition-all"
                        title="Wilayah Barat"
                      >
                        West
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(CENTRAL_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition-all"
                        title="Wilayah Tengah"
                      >
                        Central
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch(EAST_BRANCHES.join(', '))}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition-all"
                        title="Wilayah Timur"
                      >
                        East
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranch('')}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-600 rounded transition-all"
                        title="Hapus pilihan"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs and search bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setBranchTab('all')}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${
                          branchTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua ({ALL_SYSTEM_BRANCHES.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchTab('reguler')}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${
                          branchTab === 'reguler' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Reguler ({BRANCH_LIST.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchTab('megabranch')}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${
                          branchTab === 'megabranch' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        BSO ({MEGABRANCH_LIST.length})
                      </button>
                    </div>

                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder="Cari cabang / BSO..."
                        className="w-full text-[10px] pl-7 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Checkbox Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-36 sm:max-h-40 overflow-y-auto custom-scrollbar p-1 bg-white rounded-lg border border-slate-200">
                    {ALL_SYSTEM_BRANCHES
                      .filter((bName) => {
                        if (branchTab === 'reguler' && !BRANCH_LIST.includes(bName)) return false;
                        if (branchTab === 'megabranch' && !MEGABRANCH_LIST.includes(bName)) return false;
                        if (branchSearch.trim()) {
                          return bName.toLowerCase().includes(branchSearch.toLowerCase().trim());
                        }
                        return true;
                      })
                      .map((bName) => {
                        const isChecked = branch === 'Nasional' || selectedBranchList.includes(bName);
                        const isBso = MEGABRANCH_LIST.includes(bName);
                        return (
                          <label
                            key={bName}
                            onClick={() => toggleBranchSelection(bName)}
                            className={`flex items-center space-x-1 px-1.5 py-1 rounded-md border text-[10px] font-bold cursor-pointer transition-all select-none ${
                              isChecked
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-3 h-3 text-white shrink-0" />
                            ) : (
                              <Square className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate flex-1">{bName}</span>
                            {isBso && (
                              <span className={`text-[7px] px-1 py-0.2 rounded font-extrabold shrink-0 ${
                                isChecked ? 'bg-blue-800/60 text-blue-100' : 'bg-slate-200 text-slate-600'
                              }`}>
                                BSO
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </div>

                  {/* Selected Branches Summary */}
                  <div className="text-[9px] text-slate-500 bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200 flex items-start gap-1">
                    <span className="font-bold text-slate-700 shrink-0">Terpilih:</span>
                    <span className="font-mono text-slate-800 break-words leading-tight flex-1">
                      {branch === 'Nasional' 
                        ? `Nasional (Semua ${ALL_SYSTEM_BRANCHES.length} Cabang & BSO Aktif)`
                        : selectedBranchList.length > 0 
                          ? selectedBranchList.join(', ') 
                          : 'Belum ada cabang dipilih (Wajib centang minimal 1 cabang)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex items-center justify-end space-x-2 px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/70 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all"
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
              Apakah Anda yakin ingin menghapus akses Backcharge untuk staf berikut?
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
