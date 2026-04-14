'use client';

import { ArrowLeft, Star, MapPin, Users, Clock, Shield, ChevronRight, Share2, Heart, Camera, Map, Navigation, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { VenueTableMap } from './VenueTableMap';

const FAV_KEY = 'alist_favourite_venues';

function getFavourites(): any[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavourites(favs: any[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  window.dispatchEvent(new Event('alist-favourites-updated'));
}

// Fallback tables if venue not in DB yet
const FALLBACK_TABLES = [
  { id: 'f1', name: 'VIP 1', category: 'vip', section: 'Main Floor', capacity_min: 4, capacity_max: 8, min_spend: 5000, pos_x: 20, pos_y: 30, width: 10, height: 7, shape: 'rect', availability: 'available', perks: ['Dedicated server', 'Priority entry'] },
  { id: 'f2', name: 'VIP 2', category: 'vip', section: 'Main Floor', capacity_min: 4, capacity_max: 8, min_spend: 5000, pos_x: 35, pos_y: 30, width: 10, height: 7, shape: 'rect', availability: 'available', perks: ['Dedicated server'] },
  { id: 'f3', name: 'VIP 3', category: 'vip', section: 'Main Floor', capacity_min: 4, capacity_max: 8, min_spend: 7500, pos_x: 50, pos_y: 30, width: 10, height: 7, shape: 'rect', availability: 'booked', perks: ['Stage front'] },
  { id: 'f4', name: 'Skybox 1', category: 'skybox', section: 'Mezzanine', capacity_min: 8, capacity_max: 16, min_spend: 15000, pos_x: 25, pos_y: 15, width: 14, height: 9, shape: 'rect', availability: 'available', perks: ['Private entrance', '360 view'] },
  { id: 'f5', name: 'Booth A', category: 'booth', section: 'Bar Area', capacity_min: 2, capacity_max: 4, min_spend: 1500, pos_x: 15, pos_y: 65, width: 8, height: 6, shape: 'rect', availability: 'available', perks: [] },
  { id: 'f6', name: 'Booth B', category: 'booth', section: 'Bar Area', capacity_min: 2, capacity_max: 4, min_spend: 1500, pos_x: 28, pos_y: 65, width: 8, height: 6, shape: 'rect', availability: 'available', perks: [] },
  { id: 'f7', name: 'Stage Front 1', category: 'stage_front', section: 'Stage', capacity_min: 6, capacity_max: 12, min_spend: 10000, pos_x: 35, pos_y: 50, width: 12, height: 8, shape: 'rect', availability: 'available', perks: ['Closest to stage'] },
  { id: 'f8', name: 'Patio 1', category: 'patio', section: 'Outdoor', capacity_min: 4, capacity_max: 10, min_spend: 3000, pos_x: 20, pos_y: 82, width: 12, height: 8, shape: 'rect', availability: 'available', perks: ['Outdoor terrace'] },
];

interface VenueDetailProps {
  venue: any;
  onBack: () => void;
  onBookTable: (venue: any) => void;
  selectedTableForBooking?: any;
}

export function VenueDetail({ venue, onBack, onBookTable }: VenueDetailProps) {
  const [isSaved, setIsSaved] = useState(() =>
    getFavourites().some((f: any) => f.id === venue?.id || f.name === venue?.name)
  );
  const [liveVenueData, setLiveVenueData] = useState<any>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTable, setSelectedTable] = useState<any>(null);

  useEffect(() => {
    setIsSaved(getFavourites().some((f: any) => f.id === venue?.id || f.name === venue?.name));
  }, [venue]);

  // Try to load live venue data by matching name to DB slug
  useEffect(() => {
    const loadVenueData = async () => {
      setLoadingTables(true);
      try {
        // First try by ID if it looks like a UUID
        const isUuid = /^[0-9a-f-]{36}$/i.test(venue?.id);
        if (isUuid) {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/server/venues/${venue.id}?date=${selectedDate}`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
          );
          if (res.ok) {
            setLiveVenueData(await res.json());
            return;
          }
        }
        // Try matching by city + name via venues list
        const listRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/server/venues?city=${encodeURIComponent(venue?.location?.split(',')[0] || '')}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        );
        if (listRes.ok) {
          const venues = await listRes.json();
          const match = venues.find((v: any) =>
            v.name.toLowerCase() === (venue?.name || '').toLowerCase()
          );
          if (match) {
            const detailRes = await fetch(
              `https://${projectId}.supabase.co/functions/v1/server/venues/${match.id}?date=${selectedDate}`,
              { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
            );
            if (detailRes.ok) {
              setLiveVenueData(await detailRes.json());
              return;
            }
          }
        }
      } catch (e) {
        console.log('No live venue data, using fallback');
      } finally {
        setLoadingTables(false);
      }
    };
    if (venue) loadVenueData();
  }, [venue, selectedDate]);

  const tables = liveVenueData?.tables ?? FALLBACK_TABLES;
  const summary = liveVenueData?.summary ?? [];

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
          <button onClick={onBack} className="min-w-[44px] min-h-[44px] w-11 h-11 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50">
            <ArrowLeft size={18} />
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setMediaView(mediaView === 'gallery' ? 'map' : 'gallery')}
              className="min-w-[44px] min-h-[44px] w-11 h-11 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
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
              className="min-w-[44px] min-h-[44px] w-11 h-11 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
            >
              <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-red-500' : ''} />
            </button>
            <button
              onClick={async () => {
                const shareData = { title: venue.name, text: `${venue.name} — ${venue.location}`, url: window.location.href };
                if (navigator.share) {
                  try { await navigator.share(shareData); } catch (_) {}
                } else {
                  await navigator.clipboard.writeText(`${venue.name} — ${venue.location} | A-List`);
                  // brief visual feedback via aria-label change handled by browser
                }
              }}
              className="min-w-[44px] min-h-[44px] w-11 h-11 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#E5E4E2]/50"
              aria-label="Share venue"
            >
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
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-6 mb-8 overflow-x-auto scrollbar-hide">
            {['Tables', 'Floor Map', 'Live View', 'Rules'].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab.toLowerCase().replace(' ', '-')}
                className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-3 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 data-[state=active]:text-white transition-all whitespace-nowrap flex-shrink-0"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── TABLES TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="tables" className="space-y-6 mt-0">

            {/* Date selector */}
            <div className="flex items-center gap-3">
              <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold flex-shrink-0">Date</p>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => { setSelectedDate(e.target.value); setSelectedTable(null); }}
                className="bg-transparent border-b border-white/10 focus:border-white/30 text-[10px] uppercase tracking-widest text-white/70 outline-none pb-1 flex-1 transition-colors"
              />
              {loadingTables && <Loader2 size={12} className="text-white/30 animate-spin flex-shrink-0" />}
            </div>

            {/* Category summary */}
            {summary.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {summary.map((s: any) => (
                  <div key={s.category} className="bg-zinc-950/60 border border-white/5 p-3 rounded-lg">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1 capitalize">{s.category.replace('_', ' ')}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-light text-white">{s.available}</p>
                      <p className="text-[8px] text-white/30">/ {s.total} avail</p>
                    </div>
                    {s.booked > 0 && <p className="text-[7px] text-red-400/60 uppercase tracking-wider mt-1">{s.booked} booked</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Table list */}
            <div className="space-y-3">
              {tables.filter((t: any) => t.availability !== 'blocked').map((table: any) => {
                const isAvailable = table.availability === 'available';
                const isSelected = selectedTable?.id === table.id;
                return (
                  <div
                    key={table.id}
                    onClick={() => isAvailable && setSelectedTable(isSelected ? null : table)}
                    className={`p-5 border transition-all rounded-lg ${
                      isSelected ? 'border-[#E5E4E2]/60 bg-white/5' :
                      isAvailable ? 'border-white/10 hover:border-[#E5E4E2]/30 bg-zinc-950/40 cursor-pointer' :
                      'border-white/5 opacity-40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-widest">{table.name}</h4>
                          <span className="text-[7px] uppercase tracking-widest text-white/30 border border-white/10 px-1.5 py-0.5 rounded">
                            {(table.category || '').replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-white/40">
                          <span>{table.section}</span>
                          <span>{table.capacity_min}–{table.capacity_max} guests</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-light">${(table.min_spend || 0).toLocaleString()}</p>
                        <p className="text-[8px] uppercase tracking-widest text-white/30">min spend</p>
                      </div>
                    </div>

                    {/* Perks */}
                    {table.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {table.perks.slice(0, 3).map((perk: string) => (
                          <span key={perk} className="text-[7px] uppercase tracking-wider text-white/40 border border-white/10 px-1.5 py-0.5 rounded-full">
                            {perk}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Status + action */}
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/5">
                      {isAvailable ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <Shield size={10} />
                          <span className="text-[8px] font-bold uppercase tracking-widest">Available</span>
                        </div>
                      ) : (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-red-400/60">Booked</span>
                      )}
                      {isAvailable && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onBookTable({ ...venue, selectedTable: table, selectedDate });
                          }}
                          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2] hover:text-white active:scale-95 transition-all focus:outline-none"
                        >
                          Book <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            {selectedTable && (
              <div className="sticky bottom-4 left-0 right-0">
                <button
                  onClick={() => onBookTable({ ...venue, selectedTable, selectedDate })}
                  className="w-full h-14 bg-[#E5E4E2] text-black text-[10px] font-bold uppercase tracking-[0.3em] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Book {selectedTable.name} · ${(selectedTable.min_spend || 0).toLocaleString()} min
                </button>
              </div>
            )}

            {tables.filter((t: any) => t.availability === 'booked').length > 0 && (
              <p className="text-[8px] text-white/20 uppercase tracking-widest text-center">
                {tables.filter((t: any) => t.availability === 'booked').length} table{tables.filter((t: any) => t.availability === 'booked').length > 1 ? 's' : ''} booked for this date
              </p>
            )}
          </TabsContent>

          {/* ── FLOOR MAP TAB ──────────────────────────────────────────────── */}
          <TabsContent value="floor-map" className="mt-0">
            <div className="space-y-4">
              {/* Date selector */}
              <div className="flex items-center gap-3">
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold flex-shrink-0">Date</p>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => { setSelectedDate(e.target.value); setSelectedTable(null); }}
                  className="bg-transparent border-b border-white/10 focus:border-white/30 text-[10px] uppercase tracking-widest text-white/70 outline-none pb-1 flex-1 transition-colors"
                />
                {loadingTables && <Loader2 size={12} className="text-white/30 animate-spin flex-shrink-0" />}
              </div>

              <VenueTableMap
                tables={tables}
                selectedTableId={selectedTable?.id}
                onSelectTable={t => setSelectedTable(prev => prev?.id === t.id ? null : t)}
                date={selectedDate}
              />

              {/* Selected table action */}
              {selectedTable && (
                <div className="border border-[#E5E4E2]/20 p-4 space-y-3 rounded-lg bg-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest">{selectedTable.name}</p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">
                        {selectedTable.section} · {selectedTable.capacity_min}–{selectedTable.capacity_max} guests
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-light">${(selectedTable.min_spend || 0).toLocaleString()}</p>
                      <p className="text-[8px] text-white/30 uppercase tracking-wider">min spend</p>
                    </div>
                  </div>
                  {selectedTable.perks?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTable.perks.map((p: string) => (
                        <span key={p} className="text-[7px] border border-white/10 px-1.5 py-0.5 rounded-full text-white/40 uppercase tracking-wider">{p}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => onBookTable({ ...venue, selectedTable, selectedDate })}
                    className="w-full h-12 bg-[#E5E4E2] text-black text-[10px] font-bold uppercase tracking-[0.3em] active:scale-[0.98] transition-all rounded-sm"
                  >
                    Book This Table
                  </button>
                </div>
              )}
            </div>
          </TabsContent>


          {/* LIVE VIEW TAB — first-person immersive table perspective */}
          <TabsContent value="live-view" className="mt-0 space-y-6">
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold">
              What you'll actually see from each table
            </p>

            {tables.filter((t: any) => t.availability === 'available').slice(0, 3).map((table: any, i: number) => (
              <div key={table.id} className="border border-white/10 overflow-hidden group">
                <div className="relative h-52 bg-zinc-950 overflow-hidden">
                  <img
                    src={[
                      'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80',
                      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
                      'https://images.unsplash.com/photo-1545128485-c400e7702796?w=800&q=80',
                    ][i % 3]}
                    alt={`View from ${table.name}`}
                    className="w-full h-full object-cover grayscale-[40%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-bold uppercase tracking-widest text-white">Live Angle</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white">{table.name}</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/50 mt-0.5">
                      {table.capacity_min}–{table.capacity_max} guests · ${(table.min_spend || 0).toLocaleString()} min
                    </p>
                  </div>
                </div>
                <div className="p-4 space-y-3 bg-zinc-950/60">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-bold">From this table you'll see</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'DJ Booth', value: i === 0 ? 'Direct sightline' : i === 1 ? 'Elevated angle' : 'Side stage' },
                      { label: 'Dance Floor', value: i === 0 ? 'Full panoramic' : i === 1 ? "Bird's eye" : 'Left panoramic' },
                      { label: 'Stage', value: i === 0 ? 'Centre view' : i === 1 ? 'Full visibility' : 'Terrace access' },
                      { label: 'Bar', value: i === 0 ? '15m · easy access' : i === 1 ? '8m · closest' : '20m · far end' },
                    ].map(({ label, value }) => (
                      <div key={label} className="border border-white/5 px-3 py-2">
                        <p className="text-[7px] uppercase tracking-widest text-white/25">{label}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-white/70 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onBookTable({ ...venue, selectedTable: table, selectedDate })}
                    className="w-full py-3 bg-white text-[#000504] font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-[#E5E4E2] transition-all mt-2"
                  >
                    Book This Table
                  </button>
                </div>
              </div>
            ))}
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

        </Tabs>
      </div>
    </div>
  );
}