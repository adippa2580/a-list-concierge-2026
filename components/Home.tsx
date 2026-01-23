'use client';

import { MapPin, Star, ChevronRight, Search, Music, Wine, Mic2, Navigation, Play, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export function Home({ onVenueClick, onBookTable, onOpenCalendar, onViewAllArtists }: any) {
  const [currentLocation, setCurrentLocation] = useState('Miami, FL');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen pb-32 bg-black text-white marble-bg">
      <div className="pt-2 px-6 pb-6 space-y-6">
        <div className="flex items-end justify-between">
          <div className="cursor-pointer group">
            <p className="text-[10px] text-white/60 uppercase tracking-[0.2em] mb-1">Location</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-light tracking-widest uppercase gold-gradient">{currentLocation.split(',')[0]}</span>
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
        <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-6">Tonight's Elite Picks</h2>
        {/* Venue cards would go here in full implementation */}
        <p className="text-sm text-white/60">Discover curated nightlife experiences in {currentLocation}.</p>
      </div>
    </div>
  );
}