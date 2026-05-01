'use client';

import { Calendar, Clock, MapPin, Search, Star, Bookmark, BookmarkCheck, Filter, Music, Ticket, Users, ChevronRight } from 'lucide-react';
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

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const url = new URL(`https://${projectId}.supabase.co/functions/v1/server/eventbrite/events`);
      url.searchParams.append('sort_by', 'date');
      url.searchParams.append('city', 'Miami');
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">Event Calendar</h2>
          </div>
          <div className="w-12 h-12 platinum-border flex items-center justify-center bg-[#011410]">
            <Calendar size={20} className="text-[#E5E4E2]" strokeWidth={1.5} />
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

        {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
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
      </div>
    </div>
  );
}