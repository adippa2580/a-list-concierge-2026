'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, MapPin, Music, Heart, Clock, Star, Filter, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const initialBookedEvents = [
  {
    id: 1,
    name: 'Martin Garrix Live',
    venue: 'LIV Miami',
    date: 'Tonight',
    time: '11:00 PM',
    status: 'Confirmed',
    guests: ['Sarah', 'Mike', '+3']
  },
  {
    id: 2,
    name: 'Sunset Boat Party',
    venue: 'Biscayne Bay',
    date: 'Tomorrow',
    time: '5:00 PM',
    status: 'Pending',
    guests: ['Anna', 'Tom']
  }
];

const initialRecommendedEvents = [
  {
    id: 3,
    name: 'Underground Techno',
    venue: 'Club Space',
    date: 'Fri, Oct 24',
    time: '11:00 PM',
    match: '98%',
    genre: 'Techno',
    price: '$40',
    isSaved: false
  },
  {
    id: 4,
    name: 'Hip Hop Fridays',
    venue: 'E11EVEN',
    date: 'Fri, Oct 24',
    time: '10:00 PM',
    match: '85%',
    genre: 'Hip Hop',
    price: '$60',
    isSaved: false
  }
];

const initialSavedVenues = [
  {
    id: 1,
    name: 'LIV Miami',
    location: 'Miami Beach',
    rating: 4.9,
    type: 'Nightclub'
  },
  {
    id: 2,
    name: 'Komodo',
    location: 'Brickell',
    rating: 4.7,
    type: 'Lounge / Dining'
  }
];

