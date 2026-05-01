'use client';

import { Calendar, Clock, MapPin, Search, Star, Bookmark, BookmarkCheck, Music, Ticket, Users, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AListLogo } from './AListLogo';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const categories = [
  { key: 'all', label: 'All Events', icon: Star },
  { key: 'tables', label: 'Tables', icon: Users },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'guestlist', label: 'Guestlist', icon: Bookmark }
];

export function EventCalendar() {
  const { userId } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'month'>('list');
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // toDateString() of cell tapped in month view

  // Pull stored city from localStorage (matches Home + YourScene patterns).
  // Defaults to Miami only when no location has ever been set.
  const [city] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('alist_location');
      if (saved) return saved.split(',')[0].trim();
    } catch { /* SSR / unavailable */ }
    return 'Miami';
  });

  useEffect(() => {
    fetchEvents();
    fetchSavedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, city]);

  // Load persisted savedEvents from /server/profile
  const fetchSavedEvents = async () => {
    if (!userId || userId === 'default_user') return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.savedEvents)) {
          setSavedEvents(new Set(data.savedEvents.map(String)));
        }
      }
    } catch { /* silent — fall back to empty set */ }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const url = new URL(`https://${projectId}.supabase.co/functions/v1/server/eventbrite/events`);
      url.searchParams.append('sort_by', 'date');
      url.searchParams.append('city', city);
      if (userId && userId !== 'default_user') {
        url.searchParams.append('userId', userId);
      }

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (res.ok) {
        const data = await res.json();
        const eventList = Array.isArray(data) ? data : (data.events || []);

        const formatted = eventList.map((e: any) => {
          const matchedFrom: ('spotify' | 'apple_music')[] = Array.isArray(e.matchedFrom) ? e.matchedFrom : [];
          return {
            id: e.id || Math.random().toString(),
            name: e.name?.text || e.name || 'Event',
            venue: e.venue?.name || 'Secret Venue',
            date: new Date(e.start?.local || Date.now()),
            dateStr: new Date(e.start?.local || Date.now()).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            }),
            time: new Date(e.start?.local || Date.now()).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true
            }),
            image: e.logo?.url || null,
            category: 'tables',
            source: e.source || 'eventbrite',
            ticketUrl: e.ticketUrl || null,
            matchedArtist: e.matchedArtist || null,
            matchedFrom,
            fromSpotify: matchedFrom.includes('spotify'),
            fromAppleMusic: matchedFrom.includes('apple_music'),
            isPersonalized: matchedFrom.length > 0,
          };
        }).slice(0, 30);

        // Sort: personalized first, then by date asc
        formatted.sort((a: any, b: any) => {
          if (a.isPersonalized !== b.isPersonalized) return a.isPersonalized ? -1 : 1;
          return a.date.getTime() - b.date.getTime();
        });

        setEvents(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (eventId: string) => {
    setSavedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
        toast('Removed from Plan');
      } else {
        next.add(eventId);
        toast.success('Saved to Plan');
      }
      // Persist to /server/profile (best-effort; UI state already updated optimistically)
      if (userId && userId !== 'default_user') {
        fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ savedEvents: [...next] }),
        }).catch(() => { /* silent — local state remains correct */ });
      }
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply category filter
    if (activeCategory !== 'all') {
      const categoryKeywords: Record<string, string[]> = {
        tables: ['table', 'vip', 'booth', 'bottle', 'lounge', 'nightclub', 'club'],
        tickets: ['ticket', 'concert', 'show', 'festival', 'music', 'live', 'dj', 'dance', 'rave'],
        guestlist: ['guestlist', 'guest list', 'free', 'rsvp', 'entry', 'door'],
      };
      const keywords = categoryKeywords[activeCategory] || [];
      const categoryFiltered = filtered.filter(e =>
        keywords.some(kw =>
          e.name.toLowerCase().includes(kw) ||
          e.venue.toLowerCase().includes(kw) ||
          e.category === activeCategory
        )
      );
      // Only apply filter if it returns results, otherwise show all
      if (categoryFiltered.length > 0) filtered = categoryFiltered;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [events, activeCategory, searchQuery]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredEvents.forEach(event => {
      const key = event.dateStr;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [filteredEvents]);

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      {/* Header */}
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">Event Calendar</h2>
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 mt-2 font-bold">{city}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle: List / Month */}
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 border transition-all active:scale-95 ${viewMode === 'list' ? 'border-white/30 bg-white/5' : 'border-white/5 text-white/30 hover:border-white/15'}`}
              aria-label="List view"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`p-2 border transition-all active:scale-95 ${viewMode === 'month' ? 'border-white/30 bg-white/5' : 'border-white/5 text-white/30 hover:border-white/15'}`}
              aria-label="Month view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 border whitespace-nowrap transition-all text-[9px] font-bold uppercase tracking-widest ${
                activeCategory === cat.key
                  ? 'bg-white text-black border-white'
                  : 'border-white/10 text-white/40 hover:border-white/30'
              }`}
            >
              <cat.icon size={12} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative group mt-4">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-[#E5E4E2] transition-colors" size={14} />
          <Input
            placeholder="SEARCH EVENTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 bg-transparent border-0 border-b border-white/10 rounded-xl px-0 py-2 text-white placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-[#E5E4E2] transition-all tracking-[0.2em] text-[10px] font-bold uppercase h-10 w-full"
          />
        </div>
      </div>

      {/* Events */}
      <div className="px-6 py-8 space-y-8">
        {loading && (
          <div className="text-center py-12">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5E4E2] animate-pulse font-bold">Loading Events...</span>
          </div>
        )}

        {!loading && Object.keys(groupedEvents).length === 0 && (
          <div className="text-center py-16 border border-dashed border-white/10">
            <Calendar size={32} className="mx-auto text-white/10 mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">No events found</p>
          </div>
        )}

        {/* ── MONTH VIEW ──────────────────────────────────────────────────── */}
        {!loading && viewMode === 'month' && Object.keys(groupedEvents).length > 0 && (
          <MonthGrid
            cursor={monthCursor}
            onPrev={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNext={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            events={filteredEvents}
            selectedDay={selectedDay}
            onSelectDay={(dayKey) => setSelectedDay(prev => (prev === dayKey ? null : dayKey))}
          />
        )}

        {/* ── LIST VIEW (per-day grouping) ────────────────────────────────── */}
        {viewMode === 'list' && Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
          <div key={dateKey} className="space-y-4">
            {/* Date Header */}
            <div className="sticky top-[220px] z-10 bg-[#060606]/90 backdrop-blur-md py-2 -mx-6 px-6 border-y border-[#E5E4E2]/5 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">{dateKey}</span>
              <Badge variant="outline" className="border-[#E5E4E2]/10 text-[#E5E4E2]/40 text-[7px] uppercase tracking-[0.2em] px-2 py-0 h-4 rounded-sm">
                {dateEvents.length} Events
              </Badge>
            </div>

            {/* Event Cards */}
            {dateEvents.map((event: any, index: number) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-950/60 border border-white/5 hover:border-[#E5E4E2]/20 transition-all group cursor-pointer"
                onClick={() => {
                  if (event.ticketUrl) {
                    window.open(event.ticketUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <div className="flex gap-5 p-5">
                  {/* Date Column */}
                  <div className="flex flex-col items-center justify-center w-14 flex-shrink-0 border-r border-white/5 pr-4">
                    <span className="text-2xl font-serif italic">{event.date.getDate()}</span>
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">
                      {event.date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold uppercase tracking-wider truncate pr-2">{event.name}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(event.id);
                        }}
                        className="flex-shrink-0 p-1 hover:bg-white/5 transition-colors"
                      >
                        {savedEvents.has(event.id) ? (
                          <BookmarkCheck size={16} className="text-[#E5E4E2]" />
                        ) : (
                          <Bookmark size={16} className="text-white/20" />
                        )}
                      </button>
                    </div>

                    {event.isPersonalized && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {event.fromSpotify && (
                          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border whitespace-nowrap flex items-center gap-1 bg-[#1DB954]/15 text-[#1DB954] border-[#1DB954]/35">
                            <Music size={7} />
                            Spotify
                          </span>
                        )}
                        {event.fromAppleMusic && (
                          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border whitespace-nowrap flex items-center gap-1 bg-[#FA243C]/15 text-[#FA243C] border-[#FA243C]/35">
                            <Music size={7} />
                            Apple Music
                          </span>
                        )}
                        {event.matchedArtist && (
                          <span className="text-[7px] uppercase tracking-widest text-white/40 truncate max-w-[160px]">
                            · {event.matchedArtist}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-1 text-[9px] uppercase tracking-widest text-white/40">
                      <div className="flex items-center gap-1">
                        <Clock size={9} />
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={9} />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ))}

        {/* Month view: show events for the selected day inline below the grid */}
        {viewMode === 'month' && selectedDay && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/60 border-l-2 border-[#E5E4E2]/30 pl-4">
              {selectedDay}
            </h3>
            {filteredEvents
              .filter(e => e.date.toDateString() === selectedDay)
              .map((event: any, index: number) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="bg-zinc-950/60 border border-white/5 hover:border-[#E5E4E2]/20 transition-all group cursor-pointer"
                  onClick={() => { if (event.ticketUrl) window.open(event.ticketUrl, '_blank', 'noopener,noreferrer'); }}
                >
                  <div className="flex gap-5 p-5">
                    <div className="flex flex-col items-center justify-center w-14 flex-shrink-0 border-r border-white/5 pr-4">
                      <span className="text-2xl font-serif italic">{event.date.getDate()}</span>
                      <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">
                        {event.date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold uppercase tracking-wider truncate pr-2">{event.name}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSave(event.id); }}
                          className="flex-shrink-0 p-1 hover:bg-white/5 transition-colors"
                        >
                          {savedEvents.has(event.id) ? (
                            <BookmarkCheck size={16} className="text-[#E5E4E2]" />
                          ) : (
                            <Bookmark size={16} className="text-white/20" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[9px] uppercase tracking-widest text-white/40">
                        <div className="flex items-center gap-1"><Clock size={9} /><span>{event.time}</span></div>
                        <div className="flex items-center gap-1"><MapPin size={9} /><span className="truncate">{event.venue}</span></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            {filteredEvents.filter(e => e.date.toDateString() === selectedDay).length === 0 && (
              <p className="text-[9px] uppercase tracking-widest text-white/20 text-center py-8">
                No events on this day
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MonthGrid: 7-col date cells with event-count dots ────────────────────────
function MonthGrid({
  cursor,
  onPrev,
  onNext,
  events,
  selectedDay,
  onSelectDay,
}: {
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  events: any[];
  selectedDay: string | null;
  onSelectDay: (dayKey: string) => void;
}) {
  // Build the 6-week (42-cell) grid for cursor's month
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = firstDay.getDay(); // 0=Sun..6=Sat
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startWeekday);

  const cells: { date: Date; key: string; inMonth: boolean; count: number }[] = [];
  // Build a count map first
  const countByKey: Record<string, number> = {};
  for (const ev of events) {
    const k = ev.date.toDateString();
    countByKey[k] = (countByKey[k] || 0) + 1;
  }

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = d.toDateString();
    cells.push({
      date: d,
      key,
      inMonth: d.getMonth() === cursor.getMonth(),
      count: countByKey[key] || 0,
    });
  }

  const todayKey = new Date().toDateString();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          className="p-2 border border-white/10 hover:border-white/30 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white">
          {monthLabel}
        </span>
        <button
          onClick={onNext}
          className="p-2 border border-white/10 hover:border-white/30 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {dayLabels.map(d => (
          <div key={d} className="text-center text-[7px] font-bold uppercase tracking-widest text-white/30 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDay;
          const hasEvents = cell.count > 0;
          return (
            <button
              key={cell.key}
              onClick={() => hasEvents && onSelectDay(cell.key)}
              disabled={!hasEvents}
              className={`aspect-square flex flex-col items-center justify-center border transition-colors text-[10px] font-bold uppercase ${
                !cell.inMonth
                  ? 'border-white/5 text-white/15'
                  : isSelected
                  ? 'border-[#E5E4E2] bg-white/10 text-white'
                  : isToday
                  ? 'border-[#1DB954]/40 bg-[#1DB954]/5 text-white'
                  : hasEvents
                  ? 'border-white/15 hover:border-white/40 hover:bg-white/5 text-white/80 cursor-pointer'
                  : 'border-white/5 text-white/30 cursor-default'
              }`}
            >
              <span>{cell.date.getDate()}</span>
              {hasEvents && (
                <span className={`text-[7px] mt-0.5 tracking-widest ${isSelected ? 'text-white' : 'text-[#E5E4E2]/70'}`}>
                  {cell.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p className="text-[7px] uppercase tracking-widest text-white/20 text-center pt-2">
        Tap a date to see its events
      </p>
    </div>
  );
}