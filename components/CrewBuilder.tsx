'use client';

import { Users, Plus, Crown, Star, TrendingUp, Gift, Award, Lock, Edit, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Progress } from './ui/progress';
import { AListLogo } from './AListLogo';
import { useState } from 'react';

const myCrews = [
  {
    id: 1,
    name: 'Miami Night Owls',
    emoji: '🦉',
    members: [
      { name: 'You', avatar: 'ME', role: 'founder' },
      { name: 'Sarah Chen', avatar: 'SC', role: 'member' },
      { name: 'Marcus Liu', avatar: 'ML', role: 'member' },
      { name: 'Jessica Park', avatar: 'JP', role: 'member' }
    ],
    totalSpend: 12450,
    nightsOut: 23,
    perks: ['Priority Tables', '10% Discount', 'VIP Access'],
    level: 3,
    nextLevel: 4,
    progress: 65,
    vibe: 'House & Techno',
    favoriteVenues: ['LIV Miami', 'E11EVEN']
  },
  {
    id: 2,
    name: 'The A-Team',
    emoji: '⚡',
    members: [
      { name: 'You', avatar: 'ME', role: 'member' },
      { name: 'David Kim', avatar: 'DK', role: 'founder' },
      { name: 'Alex Rivera', avatar: 'AR', role: 'member' }
    ],
    totalSpend: 8200,
    nightsOut: 15,
    perks: ['Early Access', 'Free Entry'],
    level: 2,
    nextLevel: 3,
    progress: 45,
    vibe: 'EDM & Progressive',
    favoriteVenues: ['Story Miami']
  }
];

const crewBenefits = [
  {
    level: 1,
    name: 'Starter Crew',
    spend: 0,
    perks: ['Crew Chat', 'Shared Calendar', 'Split Payments']
  },
  {
    level: 2,
    name: 'Rising Crew',
    spend: 5000,
    perks: ['Early Access to Events', 'Free Entry Vouchers', '5% Crew Discount']
  },
  {
    level: 3,
    name: 'Elite Crew',
    spend: 10000,
    perks: ['Priority Table Booking', '10% Crew Discount', 'VIP Access', 'Complimentary Upgrades']
  },
  {
    level: 4,
    name: 'Legendary Crew',
    spend: 25000,
    perks: ['Exclusive Events', '15% Crew Discount', 'Private Concierge', 'Secret Menu Access']
  }
];

export function CrewBuilder() {
  const [selectedCrew, setSelectedCrew] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10 font-serif">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-[0.1em] uppercase text-white">My Crews</h1>
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-white hover:text-white/70">
            <Plus size={14} className="mr-1" />
            Create
          </Button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* My Crews */}
        <div className="space-y-6">
          {myCrews.map((crew) => (
            <div key={crew.id} className="border border-white/10 bg-zinc-950">
              {/* Crew Header */}
              <div className="p-6 border-b border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{crew.emoji}</span>
                    <div>
                      <h3 className="text-xl font-medium uppercase tracking-wide font-serif">{crew.name}</h3>
                      <p className="text-[9px] uppercase tracking-widest text-white/60">{crew.vibe}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-white text-black px-2 py-0.5 !text-black">
                      Level {crew.level}
                    </span>
                    {crew.members.find(m => m.name === 'You')?.role === 'founder' && (
                      <span className="text-[8px] uppercase tracking-widest text-white/60 flex items-center gap-1">
                        <Crown size={10} className="text-white" /> Founder
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2 mb-4 relative z-10">
                  <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/80">
                    <span>Progress to Lvl {crew.nextLevel}</span>
                    <span>{crew.progress}%</span>
                  </div>
                  <Progress value={crew.progress} className="h-0.5 bg-white/20" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 relative z-10">
                  <div className="text-center">
                    <p className="text-lg font-light">{crew.members.length}</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/60">Members</p>
                  </div>
                  <div className="text-center border-l border-white/10">
                    <p className="text-lg font-light">${crew.totalSpend.toLocaleString()}</p>
                    <p className="text--[8px] uppercase tracking-widest text-white/60">Spend</p>
                  </div>
                  <div className="text-center border-l border-white/10">
                    <p className="text-lg font-light">{crew.nightsOut}</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/60">Nights</p>
                  </div>
                </div>
              </div>

              {/* Crew Members & Perks */}
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">Members</h4>
                  <button className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-white/70">
                    + Invite
                  </button>
                </div>
                
                <div className="flex gap-2">
                  {crew.members.map((member, index) => (
                    <div key={index} className="relative group/member">
                      <Avatar className="w-10 h-10 rounded-none bg-zinc-900 border border-white/30">
                        <AvatarFallback className="rounded-none bg-zinc-900 text-[10px] text-white/80">
                          {member.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {member.role === 'founder' && (
                        <div className="absolute -top-1 -right-1 bg-black p-0.5 border border-white/30">
                           <Crown size={8} className="text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-2 border-t border-white/10">
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">Unlocked Perks</h4>
                  <div className="flex flex-wrap gap-2">
                    {crew.perks.map((perk, index) => (
                      <span key={index} className="text-[9px] uppercase tracking-widest text-white/80 border border-white/20 px-2 py-1 bg-white/5">
                        {perk}
                      </span>
                    ))}
                  </div>
                </div>

                {crew.members.find(m => m.name === 'You')?.role === 'founder' && (
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 border-white/20 text-white/80 hover:text-white hover:border-white rounded-none h-8 text-[9px] uppercase tracking-widest">
                      Edit
                    </Button>
                    <Button variant="outline" className="h-8 border-white/20 text-white/60 hover:text-red-500 hover:border-red-500 rounded-none px-3">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Crew Benefits Guide */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Award className="text-white/60" size={16} />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Tiers & Benefits</h3>
          </div>

          <div className="space-y-4">
            {crewBenefits.map((benefit, index) => (
              <div
                key={index}
                className={`p-4 border transition-all ${
                  index <= 2
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/10 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest border border-white/30 w-6 h-6 flex items-center justify-center">
                      {benefit.level}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wide">{benefit.name}</h4>
                      <p className="text-[8px] uppercase tracking-widest text-white/60">${benefit.spend.toLocaleString()}+ Spend</p>
                    </div>
                  </div>
                  {index <= 2 ? (
                     <Lock size={12} className="text-white/0" /> // Hidden spacer or check
                  ) : (
                     <Lock size={12} className="text-white/60" />
                  )}
                </div>

                <div className="space-y-1 pl-9 border-l border-white/20 ml-3">
                  {benefit.perks.map((perk, perkIndex) => (
                    <p key={perkIndex} className="text-[9px] uppercase tracking-widest text-white/80">
                      • {perk}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}