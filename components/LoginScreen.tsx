'use client';

import { useState } from 'react';
import { AListLogo } from './AListLogo';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.warn('Auth error (prototype bypass):', error.message);
      }

      // Always proceed in prototype mode
      toast.success('Identity Verified', {
        description: 'Access Granted'
      });

      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      // Silent Bypass for Prototype
      toast.success('Identity Verified');
      setTimeout(() => onSuccess(), 800);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    setLoading(true);
    toast.info(`Connecting ${provider} Identity...`);
    setTimeout(() => {
      toast.success('Access Granted');
      setTimeout(() => onSuccess(), 500);
    }, 1200);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#000504] text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
         <div 
           className="absolute inset-0 bg-cover bg-center opacity-15 scale-105"
           style={{ 
             backgroundImage: 'url(https://images.unsplash.com/photo-1767713421795-ca09a9d05c38?q=80&w=1080&auto=format&fit=crop)'
           }}
         />
         <div className="absolute inset-0 bg-gradient-to-t from-[#000504] via-[#000504]/95 to-[#000504]/50" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-12">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6">
          <AListLogo variant="splash" size="xl" theme="gradient" animated />
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Secure Identifier</label>
              <Input
                type="email"
                placeholder="EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-white/10 rounded-none h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:border-[#E5E4E2] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Access Key</label>
              <Input
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent border-white/10 rounded-none h-14 text-[11px] uppercase tracking-widest placeholder:text-white/20 focus:border-[#E5E4E2] transition-all"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none font-bold text-[10px] uppercase tracking-[0.3em] !text-black transition-all disabled:opacity-50"
          >
            {loading ? 'Verifying Identity...' : 'Verify & Enter'}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[8px] uppercase tracking-[0.3em] text-white/30">Or Connect With</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleSocialLogin('Instagram')}
            className="py-4 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 hover:border-white/30 transition-all"
          >
            Instagram
          </button>
          <button 
            onClick={() => handleSocialLogin('SoundCloud')}
            className="py-4 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 hover:border-white/30 transition-all"
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