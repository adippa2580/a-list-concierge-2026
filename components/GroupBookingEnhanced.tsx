'use client';

import {
  Users, Crown, Plus, Minus, Copy, ChevronRight, X,
  Shield, Check, Lock, Unlock, ArrowRight, Loader2,
  AlertCircle, ExternalLink, ChevronDown
} from 'lucide-react';
import { Button } from './ui/button';
import { AListLogo } from './AListLogo';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const USER_ID = 'default_user';

// ── Types ─────────────────────────────────────────────────────────────────────
type SplitMethod = 'even' | 'host' | 'custom';
type PaymentRail = 'venmo' | 'cashapp' | 'applepay' | 'zelle' | 'cash';
type Screen = 'crew-select' | 'builder' | 'confirm' | 'sent';

interface CrewMember { name: string; avatar: string; role: string; spend: number; }
interface Crew { id: number; name: string; emoji: string; level: string; members: CrewMember[]; }
interface SplitMember extends CrewMember { amount: number; confirmed: boolean; }

// ── Static packages (fetched from backend in future; defined here for speed) ──
const LIQUOR_PACKAGES = [
  { name: 'Standard Selection', bottles: 2, price: 800,  items: ['Grey Goose', 'Don Julio'] },
  { name: 'Premium Reserve',    bottles: 3, price: 1500, items: ['Dom Pérignon', 'Clase Azul', 'Macallan 18'] },
  { name: 'Elite Package',      bottles: 5, price: 3200, items: ['Louis XIII', 'Dom Pérignon Rosé', 'Clase Azul Ultra', 'Macallan 25', 'Belvedere 10'] },
];
const MIXER_PACKAGES = [
  { name: 'Basic Mixer Set',   price: 150, items: ['Cranberry', 'OJ', 'Tonic', 'Soda', 'Red Bull ×6'] },
  { name: 'Premium Mixer Set', price: 300, items: ['Fresh Juices', 'Coconut Water', 'Premium Tonics', 'Red Bull ×12', 'Ginger Beer'] },
];

// ── Payment rails with real deep-link generators ──────────────────────────────
const PAYMENT_RAILS: {
  id: PaymentRail;
  label: string;
  color: string;
  bg: string;
  buildUrl: (handle: string, amount: number, note: string) => string;
  placeholder: string;
  prefix: string;
}[] = [
  {
    id: 'venmo', label: 'Venmo', color: 'text-[#008CFF]',
    bg: 'bg-[#008CFF]/10 hover:bg-[#008CFF]/20 border-[#008CFF]/30',
    buildUrl: (h, amt, note) => `https://venmo.com/${h}?txn=pay&amount=${amt}&note=${encodeURIComponent(note)}`,
    placeholder: 'venmo-username', prefix: '@',
  },
  {
    id: 'cashapp', label: 'Cash App', color: 'text-[#00D64F]',
    bg: 'bg-[#00D64F]/10 hover:bg-[#00D64F]/20 border-[#00D64F]/30',
    buildUrl: (h, amt, _note) => `https://cash.app/${h.startsWith('$') ? h : '$' + h}/${amt}`,
    placeholder: '$cashtag', prefix: '$',
  },
  {
    id: 'applepay', label: 'Apple Pay', color: 'text-white',
    bg: 'bg-white/5 hover:bg-white/10 border-white/20',
    buildUrl: (_h, _amt, _note) => 'https://support.apple.com/apple-cash',
    placeholder: 'phone or email', prefix: '',
  },
  {
    id: 'zelle', label: 'Zelle', color: 'text-[#6D1ED4]',
    bg: 'bg-[#6D1ED4]/10 hover:bg-[#6D1ED4]/20 border-[#6D1ED4]/30',
    buildUrl: (_h, _amt, _note) => 'https://www.zellepay.com/',
    placeholder: 'phone or email', prefix: '',
  },
  {
    id: 'cash', label: 'Cash', color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 hover:bg-emerald-400/20 border-emerald-400/30',
    buildUrl: (_h, _amt, _note) => '',
    placeholder: '', prefix: '',
  },
];

