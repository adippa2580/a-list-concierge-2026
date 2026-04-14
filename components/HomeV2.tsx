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
            tmName: null as string | null,
            tmVenueName: null as string | null,
            tmTicketUrl: null as string | null,
          }));

          // TM enrichment — match TM events to non-TM results by name/venue
          const tmEvents = formatted.filter((e: any) => e.isTicketmaster);
          const usedIds = new Set<string>();
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          const findTmMatch = (name: string, venue: string, date: Date) =>
            tmEvents.find((tm: any) => {
              if (usedIds.has(tm.id)) return false;
              const nameSim = norm(name).split(' ').filter(w => w.length > 3).some(w => norm(tm.name?.text || tm.name || '').includes(w));
              const dateSim = Math.abs(tm.rawDate.getTime() - date.getTime()) < 86400000 * 3;
              return nameSim && dateSim;
            });

          formatted.filter((e: any) => !e.isTicketmaster).forEach((ev: any) => {
            const match = findTmMatch(ev.name, ev.venue, ev.rawDate);
            if (match) {
              usedIds.add(match.id);
              ev.tmName = match.name?.text || match.name;
              ev.tmVenueName = match.venue?.name || match.venue;
              ev.tmTicketUrl = match.ticketUrl;
              ev.tmVenueMatch = true;
              if (match.image) ev.image = match.image;
            }
          });

          // Sort: RA → venue+photo → TM → venue-no-photo → rest
          formatted.sort((a: any, b: any) => {
            const rank = (e: any) => e.source === 'ra' ? 0 : (e.isVenueSource && e.image) ? 1 : e.isTicketmaster ? 2 : (e.isVenueSource) ? 3 : 4;
            return rank(a) - rank(b) || a.rawDate.getTime() - b.rawDate.getTime();
          });

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

  const [searchFocused, setSearchFocused] = useState(false);

  const filteredEvents = useMemo(() => {
    if (dateFilter === 'all') return events;
    return groupedEvents[dateFilter] || [];
  }, [dateFilter, events, groupedEvents]);

  // Hero events — top 5 with images
  const heroEvents = useMemo(() => events.filter(e => e.image).slice(0, 5), [events]);
  const heroEvent = heroEvents[heroIndex] || null;

  // Grid: all events (hero events also appear in grid — hero is just a spotlight)
  const gridEvents = useMemo(() => {
    return dateFilter === 'all' ? events : filteredEvents;
  }, [events, filteredEvents, dateFilter]);

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
      <div
        className="sticky top-0 z-40 px-4 pb-2"
        style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/10 shadow-2xl">
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
            onClick={() => { setSearchFocused(true); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="flex-shrink-0 p-1 text-white/40 hover:text-white transition-colors"
          >
            <Search size={13} />
          </button>
        </div>

        {/* Search bar — expands below filter bar */}
        {(searchQuery || searchFocused) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-1"
          >
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { if (!searchQuery) setSearchFocused(false); }}
              placeholder="Search events, venues, artists..."
              className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-[11px] uppercase tracking-widest text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
              autoFocus
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
            className="relative mx-4 mt-3 rounded-2xl overflow-hidden cursor-pointer"
            style={{ minHeight: 280 }}
            onClick={() => onVenueClick?.({
              id: heroEvent.id,
              name: heroEvent.tmVenueName || heroEvent.venue,
              image: heroEvent.image,
              date: heroEvent.date,
              ticketUrl: heroEvent.tmTicketUrl || heroEvent.ticketUrl,
              source: heroEvent.source,
              tables: [],
              minSpend: 500,
              location: heroEvent.venue,
            })}
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
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full hover:bg-white/90 transition-colors active:scale-95"
                      >
                        Get Tickets
                      </a>
                    )}
                    {onBookTable && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onBookTable({
                            id: heroEvent.id,
                            name: heroEvent.tmVenueName || heroEvent.venue,
                            image: heroEvent.image,
                            date: heroEvent.date,
                            ticketUrl: heroEvent.tmTicketUrl || heroEvent.ticketUrl,
                            source: heroEvent.source,
                            tables: [],
                            minSpend: 500,
                            location: heroEvent.venue,
                          });
                        }}
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
        <div className="px-4 grid grid-cols-2 gap-2 pb-32" style={{ gridAutoRows: '160px' }}>
          {gridEvents.map((event, idx) => {
            const venueObj = {
              id: event.id,
              name: event.tmVenueName || event.venue,
              image: event.image,
              date: event.date,
              ticketUrl: event.tmTicketUrl || event.ticketUrl,
              source: event.source,
              tables: [],
              minSpend: 500,
              location: event.venue,
            };
            return (
              <FullBleedCard
                key={event.id}
                event={event}
                onBook={() => onBookTable?.(venueObj)}
                onVenueClick={() => onVenueClick?.(venueObj)}
                isTall={idx % 5 === 0}
              />
            );
          })}
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
function FullBleedCard({ event, onBook, onVenueClick, isTall }: {
  event: any;
  onBook: () => void;
  onVenueClick: () => void;
  isTall: boolean;
}) {
  const displayName = event.tmName || event.name;
  const displayVenue = event.tmVenueName || event.venue;
  const ticketUrl = event.tmTicketUrl || event.ticketUrl;
  const attendance = fakeAttendance(event.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onVenueClick}
      className={`relative rounded-xl overflow-hidden cursor-pointer group ${isTall ? 'row-span-2' : 'row-span-1'}`}
      style={{ minHeight: 0 }}
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
          <div className="flex items-center gap-1.5">
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 bg-white text-black rounded-full px-2 py-0.5 active:scale-95 transition-transform"
              >
                <Ticket size={7} className="text-black" />
                <span className="text-[7px] text-black font-bold uppercase">Tickets</span>
              </a>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onBook(); }}
                className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5 hover:bg-white/25 transition-colors active:scale-95"
              >
                <span className="text-[7px] text-white/70 font-bold uppercase">Book Table</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
