'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Users, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AListLogo } from './AListLogo';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

interface CrewPreview {
  crewName: string;
  crewEmoji: string;
  crewLevel: string;
  memberCount: number;
  expiresAt: number;
}

interface JoinCrewScreenProps {
  token: string;
  onAccepted: () => void;
  onDeclined: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze:   'text-amber-500',
  Silver:   'text-[#C0C0C0]',
  Gold:     'text-yellow-400',
  Platinum: 'text-[#E5E4E2]',
  Diamond:  'text-cyan-300',
};

export function JoinCrewScreen({ token, onAccepted, onDeclined }: JoinCrewScreenProps) {
  const { userId } = useAuth();
  const [preview, setPreview] = useState<CrewPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinerName, setJoinerName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [token]);

  const fetchPreview = async () => {
    try {
      const res = await fetch(`${API}/crews/preview/${token}`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || 'Invalid or expired invite link.');
        return;
      }
      setPreview(data);
    } catch (_e) {
      setLoadError('Unable to load invite. Check your connection.');
    }
  };

  const handleJoin = async () => {
    if (!joinerName.trim() || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`${API}/crews/join`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ token, joinerName: joinerName.trim(), joinerUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join crew.');
        setJoining(false);
        return;
      }
      setJoined(true);
      // Auto-navigate to the app after 2.5s
      setTimeout(onAccepted, 2500);
    } catch (_e) {
      setJoinError('Something went wrong. Please try again.');
      setJoining(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (joined && preview) {
    return (
      <div className="min-h-screen bg-[#000504] flex flex-col items-center justify-center px-8 text-white">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="text-center space-y-6"
        >
          <div className="text-6xl mb-2">{preview.crewEmoji}</div>
          <CheckCircle size={48} className="text-emerald-400 mx-auto" />
          <div>
            <h2 className="text-2xl font-serif italic uppercase tracking-wider">You're In</h2>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-2">
              Welcome to {preview.crewName}
            </p>
          </div>
          <p className="text-[9px] text-white/30 uppercase tracking-widest">Taking you to the crew...</p>
        </motion.div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#000504] flex flex-col items-center justify-center px-8 text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-xs"
        >
          <XCircle size={48} className="text-red-400/60 mx-auto" />
          <div>
            <h2 className="text-xl font-serif italic uppercase tracking-wider text-white/80">Invite Invalid</h2>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 mt-3 leading-relaxed">{loadError}</p>
          </div>
          <button
            onClick={onDeclined}
            className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white border border-white/10 hover:border-white/30 px-6 py-3 transition-all"
          >
            Continue to App
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!preview) {
    return (
      <div className="min-h-screen bg-[#000504] flex items-center justify-center">
        <Loader2 size={24} className="text-[#E5E4E2]/30 animate-spin" />
      </div>
    );
  }

  // ── Join screen ────────────────────────────────────────────────────────────
  const expiresIn = Math.max(0, Math.floor((preview.expiresAt - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen bg-[#000504] flex flex-col text-white">
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#E5E4E2]/5 to-transparent pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm space-y-10"
        >
          {/* Logo */}
          <div className="flex justify-center">
            <AListLogo size="md" animated variant="full" />
          </div>

          {/* Crew card */}
          <div className="border border-[#E5E4E2]/15 bg-zinc-950/80 p-8 space-y-6 relative overflow-hidden">
            <div className="absolute inset-0 marble-bg opacity-10 pointer-events-none" />
            <div className="relative z-10 text-center space-y-4">
              <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-white/30">Join Group</p>
              <div className="text-5xl">{preview.crewEmoji}</div>
              <h2 className="text-2xl font-serif italic uppercase tracking-wider">{preview.crewName}</h2>
              <div className="flex items-center justify-center gap-4 pt-2">
                <div className="text-center">
                  <p className={`text-sm font-bold uppercase tracking-widest ${LEVEL_COLORS[preview.crewLevel] ?? 'text-white'}`}>
                    {preview.crewLevel}
                  </p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">Tier</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-sm font-light font-serif italic">{preview.memberCount}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">Members</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center flex flex-col items-center gap-1">
                  <Shield size={14} className="text-white/40" />
                  <p className="text-[7px] uppercase tracking-widest text-white/30">Expires {expiresIn}h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-3">
            <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 block">Your Name</label>
            <Input
              value={joinerName}
              onChange={(e) => setJoinerName(e.target.value)}
              placeholder="Enter your name to join..."
              maxLength={30}
              className="bg-transparent border-white/10 rounded-none h-12 text-[11px] tracking-widest placeholder:text-white/20 focus:border-white transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {joinError && (
              <p className="text-[9px] text-red-400 uppercase tracking-wider">{joinError}</p>
            )}
          </div>

          {/* CTA buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleJoin}
              disabled={!joinerName.trim() || joining}
              className="w-full h-13 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none font-bold text-[9px] uppercase tracking-[0.3em] disabled:opacity-30 !text-black h-12"
            >
              {joining
                ? <><Loader2 size={14} className="animate-spin mr-2" />Joining...</>
                : <><Users size={14} className="mr-2" />Join Crew</>
              }
            </Button>
            <button
              onClick={onDeclined}
              className="w-full text-[9px] font-bold uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors py-2"
            >
              Decline
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
