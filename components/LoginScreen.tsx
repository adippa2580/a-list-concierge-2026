'use client';

import { useState } from 'react';
import { AListLogo } from './AListLogo';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setDisplayNameError('');
    setError('');

    if (mode === 'signup' && !displayName.trim()) {
      setDisplayNameError('Display name is required');
      isValid = false;
    }

    if (!email) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          if (authError.message.toLowerCase().includes('invalid login')) {
            setError('Incorrect email or password.');
          } else {
            setError(authError.message);
          }
          return;
        }
        toast.success('Identity Verified', { description: 'Access Granted' });
        setTimeout(() => onSuccess(), 600);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.session) {
          if (displayName && data.user) {
            await supabase
              .from('profiles')
              .update({ display_name: displayName })
              .eq('id', data.user.id);
          }
          toast.success('Account Created', { description: 'Welcome to A-List' });
          setTimeout(() => onSuccess(), 600);
        } else {
          toast.success('Check Your Inbox', {
            description: 'Confirm your email to complete registration',
          });
          setMode('signin');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
      toast.error('Verification Failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) {
      toast.error(`${provider} login failed`, { description: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-y-auto bg-[#000504] text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15 scale-105"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1767713421795-ca09a9d05c38?q=80&w=1080&auto=format&fit=crop)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000504] via-[#000504]/95 to-[#000504]/50" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6">
          <AListLogo variant="splash" size="xl" theme="gradient" animated />
        </div>

        {/* Mode toggle */}
        <div className="flex border border-white/10">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); }}
            className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-all ${
              mode === 'signin' ? 'bg-white text-[#000504]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-all ${
              mode === 'signup' ? 'bg-white text-[#000504]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-[11px] uppercase tracking-widest">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Display Name <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="YOUR NAME"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setDisplayNameError(''); }}
                  className={`bg-transparent border-white/10 rounded-none h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:border-[#E5E4E2] transition-all ${displayNameError ? 'border-red-500/50' : ''}`}
                />
                {displayNameError && (
                  <p className="text-red-300 text-[9px] uppercase tracking-widest mt-1">{displayNameError}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                Secure Identifier
              </label>
              <Input
                type="email"
                placeholder="EMAIL ADDRESS"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                className={`bg-transparent border-white/10 rounded-none h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:border-[#E5E4E2] transition-all ${
                  emailError ? 'border-red-500/50' : ''
                }`}
              />
              {emailError && (
                <p className="text-red-300 text-[9px] uppercase tracking-widest mt-1">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                Access Key
              </label>
              <Input
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                className={`bg-transparent border-white/10 rounded-none h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:border-[#E5E4E2] transition-all ${
                  passwordError ? 'border-red-500/50' : ''
                }`}
              />
              {passwordError && (
                <p className="text-red-300 text-[9px] uppercase tracking-widest mt-1">{passwordError}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-white text-[#000504] hover:bg-[#E5E4E2] active:bg-[#D5D4D2] active:scale-95 rounded-none font-bold text-[10px] uppercase tracking-[0.3em] !text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            {loading ? 'Verifying...' : mode === 'signin' ? 'Verify & Enter' : 'Create Account'}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[8px] uppercase tracking-[0.3em] text-white/30">Or Connect With</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
            className="py-4 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 hover:border-white/30 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-40"
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => toast.info('Instagram connect available after sign in')}
            disabled={loading}
            className="py-4 border border-[#E1306C]/20 text-[9px] font-bold uppercase tracking-widest text-[#E1306C]/60 hover:bg-[#E1306C]/5 hover:border-[#E1306C]/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 disabled:opacity-40"
          >
            Instagram
          </button>
          <button
            type="button"
            onClick={() => toast.info('SoundCloud connect available after sign in')}
            disabled={loading}
            className="py-4 border border-[#FF5500]/20 text-[9px] font-bold uppercase tracking-widest text-[#FF5500]/60 hover:bg-[#FF5500]/5 hover:border-[#FF5500]/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/20 disabled:opacity-40"
          >
            SoundCloud
          </button>
        </div>

        <p className="text-center text-[7px] uppercase tracking-[0.2em] text-white/20 leading-loose">
          By continuing, you agree to A-List Terms of Service and Privacy Policy.
          <br />All interactions are monitored and encrypted.
        </p>
      </div>
    </div>
  );
}
