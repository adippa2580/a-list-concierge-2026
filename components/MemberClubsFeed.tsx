'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Lock, Plus, RefreshCw, Calendar, Clock,
  ChevronRight, ShieldCheck, Zap, Users, Tag, ExternalLink,
  Settings, Check, Globe, Wifi, WifiOff, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { PrivateClub } from './OnboardingScreen';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// ── API ───────────────────────────────────────────────────────────────────────
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;
const CLUBS_KEY = 'alist_private_clubs';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MemberEvent {
  id: string;
  clubId: string;       // virtual club id — may include location suffix
  clubName: string;
  location?: string;    // "Houston" | "Dallas" for Park House
  title: string;
  type: string;
  date: string;
  rawDate: string;
  time: string;
  dresscode: string;
  spotsLeft: number;
  price: string;
  description: string;
  portalUrl: string | null;
  isRSVPed: boolean;
  isSoldOut: boolean;
  isExclusive: boolean;
  source: 'live' | 'curated';
}

// Whether a club name triggers the dual-location Park House mode
function isParkHouseClub(name: string): boolean {
  return name.toLowerCase().includes('park house');
}
function isParkHouseHouston(name: string): boolean {
  return name.toLowerCase().includes('park house houston');
}
function isParkHouseDallas(name: string): boolean {
  return name.toLowerCase().includes('park house dallas');
}

// ── Curated fallback templates ────────────────────────────────────────────────
interface EventTemplate {
  title: string; type: string; time: string;
  dresscode: string; spots: number; price: string; description: string;
}

