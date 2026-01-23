'use client';

import { ArrowLeft, Star, MapPin, Users, Share2, Heart, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function VenueDetail({ venue, onBook, onBack }: any) {
  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="relative h-[400px]">
        <div
          className="absolute inset-0 grayscale"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,1) 100%), url(${venue.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute top-0 left-0 right-0 pt-8 px-6 flex items-center justify-between z-10">
          <button onClick={onBack} className="text-white hover:text-white/70 transition-colors">
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <h1 className="text-4xl font-light uppercase tracking-wide leading-none mb-2">{venue.name}</h1>
          <p className="text-[10px] uppercase tracking-widest text-white/80">{venue.location}</p>
        </div>
      </div>
      <div className="p-6">
        <Button 
          onClick={() => onBook({ name: 'VIP Main Floor', minSpend: 1500 })}
          className="w-full bg-white text-black hover:bg-zinc-200 uppercase tracking-widest text-xs font-bold h-14 rounded-none !text-black"
        >
          Book Experience
        </Button>
      </div>
    </div>
  );
}