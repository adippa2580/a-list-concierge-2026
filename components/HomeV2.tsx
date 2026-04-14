'use client';

import { MapPin, Search, Navigation, Check, Ticket, ChevronLeft, ChevronRight, ExternalLink, Flame, Calendar, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';

// ── Shared location / favourite hooks from Home ───────────────────────────────
const FAV_KEY = 'alist_favourite_venues';
const CLUBS_KEY = 'alist_private_clubs';

function useFavouriteVenues() {
  const [favs] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
  });
  return favs;
}

function usePrivateClubs() {
  const [clubs] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(CLUBS_KEY) || '[]'); } catch { return []; }
  });
  return clubs;
}

// ── Date filter config ────────────────────────────────────────────────────────
const DATE_FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'today',       label: 'Tonight' },
  { key: 'thisWeek',    label: 'This Week' },
  { key: 'weekend',     label: 'Weekend' },
  { key: 'restOfMonth', label: 'This Month' },
  { key: 'comingUp',    label: 'Coming Up' },
] as const;

type DateFilterKey = typeof DATE_FILTERS[number]['key'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveEventDate(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function fakeAttendance(eventId: string): string {
  // Deterministic pseudo-random from id so it doesn't flicker
  const n = eventId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = 50 + (n % 450);
  if (count > 400) return '400+ going';
  if (count > 200) return `${Math.floor(count / 50) * 50}+ going`;
  return `${count} going`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function HomeV2({ onVenueClick, onBookTable, onOpenCalendar, onViewAllArtists, onViewMemberClubs }: any) {
  const [currentLocation, setCurrentLocation] = useState(() => {
    try { return localStorage.getItem('alist_location') || 'Miami, FL'; } catch { return 'Miami, FL'; }
  });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const locationSubmittingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const favouriteVenues = useFavouriteVenues();

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery) setDateFilter('all');
    }, 500);
    return () => clearTimeout(h);
  }, [searchQuery]);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      const url = new URL(`https://${projectId}.supabase.co/functions/v1/server/eventbrite/events`);
      if (debouncedQuery) url.searchParams.append('q', debouncedQuery);
      url.searchParams.append('sort_by', 'date');
      url.searchParams.append('city', currentLocation.split(',')[0].trim());
      if (coords) {
        url.searchParams.append('lat', coords.lat.toString());
        url.searchParams.append('lon', coords.lng.toString());
      }
      try {
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.events || []);
          const formatted = list.map((e: any) => ({
            id: e.id,
            name: e.name?.text || e.name || 'Event',
            venue: e.venue?.name || 'Secret Venue',
            date: new Date(e.start?.local || Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            rawDate: new Date(e.start?.local || Date.now()),
            image: e.logo?.url || null,
            source: e.source || 'eventbrite',
            ticketUrl: e.ticketUrl || null,
            snippet: e.snippet || null,
            isTicketmaster: e.source === 'ticketmaster',
            isVenueSource: ['ra', 'web_search', 'website', 'tickettailor'].includes(e.source),
            tmVenueMatch: false,
          }));
          setEvents(formatted);
          setHeroIndex(0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [currentLocation, coords, debouncedQuery]);

  // Location helpers
  const saveLocation = (loc: string) => {
    setCurrentLocation(loc);
    try { localStorage.setItem('alist_location', loc); } catch {}
  };

  const detectDeviceLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    locationSubmittingRef.current = true;
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const d = await res.json();
        const loc = d.city ? `${d.city}${d.principalSubdivisionCode ? `, ${d.principalSubdivisionCode}` : ''}` : 'Current Location';
        saveLocation(loc);
        setEditingLocation(false);
        toast.success(`Location set to ${loc.split(',')[0]}`);
      } catch { saveLocation('Current Location'); setEditingLocation(false); }
      finally { setLoadingLocation(false); locationSubmittingRef.current = false; }
    }, () => { toast.error('Unable to get location'); setLoadingLocation(false); locationSubmittingRef.current = false; });
  };

  const commitLocation = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) { saveLocation(trimmed); setCoords(null); }
    setEditingLocation(false);
  };

  // Date grouping
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const groups: Record<string, any[]> = { today: [], thisWeek: [], weekend: [], restOfMonth: [], comingUp: [] };
    events.forEach(ev => {
      const d = ev.rawDate;
      if (!d) return;
      if (d.toDateString() === todayStr) { groups.today.push(ev); return; }
      const day = d.getDay();
      if (d < nextMonday) {
        (day === 5 || day === 6 || day === 0 ? groups.weekend : groups.thisWeek).push(ev);
        return;
      }
      (d <= endOfMonth ? groups.restOfMonth : groups.comingUp).push(ev);
    });
    return groups;
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (dateFilter === 'all') return events;
    return groupedEvents[dateFilter] || [];
  }, [dateFilter, events, groupedEvents]);

  // Hero events — top 5 with images
  const heroEvents = useMemo(() => events.filter(e => e.image).slice(0, 5), [events]);
  const heroEvent = heroEvents[heroIndex] || null;

  // Card grid events — skip hero ones, show rest
  const gridEvents = useMemo(() => {
    const heroIds = new Set(heroEvents.map(e => e.id));
    return (dateFilter === 'all' ? events : filteredEvents).filter(e => !heroIds.has(e.id));
  }, [events, filteredEvents, heroEvents, dateFilter]);

  // Auto-advance hero
  useEffect(() => {
    if (heroEvents.length < 2) return;
    const t = setInterval(() => setHeroIndex(i => (i + 1) % heroEvents.length), 5000);
    return () => clearInterval(t);
  }, [heroEvents.length]);

  const city = currentLocation.split(',')[0];

  return (
    <div className="min-h-screen bg-[#060606] text-white relative">

      {/* ── FLOATING FILTER BAR ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-white/8 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/10 shadow-2xl">
          {/* Location */}
          {editingLocation ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MapPin size={12} className="text-white/50 flex-shrink-0" />
              <input
                autoFocus
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { locationSubmittingRef.current = true; commitLocation(locationInput); }
                  if (e.key === 'Escape') { locationSubmittingRef.current = true; setEditingLocation(false); }
                }}
                onBlur={() => {
                  if (!locationSubmittingRef.current) commitLocation(locationInput);
                  locationSubmittingRef.current = false;
                }}
                className="flex-1 min-w-0 bg-transparent text-[11px] uppercase tracking-widest text-white outline-none placeholder:text-white/30"
                placeholder="Enter city..."
              />
              <button onMouseDown={() => { locationSubmittingRef.current = true; }} onClick={detectDeviceLocation} disabled={loadingLocation}>
                <Navigation size={11} className={`text-white/50 ${loadingLocation ? 'animate-spin' : ''}`} />
              </button>
              <button onMouseDown={() => { locationSubmittingRef.current = true; }} onClick={() => commitLocation(locationInput)}>
                <Check size={11} className="text-white/50" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setLocationInput(currentLocation); setEditingLocation(true); }}
              className="flex items-center gap-1.5 flex-shrink-0"
            >
              <MapPin size={11} className="text-white/40" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">{city}</span>
            </button>
          )}

          <div className="w-px h-4 bg-white/15 flex-shrink-0" />

          {/* Date filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
            {DATE_FILTERS.map(({ key, label }) => {
              const count = key === 'all' ? events.length : (groupedEvents[key]?.length || 0);
              if (key !== 'all' && count === 0) return null;
              const isActive = dateFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setDateFilter(key)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {label}
                  {key !== 'all' && <span className={`text-[8px] ${isActive ? 'text-black/50' : 'text-white/25'}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Search toggle */}
          <button
            onClick={() => { searchRef.current?.focus(); }}
            className="flex-shrink-0 p-1 text-white/40 hover:text-white transition-colors"
          >
            <Search size={13} />
          </button>
        </div>

        {/* Search bar — expands below filter bar */}
        {(searchQuery || document.activeElement === searchRef.current) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-1"
          >
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events, venues, artists..."
              className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-[11px] uppercase tracking-widest text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
            />
          </motion.div>
        )}
      </div>

      {/* ── HERO EVENT ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {heroEvent && dateFilter === 'all' && !debouncedQuery && (
          <motion.div
            key={heroEvent.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="relative mx-4 mt-3 rounded-2xl overflow-hidden"
            style={{ minHeight: 280 }}
          >
            {/* Background image with colour bleed */}
            <div className="absolute inset-0">
              <ImageWithFallback
                src={heroEvent.image}
                alt={heroEvent.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 flex items-end min-h-[280px]">
              <div className="flex gap-4 items-end w-full">
                {/* Portrait flyer thumbnail */}
                <div className="flex-shrink-0 w-24 rounded-xl overflow-hidden shadow-2xl border border-white/10" style={{ aspectRatio: '3/4' }}>
                  <ImageWithFallback
                    src={heroEvent.image}
                    alt={heroEvent.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Event info */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/50 mb-1">
                    {heroEvent.date} · {heroEvent.venue}
                  </p>
                  <h2 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                    {heroEvent.name}
                  </h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Users size={9} />
                    {fakeAttendance(heroEvent.id)}
                  </p>
                  <div className="flex items-center gap-2">
                    {heroEvent.ticketUrl && (
                      <a
                        href={heroEvent.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full hover:bg-white/90 transition-colors active:scale-95"
                      >
                        Get Tickets
                      </a>
                    )}
                    {onBookTable && (
                      <button
                        onClick={() => onBookTable(heroEvent)}
                        className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full hover:bg-white/20 transition-colors active:scale-95"
                      >
                        Book Table
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero pagination dots */}
            {heroEvents.length > 1 && (
              <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-20">
                <button
                  onClick={() => setHeroIndex(i => (i - 1 + heroEvents.length) % heroEvents.length)}
                  className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white"
                >
                  <ChevronLeft size={12} />
                </button>
                {heroEvents.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={`rounded-full transition-all ${i === heroIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
                  />
                ))}
                <button
                  onClick={() => setHeroIndex(i => (i + 1) % heroEvents.length)}
                  className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION HEADER ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/30">
            {debouncedQuery
              ? `Results for "${debouncedQuery}"`
              : dateFilter !== 'all'
              ? DATE_FILTERS.find(f => f.key === dateFilter)?.label
              : `${city} Events`}
          </h2>
          {loadingEvents && (
            <p className="text-[8px] uppercase tracking-widest text-white/20 mt-0.5 animate-pulse">Scanning...</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Flame size={11} className="text-white/20" />
          <span className="text-[9px] uppercase tracking-widest text-white/20">{filteredEvents.length} events</span>
        </div>
      </div>

      {/* ── FULL-BLEED CARD GRID ─────────────────────────────────────────────── */}
      {gridEvents.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-2 pb-32">
          {gridEvents.map((event, idx) => (
            <FullBleedCard
              key={event.id}
              event={event}
              onBook={() => onBookTable?.(event)}
              isTall={idx % 5 === 0} // Every 5th card is tall (like Posh editorial grid)
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingEvents && filteredEvents.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <Calendar size={28} className="mx-auto text-white/10 mb-3" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">No events found in {city}</p>
        </div>
      )}
    </div>
  );
}

// ── Full-Bleed Event Card ─────────────────────────────────────────────────────
function FullBleedCard({ event, onBook, isTall }: { event: any; onBook: () => void; isTall: boolean }) {
  const displayName = event.tmName || event.name;
  const displayVenue = event.tmVenueName || event.venue;
  const ticketUrl = event.tmTicketUrl || event.ticketUrl;
  const attendance = fakeAttendance(event.id);

  const handleTap = () => {
    if (ticketUrl) window.open(ticketUrl, '_blank', 'noopener,noreferrer');
    else onBook();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={handleTap}
      className={`relative rounded-xl overflow-hidden cursor-pointer group ${isTall ? 'row-span-2' : ''}`}
      style={{ aspectRatio: isTall ? '3/4' : '1/1' }}
    >
      {/* Full-bleed image */}
      {event.image ? (
        <ImageWithFallback
          src={event.image}
          alt={displayName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-active:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* Gradient scrim — bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {/* Source badge — top left */}
      {(event.source === 'ra' || event.isVenueSource) && (
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-widest ${
          event.source === 'ra' ? 'bg-green-500 text-white' : 'bg-white/20 backdrop-blur text-white'
        }`}>
          {event.source === 'ra' ? 'RA' : 'Live'}
        </div>
      )}

      {/* Attendance badge — top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
        <Users size={8} className="text-white/60" />
        <span className="text-[8px] text-white/70 font-medium">{attendance.split(' ')[0]}</span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[8px] text-white/50 uppercase tracking-widest mb-0.5 truncate">{displayVenue}</p>
        <h3 className="text-xs font-bold text-white leading-tight line-clamp-2 mb-1.5">{displayName}</h3>
        <div className="flex items-center justify-between">
          <p className="text-[8px] text-white/40 uppercase tracking-wider">{event.date}</p>
          {ticketUrl && (
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5">
              <Ticket size={7} className="text-white/70" />
              <span className="text-[7px] text-white/70 font-bold uppercase">Tickets</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