const CURATED_PROFILES: Array<{ match: string; events: EventTemplate[] }> = [
  {
    match: 'soho house',
    events: [
      { title: "Rooftop Members' Night", type: 'Cocktails', time: '7:00 PM', dresscode: 'Smart Casual', spots: 60, price: 'Members rate', description: 'Monthly members-only rooftop gathering with DJ, craft cocktails, and city skyline views.' },
      { title: 'House Film Club', type: 'Entertainment', time: '8:30 PM', dresscode: 'Casual', spots: 40, price: 'Complimentary', description: 'A curated film screening in the private cinema followed by a discussion.' },
      { title: 'Creative Breakfast', type: 'Networking', time: '8:30 AM', dresscode: 'Casual', spots: 25, price: 'Complimentary', description: 'An informal breakfast for creative professionals.' },
      { title: 'Pool Social — Members Only', type: 'Wellness', time: '12:00 PM', dresscode: 'Resort Casual', spots: 30, price: 'Members only', description: 'Weekend pool access for members with DJ, light bites, and cocktails.' },
      { title: 'House DJ Night: Basement', type: 'Music', time: '10:00 PM', dresscode: 'Smart Casual', spots: 80, price: 'Members + 1 guest', description: 'The Basement opens exclusively for members with a curated DJ set.' },
    ],
  },
  {
    match: 'core club',
    events: [
      { title: 'Founders Roundtable: AI & Finance', type: 'Networking', time: '6:30 PM', dresscode: 'Business', spots: 20, price: 'Members only', description: 'An off-the-record roundtable with senior figures from venture capital, fintech, and AI.' },
      { title: 'Single Malt Masters', type: 'Cocktails', time: '7:00 PM', dresscode: 'Smart Casual', spots: 18, price: '$120 / person', description: 'Our whiskey sommelier guides members through eight rare single malts.' },
      { title: 'Art Fair Preview', type: 'Culture', time: '5:00 PM', dresscode: 'Smart Casual', spots: 30, price: 'Complimentary', description: 'Early access and private walk-through of a curated gallery exhibition.' },
    ],
  },
  {
    match: 'zero bond',
    events: [
      { title: "Members' After-Hours", type: 'Cocktails', time: '10:30 PM', dresscode: 'Smart Casual', spots: 55, price: 'Members only', description: "Zero Bond's signature late-night gathering in the Garden Level bar." },
      { title: 'Fashion Week Kickoff Dinner', type: 'Entertainment', time: '7:00 PM', dresscode: 'Fashion Forward', spots: 45, price: '$95 / person', description: "Kick off NYFW in style at Zero Bond's annual members' dinner." },
      { title: 'Intimate Live Session', type: 'Music', time: '9:00 PM', dresscode: 'Smart Casual', spots: 35, price: 'Complimentary', description: 'An emerging artist performs a live set in the Library Room.' },
    ],
  },
  {
    match: 'crescent club',
    events: [
      { title: 'Espress-Yourself – Espresso Martini Class!', type: 'Cocktails', time: '6:00 PM', dresscode: 'Smart Casual', spots: 20, price: 'Members rate', description: "Hands-on espresso martini masterclass at The Crescent Club & Spa. Learn the craft behind Dallas's favourite cocktail in a private, members-only setting." },
      { title: 'Headshot Happy Hour', type: 'Networking', time: '6:00 PM', dresscode: 'Business Casual', spots: 30, price: 'Complimentary', description: 'Update your professional headshot and network with fellow members over cocktails. Professional photographer on-site. Up to 2 guests welcome.' },
      { title: "Members' Morning Fitness & Brunch", type: 'Wellness', time: '9:00 AM', dresscode: 'Athletic', spots: 20, price: 'Complimentary', description: "Start your Saturday with a guided fitness class followed by a members' brunch in the Club Room." },
      { title: 'Cocktails on the Terrace', type: 'Cocktails', time: '6:30 PM', dresscode: 'Smart Casual', spots: 50, price: 'Complimentary', description: "Monthly sunset cocktail reception on the Crescent's private terrace overlooking Turtle Creek." },
      { title: "Members' Wine Dinner", type: 'Dining', time: '7:00 PM', dresscode: 'Business Casual', spots: 24, price: '$95 / person', description: "A paired five-course wine dinner in the private dining room with the club's sommelier." },
    ],
  },
  {
    match: '',
    events: [
      { title: "Members' Evening: Cocktails & Connections", type: 'Cocktails', time: '7:00 PM', dresscode: 'Smart Casual', spots: 40, price: 'Complimentary', description: 'An informal members-only cocktail gathering.' },
      { title: 'Private Dining Experience', type: 'Dining', time: '7:30 PM', dresscode: 'Smart Casual', spots: 20, price: 'Members rate', description: 'A curated three-course dinner reserved exclusively for members.' },
      { title: 'Cultural Preview Evening', type: 'Culture', time: '6:30 PM', dresscode: 'Business Casual', spots: 30, price: 'Complimentary', description: "An exclusive first-look at new programming, art, or a guest speaker." },
      { title: 'Wellness Morning', type: 'Wellness', time: '8:00 AM', dresscode: 'Athletic', spots: 15, price: 'Complimentary', description: 'A guided morning wellness session with a light members\' breakfast.' },
      { title: 'Networking Dinner', type: 'Networking', time: '7:00 PM', dresscode: 'Business', spots: 22, price: '$65 / person', description: 'A structured networking dinner with introductions facilitated by the club team.' },
    ],
  },
];

// Portal URLs for clubs that use portal_only (no scrapeable events page)
const PORTAL_URLS: Record<string, string> = {
  'crescent club': 'https://members.crescentclubandspa.com/',
};

function getCuratedEvents(club: PrivateClub, virtualId: string, displayName: string, location?: string): MemberEvent[] {
  const lower = club.name.toLowerCase();
  const profile = CURATED_PROFILES.find(p => p.match && lower.includes(p.match))
    ?? CURATED_PROFILES[CURATED_PROFILES.length - 1];
  const seed = virtualId.charCodeAt(virtualId.length - 1) % profile.events.length;
  const count = Math.min(profile.events.length, 4 + (seed % 2));
  const today = new Date();
  const DAYS = [1, 3, 5, 7, 10];

  // Inject portal URL for clubs that don't have a scrapeable events page
  const portalUrl = Object.entries(PORTAL_URLS).find(([k]) => lower.includes(k))?.[1] ?? null;

  return Array.from({ length: count }, (_, i) => {
    const tpl = profile.events[(seed + i) % profile.events.length];
    const d = new Date(today);
    d.setDate(today.getDate() + DAYS[i % DAYS.length]);
    return {
      id: `${virtualId}_curated_${i}`,
      clubId: virtualId,
      clubName: displayName,
      location,
      title: tpl.title,
      type: tpl.type,
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      rawDate: '',
      time: tpl.time,
      dresscode: tpl.dresscode,
      spotsLeft: tpl.spots,
      price: tpl.price,
      description: tpl.description,
      portalUrl,
      isRSVPed: false,
      isSoldOut: false,
      isExclusive: true,
      source: 'curated' as const,
    };
  });
}

