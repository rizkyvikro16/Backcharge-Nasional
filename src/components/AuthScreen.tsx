import React, { useState } from 'react';
import { Shield, Key, Mail, Users, Landmark, UserCheck } from 'lucide-react';
import { Profile, UserRole } from '../types';
import { supabase, isSupabaseConfigured, mockDb } from '../supabaseClient';

interface AuthScreenProps {
  onLoginSuccess: (profile: Profile) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const emailTrim = email.trim().toLowerCase();
    
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. First check if a profile exists with this email in public.profiles table
        const { data: dbProfile, error: dbProfileError } = await supabase
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
          const { data: profileData, error: profileError } = await supabase
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
    <div id="authScreen" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative ambient background gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl z-10 relative">
        <div className="text-center mb-6">
          <div className="p-3.5 bg-blue-600/20 text-blue-400 rounded-2xl inline-block shadow-lg border border-blue-500/30 mb-3 animate-pulse">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Sistem Backcharge</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Portal Monitoring & Alur Kerja Denda Nasional</p>
          
          {isSupabaseConfigured ? (
            <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ● Connected to Supabase
            </span>
          ) : (
            <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              ✦ Sandbox Simulation Mode
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-xl font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1 tracking-wider">Email Perusahaan</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.id"
                className="w-full text-xs text-white border border-slate-800 rounded-xl pl-9 pr-4 py-3 bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1 tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs text-white border border-slate-800 rounded-xl pl-9 pr-4 py-3 bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Menghubungkan...' : 'Masuk Aplikasi'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
