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
import { useAuth } from '../contexts/AuthContext';

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };


// ââ Types âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
type SplitMethod = 'even' | 'host' | 'custom';
type PaymentRail = 'venmo' | 'cashapp' | 'applepay' | 'zelle' | 'cash';
type Screen = 'table' | 'crew-select' | 'split' | 'addons' | 'review' | 'sent';

interface CrewMember { name: string; avatar: string; role: string; spend: number; }
interface Crew { id: number; name: string; emoji: string; level: string; members: CrewMember[]; }
interface SplitMember extends CrewMember { amount: number; confirmed: boolean; }

// ââ Liquor Inventory (Brand Partnerships/Sponsorships) ââââââââââââââââââââââââââ
const LIQUOR_INVENTORY = {
  vodka: [
    { name: 'Grey Goose', brand: 'Vodka', tier: 'Standard', price: 280 },
    { name: 'Belvedere', brand: 'Vodka', tier: 'Premium', price: 450 },
    { name: 'Belvedere 10', brand: 'Vodka', tier: 'Elite', price: 950 },
  ],
  tequila: [
    { name: 'Don Julio', brand: 'Tequila', tier: 'Standard', price: 300 },
    { name: 'Clase Azul', brand: 'Tequila', tier: 'Premium', price: 600 },
    { name: 'Clase Azul Ultra', brand: 'Tequila', tier: 'Elite', price: 1400 },
  ],
  cognac: [
    { name: 'Hennessy VSOP', brand: 'Cognac', tier: 'Standard', price: 350 },
    { name: 'Hennessy XO', brand: 'Cognac', tier: 'Premium', price: 950 },
    { name: 'Louis XIII', brand: 'Cognac', tier: 'Elite', price: 4200 },
  ],
  champagne: [
    { name: 'MoÃ«t & Chandon', brand: 'Champagne', tier: 'Standard', price: 220 },
    { name: 'Dom PÃ©rignon', brand: 'Champagne', tier: 'Premium', price: 750 },
    { name: 'Dom PÃ©rignon RosÃ©', brand: 'Champagne', tier: 'Elite', price: 1200 },
  ],
  whiskey: [
    { name: 'Macallan 12', brand: 'Whiskey', tier: 'Standard', price: 320 },
    { name: 'Macallan 18', brand: 'Whiskey', tier: 'Premium', price: 800 },
    { name: 'Macallan 25', brand: 'Whiskey', tier: 'Elite', price: 2500 },
  ],
};

// ââ Mixer Inventory (Brand Partnerships/Sponsorships) ââââââââââââââââââââââââââââ
const MIXER_INVENTORY = {
  energy: [
    { name: 'Red Bull', brand: 'Energy Drink', tier: 'Standard', price: 8 },
    { name: 'Red Bull Sugar Free', brand: 'Energy Drink', tier: 'Premium', price: 10 },
  ],
  water: [
    { name: 'San Pellegrino', brand: 'Sparkling', tier: 'Standard', price: 6 },
    { name: 'San Pellegrino Limonata', brand: 'Sparkling', tier: 'Premium', price: 8 },
  ],
  tonic: [
    { name: 'Schweppes Tonic', brand: 'Mixer', tier: 'Standard', price: 5 },
    { name: 'Fever-Tree Premium Tonic', brand: 'Mixer', tier: 'Premium', price: 9 },
    { name: 'Fever-Tree Elderflower Tonic', brand: 'Mixer', tier: 'Elite', price: 12 },
  ],
  juice: [
    { name: 'Fresh OJ', brand: 'Juice', tier: 'Standard', price: 6 },
    { name: 'Pressed Juice', brand: 'Premium Juice', tier: 'Premium', price: 12 },
  ],
  specialty: [
    { name: 'Ginger Beer', brand: 'Mixer', tier: 'Premium', price: 8 },
    { name: 'Fever-Tree Ginger Beer', brand: 'Premium Mixer', tier: 'Elite', price: 11 },
  ],
};

// ââ Static packages with tier info ââââââââââââââââââââââââââââââââââââââââââââââ
const LIQUOR_PACKAGES = [
  { id: 0, name: 'Standard Selection', tier: 'Standard', bottles: 2, price: 800, description: 'Perfect for the night' },
  { id: 1, name: 'Premium Reserve', tier: 'Premium', bottles: 3, price: 1500, description: 'Elevated experience' },
  { id: 2, name: 'Elite Package', tier: 'Elite', bottles: 5, price: 3200, description: 'The ultimate selection' },
];

