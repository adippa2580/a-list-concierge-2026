'use client';

import { useState, useEffect } from 'react';
import { MapPin, Users, ChevronRight, Instagram, Loader2, ExternalLink, LogOut, RefreshCw, AlertTriangle, Trophy, ArrowUpRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { Authorization: `Bearer ${publicAnonKey}` };

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
    user: { name: 'Sarah Chen', tier: 'Platinum', avatar: 'SC' },
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
    user: { name: 'Marcus Liu', tier: 'Gold Elite', avatar: 'ML' },
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

interface InstagramMediaItem {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

interface SocialFeedProps {
  onVenueClick: (venue: { name: string; location?: string; image?: string; time?: string }) => void;
}

export function SocialFeed({ onVenueClick }: SocialFeedProps) {
  const [instagramMedia, setInstagramMedia] = useState<InstagramMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [tokenDaysLeft, setTokenDaysLeft] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const { userId } = useAuth();

  useEffect(() => {
    fetchInstagramStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstagramStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/instagram/media?userId=${userId}&limit=12`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        connected: boolean;
        expired?: boolean;
        username?: string;
        token_expires_days?: number;
        data: InstagramMediaItem[];
      };

      setConnected(data.connected);
      setExpired(!!data.expired);
      setUsername(data.username ?? null);
      setTokenDaysLeft(data.token_expires_days ?? null);
      setInstagramMedia(data.data || []);
    } catch (e) {
      console.error('[Instagram] Status check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API}/instagram/login?userId=${userId}`, { headers: HEADERS });
      const data = await res.json() as { authUrl?: string; error?: string };
      if (data.error) {
        // Credentials not yet configured — show setup guide
        setShowSetupGuide(true);
        return;
      }
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (e) {
      console.error('[Instagram] Connect failed:', e);
      setShowSetupGuide(true);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`${API}/instagram/disconnect?userId=${userId}`, {
        method: 'DELETE',
        headers: HEADERS
      });
      setConnected(false);
      setExpired(false);
      setUsername(null);
      setTokenDaysLeft(null);
      setInstagramMedia([]);
    } catch (e) {
      console.error('[Instagram] Disconnect failed:', e);
    } finally {
      setDisconnecting(false);
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
                className="w-full group cursor-pointer platinum-border rounded-sm overflow-hidden bg-[#0a0a0a] shadow-2xl"
              >
                {/* Featured Image */}
                <div className="relative aspect-video overflow-hidden bg-zinc-900">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] ease-out group-hover:scale-110 opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0"
                    style={{ backgroundImage: `url(${venue.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                  {/* Ranking Badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2 shadow-lg">
                    <Trophy size={12} className="text-black" />
                    #{venue.rank}
                  </div>

                  {/* Price Tag */}
                  <div className="absolute top-4 left-4 bg-[#E5E4E2]/90 text-black text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5">
                    {venue.price}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-8 space-y-5">
                  {/* Venue Name */}
                  <div>
                    <h3 className="text-3xl font-serif font-light uppercase tracking-wider text-white group-hover:platinum-gradient transition-all mb-2">{venue.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
                      <MapPin size={12} className="text-[#E5E4E2]/40" />
                      {venue.location}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent" />

                  {/* Engagement Stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500/60 animate-pulse" />
                      <span className="text-[10px] uppercase tracking-widest text-white/60">{venue.attendees} In The Scene</span>
                    </div>
                    <div className="flex items-center gap-3 group-hover:gap-4 transition-all">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#E5E4E2]/50">EXPLORE</span>
                      <ArrowUpRight size={14} className="text-white/30 group-hover:text-[#E5E4E2] transition-colors" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Instagram / Live Dispatch Section */}
        <div className="space-y-10">
          <div className="px-6 flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Live Dispatch</h2>

            {loading ? (
              <Loader2 size={12} className="text-white/30 animate-spin" />
            ) : connected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[8px] uppercase tracking-widest text-white/40">
                    {username ? `@${username}` : 'Instagram Synced'}
                    {tokenDaysLeft !== null && tokenDaysLeft < 7 && (
                      <span className="ml-1 text-amber-400">· {tokenDaysLeft}d left</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1 text-white/20 hover:text-white/60 transition-colors"
                  title="Disconnect Instagram"
                >
                  <LogOut size={10} />
                </button>
              </div>
            ) : expired ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors group"
              >
                <AlertTriangle size={12} />
                <span className="text-[8px] uppercase tracking-widest border-b border-amber-400/40">Token Expired — Reconnect</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 group hover:text-white transition-colors"
              >
                {connecting
                  ? <Loader2 size={12} className="animate-spin text-white/40" />
                  : <Instagram size={12} className="text-white/40 group-hover:text-white" />}
                <span className="text-[8px] uppercase tracking-widest text-white/40 group-hover:text-white border-b border-white/20">Link Profile</span>
              </button>
            )}
          </div>

          {/* Setup Guide Modal */}
          <AnimatePresence>
            {showSetupGuide && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-6 p-5 bg-zinc-900 border border-amber-400/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Instagram size={14} className="text-amber-400" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-400">Instagram Setup Required</p>
                  </div>
                  <button onClick={() => setShowSetupGuide(false)} className="text-white/30 hover:text-white text-xs">✕</button>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed mb-4">
                  To connect Instagram, you need a <strong className="text-white/70">Business or Creator account</strong> and a configured Meta app with the <code className="text-amber-400/80 text-[9px]">instagram_business_basic</code> permission. Set these Supabase secrets:
                </p>
                <div className="space-y-1.5 font-mono text-[9px] text-white/40 bg-black/40 p-3 border border-white/5">
                  <p><span className="text-amber-400">INSTAGRAM_CLIENT_ID</span>=&lt;your_meta_app_id&gt;</p>
                  <p><span className="text-amber-400">INSTAGRAM_CLIENT_SECRET</span>=&lt;your_meta_app_secret&gt;</p>
                </div>
                <p className="text-[9px] text-white/30 mt-2">
                  Register this URL as your OAuth redirect in the Meta app:
                </p>
                <div className="font-mono text-[8px] text-amber-400/60 bg-black/40 p-2 border border-white/5 break-all">
                  https://&lt;project-ref&gt;.supabase.co/functions/v1/server/instagram/callback
                </div>
                <p className="text-[9px] text-white/30 mt-3">
                  Create your app at{' '}
                  <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">
                    developers.facebook.com/apps
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="divide-y divide-white/5">
            {connected && instagramMedia.length > 0 ? (
              instagramMedia.map((post) => {
                const mediaSrc = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
                return (
                  <div key={post.id} className="p-0 space-y-0 group">
                    <div className="relative aspect-square w-full overflow-hidden">
                      {post.media_type === 'VIDEO' ? (
                        <video
                          src={post.media_url}
                          poster={post.thumbnail_url}
                          muted
                          playsInline
                          loop
                          onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                          onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
                          className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-1000"
                        />
                      ) : (
                        <img
                          src={mediaSrc}
                          alt="Instagram Media"
                          className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-1000"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      <div className="absolute top-6 left-6 flex items-center gap-3">
                        <div className="w-10 h-10 border border-white/40 backdrop-blur-md p-0.5 flex items-center justify-center bg-black/20">
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">IG</span>
                          </div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 border border-white/10">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white">
                            {new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {post.media_type === 'VIDEO' && (
                        <div className="absolute top-6 right-6 bg-black/50 backdrop-blur-md px-2 py-1 border border-white/10">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">▶ Video</span>
                        </div>
                      )}
                    </div>

                    <div className="p-8 space-y-6 bg-zinc-950">
                      <p className="text-lg font-light leading-relaxed text-white/90 font-serif italic">
                        "{post.caption || 'A night to remember.'}"
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="flex gap-4 text-[9px] uppercase tracking-widest text-white/40">
                          <span className="flex items-center gap-2"><MapPin size={10} /> Miami District</span>
                        </div>
                        <button
                          onClick={() => window.open(post.permalink, '_blank')}
                          className="text-[9px] font-bold uppercase tracking-[0.2em] text-white hover:text-white/70 flex items-center gap-2"
                        >
                          View on Instagram <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : connected && !loading ? (
              /* Connected but no media yet */
              <div className="px-6 py-12 text-center space-y-3">
                <Instagram size={24} className="text-white/20 mx-auto" />
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">No media found on your account</p>
                <button
                  onClick={fetchInstagramStatus}
                  className="flex items-center gap-2 mx-auto text-white/30 hover:text-white/60 transition-colors"
                >
                  <RefreshCw size={10} />
                  <span className="text-[8px] uppercase tracking-widest">Refresh</span>
                </button>
              </div>
            ) : (
              /* Not connected — show curated social posts */
              socialPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="px-6 py-8 platinum-border rounded-sm bg-gradient-to-br from-[#0a0a0a] to-[#000504] my-6 group"
                >
                  {/* User Header with Tier Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 rounded-none platinum-border overflow-hidden bg-zinc-800">
                        <AvatarFallback className="bg-[#0a0a0a] text-[11px] font-bold text-[#E5E4E2] rounded-none">
                          {post.user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-bold uppercase tracking-wider text-white">{post.user.name}</span>
                          <span className="text-[9px] bg-[#E5E4E2]/10 text-[#E5E4E2] border border-[#E5E4E2]/30 px-2 py-1 uppercase tracking-widest font-bold">
                            {post.user.tier}
                          </span>
                        </div>
                        <span className="text-[9px] text-white/40 uppercase tracking-widest">{post.postedTime}</span>
                      </div>
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-white/50 border border-[#E5E4E2]/20 px-3 py-2 bg-white/5">
                      {post.visibility}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-6" />

                  {/* Message */}
                  <p className="text-base font-serif font-light leading-relaxed text-white italic mb-6 text-[#E5E4E2]/95">
                    "{post.message}"
                  </p>

                  {/* Venue Card */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6 group/venue cursor-pointer platinum-border rounded-sm overflow-hidden bg-[#000504]"
                    onClick={() => onVenueClick(post.venue)}
                  >
                    <div className="flex h-28 overflow-hidden">
                      <div
                        className="w-32 h-full bg-cover bg-center flex-shrink-0 grayscale group-hover/venue:grayscale-0 transition-all duration-700 group-hover/venue:scale-110"
                        style={{ backgroundImage: `url(${post.venue.image})` }}
                      />
                      <div className="flex-1 p-5 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white group-hover/venue:platinum-gradient transition-all">{post.venue.name}</h3>
                          <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">{post.venue.time}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40">{post.venue.location}</span>
                          <ArrowUpRight size={14} className="text-white/30 group-hover/venue:text-[#E5E4E2] transition-colors" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-6" />

                  {/* Stats & CTA */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-6 text-[10px] uppercase tracking-widest text-white/60">
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-[#E5E4E2]/40" />
                        <span>{post.peopleGoing} Going</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#E5E4E2]/60">${post.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onVenueClick(post.venue)}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#E5E4E2] border border-[#E5E4E2]/40 px-4 py-2 hover:bg-white/5 hover:border-[#E5E4E2]/70 transition-all active:scale-95"
                    >
                      Join Group
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Load More hidden until social feed pagination is wired to API */}
        {connected && (
          <div className="px-6">
            <Button
              variant="outline"
              onClick={fetchInstagramStatus}
              className="w-full h-12 border-white/20 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/40 rounded-none uppercase tracking-widest text-[10px] font-bold"
            >
              Refresh Feed
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}