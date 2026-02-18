'use client';

import { MapPin, Star, ChevronRight, Search, Music, Wine, Mic2, Navigation, Play, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';

export function Home({ onVenueClick, onBookTable, onOpenCalendar, onViewAllArtists }: any) {
  const [currentLocation, setCurrentLocation] = useState('Miami, FL');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
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

      if (coords) {
        url.searchParams.append('lat', coords.lat.toString());
        url.searchParams.append('lon', coords.lng.toString());
      } else {
        const city = currentLocation.split(',')[0].trim();
        url.searchParams.append('city', city);
      }

      try {
        const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
        if (res.ok) {
          const data = await res.json();
          // Backend returns array of events directly
          const eventList = Array.isArray(data) ? data : (data.events || []);

          const formatted = eventList.map((e: any) => ({
            id: e.id,
            name: e.name.text,
            venue: e.venue?.name || 'Secret Venue',
            date: new Date(e.start.local).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            rawDate: new Date(e.start.local),
            image: e.logo?.url || null
          })).sort((a: any, b: any) => a.rawDate - b.rawDate).slice(0, 20);

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

  const handleLocationCheck = () => {
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
          setCurrentLocation(`${data.city}${stateCode}`);
          toast.success(`Location updated to ${data.city}`);
        } else {
          setCurrentLocation("Current Location");
          toast.success("Location updated");
        }
      } catch (e) {
        console.error(e);
        setCurrentLocation("Current Location");
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
  const groupedEvents = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();

    // Start of next week (Next Monday)
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7);
    if (nextMonday <= today) nextMonday.setDate(today.getDate() + 7);

    // End of current month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const groups = {
      today: [] as any[],
      thisWeek: [] as any[],
      weekend: [] as any[],
      restOfMonth: [] as any[],
      comingUp: [] as any[]
    };

    events.forEach(event => {
      const date = event.rawDate; // Already date object
      const dateStr = date.toDateString();

      // Today
      if (dateStr === todayStr) {
        groups.today.push(event);
        return;
      }

      const day = date.getDay();
      const isWeekendDay = day === 5 || day === 6 || day === 0; // Fri, Sat, Sun

      // This Week vs Weekend
      // If date is before next Monday
      if (date < nextMonday) {
        if (isWeekendDay) {
          groups.weekend.push(event);
        } else {
          groups.thisWeek.push(event);
        }
        return;
      }

      // Rest of Month
      if (date <= endOfMonth) {
        groups.restOfMonth.push(event);
        return;
      }

      // Coming Up (beyond this month)
      groups.comingUp.push(event);
    });

    return groups;
  }, [events]);



  return (
    <div className="min-h-screen pb-32 bg-black text-white marble-bg">
      <div className="pt-2 px-6 pb-6 space-y-6">
        <div className="flex items-end justify-between">
          <div className="cursor-pointer group" onClick={handleLocationCheck}>
            <p className="text-[10px] text-white/60 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
              Location {loadingLocation && <span className="animate-pulse">...</span>}
            </p>
            <div className="flex items-center gap-2 text-white group-hover:text-white/80 transition-colors">
              <MapPin size={16} className={loadingLocation ? "animate-spin" : ""} />
              <span className="text-2xl font-light tracking-widest uppercase gold-gradient">
                {currentLocation.split(',')[0]}
              </span>
            </div>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40" size={14} />
          <Input
            placeholder="SEARCH VENUES, ARTISTS..."
            className="pl-7 bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-2 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:border-gold transition-all tracking-[0.2em] text-[10px] font-bold uppercase h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-6 flex justify-between items-center">
          <span>Tonight's Elite Picks</span>
          {loadingEvents && <span className="animate-pulse text-xs text-brand-gold">Loading...</span>}
        </h2>

        <div className="space-y-8 mb-8">
          {events.length === 0 && !loadingEvents && (
            <div className="text-center py-8 border border-dashed border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-widest">{loadingEvents ? "Curating events..." : `No events found in ${currentLocation.split(',')[0]}`}</p>
            </div>
          )}

          {groupedEvents.today.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">Today</h3>
              {groupedEvents.today.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-zinc-900/40 border border-white/10 p-4 flex gap-4 overflow-hidden group hover:border-white/30 transition-all cursor-pointer"
                  onClick={() => onBookTable && onBookTable(event)}
                >
                  {event.image && (
                    <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${event.image})` }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-light uppercase tracking-wide truncate pr-2 text-white group-hover:text-brand-gold transition-colors">{event.name}</h3>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-white/60">
                      <MapPin size={10} />
                      <p className="text-[9px] uppercase tracking-widest truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groupedEvents.thisWeek.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">This Week</h3>
              {groupedEvents.thisWeek.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-zinc-900/40 border border-white/10 p-4 flex gap-4 overflow-hidden group hover:border-white/30 transition-all cursor-pointer"
                  onClick={() => onBookTable && onBookTable(event)}
                >
                  {event.image && (
                    <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${event.image})` }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-light uppercase tracking-wide truncate pr-2 text-white group-hover:text-brand-gold transition-colors">{event.name}</h3>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-white/60">
                      <MapPin size={10} />
                      <p className="text-[9px] uppercase tracking-widest truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groupedEvents.weekend.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">This Weekend</h3>
              {groupedEvents.weekend.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-zinc-900/40 border border-white/10 p-4 flex gap-4 overflow-hidden group hover:border-white/30 transition-all cursor-pointer"
                  onClick={() => onBookTable && onBookTable(event)}
                >
                  {event.image && (
                    <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${event.image})` }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-light uppercase tracking-wide truncate pr-2 text-white group-hover:text-brand-gold transition-colors">{event.name}</h3>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-white/60">
                      <MapPin size={10} />
                      <p className="text-[9px] uppercase tracking-widest truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groupedEvents.restOfMonth.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">This Month</h3>
              {groupedEvents.restOfMonth.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-zinc-900/40 border border-white/10 p-4 flex gap-4 overflow-hidden group hover:border-white/30 transition-all cursor-pointer"
                  onClick={() => onBookTable && onBookTable(event)}
                >
                  {event.image && (
                    <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${event.image})` }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-light uppercase tracking-wide truncate pr-2 text-white group-hover:text-brand-gold transition-colors">{event.name}</h3>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-white/60">
                      <MapPin size={10} />
                      <p className="text-[9px] uppercase tracking-widest truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groupedEvents.comingUp.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">Coming Up</h3>
              {groupedEvents.comingUp.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-zinc-900/40 border border-white/10 p-4 flex gap-4 overflow-hidden group hover:border-white/30 transition-all cursor-pointer"
                  onClick={() => onBookTable && onBookTable(event)}
                >
                  {event.image && (
                    <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${event.image})` }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-light uppercase tracking-wide truncate pr-2 text-white group-hover:text-brand-gold transition-colors">{event.name}</h3>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-white/60">
                      <MapPin size={10} />
                      <p className="text-[9px] uppercase tracking-widest truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-white/60">Discover curated nightlife experiences in {currentLocation}.</p>
      </div>
    </div>
  );
}