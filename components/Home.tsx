'use client';

import { MapPin, Star, ChevronRight, Search, Music, Wine, Mic2, Navigation, Play, X, ExternalLink, Globe, Ticket, Users, LayoutGrid, List, Heart, Building2, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';

const FAV_KEY = 'alist_favourite_venues';

function getFavouriteVenues(): any[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
}

function useFavouriteVenues() {
  const [favourites, setFavourites] = useState<any[]>(getFavouriteVenues);
  useEffect(() => {
    const refresh = () => setFavourites(getFavouriteVenues());
    window.addEventListener('alist-favourites-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('alist-favourites-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return favourites;
}

const CLUBS_KEY = 'alist_private_clubs';

function getPrivateClubs(): any[] {
  try { return JSON.parse(localStorage.getItem(CLUBS_KEY) || '[]'); }
  catch { return []; }
}

function usePrivateClubs() {
  const [clubs, setClubs] = useState<any[]>(getPrivateClubs);
  useEffect(() => {
    const refresh = () => setClubs(getPrivateClubs());
    window.addEventListener('storage', refresh);
    window.addEventListener('alist-clubs-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('alist-clubs-updated', refresh);
    };
  }, []);
  return clubs;
}

const MEMBER_COUNT_KEY = 'alist_member_event_count';

function getMemberEventCount(clubs: any[]): number {
  const stored = localStorage.getItem(MEMBER_COUNT_KEY);
  if (stored !== null) {
    const n = parseInt(stored, 10);
    // Only trust stored count when it's a real positive number — ignore stale "0"
    if (n > 0) return n;
  }
  // Fall back to onboarding mock counts (before MemberClubsFeed has run)
  return clubs.reduce((s: number, c: any) => s + (c.fetchedEvents || 0), 0);
}

function useMemberEventCount(clubs: any[]) {
  const [count, setCount] = useState(() => getMemberEventCount(clubs));
  useEffect(() => {
    const refresh = () => setCount(getMemberEventCount(clubs));
    window.addEventListener('storage', refresh);
    window.addEventListener('alist-member-count-updated', refresh);
    window.addEventListener('alist-clubs-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('alist-member-count-updated', refresh);
      window.removeEventListener('alist-clubs-updated', refresh);
    };
  }, [clubs]);
  return count;
}

/** Detect generic venue-listing page titles (not a specific event name). */
const isGenericTitle = (t: string) =>
  /tickets for (concerts|events|shows|music)/i.test(t) ||
  /upcoming (events|shows|concerts)/i.test(t) ||
  t.length > 60;

export function Home({ onVenueClick, onBookTable, onOpenCalendar, onViewAllArtists, onViewMemberClubs }: any) {
  const [currentLocation, setCurrentLocation] = useState('Miami, FL');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const favouriteVenues = useFavouriteVenues();
  const privateClubs = usePrivateClubs();
  const memberEventCount = useMemberEventCount(privateClubs);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery) setDateFilter(null); // clear date filter on search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      const url = new URL(`https://${projectId}.supabase.co/functions/v1/server/eventbrite/events`);

      if (debouncedQuery) {
        url.searchParams.append('q', debouncedQuery);
      }

      url.searchParams.append('sort_by', 'date');

      const city = currentLocation.split(',')[0].trim();
      url.searchParams.append('city', city);

      if (coords) {
        url.searchParams.append('lat', coords.lat.toString());
        url.searchParams.append('lon', coords.lng.toString());
      }

      try {
        const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
        if (res.ok) {
          const data = await res.json();
          const eventList = Array.isArray(data) ? data : (data.events || []);

          const formatted: any[] = eventList.map((e: any) => {
            const externalSources = ['ra', 'web_search', 'website', 'ticketmaster', 'tickettailor'];
            const isWebSource = externalSources.includes(e.source);
            const isTicketmaster = e.source === 'ticketmaster';
            const isVenueSource = isWebSource && !isTicketmaster; // RA Guide, web search, venue sites
            return {
              id: e.id,
              name: e.name?.text || e.name || 'Event',
              venue: e.venue?.name || 'Secret Venue',
              date: new Date(e.start?.local || Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              rawDate: new Date(e.start?.local || Date.now()),
              image: e.logo?.url || null,
              source: e.source || 'eventbrite',
              ticketUrl: e.ticketUrl || null,
              venueWebsite: e.venueWebsite || null,
              snippet: e.snippet || null,
              isWebSource,
              isTicketmaster,
              isVenueSource,
              // TM enrichment fields — filled in next pass
              tmImage: null as string | null,
              tmSnippet: null as string | null,
              tmTicketUrl: null as string | null,
              tmVenueMatch: false,
            };
          });

           // ── TM Enrichment: match Ticketmaster events to ALL non-TM results ──
          const tmEvents = formatted.filter(e => e.isTicketmaster);
          const usedTmIds = new Set<string>();

          // Normalise: lowercase, strip punctuation, collapse spaces
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();


          // Multi-strategy fuzzy match helper
          const findTmMatch = (title: string, venueName: string, rawDate: Date) => {
            const t = norm(title);
            const vn = norm(venueName);
            const dateStr = rawDate.toDateString();

            return tmEvents.find(tm => {
              if (usedTmIds.has(tm.id)) return false;
              const tmTitle = norm(tm.name);
              const tmVn = norm(tm.venue);
              const dayDiff = Math.abs(tm.rawDate.getTime() - rawDate.getTime()) / 86_400_000;

              // Strategy 1: title keyword overlap + same date
              if (tm.rawDate.toDateString() === dateStr) {
                const tWords = t.split(' ');
                const tmWords = tmTitle.split(' ');
                const shared = tWords.filter(w => w.length > 3 && tmWords.includes(w)).length;
                if (shared >= 2 || tmTitle.includes(t.slice(0, 12)) || t.includes(tmTitle.slice(0, 12))) {
                  return true;
                }
              }

              // Strategy 2: venue name similarity within 3 days
              // (catches generic listing pages for the same venue)
              if (dayDiff <= 3 && vn.length > 3) {
                const vnWords = vn.split(' ').filter(w => w.length > 3);
                const tmVnWords = tmVn.split(' ').filter(w => w.length > 3);
                const sharedVenue = vnWords.filter(w => tmVnWords.includes(w) || tmVn.includes(w)).length;
                if (sharedVenue >= 1) return true;
              }

              // Strategy 3: TM venue name appears in the web result title (e.g. "SILO DALLAS...")
              if (dayDiff <= 3 && tmVn.length > 3) {
                const tmVnWords = tmVn.split(' ').filter(w => w.length > 3);
                const matchedInTitle = tmVnWords.filter(w => t.includes(w)).length;
                if (matchedInTitle >= 1) return true;
              }

              return false;
            });
          };

          // Apply enrichment to all non-TM events.
          // Process in source-priority order so venue/RA results get first pick on shared TM events.
          const enrichOrder = ['ra', 'web_search', 'website', 'tickettailor', 'eventbrite', 'curated'];
          const nonTmEvents = formatted.filter(e => !e.isTicketmaster);
          nonTmEvents.sort((a, b) => enrichOrder.indexOf(a.source) - enrichOrder.indexOf(b.source));

          nonTmEvents.forEach(ev => {
            const match = findTmMatch(ev.name, ev.venue, ev.rawDate);
            if (match) {
              usedTmIds.add(match.id);
              ev.tmImage = match.image;
              ev.tmSnippet = match.snippet;
              ev.tmTicketUrl = match.ticketUrl;
              ev.tmName = match.name;      // TM event title (artist name etc)
              ev.tmVenueName = match.venue; // TM venue name
              ev.tmVenueMatch = true;
              // Always use TM image when available
              if (match.image) ev.image = match.image;
              // Use TM snippet if own snippet is missing
              if (!ev.snippet && match.snippet) ev.snippet = match.snippet;
            }
          });

          // Sort: RA first, then venue-with-photo, then venue-no-photo, then TM, then Eventbrite
          const sourceOrder = (e: any) => {
            if (e.source === 'ra') return 0;
            if (e.isVenueSource && e.image)  return 1;  // venue + has photo → TOP
            if (e.isVenueSource && !e.image) return 3;  // venue, no photo → DEMOTED (after TM)
            if (e.isTicketmaster) return 2;
            return 4;
          };
          formatted.sort((a, b) => {
            const so = sourceOrder(a) - sourceOrder(b);
            if (so !== 0) return so;
            return a.rawDate.getTime() - b.rawDate.getTime();
          });

          setEvents(formatted);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [currentLocation, coords, debouncedQuery]);

  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  const detectDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const data = await res.json();
        if (data.city) {
          const stateCode = data.principalSubdivisionCode ? `, ${data.principalSubdivisionCode}` : '';
          const newLocation = `${data.city}${stateCode}`;
          setCurrentLocation(newLocation);
          setEditingLocation(false);
          toast.success(`Location updated to ${data.city}`);
        } else {
          setCurrentLocation("Current Location");
          setEditingLocation(false);
          toast.success("Location updated");
        }
      } catch (e) {
        console.error(e);
        setCurrentLocation("Current Location");
        setEditingLocation(false);
        toast.success("Location updated");
      } finally {
        setLoadingLocation(false);
      }
    }, (err) => {
      console.error(err);
      toast.error("Unable to retrieve your location");
      setLoadingLocation(false);
    });
  };

  const handleLocationCheck = () => {
    setLocationInput(currentLocation);
    setEditingLocation(true);
  };

  const handleLocationSubmit = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      setCurrentLocation(trimmed);
      setCoords(null);
      toast.success(`Location set to ${trimmed.split(',')[0]}`);
    }
    setEditingLocation(false);
  };

  // ── Section buckets (mutually exclusive, render in this order) ──────────────
  // 1. Venue Results: RA, web search, venue sites, Ticket Tailor — NOT Ticketmaster
  // 1a. Venue Results WITH a photo — shown first (richest results)
  const venueWithPhoto = useMemo(() =>
    events.filter(e => e.isVenueSource && e.image),
  [events]);

  // 1b. Venue Results WITHOUT a photo — demoted after Ticketmaster
  const venueNoPhoto = useMemo(() =>
    events.filter(e => e.isVenueSource && !e.image),
  [events]);

  // Combined for the section header count
  const webSourcedEvents = useMemo(() =>
    events.filter(e => e.isVenueSource),
  [events]);

  // 2. Ticketmaster: standalone TM listings (shown between venue photo/no-photo results)
  const tmOnlyEvents = useMemo(() =>
    events.filter(e => e.isTicketmaster),
  [events]);

  // 3. Date-grouped Eventbrite / curated: everything that is NOT a web source at all
  const nonWebEvents = useMemo(() =>
    events.filter(e => !e.isWebSource && !e.isTicketmaster),
  [events]);

  const groupedEvents = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7);
    if (nextMonday <= today) nextMonday.setDate(today.getDate() + 7);

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const groups = {
      today: [] as any[],
      thisWeek: [] as any[],
      weekend: [] as any[],
      restOfMonth: [] as any[],
      comingUp: [] as any[]
    };

    nonWebEvents.forEach(event => {
      const date = event.rawDate;
      const dateStr = date.toDateString();

      if (dateStr === todayStr) {
        groups.today.push(event);
        return;
      }

      const day = date.getDay();
      const isWeekendDay = day === 5 || day === 6 || day === 0;

      if (date < nextMonday) {
        if (isWeekendDay) {
          groups.weekend.push(event);
        } else {
          groups.thisWeek.push(event);
        }
        return;
      }

      if (date <= endOfMonth) {
        groups.restOfMonth.push(event);
        return;
      }

      groups.comingUp.push(event);
    });

    return groups;
  }, [nonWebEvents]);

  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const DATE_FILTERS = [
    { key: 'today',       label: 'Today' },
    { key: 'thisWeek',    label: 'This Week' },
    { key: 'weekend',     label: 'Weekend' },
    { key: 'restOfMonth', label: 'This Month' },
    { key: 'comingUp',    label: 'Coming Up' },
  ] as const;

  // Filtered grouped events based on active date filter
  const visibleGroups = useMemo(() => {
    if (!dateFilter) return groupedEvents;
    return {
      today:       dateFilter === 'today'       ? groupedEvents.today       : [],
      thisWeek:    dateFilter === 'thisWeek'    ? groupedEvents.thisWeek    : [],
      weekend:     dateFilter === 'weekend'     ? groupedEvents.weekend     : [],
      restOfMonth: dateFilter === 'restOfMonth' ? groupedEvents.restOfMonth : [],
      comingUp:    dateFilter === 'comingUp'    ? groupedEvents.comingUp    : [],
    };
  }, [dateFilter, groupedEvents]);
    // When this venue/EB result is enriched with TM data, show TM's richer content
    const isTmEnriched = event.tmVenueMatch && event.tmName;
    // Always prefer the TM artist/event name when we have an enrichment match
    const displayName = isTmEnriched ? event.tmName : event.name;
    const displayVenue = isTmEnriched && event.tmVenueName ? event.tmVenueName : event.venue;
    const displaySnippet = isTmEnriched
      ? (event.tmSnippet || event.snippet)
      : event.snippet;
    const displayImage = event.image; // always pre-filled with TM image in enrichment pass
    const primaryTicketUrl = isTmEnriched
      ? (event.tmTicketUrl || event.ticketUrl)
      : event.ticketUrl;

    const isGridMode = viewMode === 'grid';

    if (isGridMode) {
      // Grid card layout
      return (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-zinc-950/60 border overflow-hidden group hover:border-[#E5E4E2]/30 transition-all cursor-pointer relative flex flex-col h-full ${
            event.isVenueSource || isTmEnriched
              ? 'border-amber-500/40'
              : event.isTicketmaster
              ? 'border-blue-500/20'
              : 'border-white/5'
          }`}
          onClick={() => {
            if (primaryTicketUrl) {
              window.open(primaryTicketUrl, '_blank', 'noopener,noreferrer');
            } else if (onBookTable) {
              onBookTable(event);
            }
          }}
        >
          {/* Image */}
          {displayImage && (
            <div className="w-full aspect-square platinum-border overflow-hidden relative">
              <ImageWithFallback
                src={displayImage}
                alt={displayName}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
              {/* Corner source badge */}
              {event.source === 'ra' && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-600 flex items-center gap-0.5">
                  <span className="text-[7px] font-black text-white uppercase tracking-widest">RA</span>
                </div>
              )}
              {event.isVenueSource && event.source !== 'ra' && (
                <div className="absolute top-1 left-1 p-1 bg-amber-500">
                  <Ticket size={8} className="text-black" />
                </div>
              )}
              {event.isTicketmaster && (
                <div className="absolute top-1 left-1 p-1 bg-blue-500">
                  <Ticket size={8} className="text-white" />
                </div>
              )}
            </div>
          )}
          {/* Info */}
          <div className="flex-1 p-3 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white group-hover:platinum-gradient transition-colors line-clamp-2 mb-1">
              {displayName}
            </h3>
            <div className="flex items-center gap-1 text-white/40 mb-2">
              <MapPin size={9} className="text-[#E5E4E2]/40 flex-shrink-0" />
              <p className="text-[8px] uppercase tracking-[0.1em] truncate">{displayVenue}</p>
            </div>
            <p className="text-[7px] text-white/30 uppercase tracking-widest mb-2">{event.date}</p>
            {displaySnippet && (
              <p className="text-[7px] text-white/40 line-clamp-2 leading-relaxed normal-case tracking-normal flex-1">
                {displaySnippet}
              </p>
            )}
            {primaryTicketUrl && (
              <button
                className="mt-2 text-[7px] font-bold uppercase tracking-[0.1em] text-[#E5E4E2] hover:text-white active:scale-95 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(primaryTicketUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink size={8} />
                {event.isTicketmaster || isTmEnriched ? 'Get Tickets' : 'Open'}
              </button>
            )}
          </div>
        </motion.div>
      );
    }

    // List card layout (original)
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-zinc-950/60 border p-5 flex gap-5 overflow-hidden group hover:border-[#E5E4E2]/30 transition-all cursor-pointer relative ${
          event.source === 'ra'
            ? 'border-l-2 border-l-green-500/70 border-t-white/5 border-r-white/5 border-b-white/5'
            : event.isVenueSource || isTmEnriched
            ? 'border-l-2 border-l-amber-500/70 border-t-white/5 border-r-white/5 border-b-white/5'
            : event.isTicketmaster
            ? 'border-l-2 border-l-blue-500/40 border-t-white/5 border-r-white/5 border-b-white/5'
            : 'border-white/5'
        }`}
        onClick={() => {
          if (primaryTicketUrl) {
            window.open(primaryTicketUrl, '_blank', 'noopener,noreferrer');
          } else if (onBookTable) {
            onBookTable(event);
          }
        }}
      >
        {/* Image — always show TM image when enriched */}
        {displayImage && (
          <div className="w-20 h-20 flex-shrink-0 platinum-border overflow-hidden relative">
            <ImageWithFallback
              src={displayImage}
              alt={displayName}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
            {/* Corner source badge */}
            {event.source === 'ra' && (
              <div className="absolute top-0 left-0 px-1 py-0.5 bg-green-600">
                <span className="text-[6px] font-black text-white uppercase tracking-widest">RA</span>
              </div>
            )}
            {event.isVenueSource && event.source !== 'ra' && (
              <div className="absolute top-0 left-0 p-0.5 bg-amber-500">
                <Ticket size={7} className="text-black" />
              </div>
            )}
            {event.isTicketmaster && (
              <div className="absolute top-0 left-0 p-0.5 bg-blue-500">
                <Ticket size={7} className="text-white" />
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-white group-hover:platinum-gradient pr-2 transition-colors line-clamp-2">
              {displayName}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Source badge — RA Guide gets distinct green, other venue sources get amber */}
              {event.source === 'ra' && (
                <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border whitespace-nowrap flex items-center gap-1 bg-green-600/20 text-green-400 border-green-500/30">
                  RA Guide
                </span>
              )}
              {event.isVenueSource && event.source !== 'ra' && (
                <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border whitespace-nowrap flex items-center gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <Ticket size={7} />
                  Venue
                </span>
              )}
              {event.isTicketmaster && (
                <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border whitespace-nowrap flex items-center gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
                  <Ticket size={7} />
                  Ticketmaster
                </span>
              )}
              {!event.isWebSource && !event.isTicketmaster && (
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-white/40">
            <MapPin size={10} className="text-[#E5E4E2]/40" />
            <p className="text-[9px] uppercase tracking-[0.2em] truncate">{displayVenue}</p>
          </div>
          {/* Body date: only for standalone TM events (venue date is already in the badge row above) */}
          {event.isTicketmaster && !event.isVenueSource && (
            <p className="text-[9px] text-white/50 mt-0.5 uppercase tracking-widest">{event.date}</p>
          )}
          {displaySnippet && (
            <p className="text-[9px] text-white/40 mt-1.5 line-clamp-3 leading-relaxed normal-case tracking-normal whitespace-pre-line">
              {displaySnippet}
            </p>
          )}
          {(primaryTicketUrl || event.venueWebsite) && (
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5">
              {primaryTicketUrl && (
                <button
                  className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-[#E5E4E2] hover:text-white active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(primaryTicketUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <ExternalLink size={9} />
                  {event.isTicketmaster || isTmEnriched ? 'Get Tickets' : 'Open Link'}
                </button>
              )}
              {event.venueWebsite && (
                <button
                  className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-white/50 hover:text-white/80 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(event.venueWebsite, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Globe size={9} />
                  Venue Site
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderEventSection = (title: string, events: any[]) => {
    if (events.length === 0) return null;
    return (
      <div className="space-y-4">
        <div className="sticky top-[120px] z-10 bg-[#000504]/90 backdrop-blur-md px-6 py-3 -mx-6 border-y border-[#E5E4E2]/5 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">{title}</span>
          <Badge variant="outline" className="border-[#E5E4E2]/10 text-[#E5E4E2]/40 text-[7px] uppercase tracking-[0.2em] px-2 py-0 h-4 rounded-none">
            {events.length} Events
          </Badge>
        </div>
        {events.map(renderEventCard)}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 bg-[#000504] text-white marble-bg">

      {/* ── Favourite Clubs Strip ── */}
      {favouriteVenues.length > 0 && (
        <div className="pt-2 pb-4">
          <div className="px-6 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={11} fill="currentColor" className="text-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/70">
                Favourite Clubs
              </span>
            </div>
            <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-bold">
              {favouriteVenues.length} saved
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-6 no-scrollbar pb-1">
            {favouriteVenues.map((fav: any) => (
              <button
                key={fav.id || fav.name}
                onClick={() => onVenueClick(fav)}
                className="flex-shrink-0 w-36 group relative overflow-hidden border border-white/10 hover:border-[#E5E4E2]/40 active:scale-95 transition-all bg-zinc-950/80 text-left focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
              >
                {/* Venue image */}
                <div className="w-full h-20 overflow-hidden relative">
                  {fav.image ? (
                    <ImageWithFallback
                      src={fav.image}
                      alt={fav.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <Music size={20} className="text-white/10" />
                    </div>
                  )}
                  {/* Heart badge */}
                  <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm p-1 border border-red-500/30">
                    <Heart size={8} fill="currentColor" className="text-red-500" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000504]/80 via-transparent to-transparent" />
                </div>
                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white truncate group-hover:text-[#E5E4E2] transition-colors">
                    {fav.name}
                  </p>
                  {fav.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={7} className="text-white/30 flex-shrink-0" />
                      <p className="text-[7px] uppercase tracking-[0.1em] text-white/30 truncate">
                        {fav.location}
                      </p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 mx-6 border-b border-[#E5E4E2]/5" />
        </div>
      )}

      {/* ── Member Clubs Teaser Banner ── */}
      {privateClubs.length > 0 && onViewMemberClubs && (
        <button
          onClick={onViewMemberClubs}
          className="mx-6 mb-4 w-[calc(100%-3rem)] flex items-center justify-between px-4 py-3 border border-[#E5E4E2]/20 bg-white/[0.02] hover:bg-white/[0.04] active:scale-[0.98] hover:border-[#E5E4E2]/40 transition-all group focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck size={12} className="text-[#E5E4E2]/60" />
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
                {memberEventCount} Member Events Available
              </p>
              <p className="text-[7px] uppercase tracking-[0.15em] text-white/30 mt-0.5">
                {privateClubs.length} club{privateClubs.length !== 1 ? 's' : ''} · Exclusive access
              </p>
            </div>
          </div>
          <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
        </button>
      )}

      {/* Location & Search Header */}
      <div className="pt-2 px-6 pb-6 space-y-6">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mb-1 flex items-center gap-2 font-bold">
              Location {loadingLocation && <span className="animate-pulse">...</span>}
            </p>

            {editingLocation ? (
              <div className="flex items-center gap-2">
                {/* Text input */}
                <input
                  autoFocus
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleLocationSubmit(locationInput);
                    if (e.key === 'Escape') setEditingLocation(false);
                  }}
                  placeholder="City, State..."
                  className="flex-1 min-w-0 bg-transparent border-b border-[#E5E4E2]/40 focus:border-[#E5E4E2] outline-none text-xl font-serif italic tracking-widest uppercase platinum-gradient pb-0.5 placeholder:text-white/20 transition-colors"
                />
                {/* Use device GPS */}
                <button
                  onClick={detectDeviceLocation}
                  disabled={loadingLocation}
                  className="flex-shrink-0 w-8 h-8 border border-white/20 flex items-center justify-center hover:border-[#E5E4E2]/40 hover:bg-white/5 transition-all disabled:opacity-40"
                  title="Use device location"
                >
                  <Navigation size={13} className={`text-[#E5E4E2] ${loadingLocation ? 'animate-spin' : ''}`} />
                </button>
                {/* Confirm */}
                <button
                  onClick={() => handleLocationSubmit(locationInput)}
                  className="flex-shrink-0 w-8 h-8 border border-white/20 flex items-center justify-center hover:border-[#E5E4E2]/40 hover:bg-white/5 transition-all"
                >
                  <X size={13} className="text-white/40 hover:text-white transition-colors" />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={handleLocationCheck}
              >
                <MapPin size={16} className="text-[#E5E4E2] flex-shrink-0" />
                <span className="text-2xl font-serif italic tracking-widest uppercase platinum-gradient group-hover:opacity-80 transition-opacity truncate">
                  {currentLocation.split(',')[0]}
                </span>
                <span className="text-[8px] uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0">
                  Change
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50 ${viewMode === 'grid' ? 'border-white/30 bg-white/5 hover:bg-white/10' : 'border-white/5 text-white/30 hover:border-white/15 hover:bg-white/[0.02]'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50 ${viewMode === 'list' ? 'border-white/30 bg-white/5 hover:bg-white/10' : 'border-white/5 text-white/30 hover:border-white/15 hover:bg-white/[0.02]'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Minimal Search */}
        <div className="relative group">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-[#E5E4E2] transition-colors" size={14} />
          <Input
            placeholder="SEARCH CLUBS, VENUES, EVENTS..."
            className="pl-7 bg-transparent border-0 border-b border-white/10 rounded-none px-0 py-2 text-white placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-[#E5E4E2] transition-all tracking-[0.2em] text-[10px] font-bold uppercase h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Pills */}
      <div className="px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {DATE_FILTERS.map(({ key, label }) => {
            const count = groupedEvents[key].length;
            if (count === 0) return null;
            const isActive = dateFilter === key;
            return (
              <button
                key={key}
                onClick={() => setDateFilter(isActive ? null : key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border text-[8px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white text-[#000504] border-white !text-black'
                    : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/70'
                }`}
              >
                {label}
                <span className={`text-[7px] ${isActive ? 'text-black/40' : 'text-white/20'}`}>{count}</span>
              </button>
            );
          })}
          {dateFilter && (
            <button
              onClick={() => setDateFilter(null)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border border-white/10 text-[8px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-all"
            >
              <X size={9} />
              All
            </button>
          )}
        </div>
      </div>

      {/* Events Content */}
      <div className="px-6 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/30">
            {debouncedQuery ? `Results for "${debouncedQuery}"` : "Tonight's Elite Picks"}
          </h2>
          {loadingEvents && (
            <span className="text-[9px] animate-pulse text-[#E5E4E2] uppercase tracking-widest font-bold">Scanning...</span>
          )}
        </div>

        {events.length === 0 && !loadingEvents && (
          <div className="text-center py-16 border border-dashed border-white/10">
            <Music size={32} className="mx-auto text-white/10 mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">
              No events found in {currentLocation.split(',')[0]}
            </p>
          </div>
        )}

        {/* Venue Results WITH photo — hidden when date filter active */}
        {!dateFilter && venueWithPhoto.length > 0 && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
            {viewMode === 'list' && (
              <h3 className="text-[8px] font-bold text-[#E5E4E2]/70 uppercase tracking-widest border-b border-[#E5E4E2]/10 pb-2 flex items-center gap-2 col-span-2">
                <Building2 size={12} />
                Venue Results
                <span className="text-[8px] text-white/25 font-normal ml-auto tracking-wider">
                  {webSourcedEvents.length} {webSourcedEvents.length === 1 ? 'result' : 'results'}
                  {webSourcedEvents.filter(e => e.tmVenueMatch).length > 0 &&
                    <span className="ml-1 text-white/30">· {webSourcedEvents.filter(e => e.tmVenueMatch).length} enriched</span>
                  }
                </span>
              </h3>
            )}
            {venueWithPhoto.map(e => renderEventCard(e))}
          </div>
        )}

        {/* Ticketmaster Results — hidden when date filter active */}
        {!dateFilter && tmOnlyEvents.length > 0 && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
            {viewMode === 'list' && (
              <h3 className="text-[8px] font-bold text-[#E5E4E2]/50 uppercase tracking-widest border-b border-[#E5E4E2]/10 pb-2 flex items-center gap-2 col-span-2">
                <Ticket size={12} />
                Ticketmaster
                <span className="text-[8px] text-white/25 font-normal ml-auto tracking-wider">
                  {tmOnlyEvents.length} {tmOnlyEvents.length === 1 ? 'result' : 'results'}
                </span>
              </h3>
            )}
            {tmOnlyEvents.map(e => renderEventCard(e))}
          </div>
        )}

        {/* Venue Results WITHOUT photo — hidden when date filter active */}
        {!dateFilter && venueNoPhoto.length > 0 && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
            {viewMode === 'list' && (
              <h3 className={`text-[8px] font-bold uppercase tracking-widest pb-2 flex items-center gap-2 border-b col-span-2 ${
                venueWithPhoto.length > 0
                  ? 'text-[#E5E4E2]/30 border-[#E5E4E2]/5'
                  : 'text-[#E5E4E2]/70 border-[#E5E4E2]/10'
              }`}>
                <Building2 size={12} className={venueWithPhoto.length > 0 ? 'opacity-40' : ''} />
                {venueWithPhoto.length > 0 ? 'More from Venue' : 'Venue Results'}
                <span className={`text-[8px] font-normal ml-auto tracking-wider ${venueWithPhoto.length > 0 ? 'text-white/15' : 'text-white/25'}`}>
                  {venueNoPhoto.length} {venueNoPhoto.length === 1 ? 'result' : 'results'}
                </span>
              </h3>
            )}
            {venueNoPhoto.map(e => renderEventCard(e))}
          </div>
        )}

        {renderEventSection('Today', visibleGroups.today)}
        {renderEventSection('This Week', visibleGroups.thisWeek)}
        {renderEventSection('This Weekend', visibleGroups.weekend)}
        {renderEventSection('This Month', visibleGroups.restOfMonth)}
        {renderEventSection('Coming Up', visibleGroups.comingUp)}
      </div>
    </div>
  );
}