// ── Fetch real events from server endpoint ────────────────────────────────────
async function fetchRealEvents(
  clubName: string,
  virtualId: string,
  displayName: string,
  location?: string,
): Promise<MemberEvent[]> {
  // Fetch with a timeout — returns [] on any network/timeout failure
  let res: Response;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20_000);
    try {
      res = await fetch(
        `${API_BASE}/member-club/events?clubName=${encodeURIComponent(clubName)}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(tid);
    }
  } catch (fetchErr) {
    console.warn(`[fetchRealEvents] network error for "${clubName}":`, fetchErr);
    return [];
  }

  if (!res.ok) {
    console.warn(`[fetchRealEvents] HTTP ${res.status} for "${clubName}"`);
    return []; // 404 / 5xx → caller falls back to curated
  }

  let data: { events: Array<{
    id: string; title: string; description: string;
    rawDate: string; isoDate?: string;
    portalUrl: string; type: string; isSoldOut?: boolean;
  }> };
  try {
    data = await res.json();
  } catch {
    console.warn(`[fetchRealEvents] JSON parse error for "${clubName}"`);
    return [];
  }

  console.log(`[fetchRealEvents] "${clubName}" → ${(data.events || []).length} events from API`);

  return (data.events || []).map(ev => {
    // Prefer exact isoDate from scraper; fall back to year-guessing
    let d: Date;
    if (ev.isoDate) {
      // Parse as local noon to avoid UTC-midnight → previous-day timezone shift
      d = new Date(`${ev.isoDate}T12:00:00`);
    } else {
      const yr = new Date().getFullYear();
      d = new Date(`${ev.rawDate} ${yr}`);
      if (isNaN(d.getTime())) d = new Date();
      if (d.getTime() < Date.now() - 60 * 86_400_000) d = new Date(`${ev.rawDate} ${yr + 1}`);
    }

    return {
      id: `${virtualId}_live_${ev.id}`,
      clubId: virtualId,
      clubName: displayName,
      location,
      title: ev.title,
      type: ev.type,
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      rawDate: ev.rawDate,
      time: '',
      dresscode: '',
      spotsLeft: -1,
      price: 'Members only',
      description: ev.description,
      portalUrl: ev.portalUrl || null,
      isRSVPed: false,
      isSoldOut: ev.isSoldOut ?? false,
      isExclusive: true,
      source: 'live' as const,
    };
  });
}


// ── "Virtual club" — what we actually display as a tab ───────────────────────
// For Park House (generic) we create two virtual clubs: Houston & Dallas.
// For any other club it's 1:1.
interface VirtualClub {
  id: string;          // unique identifier for this tab
  parentId: string;    // original PrivateClub.id
  name: string;        // display name for tab
  fetchName: string;   // what to pass to the API as clubName
  location?: string;   // human-readable location label
  isParkHouse?: boolean;
}

function buildVirtualClubs(clubs: PrivateClub[]): VirtualClub[] {
  const result: VirtualClub[] = [];
  for (const club of clubs) {
    if (isParkHouseHouston(club.name)) {
      result.push({ id: `${club.id}_hou`, parentId: club.id, name: 'Park House', fetchName: 'park house houston', location: 'Houston', isParkHouse: true });
    } else if (isParkHouseDallas(club.name)) {
      result.push({ id: `${club.id}_dal`, parentId: club.id, name: 'Park House', fetchName: 'park house dallas', location: 'Dallas', isParkHouse: true });
    } else if (isParkHouseClub(club.name)) {
      // Generic "Park House" → show both locations
      result.push({ id: `${club.id}_hou`, parentId: club.id, name: 'Park House', fetchName: 'park house houston', location: 'Houston', isParkHouse: true });
      result.push({ id: `${club.id}_dal`, parentId: club.id, name: 'Park House', fetchName: 'park house dallas', location: 'Dallas', isParkHouse: true });
    } else {
      result.push({ id: club.id, parentId: club.id, name: club.name, fetchName: club.name });
    }
  }
  return result;
}

// ── Type colours ──────────────────────────────────────────────────────────────
const TYPE_COLOURS: Record<string, string> = {
  Dining:        'text-amber-400  border-amber-500/30  bg-amber-500/10',
  Cocktails:     'text-purple-400 border-purple-500/30 bg-purple-500/10',
  Music:         'text-blue-400   border-blue-500/30   bg-blue-500/10',
  Culture:       'text-rose-400   border-rose-500/30   bg-rose-500/10',
  Wellness:      'text-green-400  border-green-500/30  bg-green-500/10',
  Entertainment: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  Networking:    'text-cyan-400   border-cyan-500/30   bg-cyan-500/10',
};

// ── Park House location picker sub-component ──────────────────────────────────
function ParkHouseLocationPicker({
  options,       // virtual clubs for PH
  selected,
  onSelect,
}: {
  options: VirtualClub[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-6 mt-4 mb-2 flex items-center gap-0 border border-white/10 w-fit">
      <div className="flex items-center gap-1.5 px-3 border-r border-white/10">
        <MapPin size={9} className="text-white/30" />
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">Location</span>
      </div>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] transition-all ${
            selected === opt.id
              ? 'bg-white text-[#000504] !text-black'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {opt.location}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface MemberClubsFeedProps {
  onManageClubs: () => void;
}

export function MemberClubsFeed({ onManageClubs }: MemberClubsFeedProps) {
  const [clubs, setClubs] = useState<PrivateClub[]>([]);
  const [virtualClubs, setVirtualClubs] = useState<VirtualClub[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [parkHouseLocation, setParkHouseLocation] = useState<Record<string, string>>({}); // parentId → selected virtual id
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [rsvpd, setRsvpd] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadClubs = useCallback(() => {
    try {
      const stored: PrivateClub[] = JSON.parse(localStorage.getItem(CLUBS_KEY) || '[]');
      setClubs(stored);
      return stored;
    } catch {
      return [] as PrivateClub[];
    }
  }, []);

  const refreshEvents = useCallback(async (clubList?: PrivateClub[]) => {
    const list = clubList ?? clubs;
    if (list.length === 0) { setEvents([]); return; }

    const vClubs = buildVirtualClubs(list);
    setVirtualClubs(vClubs);

    // Initialise PH location picker to first available location per parent
    const phInit: Record<string, string> = {};
    for (const vc of vClubs) {
      if (vc.isParkHouse && !phInit[vc.parentId]) phInit[vc.parentId] = vc.id;
    }
    setParkHouseLocation(prev => ({ ...phInit, ...prev }));

    setLoading(true);

    // Write a quick minimum estimate immediately so the Home banner shows
    // a non-zero count before the async fetch completes.
    // 4 curated events per virtual club is the guaranteed minimum.
    const currentStored = parseInt(localStorage.getItem('alist_member_event_count') || '0', 10);
    if (currentStored === 0 && vClubs.length > 0) {
      const minEstimate = vClubs.length * 4;
      localStorage.setItem('alist_member_event_count', String(minEstimate));
      window.dispatchEvent(new Event('alist-member-count-updated'));
    }

    const allEvents: MemberEvent[] = [];
    const live = new Set<string>();

    await Promise.all(vClubs.map(async vc => {
      try {
        const real = await fetchRealEvents(vc.fetchName, vc.id, vc.name, vc.location);
        if (real.length > 0) {
          allEvents.push(...real);
          live.add(vc.id);
        } else {
          allEvents.push(...getCuratedEvents(
            list.find(c => c.id === vc.parentId)!,
            vc.id, vc.name, vc.location,
          ));
        }
      } catch {
        allEvents.push(...getCuratedEvents(
          list.find(c => c.id === vc.parentId)!,
          vc.id, vc.name, vc.location,
        ));
      }
    }));

    // Sort chronologically using isoDate when available, rawDate as fallback
    allEvents.sort((a, b) => {
      const getMs = (e: MemberEvent) => {
        if (e.rawDate) {
          // Try parsing the display date which was built from isoDate (e.g. "Thu, Feb 20")
          // Use the date field (already formatted from exact isoDate in live events)
          const pd = new Date(e.date);
          if (!isNaN(pd.getTime())) return pd.getTime();
        }
        return Infinity;
      };
      return getMs(a) - getMs(b);
    });

    setLiveIds(live);
    setEvents(allEvents);
    setLoading(false);

    // Persist real event count so Home.tsx banner shows the correct number
    localStorage.setItem('alist_member_event_count', String(allEvents.length));
    window.dispatchEvent(new Event('alist-member-count-updated'));
  }, [clubs]);

  useEffect(() => {
    const stored = loadClubs();
    refreshEvents(stored);
    const onStorage = () => { const s = loadClubs(); refreshEvents(s); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('alist-clubs-updated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('alist-clubs-updated', onStorage);
    };
  }, []);

  // ── Determine which virtual club ids are currently visible in each tab ───────
  // For Park House parent tabs, we show only the currently selected location's events
  const getVisibleVirtualIds = (tabId: string): string[] => {
    if (tabId === 'all') {
      // For "all" tab: per Park House parent, show only the selected location
      return virtualClubs.map(vc => {
        if (vc.isParkHouse) {
          const chosen = parkHouseLocation[vc.parentId] ?? vc.id;
          return chosen === vc.id ? vc.id : null;
        }
        return vc.id;
      }).filter(Boolean) as string[];
    }

    // Specific tab selected
    const vc = virtualClubs.find(v => v.id === tabId);
    if (!vc) return [];

    // If it's a PH tab, it already corresponds to one specific location
    return [tabId];
  };

  // ── For the "All" tab, find the PH parent ids so we can show the location picker ─
  const parkHouseParentIds = [...new Set(virtualClubs.filter(v => v.isParkHouse).map(v => v.parentId))];

  // ── Build the filtered events list ───────────────────────────────────────────
  const visibleIds = new Set(getVisibleVirtualIds(activeTabId));
  const filteredEvents = events.filter(e => visibleIds.has(e.clubId));

  const isRsvpd = (id: string, initial: boolean) => rsvpd.has(id) || initial;

  // ── Collect tabs: use parent-level grouping for PH ──────────────────────────
  // Tab list: "All" + one tab per non-PH virtual club + one tab per PH parent
  interface Tab { id: string; label: string; isParkHouseParent?: boolean; parentId?: string }
  const tabs: Tab[] = [{ id: 'all', label: 'All' }];
  const seenParents = new Set<string>();
  for (const vc of virtualClubs) {
    if (vc.isParkHouse) {
      if (!seenParents.has(vc.parentId)) {
        seenParents.add(vc.parentId);
        tabs.push({ id: `ph_parent_${vc.parentId}`, label: 'Park House', isParkHouseParent: true, parentId: vc.parentId });
      }
    } else {
      tabs.push({ id: vc.id, label: vc.name });
    }
  }

  // Resolve whether a tab is "active" (PH parent tab is active when any of its locations is selected)
  const isTabActive = (tab: Tab): boolean => {
    if (tab.id === activeTabId) return true;
    if (tab.isParkHouseParent && tab.parentId) {
      const phVcs = virtualClubs.filter(v => v.parentId === tab.parentId);
      return phVcs.some(v => v.id === activeTabId);
    }
    return false;
  };

  const handleTabClick = (tab: Tab) => {
    if (tab.isParkHouseParent && tab.parentId) {
      // Select this parent's currently chosen location virtual club
      const chosen = parkHouseLocation[tab.parentId] ?? virtualClubs.find(v => v.parentId === tab.parentId)?.id ?? 'all';
      setActiveTabId(chosen);
    } else {
      setActiveTabId(tab.id);
    }
  };

  // Count events per tab
  const countForTab = (tab: Tab): number => {
    if (tab.id === 'all') return events.filter(e => {
      const vc = virtualClubs.find(v => v.id === e.clubId);
      if (!vc?.isParkHouse) return true;
      return parkHouseLocation[vc.parentId] === e.clubId;
    }).length;
    if (tab.isParkHouseParent && tab.parentId) {
      const chosen = parkHouseLocation[tab.parentId] ?? virtualClubs.find(v => v.parentId === tab.parentId)?.id;
      return events.filter(e => e.clubId === chosen).length;
    }
    return events.filter(e => e.clubId === tab.id).length;
  };

  // Handle RSVP
  const handleRSVP = async (event: MemberEvent) => {
    if (event.isSoldOut) return;
    if (event.source === 'live' && event.portalUrl) {
      toast('Opening member portal…', { description: `${event.title} · ${event.clubName}${event.location ? ` ${event.location}` : ''}` });
      window.open(event.portalUrl, '_blank');
      return;
    }
    if (rsvpd.has(event.id) || event.isRSVPed) {
      setRsvpd(prev => { const n = new Set(prev); n.delete(event.id); return n; });
      toast('RSVP cancelled', { description: event.title });
      return;
    }
    setRsvpd(prev => new Set([...prev, event.id]));
    toast.success('RSVP Confirmed!', { description: `${event.title} · ${event.date}` });
  };

  // ── Find PH virtual clubs for the current context (for location picker) ──────
  // When a PH location is the active tab, show the picker
  const activeVc = virtualClubs.find(v => v.id === activeTabId);
  const showLocationPicker = activeVc?.isParkHouse ?? false;
  const phParentId = activeVc?.parentId;
  const phOptionsForActive = phParentId
    ? virtualClubs.filter(v => v.parentId === phParentId && v.isParkHouse)
    : [];

  // Also show location picker in "all" tab if there are PH clubs
  const showAllTabLocationPicker = activeTabId === 'all' && parkHouseParentIds.length > 0;

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (clubs.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#000504] text-white flex flex-col items-center justify-center px-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8 max-w-xs">
          <div className="w-20 h-20 border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
            <Building2 size={32} className="text-white/20" />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic uppercase tracking-wider mb-3">No Clubs Connected</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 leading-loose">Connect your private club memberships to unlock a dedicated member-only event feed.</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button onClick={onManageClubs} className="w-full py-4 bg-white text-[#000504] font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-[#E5E4E2] transition-all flex items-center justify-center gap-2 !text-black">
              <Plus size={12} className="text-black" /> Connect a Club
            </button>
            <div className="flex items-start gap-3 p-4 border border-[#E5E4E2]/10 text-left">
              <ShieldCheck size={12} className="text-[#E5E4E2]/40 mt-0.5 flex-shrink-0" />
              <p className="text-[8px] text-white/30 uppercase tracking-[0.12em] leading-loose">Credentials are stored only on your device and used solely to retrieve member events.</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000504] text-white pb-32">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="pt-2 px-6 pb-4">
        <div className="flex items-end justify-between mb-1">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/30 mb-1 flex items-center gap-1.5">
              <Lock size={8} className="text-[#E5E4E2]/50" /> Private Access
            </p>
            <h1 className="text-2xl font-serif italic uppercase tracking-wider">Member Events</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refreshEvents()} disabled={loading} className="p-2 border border-white/10 hover:border-white/30 text-white/40 hover:text-white transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onManageClubs} className="p-2 border border-white/10 hover:border-white/30 text-white/40 hover:text-white transition-all">
              <Settings size={13} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">{clubs.length} club{clubs.length !== 1 ? 's' : ''} connected</span>
          <span className="text-white/10">·</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">
            {events.filter(e => {
              const vc = virtualClubs.find(v => v.id === e.clubId);
              if (!vc?.isParkHouse) return true;
              return (parkHouseLocation[vc.parentId] ?? vc.id) === e.clubId;
            }).length} events
          </span>
          {liveIds.size > 0 && <>
            <span className="text-white/10">·</span>
            <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-green-400/70">
              <Wifi size={8} /> Live data
            </span>
          </>}
        </div>
      </div>

      {/* ── Club Tab Bar ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-0 px-6 border-b border-white/5 min-w-max">
          {tabs.map(tab => {
            const active = isTabActive(tab);
            const cnt = countForTab(tab);
            const isLive = tab.isParkHouseParent
              ? virtualClubs.filter(v => v.parentId === tab.parentId).some(v => liveIds.has(v.id))
              : liveIds.has(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-2 px-4 py-3 text-[9px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${
                  active ? 'border-[#E5E4E2] text-white' : 'border-transparent text-white/30 hover:text-white/60'
                }`}
              >
                {tab.id === 'all'
                  ? <Globe size={10} />
                  : isLive
                  ? <Wifi size={9} className="text-green-400/70" />
                  : <Building2 size={10} />
                }
                {tab.id === 'all' ? 'All' : tab.label.length > 14 ? tab.label.slice(0, 14) + '…' : tab.label}
                <span className={`text-[7px] px-1.5 py-0.5 font-bold border ${
                  active ? 'border-[#E5E4E2]/30 text-[#E5E4E2]/70' : 'border-white/10 text-white/20'
                }`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Park House location picker (single-club tab view) ─────────────── */}
      <AnimatePresence>
        {showLocationPicker && phParentId && phOptionsForActive.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ParkHouseLocationPicker
              options={phOptionsForActive}
              selected={activeTabId}
              onSelect={id => {
                setActiveTabId(id);
                const vc = virtualClubs.find(v => v.id === id);
                if (vc?.parentId) setParkHouseLocation(prev => ({ ...prev, [vc.parentId]: id }));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Park House location picker (all tab view) ─────────────────────── */}
      <AnimatePresence>
        {showAllTabLocationPicker && parkHouseParentIds.map(parentId => {
          const phVcs = virtualClubs.filter(v => v.parentId === parentId && v.isParkHouse);
          if (phVcs.length < 2) return null;
          const selected = parkHouseLocation[parentId] ?? phVcs[0].id;
          return (
            <motion.div key={parentId} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="px-6 mt-4 mb-1">
                <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Park House location</p>
              </div>
              <ParkHouseLocationPicker
                options={phVcs}
                selected={selected}
                onSelect={id => {
                  const vc = virtualClubs.find(v => v.id === id);
                  if (vc?.parentId) setParkHouseLocation(prev => ({ ...prev, [vc.parentId]: id }));
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* ── Events list ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-white/5 p-5 space-y-3 animate-pulse">
                <div className="h-3 bg-white/5 w-2/3 rounded-sm" />
                <div className="h-2 bg-white/5 w-1/3 rounded-sm" />
                <div className="h-2 bg-white/5 w-1/2 rounded-sm" />
              </div>
            ))}
            <p className="text-center text-[8px] uppercase tracking-[0.2em] text-white/20 pt-2">Fetching live events from all locations…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10">
            <Calendar size={28} className="mx-auto text-white/10 mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">No upcoming events</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredEvents.map((event, i) => {
              const rsvped = isRsvpd(event.id, event.isRSVPed);
              const typeStyle = TYPE_COLOURS[event.type] || 'text-white/50 border-white/10 bg-white/5';
              const isExpanded = expandedId === event.id;
              const isLive = event.source === 'live';

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={`border transition-all overflow-hidden ${
                    rsvped ? 'border-[#E5E4E2]/30 bg-white/[0.03]'
                    : event.isSoldOut ? 'border-white/5 opacity-50'
                    : 'border-white/10 bg-zinc-950/40 hover:border-[#E5E4E2]/20'
                  }`}
                >
                  <button className="w-full text-left p-5" onClick={() => setExpandedId(isExpanded ? null : event.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Club / location source row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {isLive
                            ? <Wifi size={7} className="text-green-400/60" />
                            : <Building2 size={8} className="text-white/20" />
                          }
                          <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/30">
                            {event.clubName}{event.location ? ` · ${event.location}` : ''}
                          </span>
                          {isLive && (
                            <span className="text-[6px] font-bold uppercase tracking-widest text-green-400/50 border border-green-500/20 px-1 py-0.5">Live</span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-[7px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 border ${typeStyle}`}>{event.type}</span>
                          <span className="text-[7px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 border border-[#E5E4E2]/20 text-[#E5E4E2]/60 flex items-center gap-1">
                            <Lock size={6} /> Members Only
                          </span>
                          {rsvped && !isLive && (
                            <span className="text-[7px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 border border-green-500/30 text-green-400 bg-green-500/10 flex items-center gap-1">
                              <Check size={6} /> RSVP'd
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold uppercase tracking-wider text-white leading-snug">{event.title}</h3>

                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          {event.date && (
                            <div className="flex items-center gap-1 text-white/40">
                              <Calendar size={9} />
                              <span className="text-[8px] uppercase tracking-widest font-bold">{event.date}</span>
                            </div>
                          )}
                          {event.time && (
                            <div className="flex items-center gap-1 text-white/40">
                              <Clock size={9} />
                              <span className="text-[8px] uppercase tracking-widest font-bold">{event.time}</span>
                            </div>
                          )}
                          {event.spotsLeft > 0 && (
                            <div className="flex items-center gap-1 text-white/30">
                              <Users size={9} />
                              <span className="text-[8px] uppercase tracking-widest">{event.spotsLeft} spots</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className={`text-white/20 flex-shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-white/5">
                          <p className="text-[10px] text-white/50 leading-relaxed pt-4">{event.description}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {event.price && <EventDetail icon={<Tag size={9} />} label="Price" value={event.price} />}
                            {event.dresscode && <EventDetail icon={<Users size={9} />} label="Dress Code" value={event.dresscode} />}
                            <EventDetail icon={<ShieldCheck size={9} />} label="Access" value="Members Only" highlight />
                            <EventDetail
                              icon={isLive ? <Wifi size={9} /> : <WifiOff size={9} />}
                              label="Source"
                              value={isLive ? `Live · ${event.location ?? event.clubName}` : 'Curated'}
                            />
                          </div>
                          <div className="flex gap-3 pt-2">
                            {isLive && event.portalUrl ? (
                              <a
                                href={event.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-3 font-bold text-[9px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 bg-white text-[#000504] hover:bg-[#E5E4E2] !text-black"
                              >
                                <ExternalLink size={11} className="text-black" /> View in Portal
                              </a>
                            ) : !event.isSoldOut ? (
                              <button
                                onClick={() => handleRSVP(event)}
                                className={`flex-1 py-3 font-bold text-[9px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 ${
                                  rsvped
                                    ? 'border border-[#E5E4E2]/30 text-[#E5E4E2]/60 hover:border-red-500/30 hover:text-red-400'
                                    : 'bg-white text-[#000504] hover:bg-[#E5E4E2] !text-black'
                                }`}
                              >
                                {rsvped ? <><Check size={11} /> RSVP'd — Cancel</> : <><Zap size={11} className="text-black" /> RSVP Now</>}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── Add club CTA ──────────────────────────────────────────────────────── */}
      {!loading && clubs.length > 0 && (
        <div className="mt-10 mx-6 border border-dashed border-white/10 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus size={12} className="text-white/30" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Add another club</span>
          </div>
          <button onClick={onManageClubs} className="text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2] border-b border-[#E5E4E2] pb-0.5 hover:text-white transition-colors">
            Manage
          </button>
        </div>
      )}
    </div>
  );
}

// ── EventDetail sub-component ─────────────────────────────────────────────────
function EventDetail({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`p-3 border ${highlight ? 'border-[#E5E4E2]/20 bg-white/[0.02]' : 'border-white/5'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={highlight ? 'text-[#E5E4E2]/50' : 'text-white/20'}>{icon}</span>
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/30">{label}</span>
      </div>
      <p className={`text-[9px] font-bold uppercase tracking-widest ${highlight ? 'text-[#E5E4E2]' : 'text-white/70'}`}>{value}</p>
    </div>
  );
}
