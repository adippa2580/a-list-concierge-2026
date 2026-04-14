'use client';

import { useState } from 'react';
import { Shield, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

const ADMIN_PASSWORD = 'alist-admin-2026';

interface AdminGateScreenProps {
  onUnlock: () => void;
}

export function AdminGateScreen({ onUnlock }: AdminGateScreenProps) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');

    // Small artificial delay for UX
    await new Promise(r => setTimeout(r, 400));

    if (password === ADMIN_PASSWORD) {
      onUnlock();
    } else {
      setError('Invalid admin password');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#030508] flex items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #0d0820 0%, #030508 100%)' }}>
      
      {/* Card */}
      <div className={`w-full max-w-sm transition-all ${shake ? 'animate-pulse' : ''}`}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
            <Shield size={28} className="text-purple-400" />
          </div>
          <h1 className="text-[11px] font-bold uppercase tracking-[0.5em] text-white/40 mb-1">A-List</h1>
          <h2 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h2>
          <p className="text-[11px] text-white/30 mt-2 uppercase tracking-widest">Authorised access only</p>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Admin password"
              autoFocus
              className={`w-full bg-white/5 border rounded-xl px-4 py-4 pr-12 text-white placeholder-white/20 text-[13px] outline-none transition-all ${
                error
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-white/10 focus:border-purple-500/50'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-[11px] uppercase tracking-wider">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="w-full py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              background: loading || !password
                ? 'rgba(168,85,247,0.2)'
                : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              color: loading || !password ? 'rgba(168,85,247,0.5)' : '#fff',
              boxShadow: loading || !password ? 'none' : '0 4px 24px rgba(168,85,247,0.3)',
            }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Enter Dashboard <ArrowRight size={14} /></>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] text-white/15 uppercase tracking-widest mt-8">
          ALIST Admin · Restricted Access
        </p>
      </div>
    </div>
  );
}