const MIXER_PACKAGES = [
  { id: 0, name: 'Standard Set', tier: 'Standard', price: 150, description: 'Essential mixers' },
  { id: 1, name: 'Premium Set', tier: 'Premium', price: 300, description: 'Premium selections' },
  { id: 2, name: 'Elite Set', tier: 'Elite', price: 450, description: 'Signature mixers' },
];

// ââ Payment rails with real deep-link generators ââââââââââââââââââââââââââââââ
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

// ââ Helper to get bottles/mixers available in a tier ââââââââââââââââââââââââââââââ
const getBottlesInTier = (tier: string) => {
  const all = Object.values(LIQUOR_INVENTORY).flat();
  return all.filter(b => b.tier === tier);
};

const getMixersInTier = (tier: string) => {
  const all = Object.values(MIXER_INVENTORY).flat();
  return all.filter(m => m.tier === tier);
};

// ââ Main Component âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function GroupBooking({ venue, onBack }: GroupBookingProps) {
  const { userId: USER_ID } = useAuth();
  const [screen, setScreen] = useState<Screen>(venue?.selectedTable ? 'crew-select' : 'table');
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loadingCrews, setLoadingCrews] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  // Table options (pulled from venue or defaults)
  const selectedTableMin = venue?.selectedTable?.min_spend ?? venue?.selectedTable?.min ?? 1500;
  const TABLE_OPTIONS = [
    { name: venue?.selectedTable?.name ?? 'Standard VIP', capacity: '2–4 guests', min: selectedTableMin },
    { name: 'Premium Booth', capacity: '4–8 guests', min: selectedTableMin + 1000 },
    { name: 'Main Stage Table', capacity: '8–12 guests', min: selectedTableMin + 2500 },
  ];
  const [selectedTableIdx, setSelectedTableIdx] = useState(0);

  const [splitMethod, setSplitMethod] = useState<SplitMethod>('even');
  const [selectedLiquor, setSelectedLiquor] = useState(1);
  const [selectedMixer, setSelectedMixer] = useState(0);
  const [selectedBottles, setSelectedBottles] = useState<Set<string>>(new Set());
  const [selectedMixerItems, setSelectedMixerItems] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [memberRails, setMemberRails] = useState<Record<string, PaymentRail>>({});
  const [memberHandles, setMemberHandles] = useState<Record<string, string>>({});
  const [lockedCustom, setLockedCustom] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedBookingId, setSavedBookingId] = useState<number | null>(null);
  const [inviteCode] = useState('ALIST-' + Math.random().toString(36).substring(2, 8).toUpperCase());

  // Manual member entry when booking without a crew
  const [manualMembers, setManualMembers] = useState<{name: string; avatar: string; role: string; spend: number}[]>([]);
  const [newMemberName, setNewMemberName] = useState('');

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

  const tableMin = TABLE_OPTIONS[selectedTableIdx].min;
  const liquorCost = LIQUOR_PACKAGES[selectedLiquor].price;
  const mixerCost = MIXER_PACKAGES[selectedMixer].price;
  const totalCost = tableMin + liquorCost + mixerCost;

  // Crew members treated as "confirmed" if in the crew; map to SplitMember
  // When no crew is selected, use the manually entered members instead
  const crewMembers: SplitMember[] = useMemo(() => {
    const source = selectedCrew ? (selectedCrew.members ?? []) : manualMembers;
    if (!source.length) return [];
    return source.map(m => ({
      ...m,
      confirmed: true,
      amount: Math.ceil(totalCost / source.length),
    }));
  }, [selectedCrew, manualMembers, totalCost]);

  // ââ Split calculations ââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const splitData: SplitMember[] = useMemo(() => {
    const mems = crewMembers;
    if (!mems.length) return [];
    if (splitMethod === 'even') {
      const pp = Math.ceil(totalCost / mems.length);
      return mems.map(m => ({ ...m, amount: pp }));
    }
    if (splitMethod === 'host') {
      const nonHost = mems.filter(m => m.role !== 'Captain');
      if (nonHost.length === 0) {
        return mems.map(m => ({ ...m, amount: totalCost }));
      }
      const memberShare = Math.ceil((liquorCost + mixerCost) / nonHost.length);
      let hostShare = tableMin;
      if (hostShare < memberShare) {
        const evenShare = Math.ceil(totalCost / mems.length);
        const hostExtra = totalCost - (evenShare * nonHost.length);
        return mems.map(m => ({ ...m, amount: m.role === 'Captain' ? hostExtra : evenShare }));
      }
      return mems.map(m => ({ ...m, amount: m.role === 'Captain' ? hostShare : memberShare }));
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

  // ââ Handlers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleConfirm = () => {
    if (splitMethod === 'custom' && !customBalanced) {
      toast.error(`Split is $${Math.abs(customDiff)} ${customDiff > 0 ? 'over' : 'short'}`);
      return;
    }
    setScreen('review');
  };

  const handleSendRequests = async () => {
    setConfirming(true);
    try {
      // Save the booking now (after payment rails + handles are confirmed)
      const bookingPayload = {
        crewId: selectedCrew?.id,
        crewName: selectedCrew?.name,
        venue: venue?.name ?? 'Venue',
        tableName: venue?.selectedTable?.name ?? 'VIP Table',
        tableMin,
        liquorPackage: {
          name: LIQUOR_PACKAGES[selectedLiquor].name,
          tier: LIQUOR_PACKAGES[selectedLiquor].tier,
          price: liquorCost,
          bottles: LIQUOR_PACKAGES[selectedLiquor].bottles,
          selectedBottles: Array.from(selectedBottles),
        },
        mixerPackage: {
          name: MIXER_PACKAGES[selectedMixer].name,
          tier: MIXER_PACKAGES[selectedMixer].tier,
          price: mixerCost,
          selectedMixers: Array.from(selectedMixerItems),
        },
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
      } else {
        toast.error('Failed to save booking â payment links still sent');
      }

      // Open payment deep-links for each non-Captain member
      for (const member of splitData.filter(m => m.role !== 'Captain')) {
        const rail = PAYMENT_RAILS.find(r => r.id === memberRails[member.name]);
        const handle = memberHandles[member.name];
        if (rail && handle && rail.id !== 'cash' && rail.id !== 'applepay' && rail.id !== 'zelle') {
          const url = rail.buildUrl(handle, member.amount, `A-List table @ ${venue?.name ?? 'venue'}`);
          if (url) window.open(url, '_blank');
        }
      }

      setScreen('sent');
      toast.success('Payment requests sent!');
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setConfirming(false);
    }
  };

  // ââ Step indicator ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const STEPS: Screen[] = ['table', 'crew-select', 'split', 'addons', 'review'];
  const stepIdx = STEPS.indexOf(screen);
  const stepLabels = ['Table', 'Crew', 'Split', 'Add-ons', 'Review'];

  // ââ Screens ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (screen === 'sent') return <SentScreen splitData={splitData} inviteCode={inviteCode} bookingId={savedBookingId} venue={venue} onBack={onBack} />;

  if (screen === 'review') return (
    <ConfirmScreen
      splitData={splitData} totalCost={totalCost} splitMethod={splitMethod}
      memberRails={memberRails} setMemberRails={setMemberRails}
      memberHandles={memberHandles} setMemberHandles={setMemberHandles}
      venue={venue} liquorPkg={LIQUOR_PACKAGES[selectedLiquor]} mixerPkg={MIXER_PACKAGES[selectedMixer]}
      selectedBottles={Array.from(selectedBottles)} selectedMixers={Array.from(selectedMixerItems)}
      confirming={confirming} onBack={() => setScreen('addons')} onSend={handleSendRequests}
      tableMin={tableMin} tableName={TABLE_OPTIONS[selectedTableIdx].name}
    />
  );

  // ââ Shared step header âââââââââââââââââââââââââââââââââââââââââââââââââââ
  const StepHeader = ({ title, onBack: goBack }: { title: string; onBack: () => void }) => (
    <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-5 sticky top-0 z-20">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={goBack} className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-white/40 hover:text-white active:scale-95 transition-all">
          <X size={18} />
        </button>
        <div className="flex-1">
          <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Group Booking</p>
          <h2 className="text-2xl font-serif italic platinum-gradient leading-none tracking-tight">{title}</h2>
        </div>
        {venue && <p className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-bold text-right">{venue.name}</p>}
      </div>
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-0.5 w-full transition-all duration-300 ${i <= stepIdx ? 'bg-white' : 'bg-white/10'}`} />
            <span className={`text-[6px] uppercase tracking-widest ${i === stepIdx ? 'text-white/60' : 'text-white/20'}`}>{stepLabels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ââ Inline price bar â shows min spend + per-person only (hides full total) ââ
  const PriceBar = () => {
    const pp = members.length ? Math.ceil(totalCost / members.length) : null;
    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 bg-[#060606]/95 backdrop-blur-xl border-t border-[#E5E4E2]/10 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold">Min. Spend</p>
          <p className="text-lg font-serif italic">${tableMin.toLocaleString()}</p>
        </div>
        {pp ? (
          <div className="text-center">
            <p className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold">Your Share</p>
            <motion.p key={pp} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xl font-serif italic text-[#E5E4E2]">${pp.toLocaleString()}</motion.p>
          </div>
        ) : <div />}
        <div />
      </div>
    );
  };

  // ââ TABLE SELECTION SCREEN âââââââââââââââââââââââââââââââââââââââââââââââ
  if (screen === 'table') return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      <StepHeader title="Select Table" onBack={onBack ?? (() => {})} />
      <div className="px-6 py-8 space-y-4">
        <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold mb-2">Choose your table for the night</p>
        {TABLE_OPTIONS.map((table, i) => (
          <button key={i} onClick={() => setSelectedTableIdx(i)}
            className={`w-full p-6 border text-left transition-all ${selectedTableIdx === i ? 'border-[#E5E4E2]/40 bg-white/5' : 'border-white/10 hover:border-white/20'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-widest">{table.name}</h3>
              <span className="text-xl font-serif italic">${table.min.toLocaleString()}<span className="text-[9px] text-white/30 font-sans font-normal ml-1">min</span></span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-white/40">{table.capacity}</p>
          </button>
        ))}
        <Button onClick={() => setScreen('crew-select')}
          className="w-full h-14 bg-white text-black hover:bg-[#E5E4E2] rounded-full font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8 mt-4"
        >
          <span>Select Crew</span><ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );

  // ââ CREW SELECT SCREEN âââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (screen === 'crew-select') return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-1">
          <button onClick={() => setScreen('table')} className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-white/40 hover:text-white active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"><X size={18} /></button>
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Group Booking</p>
            <h2 className="text-2xl font-serif italic platinum-gradient">Select Your Crew</h2>
          </div>
        </div>
        {venue && <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-bold mt-3">{venue.name} â¢ {TABLE_OPTIONS[selectedTableIdx].name} â¢ Min ${tableMin.toLocaleString()}</p>}
      </div>

      <div className="px-6 py-10 space-y-4">
        {loadingCrews ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="text-white/20 animate-spin" />
          </div>
        ) : (
          <>
            {/* Create Crew Button â Always First */}
            <div className="space-y-1">
              <p className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-bold pl-1">New</p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              onClick={() => { setSelectedCrew(null); setScreen('split'); }}
              className="w-full border border-dashed border-[#E5E4E2]/30 hover:border-[#E5E4E2] p-5 text-left transition-all group bg-[#E5E4E2]/5 hover:bg-[#E5E4E2]/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Plus size={20} className="text-[#E5E4E2]" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#E5E4E2]">Create New Crew</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">
                      Start your own alliance
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#E5E4E2]" />
              </div>
            </motion.button>
            </div>

            {/* Existing Crews â clearly distinct from "create new" */}
            {crews.length > 0 && (
              <div className="space-y-2">
                <p className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-bold pl-1">Your Crews</p>
              <AnimatePresence initial={false}>
                {crews
                  .sort((a, b) => ((b as any).totalSpend || 0) - ((a as any).totalSpend || 0))
                  .map((crew, i) => (
                    <motion.button
                      key={crew.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (i + 1) * 0.04 }}
                      onClick={() => { setSelectedCrew(crew); setScreen('split'); }}
                      className="w-full border border-[#E5E4E2]/15 hover:border-[#E5E4E2]/40 bg-[#E5E4E2]/3 hover:bg-[#E5E4E2]/8 p-5 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{crew.emoji}</span>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xs font-bold uppercase tracking-widest">{crew.name}</p>
                              <span className="text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-[#E5E4E2]/10 text-[#E5E4E2]/60 border border-[#E5E4E2]/15">Saved</span>
                            </div>
                            <p className="text-[8px] uppercase tracking-widest text-white/30">
                              {crew.level} Â· {crew.members?.length ?? 0} members
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
              </div>
            )}

            {crews.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <Users size={32} className="text-white/10 mx-auto" />
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">No crews yet â start with the option above</p>
              </div>
            )}

            {/* Continue without crew */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.max(1, crews.length + 1) * 0.04 }}
              onClick={() => { setSelectedCrew(null); setScreen('split'); }}
              className="w-full text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 hover:text-white/50 transition-colors py-4 border border-white/5 hover:border-white/20"
            >
              Continue Without a Crew
            </motion.button>
          </>
        )}
      </div>
    </div>
  );

  // ââ Shared members list (crew or manual) âââââââââââââââââââââââââââââââââ
  const members = selectedCrew ? splitData : manualMembers.length ? splitData : [];

  // ââ SPLIT SCREEN âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (screen === 'split') return (
    <div className="min-h-screen bg-[#060606] text-white pb-36">
      <StepHeader title="Payment Split" onBack={() => setScreen('crew-select')} />
      <PriceBar />

      <div className="px-6 py-8 space-y-8">

        {/* Manual Member Entry â when no crew selected */}
        {!selectedCrew && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Add Members</h3>
            <div className="flex gap-2">
              <input
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newMemberName.trim()) {
                    const name = newMemberName.trim();
                    const initials = name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
                    setManualMembers(prev => [...prev, { name, avatar: initials, role: prev.length === 0 ? 'Captain' : 'Member', spend: 0 }]);
                    setNewMemberName('');
                  }
                }}
                placeholder="Member name..."
                className="flex-1 bg-transparent border border-white/10 focus:border-white outline-none text-[10px] tracking-widest placeholder:text-white/20 px-4 py-3 transition-colors text-white"
              />
              <button
                onClick={() => {
                  const name = newMemberName.trim();
                  if (!name) return;
                  const initials = name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
                  setManualMembers(prev => [...prev, { name, avatar: initials, role: prev.length === 0 ? 'Captain' : 'Member', spend: 0 }]);
                  setNewMemberName('');
                }}
                disabled={!newMemberName.trim()}
                className="w-12 h-12 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
            {manualMembers.length === 0 && (
              <p className="text-[8px] uppercase tracking-widest text-white/20 text-center py-2">Add members to configure split</p>
            )}
            <AnimatePresence initial={false}>
              {manualMembers.map((m, i) => (
                <motion.div key={`${m.name}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between p-4 border border-white/10 bg-zinc-950/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold">{m.avatar}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">{m.name}</p>
                      <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{m.role}</p>
                    </div>
                  </div>
                  {i !== 0 && (
                    <button onClick={() => setManualMembers(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400/40 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Split Method */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Split Method</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'even',   label: 'Even Split',  desc: 'All pay same' },
              { id: 'host',   label: 'Host Led',     desc: 'Host covers table' },
              { id: 'custom', label: 'Custom',        desc: 'Set per person' },
            ] as const).map(({ id, label, desc }) => (
              <button key={id} onClick={() => { setSplitMethod(id); setLockedCustom(false); }}
                className={`p-4 border text-center transition-all ${splitMethod === id ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'}`}
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
              {splitMethod === 'even' && `Each of the ${members.length || 'â'} members pays $${members.length ? Math.ceil(totalCost / members.length).toLocaleString() : 'â'}.`}
              {splitMethod === 'host' && `You cover $${tableMin.toLocaleString()} table min. Members split the bottles & mixers.`}
              {splitMethod === 'custom' && 'Set each person\'s amount. Must total exactly before proceeding.'}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Member Breakdown */}
        {members.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Member Breakdown</h3>
              {splitMethod === 'custom' && (
                <button onClick={() => setLockedCustom(l => !l)} disabled={!customBalanced && !lockedCustom}
                  className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest transition-colors ${lockedCustom ? 'text-emerald-400' : customBalanced ? 'text-white hover:text-white/70' : 'text-white/20 cursor-not-allowed'}`}
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
                    {customBalanced ? 'â Balanced' : customDiff > 0 ? `$${customDiff} over` : `$${Math.abs(customDiff)} short`}
                  </span>
                </div>
                <div className="h-0.5 bg-white/5">
                  <motion.div animate={{ width: `${Math.min((customTotal / totalCost) * 100, 100)}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`h-full ${customBalanced ? 'bg-emerald-400' : customDiff > 0 ? 'bg-red-400' : 'bg-amber-400'}`}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {members.map((member, i) => (
                <motion.div key={member.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="border border-white/10 bg-zinc-950/40"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 border border-white/10 bg-zinc-900 flex items-center justify-center">
                        <span className="text-[10px] font-bold tracking-widest text-white/60">{member.avatar}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest">{member.name}</span>
                          {member.role === 'Captain' && <Crown size={11} className="text-[#E5E4E2]" />}
                        </div>
                        <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{member.role}</p>
                      </div>
                    </div>
                    {splitMethod === 'custom' && !lockedCustom ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => adjustCustom(member.name, -50)} className="w-7 h-7 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"><Minus size={11} /></button>
                        <motion.span key={member.amount} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-light tabular-nums min-w-[60px] text-center">${member.amount.toLocaleString()}</motion.span>
                        <button onClick={() => adjustCustom(member.name, 50)} className="w-7 h-7 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"><Plus size={11} /></button>
                      </div>
                    ) : (
                      <motion.span key={member.amount} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-light font-serif italic">${member.amount.toLocaleString()}</motion.span>
                    )}
                  </div>
                  {splitMethod === 'custom' && !lockedCustom && (
                    <div className="border-t border-white/5 px-4 py-2 flex gap-2">
                      {[-200, -100, +100, +200].map(d => (
                        <button key={d} onClick={() => adjustCustom(member.name, d)}
                          className="flex-1 text-[7px] font-bold uppercase tracking-widest py-1 border border-white/5 text-white/30 hover:border-white/20 hover:text-white/60 transition-all"
                        >
                          {d > 0 ? '+' : 'â'}${Math.abs(d)}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => setScreen('addons')}
          disabled={splitMethod === 'custom' && !customBalanced && !lockedCustom}
          className="w-full h-14 bg-white text-black hover:bg-[#E5E4E2] rounded-full font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8 disabled:opacity-30"
        >
          <span>Choose Add-ons</span><ChevronRight size={16} />
        </Button>
        {splitMethod === 'custom' && !customBalanced && (
          <p className="text-[8px] uppercase tracking-widest text-amber-400 text-center flex items-center justify-center gap-2">
            <AlertCircle size={11} />
            {customDiff > 0 ? `$${customDiff} over` : `$${Math.abs(customDiff)} short`} â balance before proceeding
          </p>
        )}
      </div>
    </div>
  );

  // ââ ADD-ONS SCREEN ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <div className="min-h-screen bg-[#060606] text-white pb-36">
      <StepHeader title="Add-ons" onBack={() => setScreen('split')} />
      <PriceBar />

      <div className="px-6 py-8 space-y-8">

        {/* Liquor Package */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Liquor Package</h3>
          <div className="space-y-2">
            {LIQUOR_PACKAGES.map((pkg, index) => {
              const isSelected = selectedLiquor === index;
              const tierBottles = getBottlesInTier(pkg.tier);
              return (
                <div key={index} className={`border transition-all ${isSelected ? 'border-[#E5E4E2]/30 bg-white/5' : 'border-white/5 hover:border-white/20'}`}>
                  <button onClick={() => {
                    setSelectedLiquor(index);
                    // Reset to empty set when switching packages â user picks fresh
                    setSelectedBottles(new Set());
                  }} className="w-full p-5 text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-bold uppercase tracking-widest">{pkg.name}</h4>
                          <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 border border-[#E5E4E2]/30 bg-[#E5E4E2]/5 text-[#E5E4E2]">{pkg.tier}</span>
                        </div>
                        <p className="text-[8px] uppercase tracking-widest text-white/30">{pkg.description} Â· {pkg.bottles} bottles</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-light">${pkg.price.toLocaleString()}</span>
                        {members.length > 0 && (
                          <motion.p key={`${pkg.price}-${members.length}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">
                            +${Math.ceil(pkg.price / members.length).toLocaleString()}/person
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </button>
                  <AnimatePresence>
                    {isSelected && tierBottles.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/5 p-5 bg-zinc-950/40"
                      >
                        {/* Count only bottles valid for this tier */}
                        {(() => {
                          const tierSelected = tierBottles.filter(b => selectedBottles.has(b.name));
                          const remaining = pkg.bottles - tierSelected.length;
                          return (
                            <p className="text-[7px] uppercase tracking-widest text-white/40 mb-3 font-bold">
                              {tierSelected.length === pkg.bottles
                                ? `${pkg.bottles} bottle${pkg.bottles > 1 ? 's' : ''} selected â`
                                : `Select ${remaining} more bottle${remaining !== 1 ? 's' : ''} (${tierSelected.length}/${pkg.bottles})`}
                            </p>
                          );
                        })()}
                        <div className="grid grid-cols-1 gap-2">
                          {tierBottles.map(bottle => {
                            const isChecked = selectedBottles.has(bottle.name);
                            // Count only bottles in this tier for the limit check
                            const tierSelectedCount = tierBottles.filter(b => selectedBottles.has(b.name)).length;
                            const isDisabled = !isChecked && tierSelectedCount >= pkg.bottles;
                            return (
                              <button key={bottle.name}
                                onClick={() => {
                                  const newSet = new Set(selectedBottles);
                                  if (isChecked) {
                                    newSet.delete(bottle.name); // always allow deselect
                                  } else {
                                    const currentTierCount = tierBottles.filter(b => newSet.has(b.name)).length;
                                    if (currentTierCount < pkg.bottles) {
                                      newSet.add(bottle.name);
                                    }
                                  }
                                  setSelectedBottles(newSet);
                                }}
                                disabled={isDisabled}
                                className={`p-3 border text-left text-[8px] font-bold uppercase tracking-widest transition-all ${
                                  isChecked ? 'border-[#E5E4E2]/40 bg-[#E5E4E2]/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{bottle.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[7px] text-white/30">${bottle.price}</span>
                                    {isChecked && <Check size={10} className="text-[#E5E4E2]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mixer Package */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Mixer Package</h3>
          <div className="space-y-2">
            {MIXER_PACKAGES.map((pkg, index) => {
              const isSelected = selectedMixer === index;
              const tierMixers = getMixersInTier(pkg.tier);
              const mixerCount = Math.ceil(tierMixers.length / 2);
              return (
                <div key={index} className={`border transition-all ${isSelected ? 'border-[#E5E4E2]/30 bg-white/5' : 'border-white/5 hover:border-white/20'}`}>
                  <button onClick={() => { setSelectedMixer(index); setSelectedMixerItems(new Set(tierMixers.slice(0, mixerCount).map(m => m.name))); }}
                    className="w-full p-5 text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-bold uppercase tracking-widest">{pkg.name}</h4>
                          <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 border border-[#E5E4E2]/30 bg-[#E5E4E2]/5 text-[#E5E4E2]">{pkg.tier}</span>
                        </div>
                        <p className="text-[8px] uppercase tracking-widest text-white/30">{pkg.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-light">${pkg.price.toLocaleString()}</span>
                        {members.length > 0 && (
                          <motion.p key={`${pkg.price}-${members.length}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">
                            +${Math.ceil(pkg.price / members.length).toLocaleString()}/person
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </button>
                  <AnimatePresence>
                    {isSelected && tierMixers.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/5 p-5 bg-zinc-950/40"
                      >
                        <p className="text-[7px] uppercase tracking-widest text-white/40 mb-3 font-bold">Select mixers</p>
                        <div className="space-y-2">
                          {tierMixers.map(mixer => {
                            const isChecked = selectedMixerItems.has(mixer.name);
                            return (
                              <button key={mixer.name}
                                onClick={() => {
                                  const newSet = new Set(selectedMixerItems);
                                  isChecked ? newSet.delete(mixer.name) : newSet.add(mixer.name);
                                  setSelectedMixerItems(newSet);
                                }}
                                className={`w-full p-3 border text-left text-[8px] font-bold uppercase tracking-widest transition-all ${isChecked ? 'border-[#E5E4E2]/40 bg-[#E5E4E2]/10 text-white' : 'border-white/10 text-white/40 hover:border-white/20'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{mixer.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[7px] text-white/30">${mixer.price}</span>
                                    {isChecked && <Check size={10} className="text-[#E5E4E2]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
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

        <Button onClick={handleConfirm}
          className="w-full h-14 bg-white text-black hover:bg-[#E5E4E2] rounded-full font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8"
        >
          <span>Review &amp; Confirm</span><ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

// ââ Confirm Screen âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function ConfirmScreen({ splitData, totalCost, splitMethod, memberRails, setMemberRails, memberHandles, setMemberHandles, venue, liquorPkg, mixerPkg, selectedBottles, selectedMixers, confirming, onBack, onSend, tableMin, tableName }: {
  splitData: SplitMember[]; totalCost: number; splitMethod: SplitMethod;
  memberRails: Record<string, PaymentRail>; setMemberRails: (r: any) => void;
  memberHandles: Record<string, string>; setMemberHandles: (h: any) => void;
  venue: any; liquorPkg: any; mixerPkg: any; selectedBottles: string[]; selectedMixers: string[];
  confirming: boolean; onBack: () => void; onSend: () => void;
  tableMin: number; tableName: string;
}) {
  const others = splitData.filter(m => m.role !== 'Captain');
  const captain = splitData.find(m => m.role === 'Captain');
  const yourShare = captain?.amount ?? (splitData.length ? Math.ceil(totalCost / splitData.length) : 0);

  const previewLink = (member: SplitMember) => {
    const rail = PAYMENT_RAILS.find(r => r.id === memberRails[member.name]);
    const handle = memberHandles[member.name];
    if (!rail || !handle || rail.id === 'cash') return null;
    return rail.buildUrl(handle, member.amount, `A-List table @ ${venue?.name ?? 'venue'}`);
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Step 5 of 5</p>
            <h2 className="text-2xl font-serif italic platinum-gradient">Review &amp; Pay</h2>
          </div>
        </div>
      </div>

      <div className="px-6 py-10 space-y-10">
        {/* Your share â prominent, not full total */}
        <div className="bg-zinc-950 border border-white/10 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold mb-2">Your Share</p>
            <p className="text-5xl font-serif italic platinum-gradient">${yourShare.toLocaleString()}</p>
            <p className="text-[8px] uppercase tracking-widest text-white/20 mt-3">{tableName} Â· {splitMethod === 'even' ? 'Even Split' : splitMethod === 'host' ? 'Host Led' : 'Custom'}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Booking Summary</h3>
          <div className="bg-zinc-950 border border-white/10 divide-y divide-white/5">
            {[
              { label: venue?.name ?? 'Venue', value: tableName },
              { label: 'Table Minimum', value: '$' + tableMin.toLocaleString() },
              { label: 'Bottles', value: liquorPkg.name },
              { label: 'Mixers', value: mixerPkg.name },
              { label: 'Guests', value: splitData.length + ' people' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center px-5 py-3">
                <span className="text-[8px] uppercase tracking-widest text-white/30">{row.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Bottles & Mixers */}
        {(selectedBottles.length > 0 || selectedMixers.length > 0) && (
          <div className="space-y-4">
            {selectedBottles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Selected Bottles</h3>
                <div className="bg-zinc-950 border border-white/10 p-4 space-y-2">
                  {selectedBottles.map(bottle => (
                    <div key={bottle} className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/70">
                      <span className="w-1.5 h-1.5 bg-[#E5E4E2] rounded-full" />
                      {bottle}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedMixers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Selected Mixers</h3>
                <div className="bg-zinc-950 border border-white/10 p-4 space-y-2">
                  {selectedMixers.map(mixer => (
                    <div key={mixer} className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/70">
                      <span className="w-1.5 h-1.5 bg-[#E5E4E2] rounded-full" />
                      {mixer}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
          className="w-full h-14 bg-white text-black hover:bg-[#E5E4E2] rounded-full font-bold text-[10px] uppercase tracking-[0.3em] !text-black flex items-center justify-between px-8"
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

// ââ Sent / Success Screen ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function SentScreen({ splitData, inviteCode, bookingId, venue, onBack }: {
  splitData: SplitMember[]; inviteCode: string; bookingId: number | null; venue: any; onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col items-center justify-center px-8">
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
            Payment requests sent Â· {venue?.name ?? 'Venue'}
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
                  {m.role === 'Captain' ? 'â Confirmed' : 'Pending'}
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
