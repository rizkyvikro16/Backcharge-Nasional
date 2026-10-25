import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getApiUrl } from '../lib/api';

interface ResetPasswordModalProps {
  email: string;
  onSuccess: (profile?: any, token?: string) => void;
}

export default function ResetPasswordModal({ email, onSuccess }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pwd = newPassword.trim();
    const confirmPwd = confirmPassword.trim();

    if (pwd.length < 6) {
      setError("Password baru minimal harus terdiri dari 6 karakter.");
      return;
    }

    if (pwd !== confirmPwd) {
      setError("Konfirmasi password baru tidak cocok. Silakan periksa kembali.");
      return;
    }

    if (pwd.toLowerCase() === 'password123') {
      setError("Password baru tidak boleh menggunakan password default ('password123'). Silakan buat password unik pribadi.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: pwd 
        })
      });

      let d: any = {};
      try {
        d = await res.json();
      } catch {
        throw new Error(`Gagal menghubungi server (${res.status}).`);
      }

      if (!res.ok || !d.success) {
        throw new Error(d.error || "Gagal memperbarui kata sandi.");
      }

      // Simpan token resmi jika disediakan backend
      if (d.token) {
        localStorage.setItem("backcharge_auth_token", d.token);
      }

      // Alihkan pengguna ke Dashboard utama
      onSuccess(d.profile, d.token);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan password baru.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Wajib Ganti Kata Sandi</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Pengamanan Akun Pengguna Pertama Kali</p>
          </div>
        </div>

        {/* Security Notification Box */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 mb-5 text-[11px] text-amber-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Kebijakan Keamanan Sistem:</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Anda masuk menggunakan akun baru atau password sementara. Demi keamanan data backcharge, Anda <b>wajib memperbarui password</b> sebelum dapat melanjutkan ke aplikasi.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Akun Email */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Akun
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={email}
              className="w-full text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 cursor-not-allowed select-all"
            />
          </div>

          {/* Password Baru */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
              Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-4 pr-10 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
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

          {/* Konfirmasi Password Baru */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
              Konfirmasi Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-4 pr-10 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && confirmPassword && (
              <p className={`text-[10px] mt-1.5 font-bold flex items-center gap-1 ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Password cocok</span>
                  </>
                ) : (
                  <span>Password belum sama</span>
                )}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-slate-950 hover:bg-black disabled:opacity-50 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Menyimpan Password Baru...</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Simpan & Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-center text-slate-400 mt-4">
          Pop-up ini tidak dapat ditutup sebelum kata sandi berhasil diperbarui.
        </p>
      </div>
    </div>
  );
}