export function EventCalendar() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [bookedEvents, setBookedEvents] = useState(initialBookedEvents);
  const [recommendedEvents, setRecommendedEvents] = useState(initialRecommendedEvents);
  const [savedVenues, setSavedVenues] = useState(initialSavedVenues);
  const [loading, setLoading] = useState(false);
  const [activeLocation, setActiveLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  useEffect(() => {
    if (activeTab === 'discover') {
      fetchEventbriteEvents();
    }
  }, [activeTab, activeLocation, useCurrentLocation]);

  const handleLocationClick = () => {
    setIsLoadingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setActiveLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          setUseCurrentLocation(true);
          setIsLoadingLocation(false);
          toast.success("Location updated");
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLoadingLocation(false);
          toast.error("Could not get location. Using default.");
        }
      );
    } else {
      toast.error("Geolocation not supported");
      setIsLoadingLocation(false);
    }
  };

  const fetchEventbriteEvents = async () => {
    setLoading(true);
    try {
      let url = `https://${projectId}.supabase.co/functions/v1/server/eventbrite/events`;
      if (useCurrentLocation && activeLocation) {
        url += `?lat=${activeLocation.lat}&lon=${activeLocation.lon}`;
      } else {
        url += `?city=Miami`;
      }

      const response = await fetch(
        url,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch events');

      const data = await response.json();

      if (data.events && data.events.length > 0) {
        const formattedEvents = data.events.map((event: any) => ({
          id: event.id,
          name: event.name.text,
          venue: event.venue?.name || 'Miami Venue',
          date: new Date(event.start.local).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: new Date(event.start.local).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          match: `${Math.floor(Math.random() * 20) + 80}%`, // Mock match percentage
          genre: 'Live Event',
          price: event.is_free ? 'Free' : '$' + (Math.floor(Math.random() * 50) + 20),
          isSaved: false,
          url: event.url
        }));
        setRecommendedEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error fetching Eventbrite events:', error);
      // Fallback to mock data is already set
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSave = (eventId: number | string) => {
    setRecommendedEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        const newStatus = !event.isSaved;
        toast.success(newStatus ? "Event saved to your list" : "Event removed from saved list");
        return { ...event, isSaved: newStatus };
      }
      return event;
    }));
  };

  const handleBookEvent = (event: any) => {
    if (bookedEvents.some(e => e.id === event.id)) {
      toast.info("You've already booked this event!");
      return;
    }

    const newBooking = {
      ...event,
      status: 'Pending',
      guests: ['You']
    };

    setBookedEvents([...bookedEvents, newBooking]);
    toast.success(`Booking request sent for ${event.name}!`);
    setActiveTab('schedule');
  };

  const handleRemoveSavedVenue = (id: number) => {
    setSavedVenues(prev => prev.filter(v => v.id !== id));
    toast.success("Venue removed from saved list");
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-white/60">Agenda</h1>
            <div
              className="flex items-center gap-1 text-white hover:text-white/80 cursor-pointer mt-1"
              onClick={handleLocationClick}
            >
              <MapPin size={10} className={isLoadingLocation ? "animate-pulse" : ""} />
              <span className="text-[10px] uppercase tracking-widest font-bold">
                {isLoadingLocation ? "Locating..." : (useCurrentLocation ? "Current Location" : "Miami, FL")}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-transparent p-0 h-auto">
            <Filter size={20} />
          </Button>
        </div>

        <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-8">
            <TabsTrigger
              value="schedule"
              className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 data-[state=active]:text-white transition-all"
            >
              My Plan
            </TabsTrigger>
            <TabsTrigger
              value="discover"
              className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 data-[state=active]:text-white transition-all"
            >
              Discover
            </TabsTrigger>
            <TabsTrigger
              value="saved"
              className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 data-[state=active]:text-white transition-all"
            >
              Saved
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-6 py-8">
        {activeTab === 'schedule' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 mb-4">Upcoming</h2>
              <div className="space-y-4">
                {bookedEvents.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-white/10">
                    <p className="text-xs uppercase tracking-widest text-white/60">No events booked</p>
                    <Button
                      variant="link"
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-white mt-2"
                      onClick={() => setActiveTab('discover')}
                    >
                      Discover events
                    </Button>
                  </div>
                ) : (
                  bookedEvents.map((event) => (
                    <div key={event.id} className="border border-white/10 bg-zinc-900/30 p-5 group hover:border-white/40 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 mb-2 inline-block !text-black ${event.status === 'Confirmed' ? 'bg-white text-zinc-950' : 'border border-white/40 text-white/80'
                            }`}>
                            {event.status}
                          </span>
                          <h3 className="text-xl font-light uppercase tracking-wide leading-none">{event.name}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold uppercase tracking-wide">{event.time}</p>
                          <p className="text-[9px] uppercase tracking-widest text-white/60">{event.date}</p>
                        </div>
                      </div>

                      {/* Guests List - White Boxes */}
                      {event.guests && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {event.guests.map((guest, idx) => (
                            <span
                              key={idx}
                              className="bg-white text-zinc-950 text-[8px] font-bold px-2 py-1 uppercase tracking-widest !text-black"
                            >
                              {guest}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white/80">
                            <MapPin size={12} />
                            <span className="text-[10px] uppercase tracking-widest">{event.venue}</span>
                          </div>
                          <Button size="sm" variant="outline" className="h-6 border-white/30 text-white/60 hover:text-white hover:border-white rounded-none text-[9px] uppercase tracking-widest">
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <div className="border border-white/10 bg-white/5 p-4 mb-6">
              <div className="flex items-start gap-3">
                <Music className="text-white mt-0.5" size={16} />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">Curated For You</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/60 mt-1">Based on your listening history.</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="animate-spin text-white/40" size={32} />
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Searching trending events...</p>
              </div>
            ) : (
              recommendedEvents.map((event) => (
                <div key={event.id} className="border border-white/10 bg-zinc-900/30 p-4 hover:border-white/40 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wide text-white line-clamp-1">{event.name}</h4>
                      <p className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">{event.venue}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-white/20 px-1 py-0.5 text-white/80">{event.match} Match</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-white/80">
                      <span>{event.date}</span>
                      <span>{event.time}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleSave(event.id)}
                        className={`transition-colors ${event.isSaved ? 'text-white' : 'text-white/40 hover:text-white'}`}
                      >
                        <Heart size={16} fill={event.isSaved ? "currentColor" : "none"} />
                      </button>
                      <Button
                        size="sm"
                        className="h-7 text-[9px] font-bold uppercase tracking-widest bg-white text-zinc-950 hover:bg-white/90 rounded-none px-3 !text-black"
                        onClick={() => event.url ? window.open(event.url, '_blank') : handleBookEvent(event)}
                      >
                        {event.url ? 'Tickets' : `Book ${event.price}`}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-2 duration-500">
            {savedVenues.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10">
                <p className="text-xs uppercase tracking-widest text-white/60">No saved venues</p>
              </div>
            ) : (
              savedVenues.map((venue) => (
                <div key={venue.id} className="border border-white/10 bg-zinc-900/30 p-4 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-wide">{venue.name}</h4>
                      <p className="text-[9px] uppercase tracking-widest text-white/60 mt-1">{venue.location}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveSavedVenue(venue.id)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      <Heart size={16} fill="currentColor" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-1 text-white">
                      <Star size={10} fill="currentColor" />
                      <span className="text-[9px] font-bold tracking-wider">{venue.rating}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-white/60">
                      {venue.type}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}