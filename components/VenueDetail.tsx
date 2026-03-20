'use client';

import { ArrowLeft, Star, MapPin, Users, Clock, Shield, ChevronRight, Share2, Heart, Camera, Map, Navigation } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useEffect } from 'react';

const FAV_KEY = 'alist_favourite_venues';

function getFavourites(): any[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFavourites(favs: any[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  window.dispatchEvent(new Event('alist-favourites-updated'));
}

const tables = [
  { name: 'VIP Main Floor', min: 2500, capacity: '6-8', available: true },
  { name: 'Skybox Premium', min: 5000, capacity: '8-12', available: true },
  { name: 'DJ Booth Adjacent', min: 8000, capacity: '10-15', available: false },
  { name: 'Rooftop Terrace', min: 3500, capacity: '6-10', available: true }
];

interface VenueDetailProps {
  venue: any;
  onBack: () => void;
  onBookTable: (venue: any) => void;
}

export function VenueDetail({ venue, onBack, onBookTable }: VenueDetailProps) {
  const [mediaView, setMediaView] = useState<'gallery' | 'map'>('gallery');
  const [isSaved, setIsSaved] = useState(() =>
    getFavourites().some((f: any) => f.id === venue?.id || f.name === venue?.name)
  );

  useEffect(() => {
    setIsSaved(getFavourites().some((f: any) => f.id === venue?.id || f.name === venue?.name));
  }, [venue]);

  if (!venue) return null;

  return (
    <div className="min-h-screen bg-[#000504] text-white pb-32 marble-bg">
      {/* Hero Section */}
      <div className="relative h-72 overflow-hidden">
        {mediaView === 'gallery' ? (
          <>
            <ImageWithFallback
              src={venue.image}
              alt={venue.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#000504] via-[#000504]/40 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
            <div className="text-center">
              <Navigation size={32} className="mx-auto text-white/20 mb-3" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                {venue.location || 'Venue Location'}
              </p>
              <p className="text-[8px] uppercase tracking-widest text-white/20 mt-2">
                Map View
              </p>
            </div>
          </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 px-6 py-6 flex justify-between items-center">
          <button onClick={onBack} className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex gap-3">
            <button 
              onClick={() => setMediaView(mediaView === 'gallery' ? 'map' : 'gallery')}
              className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all"
            >
              {mediaView === 'gallery' ? <Map size={16} /> : <Camera size={16} />}
            </button>
            <button 
              onClick={() => {
                const favs = getFavourites();
                const venueKey = (v: any) => v.id || v.name;
                const exists = favs.some((f: any) => venueKey(f) === venueKey(venue));
                const next = exists
                  ? favs.filter((f: any) => venueKey(f) !== venueKey(venue))
                  : [
                      ...favs,
                      {
                        id: venue.id || venue.name,
                        name: venue.name,
                        location: venue.location,
                        image: venue.image,
                        category: venue.category,
                        rating: venue.rating,
                        capacity: venue.capacity,
                      },
                    ];
                saveFavourites(next);
                setIsSaved(!exists);
              }}
              className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all"
            >
              <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-red-500' : ''} />
            </button>
            <button className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-[#E5E4E2] text-black text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-none border-0">
              Verified Partner
            </Badge>
            <Badge className="bg-white/10 border border-white/20 text-white text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-none">
              {venue.category}
            </Badge>
          </div>
          <h1 className="text-3xl font-serif italic uppercase tracking-wider mb-2">{venue.name}</h1>
          <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-white/60">
            <div className="flex items-center gap-1.5">
              <MapPin size={10} />
              <span>{venue.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star size={10} fill="currentColor" className="text-[#E5E4E2]" />
              <span>{venue.rating}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={10} />
              <span>{venue.capacity} cap</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-8 mb-8">
            {['Tables', 'Inventory', 'Rules', 'Media'].map(tab => (
              <TabsTrigger 
                key={tab}
                value={tab.toLowerCase()} 
                className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-3 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 data-[state=active]:text-white transition-all"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="tables" className="space-y-4 mt-0">
            {tables.map((table, index) => (
              <div 
                key={index}
                className={`p-6 border transition-all ${
                  table.available 
                    ? 'border-white/10 hover:border-[#E5E4E2]/30 bg-zinc-950/40 cursor-pointer' 
                    : 'border-white/5 opacity-30'
                }`}
                onClick={() => table.available && onBookTable({ ...venue, selectedTable: table })}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest">{table.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-[9px] uppercase tracking-widest text-white/40">
                      <span>{table.capacity} guests</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-light">${table.min.toLocaleString()}</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/30">min spend</p>
                  </div>
                </div>
                
                {table.available ? (
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-green-500">
                      <Shield size={10} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Available Tonight</span>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                ) : (
                  <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 pt-3 border-t border-white/5">Sold Out</p>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <div className="p-12 border border-dashed border-white/10 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 leading-loose italic">
                "Live inventory data will be available once connected to the venue's management system."
              </p>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-0 space-y-4">
            {[
              'Dress code: Smart casual to formal. No athletic wear.',
              'Bottle service minimum applies to all VIP tables.',
              'Guest list closes 30 minutes before event start.',
              'A-List members receive priority entry at all times.',
              'Photography policy varies by event. Check with host.'
            ].map((rule, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border-b border-white/5">
                <span className="text-[9px] text-white/20 font-bold">{String(index + 1).padStart(2, '0')}</span>
                <p className="text-[10px] text-white/60 uppercase tracking-widest leading-loose">{rule}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="media" className="mt-0">
            <div className="grid grid-cols-2 gap-2">
              {[
                'https://images.unsplash.com/photo-1604161926875-bb58f9a0d81b?w=400',
                'https://images.unsplash.com/photo-1545128485-c400e7702796?w=400',
                'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400',
                'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'
              ].map((src, i) => (
                <div key={i} className="aspect-square border border-white/5 overflow-hidden group">
                  <ImageWithFallback src={src} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}