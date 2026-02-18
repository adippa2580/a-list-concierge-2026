'use client';

import { useState, useEffect } from 'react';
import { MapPin, Users, DollarSign, Clock, TrendingUp, Filter, ChevronRight, Instagram, Loader2, ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const filters = ['All', 'Friends', 'Clubs', 'Lounges'];

const trendingVenues = [
  {
    id: 1,
    name: 'LIV Miami',
    location: 'South Beach, Miami',
    attendees: 47,
    price: '$$$$',
    rank: 1,
    image: 'https://images.unsplash.com/photo-1760865461468-d80681140a63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBsdXh1cnklMjBpbnRlcmlvcnxlbnwxfHx8fDE3NjA5NzYzMzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: 2,
    name: 'Story Miami',
    location: 'South Beach, Miami',
    attendees: 32,
    price: '$$$',
    rank: 2,
    image: 'https://images.unsplash.com/photo-1578760427294-9871d8667bf3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBWSVAlMjB0YWJsZXxlbnwxfHx8fDE3NjA5NzYzMzd8MA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

const socialPosts = [
  {
    id: 1,
    user: {
      name: 'Sarah Chen',
      tier: 'Platinum',
      avatar: 'SC'
    },
    venue: {
      name: 'LIV Miami',
      location: 'South Beach, Miami',
      time: 'Tonight, 10:30 PM',
      image: 'https://images.unsplash.com/photo-1760865461468-d80681140a63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NjA5NzYzMzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    },
    message: 'Booked a VIP table for Calvin Harris tonight! Looking for 3 more people to split costs.',
    peopleGoing: 5,
    totalCost: 2400,
    visibility: 'PUBLIC',
    postedTime: '2h ago'
  },
  {
    id: 2,
    user: {
      name: 'Marcus Liu',
      tier: 'Gold Elite',
      avatar: 'ML'
    },
    venue: {
      name: 'E11EVEN Miami',
      location: 'Downtown, Miami',
      time: 'Saturday, 11:00 PM',
      image: 'https://images.unsplash.com/photo-1744314080490-ed41f6319475?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBwYXJ0eSUyMGNyb3dkfGVufDF8fHx8MTc2MDk2NzgxOXww&ixlib=rb-4.1.0&q=80&w=1080'
    },
    message: 'Celebrating my birthday this Saturday! Table for 10, all spots filled',
    peopleGoing: 10,
    totalCost: 3500,
    visibility: 'FRIENDS',
    postedTime: '5h ago'
  }
];

interface SocialFeedProps {
  onVenueClick: (venue: any) => void;
}

export function SocialFeed({ onVenueClick }: SocialFeedProps) {
  const [instagramMedia, setInstagramMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    checkInstagramStatus();
  }, []);

  const checkInstagramStatus = async () => {
    // For this prototype, we'll try to fetch with a default userId if none found
    const userId = localStorage.getItem('alist_user_id') || 'default_user';
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/instagram/media?userId=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setInstagramMedia(data.data);
          setConnected(true);
        }
      }
    } catch (error) {
      console.error('Error fetching Instagram media:', error);
    }
  };

  const handleConnect = async () => {
    const userId = localStorage.getItem('alist_user_id') || 'default_user';
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/instagram/login?userId=${userId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (e) {
      console.error('Failed to initiate login', e);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-white/60 mb-6">Social Activity</h1>

        {/* Filter Pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter, index) => (
            <button
              key={filter}
              className={`px-4 py-2 border text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${index === 0
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-white/80 border-white/20 hover:border-white hover:text-white'
                }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-16 pt-10">

        {/* Trending Venues */}
        <div className="space-y-8">
          <div className="px-6 flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Tonight's Gravity</h2>
          </div>

          <div className="px-6 space-y-8">
            {trendingVenues.map((venue, index) => (
              <motion.div
                key={venue.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                onClick={() => onVenueClick(venue)}
                className="w-full aspect-video relative group cursor-pointer border border-white/5 bg-zinc-950 overflow-hidden shadow-2xl"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] ease-out group-hover:scale-110 opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0"
                  style={{ backgroundImage: `url(${venue.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <div className="absolute top-0 left-0 bg-white text-black text-[10px] font-bold px-4 py-2 uppercase tracking-[0.2em] !text-black z-10 shadow-lg">
                  TRENDING #{venue.rank}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-8 transform group-hover:translate-y-[-8px] transition-transform duration-500">
                  <h3 className="text-4xl font-light uppercase tracking-wide mb-2 font-serif text-white group-hover:gold-gradient transition-all">{venue.name}</h3>
                  <div className="flex justify-between items-center border-t border-white/20 pt-4">
                    <span className="text-[11px] uppercase tracking-[0.3em] text-white/60">{venue.location.split(',')[0]}</span>
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-white/40 group-hover:text-gold transition-colors" />
                      <span className="text-[10px] uppercase tracking-widest text-white font-bold">{venue.attendees} IN THE SCENE</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* The Scene - Social Activity */}
        <div className="space-y-10">
          <div className="px-6 flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Live Dispatch</h2>
            {connected ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] uppercase tracking-widest text-white/40">Instagram Feed Synced</span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 group hover:text-white transition-colors"
              >
                <Instagram size={12} className="text-white/40 group-hover:text-white" />
                <span className="text-[8px] uppercase tracking-widest text-white/40 group-hover:text-white border-b border-white/20">Link Profile</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-white/5">
            {instagramMedia.length > 0 ? (
              instagramMedia.map((post) => (
                <div key={post.id} className="p-0 space-y-0 group">
                  {/* Full width editorial post */}
                  <div className="relative aspect-square w-full overflow-hidden">
                    <img
                      src={post.media_url}
                      alt="Instagram Media"
                      className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-1000"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                      <div className="w-10 h-10 border border-white/40 backdrop-blur-md p-0.5 flex items-center justify-center bg-black/20">
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">IG</span>
                        </div>
                      </div>
                      <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 border border-white/10">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white">{new Date(post.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6 bg-zinc-950">
                    <p className="text-lg font-light leading-relaxed text-white/90 font-serif italic">"{post.caption || "A night to remember."}"</p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex gap-4 text-[9px] uppercase tracking-widest text-white/40">
                        <span className="flex items-center gap-2"><MapPin size={10} /> MIAMI DISTRICT</span>
                      </div>
                      <button
                        onClick={() => window.open(post.permalink, '_blank')}
                        className="text-[9px] font-bold uppercase tracking-[0.2em] text-white hover:text-white/70 flex items-center gap-2"
                      >
                        Source <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              socialPosts.map((post) => (
                <div key={post.id} className="p-6 space-y-4 hover:bg-white/5 transition-colors">

                  {/* User Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 rounded-none ring-1 ring-white/40">
                        <AvatarFallback className="bg-zinc-800 text-xs font-bold text-white rounded-none">
                          {post.user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest">{post.user.name}</span>
                          <span className="text-[8px] bg-white/20 text-white/80 px-1 py-0.5 uppercase tracking-wider">
                            {post.user.tier}
                          </span>
                        </div>
                        <span className="text-[9px] text-white/50 uppercase tracking-widest">{post.postedTime}</span>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-white/60 border border-white/20 px-2 py-1">
                      {post.visibility}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="pl-11 space-y-4">
                    <p className="text-sm font-light leading-relaxed text-white">"{post.message}"</p>

                    {/* Venue Link */}
                    <div
                      className="flex items-center gap-4 group cursor-pointer border border-white/20 p-1 pr-4 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
                      onClick={() => onVenueClick(post.venue)}
                    >
                      <div className="w-12 h-12 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all" style={{ backgroundImage: `url(${post.venue.image})` }} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold uppercase tracking-wide truncate">{post.venue.name}</h3>
                        <p className="text-[9px] text-white/60 uppercase tracking-widest truncate">{post.venue.time}</p>
                      </div>
                      <ChevronRight size={14} className="text-white/40 group-hover:text-white transition-colors" />
                    </div>

                    {/* Stats & Action */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-4 text-[9px] uppercase tracking-widest text-white/60">
                        <span>{post.peopleGoing} Going</span>
                        <span>Est. ${post.totalCost.toLocaleString()}</span>
                      </div>
                      <button className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-white/70 border-b border-white pb-0.5">
                        Join Group
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6">
          <Button variant="outline" className="w-full h-12 border-white/20 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/40 rounded-none uppercase tracking-widest text-[10px] font-bold">
            Load More
          </Button>
        </div>
      </div>
    </div>
  );
}