interface GroupBookingProps { venue?: any; onBack?: () => void; }

// ── Main Component ─────────────────────────────────────────────────────────────
export function GroupBooking({ venue, onBack }: GroupBookingProps) {
  const [screen, setScreen] = useState<Screen>('crew-select');
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loadingCrews, setLoadingCrews] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  const [splitMethod, setSplitMethod] = useState<SplitMethod>('even');
  const [selectedLiquor, setSelectedLiquor] = useState(1);
  const [selectedMixer, setSelectedMixer] = useState(0);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [memberRails, setMemberRails] = useState<Record<string, PaymentRail>>({});
  const [memberHandles, setMemberHandles] = useState<Record<string, string>>({});
  const [lockedCustom, setLockedCustom] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedBookingId, setSavedBookingId] = useState<number | null>(null);
  const [inviteCode] = useState('ALIST-' + Math.random().toString(36).substring(2, 8).toUpperCase());

  useEffect(() => { fetchCrews(); }, []);

  const fetchCrews = async () => {
    setLoadingCrews(true);
    try {
      const res = await fetch(`${API}/crews?userId=${USER_ID}`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        setCrews(data.crews ?? []);
      }
    } catch (_e) { /* silent */ }
    finally { setLoadingCrews(false); }
  };

  const tableMin = venue?.selectedTable?.min ?? 2500;
  const liquorCost = LIQUOR_PACKAGES[selectedLiquor].price;
  const mixerCost = MIXER_PACKAGES[selectedMixer].price;
  const totalCost = tableMin + liquorCost + mixerCost;

  // Crew members treated as "confirmed" if in the crew; map to SplitMember
  const crewMembers: SplitMember[] = useMemo(() => {
    if (!selectedCrew) return [];
    return (selectedCrew.members ?? []).map(m => ({
      ...m,
      confirmed: true,
      amount: Math.ceil(totalCost / (selectedCrew.members?.length ?? 1)),
    }));
  }, [selectedCrew, totalCost]);

  // ── Split calculations ────────────────────────────────────────────────────
  const splitData: SplitMember[] = useMemo(() => {
    const mems = crewMembers;
    if (!mems.length) return [];
    if (splitMethod === 'even') {
      const pp = Math.ceil(totalCost / mems.length);
      return mems.map(m => ({ ...m, amount: pp }));
    }
    if (splitMethod === 'host') {
      const nonHost = mems.filter(m => m.role !== 'Captain');
      const memberShare = nonHost.length > 0 ? Math.ceil((liquorCost + mixerCost) / nonHost.length) : 0;
      return mems.map(m => ({ ...m, amount: m.role === 'Captain' ? tableMin : memberShare }));
    }
    // custom
    return mems.map(m => ({
      ...m,
      amount: customAmounts[m.name] ?? Math.ceil(totalCost / mems.length),
    }));
  }, [splitMethod, crewMembers, totalCost, tableMin, liquorCost, mixerCost, customAmounts]);

  const customTotal = splitData.reduce((s, m) => s + m.amount, 0);
  const customDiff = customTotal - totalCost;
  const customBalanced = Math.abs(customDiff) <= 1;

  const adjustCustom = (name: string, delta: number) => {
    if (lockedCustom) return;
    const base = customAmounts[name] ?? Math.ceil(totalCost / (crewMembers.length || 1));
    setCustomAmounts(prev => ({ ...prev, [name]: Math.max(0, base + delta) }));
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (splitMethod === 'custom' && !customBalanced) {
      toast.error(`Split is $${Math.abs(customDiff)} ${customDiff > 0 ? 'over' : 'short'}`);
      return;
    }
    setConfirming(true);
    try {
      const bookingPayload = {
        crewId: selectedCrew?.id,
        crewName: selectedCrew?.name,
        venue: venue?.name ?? 'Venue',
        tableName: venue?.selectedTable?.name ?? 'VIP Table',
        tableMin,
        liquorPackage: { name: LIQUOR_PACKAGES[selectedLiquor].name, price: liquorCost, bottles: LIQUOR_PACKAGES[selectedLiquor].bottles },
        mixerPackage: { name: MIXER_PACKAGES[selectedMixer].name, price: mixerCost },
        splitMethod,
        totalCost,
        members: splitData.map(m => ({
          name: m.name, avatar: m.avatar, role: m.role,
          amount: m.amount,
          paymentRail: memberRails[m.name] ?? null,
          paymentHandle: memberHandles[m.name] ?? null,
          paid: m.role === 'Captain',
        })),
      };
      const res = await fetch(`${API}/bookings?userId=${USER_ID}`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify(bookingPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedBookingId(data.booking?.id ?? null);
        setScreen('confirm');
      } else {
        toast.error('Failed to save booking');
      }
    } catch (_e) { toast.error('Network error'); }
    finally { setConfirming(false); }
  };

  const handleSendRequests = async () => {
    setConfirming(true);
    // Open payment links for each member
    for (const member of splitData.filter(m => m.role !== 'Captain')) {
      const rail = PAYMENT_RAILS.find(r => r.id === memberRails[member.name]);
      const handle = memberHandles[member.name];
      if (rail && handle && rail.id !== 'cash' && rail.id !== 'applepay' && rail.id !== 'zelle') {
        const url = rail.buildUrl(handle, member.amount, `A-List table @ ${venue?.name ?? 'venue'}`);
        if (url) window.open(url, '_blank');
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    setConfirming(false);
    setScreen('sent');
    toast.success('Payment requests sent!');
  };

  // ── Screens ──────────────────────────────────────────────────────────────
  if (screen === 'sent') return <SentScreen splitData={splitData} inviteCode={inviteCode} bookingId={savedBookingId} venue={venue} onBack={onBack} />;

  if (screen === 'confirm') return (
    <ConfirmScreen
      splitData={splitData} totalCost={totalCost} splitMethod={splitMethod}
      memberRails={memberRails} setMemberRails={setMemberRails}
      memberHandles={memberHandles} setMemberHandles={setMemberHandles}
      venue={venue} liquorPkg={LIQUOR_PACKAGES[selectedLiquor]} mixerPkg={MIXER_PACKAGES[selectedMixer]}
      confirming={confirming} onBack={() => setScreen('builder')} onSend={handleSendRequests}
    />
  );

  // ── Crew Select Screen ───────────────────────────────────────────────────
  if (screen === 'crew-select') return (
    <div className="min-h-screen bg-[#000504] text-white pb-40 marble-bg">
      <div className="bg-[#000504]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-1">
          {onBack && <button onClick={onBack} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>}
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Group Booking</p>
            <h2 className="text-2xl font-serif italic platinum-gradient">Select Your Crew</h2>
          </div>
        </div>
        {venue && <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-bold mt-3">{venue.name} • {venue.selectedTable?.name || 'VIP Table'} • Min ${(venue?.selectedTable?.min ?? 2500).toLocaleString()}</p>}
      </div>

      <div className="px-6 py-10 space-y-4">
        {loadingCrews ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="text-white/20 animate-spin" />
          </div>
        ) : crews.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Users size={32} className="text-white/10 mx-auto" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">No crews yet — create one in My Crews</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {crews.map((crew, i) => (
              <motion.button
                key={crew.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => { setSelectedCrew(crew); setScreen('builder'); }}
                className="w-full border border-white/10 hover:border-white/40 p-5 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{crew.emoji}</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest">{crew.name}</p>
                      <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">
                        {crew.level} · {crew.members?.length ?? 0} members
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-colors" />
                </div>
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {(crew.members ?? []).slice(0, 4).map((m, mi) => (
                    <div key={mi} className="w-7 h-7 bg-zinc-900 border border-white/10 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-white/50">{m.avatar}</span>
                    </div>
                  ))}
                  {(crew.members?.length ?? 0) > 4 && (
                    <div className="w-7 h-7 bg-zinc-900 border border-white/10 flex items-center justify-center">
                      <span className="text-[7px] text-white/30">+{crew.members.length - 4}</span>
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}

        {/* Continue without crew */}
        <button
          onClick={() => { setSelectedCrew(null); setScreen('builder'); }}
          className="w-full text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 hover:text-white/50 transition-colors py-4 border border-white/5 hover:border-white/20"
        >
          Continue Without a Crew
        </button>
      </div>
    </div>
  );

  // ── Builder Screen ───────────────────────────────────────────────────────
  const members = selectedCrew ? splitData : [];

  return (
    <div className="min-h-screen bg-[#000504] text-white pb-40 marble-bg">
      {/* Header */}
      <div className="bg-[#000504]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-8 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-1">
          <button onClick={() => setScreen('crew-select')} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Group Booking</p>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">Payment Split</h2>
          </div>
        </div>
        {venue && <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-bold mt-2">{venue.name} • {venue.selectedTable?.name || 'VIP Table'}</p>}
        {selectedCrew && (
          <button onClick={() => setScreen('crew-select')} className="mt-2 flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors">
            <span className="text-base">{selectedCrew.emoji}</span>
            <span>{selectedCrew.name}</span>
            <ChevronDown size={11} />
          </button>
        )}
      </div>

      <div className="px-6 py-10 space-y-10">

        {/* Cost Summary */}
        <div className="bg-zinc-950 border border-white/10 p-8 relative overflow-hidden">
          <div className="absolute inset-0 marble-bg opacity-20 pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Total Cost</p>
                <p className="text-4xl font-light font-serif italic">${totalCost.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Per Person</p>
                <p className="text-2xl font-light font-serif italic text-[#E5E4E2]">
                  ${members.length ? Math.ceil(totalCost / members.length).toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
              {[{ label: 'Table Min', val: tableMin }, { label: 'Bottles', val: liquorCost }, { label: 'Mixers', val: mixerCost }].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="text-sm font-light">${val.toLocaleString()}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Split Method */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Split Method</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'even',   label: 'Even Split',  desc: 'All pay same' },
              { id: 'host',   label: 'Host Led',     desc: 'Host covers table' },
              { id: 'custom', label: 'Custom',        desc: 'Set per person' },
            ] as const).map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => { setSplitMethod(id); setLockedCustom(false); }}
                className={`p-4 border text-center transition-all ${
                  splitMethod === id ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-widest">{label}</p>
                <p className={`text-[7px] uppercase tracking-widest mt-1 ${splitMethod === id ? 'text-black/50' : 'text-white/20'}`}>{desc}</p>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={splitMethod} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="bg-zinc-950/60 border border-white/5 px-5 py-4 text-[9px] text-white/40 uppercase tracking-wider leading-relaxed"
            >
              {splitMethod === 'even' && `Each of the ${members.length || '—'} members pays $${members.length ? Math.ceil(totalCost / members.length).toLocaleString() : '—'}.`}
              {splitMethod === 'host' && `You cover $${tableMin.toLocaleString()} table min. Members split $${(liquorCost + mixerCost).toLocaleString()} for bottles & mixers.`}
              {splitMethod === 'custom' && 'Set each person\'s amount with + / −. Must total exactly before you can proceed.'}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Member Breakdown */}
        {members.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Member Breakdown</h3>
              {splitMethod === 'custom' && (
                <button
                  onClick={() => setLockedCustom(l => !l)}
                  disabled={!customBalanced && !lockedCustom}
                  className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest transition-colors ${
                    lockedCustom ? 'text-emerald-400' : customBalanced ? 'text-white hover:text-white/70' : 'text-white/20 cursor-not-allowed'
                  }`}
                >
                  {lockedCustom ? <Lock size={11} /> : <Unlock size={11} />}
                  {lockedCustom ? 'Locked' : 'Lock Split'}
                </button>
              )}
            </div>

            {splitMethod === 'custom' && (
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] uppercase tracking-widest">
                  <span className="text-white/30">Allocated ${customTotal.toLocaleString()} / ${totalCost.toLocaleString()}</span>
                  <span className={customBalanced ? 'text-emerald-400' : customDiff > 0 ? 'text-red-400' : 'text-amber-400'}>
                    {customBalanced ? '✓ Balanced' : customDiff > 0 ? `$${customDiff} over` : `$${Math.abs(customDiff)} short`}
                  </span>
                </div>
                <div className="h-0.5 bg-white/5">
                  <motion.div animate={{ width: `${Math.min((customTotal / totalCost) * 100, 100)}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`h-full ${customBalanced ? 'bg-emerald-400' : customDiff > 0 ? 'bg-red-400' : 'bg-amber-400'}`}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {members.map((member, i) => (
                <motion.div key={member.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }} className="border border-white/10 bg-zinc-950/40"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 border border-white/10 bg-zinc-900 flex items-center justify-center">
                          <span className="text-[10px] font-bold tracking-widest text-white/60">{member.avatar}</span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border border-[#000504] rounded-full flex items-center justify-center">
                          <Check size={7} strokeWidth={3} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest">{member.name}</span>
                          {member.role === 'Captain' && <Crown size={11} className="text-[#E5E4E2]" />}
                        </div>
                        <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">
                          {member.role}
                          {splitMethod === 'host' && member.role === 'Captain' && ' · Table Minimum'}
                          {splitMethod === 'host' && member.role !== 'Captain' && ' · Bottles & Mixers'}
                        </p>
                      </div>
                    </div>
                    {splitMethod === 'custom' && !lockedCustom ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => adjustCustom(member.name, -50)} className="w-7 h-7 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"><Minus size={11} /></button>
                        <span className="text-sm font-light tabular-nums min-w-[60px] text-center">${member.amount.toLocaleString()}</span>
                        <button onClick={() => adjustCustom(member.name, 50)} className="w-7 h-7 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"><Plus size={11} /></button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-sm font-light font-serif italic">${member.amount.toLocaleString()}</span>
                        {splitMethod === 'even' && members.length > 0 && (
                          <p className="text-[7px] uppercase tracking-widest text-white/20 mt-0.5">{Math.round((member.amount / totalCost) * 100)}%</p>
                        )}
                      </div>
                    )}
                  </div>
                  {splitMethod === 'custom' && !lockedCustom && (
                    <div className="border-t border-white/5 px-4 py-2 flex gap-2">
                      {[-200, -100, +100, +200].map(d => (
                        <button key={d} onClick={() => adjustCustom(member.name, d)}
                          className="flex-1 text-[7px] font-bold uppercase tracking-widest py-1 border border-white/5 text-white/30 hover:border-white/20 hover:text-white/60 transition-all"
                        >
                          {d > 0 ? '+' : '−'}${Math.abs(d)}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Liquor Selection */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Liquor Selection</h3>
          <div className="space-y-2">
            {LIQUOR_PACKAGES.map((pkg, index) => (
              <button key={index} onClick={() => setSelectedLiquor(index)}
                className={`w-full p-5 border text-left transition-all ${selectedLiquor === index ? 'border-[#E5E4E2]/30 bg-white/5' : 'border-white/5 hover:border-white/20'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest">{pkg.name}</h4>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{pkg.bottles} Bottles</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-light">${pkg.price.toLocaleString()}</span>
                    {members.length > 0 && <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">+${Math.ceil(pkg.price / members.length).toLocaleString()}/person</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pkg.items.map((item, i) => <span key={i} className="text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 border border-white/5 bg-white/5 text-white/40">{item}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mixer Selection */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Mixer Package</h3>
          <div className="space-y-2">
            {MIXER_PACKAGES.map((pkg, index) => (
              <button key={index} onClick={() => setSelectedMixer(index)}
                className={`w-full p-5 border text-left transition-all ${selectedMixer === index ? 'border-[#E5E4E2]/30 bg-white/5' : 'border-white/5 hover:border-white/20'}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest">{pkg.name}</h4>
                  <span className="text-sm font-light">${pkg.price.toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pkg.items.map((item, i) => <span key={i} className="text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 border border-white/5 bg-white/5 text-white/40">{item}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Invite code */}
        <div className="bg-zinc-950 border border-[#E5E4E2]/10 p-5 flex items-center justify-between">
          <div>
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Private Invite Code</p>
            <p className="text-sm font-mono tracking-[0.2em] text-[#E5E4E2]">{inviteCode}</p>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(inviteCode); toast.success('Copied'); }}
            className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all"
          ><Copy size={14} /></button>
        </div>

        {/* CTA */}
        <Button onClick={handleConfirm}
          disabled={confirming || (splitMethod === 'custom' && !customBalanced && !lockedCustom)}
          className="w-full h-14 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8 disabled:opacity-30"
        >
          {confirming ? <><Loader2 size={16} className="animate-spin mr-3 !text-black" />Saving...</> : <><span>Review &amp; Send Requests</span><ChevronRight size={16} /></>}
        </Button>

        {splitMethod === 'custom' && !customBalanced && (
          <p className="text-[8px] uppercase tracking-widest text-amber-400 text-center flex items-center justify-center gap-2">
            <AlertCircle size={11} />
            {customDiff > 0 ? `$${customDiff} over — reduce someone's amount` : `$${Math.abs(customDiff)} short — increase amounts to balance`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Confirm Screen ─────────────────────────────────────────────────────────────
function ConfirmScreen({ splitData, totalCost, splitMethod, memberRails, setMemberRails, memberHandles, setMemberHandles, venue, liquorPkg, mixerPkg, confirming, onBack, onSend }: {
  splitData: SplitMember[]; totalCost: number; splitMethod: SplitMethod;
  memberRails: Record<string, PaymentRail>; setMemberRails: (r: any) => void;
  memberHandles: Record<string, string>; setMemberHandles: (h: any) => void;
  venue: any; liquorPkg: any; mixerPkg: any;
  confirming: boolean; onBack: () => void; onSend: () => void;
}) {
  const others = splitData.filter(m => m.role !== 'Captain');

  const previewLink = (member: SplitMember) => {
    const rail = PAYMENT_RAILS.find(r => r.id === memberRails[member.name]);
    const handle = memberHandles[member.name];
    if (!rail || !handle || rail.id === 'cash') return null;
    return rail.buildUrl(handle, member.amount, `A-List table @ ${venue?.name ?? 'venue'}`);
  };

  return (
    <div className="min-h-screen bg-[#000504] text-white pb-40 marble-bg">
      <div className="bg-[#000504]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Step 2 of 2</p>
            <h2 className="text-2xl font-serif italic platinum-gradient">Confirm &amp; Pay</h2>
          </div>
        </div>
      </div>

      <div className="px-6 py-10 space-y-10">
        {/* Summary */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Booking Summary</h3>
          <div className="bg-zinc-950 border border-white/10 divide-y divide-white/5">
            {[
              { label: venue?.name ?? 'Venue', value: venue?.selectedTable?.name ?? 'VIP Table' },
              { label: 'Bottles', value: liquorPkg.name },
              { label: 'Mixers', value: mixerPkg.name },
              { label: 'Split', value: splitMethod === 'even' ? 'Even Split' : splitMethod === 'host' ? 'Host Led' : 'Custom' },
              { label: 'Total', value: '$' + totalCost.toLocaleString(), accent: true },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center px-5 py-3">
                <span className="text-[8px] uppercase tracking-widest text-white/30">{row.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${(row as any).accent ? 'text-[#E5E4E2]' : 'text-white/70'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-member payment rail + handle */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
            Payment Method Per Member
          </h3>
          {others.map(member => (
            <div key={member.name} className="border border-white/10 bg-zinc-950/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border border-white/10 bg-zinc-900 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white/60">{member.avatar}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{member.name}</span>
                </div>
                <span className="text-sm font-light font-serif italic">${member.amount.toLocaleString()}</span>
              </div>

              {/* Rail buttons */}
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_RAILS.map(rail => (
                  <button key={rail.id}
                    onClick={() => setMemberRails((prev: any) => ({ ...prev, [member.name]: rail.id }))}
                    className={`px-3 py-1.5 border text-[7px] font-bold uppercase tracking-widest transition-all ${
                      memberRails[member.name] === rail.id ? `${rail.bg} ${rail.color} scale-105` : 'border-white/10 text-white/30 hover:border-white/30'
                    }`}
                  >
                    {rail.label}
                  </button>
                ))}
              </div>

              {/* Handle input */}
              {memberRails[member.name] && memberRails[member.name] !== 'cash' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  {(() => {
                    const rail = PAYMENT_RAILS.find(r => r.id === memberRails[member.name])!;
                    return (
                      <div className="flex items-center gap-2">
                        {rail.prefix && <span className="text-white/30 text-sm">{rail.prefix}</span>}
                        <input
                          value={memberHandles[member.name] ?? ''}
                          onChange={e => setMemberHandles((prev: any) => ({ ...prev, [member.name]: e.target.value }))}
                          placeholder={rail.placeholder}
                          className="flex-1 bg-transparent border-b border-white/10 focus:border-white outline-none text-[10px] tracking-widest placeholder:text-white/20 py-2 transition-colors text-white"
                        />
                      </div>
                    );
                  })()}
                  {previewLink(member) && (
                    <a href={previewLink(member)!} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest mt-1 ${PAYMENT_RAILS.find(r => r.id === memberRails[member.name])?.color}`}
                    >
                      <ExternalLink size={10} />
                      Preview payment link
                    </a>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>

        <Button onClick={onSend} disabled={confirming}
          className="w-full h-14 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8"
        >
          {confirming ? <><Loader2 size={16} className="animate-spin mr-3 !text-black" />Opening links...</> : <><span>Send Payment Requests</span><ArrowRight size={16} /></>}
        </Button>
        <p className="text-[8px] uppercase tracking-widest text-white/20 text-center">
          Payment links open in the respective app. Cash/Zelle require manual transfer.
        </p>
      </div>
    </div>
  );
}

// ── Sent / Success Screen ──────────────────────────────────────────────────────
function SentScreen({ splitData, inviteCode, bookingId, venue, onBack }: {
  splitData: SplitMember[]; inviteCode: string; bookingId: number | null; venue: any; onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#000504] text-white flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-sm text-center space-y-10"
      >
        <AListLogo size="md" animated variant="full" />

        <div>
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <Check size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-3xl font-serif italic platinum-gradient">Booking Confirmed</h2>
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 mt-3">
            Payment requests sent · {venue?.name ?? 'Venue'}
          </p>
        </div>

        <div className="space-y-2 text-left">
          {splitData.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-900 border border-white/10 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white/60">{m.avatar}</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest">{m.name}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">
                    {m.role === 'Captain' ? 'Host' : 'Request sent'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-light font-serif italic">${m.amount.toLocaleString()}</p>
                <p className={`text-[7px] uppercase tracking-widest mt-0.5 ${m.role === 'Captain' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {m.role === 'Captain' ? '✓ Confirmed' : 'Pending'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-950 border border-[#E5E4E2]/10 p-4 flex items-center justify-between">
          <div>
            <p className="text-[7px] uppercase tracking-widest text-white/30">Booking Code</p>
            <p className="text-[10px] font-mono tracking-widest text-[#E5E4E2] mt-0.5">{inviteCode}</p>
            {bookingId && <p className="text-[7px] text-white/20 mt-0.5">ID #{bookingId}</p>}
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(inviteCode); toast.success('Copied'); }}
            className="w-8 h-8 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all"
          ><Copy size={12} /></button>
        </div>

        {onBack && (
          <button onClick={onBack} className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">
            Back to Home
          </button>
        )}
      </motion.div>
    </div>
  );
}