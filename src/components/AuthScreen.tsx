import React, { useState } from 'react';
import { Key, Mail } from 'lucide-react';
import { Profile } from '../types';
import { supabase, isSupabaseConfigured, mockDb } from '../supabaseClient';

interface AuthScreenProps {
  onLoginSuccess: (profile: Profile) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl z-10 relative">
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center">
            <img 
              src="https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q" 
              alt="ASSA Logo" 
              loading="lazy"
              decoding="async"
              className="h-16 object-contain"
            />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Login Sistem Backcharge</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">PT ADI SARANA ARMADA TBK</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1 tracking-wider">Email Perusahaan</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.id"
                className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1 tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl pl-9 pr-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Menghubungkan...' : 'Masuk Aplikasi'}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setShowForgotPasswordModal(true)}
            className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors pt-2"
          >
            Lupa Password?
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
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
