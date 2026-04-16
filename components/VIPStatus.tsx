'use client';

import { Shield, Crown, Star, Lock, CheckCircle2, TrendingUp, Award, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { AListLogo } from './AListLogo';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

const vipTiers = [
  { name: 'Silver', minSpend: 0, color: 'text-white/40', borderColor: 'border-white/10' },
  { name: 'Gold', minSpend: 5000, color: 'text-amber-400', borderColor: 'border-amber-400/20' },
  { name: 'Platinum', minSpend: 15000, color: 'text-[#E5E4E2]', borderColor: 'border-[#E5E4E2]/20' },
  { name: 'Diamond', minSpend: 50000, color: 'text-cyan-300', borderColor: 'border-cyan-300/20' }
];

const TIER_BENEFITS: Record<string, { name: string; tier: string; icon: any; unlocked: boolean }[]> = {
  Silver: [
    { name: 'Priority Table Booking', tier: 'Silver', icon: Star, unlocked: true },
    { name: 'Skip the Queue', tier: 'Silver', icon: TrendingUp, unlocked: true },
    { name: 'VIP Lounge Access', tier: 'Gold', icon: Crown, unlocked: false },
    { name: 'Complimentary Upgrades', tier: 'Gold', icon: Sparkles, unlocked: false },
    { name: 'Private Events', tier: 'Platinum', icon: Shield, unlocked: false },
    { name: 'Personal Concierge', tier: 'Platinum', icon: Award, unlocked: false },
    { name: 'Exclusive Artist Access', tier: 'Diamond', icon: Star, unlocked: false },
    { name: 'Secret Menu Privileges', tier: 'Diamond', icon: Lock, unlocked: false }
  ],
  Gold: [
    { name: 'Priority Table Booking', tier: 'Silver', icon: Star, unlocked: true },
    { name: 'Skip the Queue', tier: 'Silver', icon: TrendingUp, unlocked: true },
    { name: 'VIP Lounge Access', tier: 'Gold', icon: Crown, unlocked: true },
    { name: 'Complimentary Upgrades', tier: 'Gold', icon: Sparkles, unlocked: true },
    { name: 'Private Events', tier: 'Platinum', icon: Shield, unlocked: false },
    { name: 'Personal Concierge', tier: 'Platinum', icon: Award, unlocked: false },
    { name: 'Exclusive Artist Access', tier: 'Diamond', icon: Star, unlocked: false },
    { name: 'Secret Menu Privileges', tier: 'Diamond', icon: Lock, unlocked: false }
  ],
  Platinum: [
    { name: 'Priority Table Booking', tier: 'Silver', icon: Star, unlocked: true },
    { name: 'Skip the Queue', tier: 'Silver', icon: TrendingUp, unlocked: true },
    { name: 'VIP Lounge Access', tier: 'Gold', icon: Crown, unlocked: true },
    { name: 'Complimentary Upgrades', tier: 'Gold', icon: Sparkles, unlocked: true },
    { name: 'Private Events', tier: 'Platinum', icon: Shield, unlocked: true },
    { name: 'Personal Concierge', tier: 'Platinum', icon: Award, unlocked: true },
    { name: 'Exclusive Artist Access', tier: 'Diamond', icon: Star, unlocked: false },
    { name: 'Secret Menu Privileges', tier: 'Diamond', icon: Lock, unlocked: false }
  ],
  Diamond: [
    { name: 'Priority Table Booking', tier: 'Silver', icon: Star, unlocked: true },
    { name: 'Skip the Queue', tier: 'Silver', icon: TrendingUp, unlocked: true },
    { name: 'VIP Lounge Access', tier: 'Gold', icon: Crown, unlocked: true },
    { name: 'Complimentary Upgrades', tier: 'Gold', icon: Sparkles, unlocked: true },
    { name: 'Private Events', tier: 'Platinum', icon: Shield, unlocked: true },
    { name: 'Personal Concierge', tier: 'Platinum', icon: Award, unlocked: true },
    { name: 'Exclusive Artist Access', tier: 'Diamond', icon: Star, unlocked: true },
    { name: 'Secret Menu Privileges', tier: 'Diamond', icon: Lock, unlocked: true }
  ]
};

const NEXT_TIER: Record<string, { name: string; spend: number }> = {
  Silver: { name: 'Gold', spend: 5000 },
  Gold: { name: 'Platinum', spend: 15000 },
  Platinum: { name: 'Diamond', spend: 50000 },
  Diamond: { name: 'Diamond', spend: 50000 }
};

export function VIPStatus() {
  const { userId } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) setProfile(await res.json());
    } catch (_e) {
      // use defaults
    } finally {
      setLoading(false);
    }
  };

  const currentTier = profile?.tier || null;
  const verifiedSpend = profile?.stats?.totalSpend ?? 0;
  const points = profile?.points ?? 0;
  const sessions = profile?.stats?.sessions ?? 0;
  const name = profile?.name || 'Member';
  const memberSince = profile?.memberSince || 'Unavailable';
  const nextTier = NEXT_TIER[currentTier] || NEXT_TIER.Platinum;
  const progress = Math.min((verifiedSpend / nextTier.spend) * 100, 100);
  const benefits = TIER_BENEFITS[currentTier] || TIER_BENEFITS.Platinum;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <Loader2 size={24} className="text-[#E5E4E2]/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      {/* Editorial Header */}
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-8 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">VIP Status</h2>
          </div>
          <div className="w-12 h-12 platinum-border flex items-center justify-center bg-[#011410]">
            <Shield size={20} className="text-[#E5E4E2]" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="px-6 py-12 space-y-12">
        {/* Digital Membership Card */}
        <motion.div
          className="relative bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-[#E5E4E2]/20 p-8 overflow-hidden"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
          <div className="absolute inset-0 opacity-30" />

          <div className="relative z-10 space-y-8">
            <div className="flex items-start justify-between">
              <AListLogo variant="minimal" size="sm" theme="monochrome" className="opacity-40" />
              <Badge className="bg-[#E5E4E2]/10 border border-[#E5E4E2]/20 text-[#E5E4E2] text-[8px] uppercase tracking-widest px-3 py-1 rounded-full font-bold">
                {currentTier || 'Unavailable'}
              </Badge>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-serif italic uppercase tracking-wider platinum-gradient">{name}</h3>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold">Member Since {memberSince}</p>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-2xl font-light font-serif italic">{verifiedSpend === 0 ? '—' : `$${(verifiedSpend / 1000).toFixed(1)}K`}</p>
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">Verified Spend</p>
              </div>
              <div>
                <p className="text-2xl font-light font-serif italic">{points === 0 ? '—' : points.toLocaleString()}</p>
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">Points</p>
              </div>
              <div>
                <p className="text-2xl font-light font-serif italic">{sessions === 0 ? '—' : sessions}</p>
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">Sessions</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress to Next Tier */}
        <div className="space-y-4">
          {currentTier ? (
            <>
              <div className="flex justify-between text-[9px] uppercase tracking-[0.3em] text-white/40 font-bold">
                <span>{currentTier}</span>
                <span>{nextTier.name} (${nextTier.spend.toLocaleString()})</span>
              </div>
              <div className="h-1 w-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#8E8E93] via-[#E5E4E2] to-[#F5F5F7]"
                />
              </div>
              {currentTier !== 'Diamond' && (
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/20 font-bold text-center">
                  ${(nextTier.spend - verifiedSpend).toLocaleString()} remaining for {nextTier.name} Status
                </p>
              )}
            </>
          ) : (
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold text-center">Tier data unavailable</p>
          )}
        </div>

        {/* Tier Hierarchy */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Tier Hierarchy</h3>
          <div className="grid grid-cols-4 gap-2">
            {vipTiers.map((tier) => (
              <div
                key={tier.name}
                className={`p-4 border text-center space-y-2 ${
                  currentTier && tier.name === currentTier
                    ? `${tier.borderColor} bg-white/5`
                    : 'border-white/5 opacity-40'
                }`}
              >
                <Crown size={16} className={`mx-auto ${tier.color}`} />
                <p className="text-[8px] font-bold uppercase tracking-widest">{tier.name}</p>
                <p className="text-[7px] text-white/30 uppercase tracking-wider">${tier.minSpend.toLocaleString()}+</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Unlocked Perks</h3>
          <div className="space-y-2">
            {currentTier ? (
              benefits.map((benefit, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-5 border transition-all ${
                    benefit.unlocked
                      ? 'border-white/10 bg-zinc-950/40 hover:border-[#E5E4E2]/20'
                      : 'border-white/5 opacity-30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 border ${benefit.unlocked ? 'border-[#E5E4E2]/20 bg-white/5' : 'border-white/5'} flex items-center justify-center`}>
                      <benefit.icon size={14} className={benefit.unlocked ? 'text-[#E5E4E2]' : 'text-white/20'} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">{benefit.name}</p>
                      <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{benefit.tier} Tier</p>
                    </div>
                  </div>
                  {benefit.unlocked ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Lock size={14} className="text-white/20" />
                  )}
                </div>
              ))
            ) : (
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold text-center py-4">Perks unavailable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}