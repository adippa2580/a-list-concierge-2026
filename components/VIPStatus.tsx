'use client';

import { Star, Zap, Lock, Gift, Calendar, Info, Settings, CreditCard } from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AListLogo } from './AListLogo';
import { motion } from 'framer-motion';

const vipTiers = [
  { name: 'Bronze', spend: 0 },
  { name: 'Silver', spend: 2500 },
  { name: 'Gold Elite', spend: 8500 },
  { name: 'Platinum', spend: 15000 },
  { name: 'Diamond', spend: 30000 }
];

export function VIPStatus() {
  const currentSpend = 8500;
  const currentTier = 2; // Gold Elite
  const nextTier = vipTiers[currentTier + 1];
  const progress = ((currentSpend - vipTiers[currentTier].spend) / (nextTier.spend - vipTiers[currentTier].spend)) * 100;

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-white/60">Membership</h1>
      </div>
      <div className="p-6">
        <div className="relative aspect-[1.586/1] w-full max-w-sm mx-auto rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(255,255,255,0.1)] group">
          <div className="absolute inset-0 bg-black border border-white/10 p-8 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <AListLogo variant="icon" size="sm" />
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-white border border-white px-3 py-1 bg-white/5">
                {vipTiers[currentTier].name}
              </span>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/40 mb-2">Member Identifier</p>
              <p className="font-mono text-base tracking-[0.4em] text-white">AL-00{currentSpend}-RIV</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}