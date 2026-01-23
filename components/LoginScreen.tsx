'use client';

import { AListLogo } from './AListLogo';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Music, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export function LoginScreen({ onLogin }: any) {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1588419651107-bb8e27af6ff5?q=80&w=1080&auto=format&fit=crop)' }} />
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-6">
          <AListLogo size="xl" variant="minimal" />
          <h2 className="text-2xl font-light tracking-widest uppercase">Member Access</h2>
        </div>
        <div className="space-y-6">
          <Input placeholder="EMAIL ADDRESS" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-6 text-white" />
          <Button onClick={onLogin} className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-none uppercase tracking-[0.2em] text-xs font-medium !text-black">
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}