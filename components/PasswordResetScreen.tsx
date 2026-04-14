'use client';

import { useState } from 'react';
import { AListLogo } from './AListLogo';
import { CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase/client';

interface PasswordResetScreenProps {
  onComplete: () => void;
}

export function PasswordResetScreen({ onComplete }: PasswordResetScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setTimeout(() => onComplete(), 2000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000504] text-white flex flex-col items-center justify-center px-6 marble-bg">
      <div className="w-full max-w-sm space-y-10">

        {/* Logo */}
        <div className="text-center">
          <AListLogo variant="splash" size="xl" theme="gradient" animated />
        </div>

        {done ? (
          /* Success state */
          <div className="text-center space-y-4">
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
              Password updated
            </p>
            <p className="text-[9px] uppercase tracking-widest text-white/30">
              Signing you in...
            </p>
          </div>
        ) : (
          /* Password form */
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-lg font-serif italic tracking-widest uppercase platinum-gradient">
                Set New Password
              </h1>
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/30">
                Choose a strong password for your account
              </p>
            </div>

            <div className="space-y-4">
              {/* Password field */}
              <div className="relative border-b border-white/10 focus-within:border-[#E5E4E2]/60 transition-colors">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="NEW PASSWORD"
                  className="w-full bg-transparent h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Confirm field */}
              <div className="border-b border-white/10 focus-within:border-[#E5E4E2]/60 transition-colors">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="CONFIRM PASSWORD"
                  className="w-full bg-transparent h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:outline-none"
                />
              </div>

              {/* Strength hint */}
              {password.length > 0 && (
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 flex-1 rounded-full transition-all ${
                        password.length >= [8, 10, 12, 16][i]
                          ? i < 2 ? 'bg-amber-400' : i < 3 ? 'bg-green-400' : 'bg-emerald-400'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-red-300 text-[9px] uppercase tracking-widest">{error}</p>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !password || !confirm}
              className="w-full h-14 border border-[#E5E4E2]/20 text-[10px] font-bold uppercase tracking-[0.3em] text-[#E5E4E2] hover:bg-[#E5E4E2]/5 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
