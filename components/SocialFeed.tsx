'use client';

import { useState, useEffect } from 'react';
import { MapPin, Instagram, Loader2, ExternalLink, Trophy, ArrowUpRight, Users, Music, Check, Disc3, Headphones } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion } from 'motion/react';
import { supabase } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const filters = ['All', 'Friends', 'Clubs', 'Lounges'];

interface SocialFeedProps {
  onVenueClick: (venue: { name: string; location?: string; image?: string; time?: string }) => void;
}

export function SocialFeed({ onVenueClick }: SocialFeedProps) {
  const [loading, setLoading] = useState(true);
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [soundcloudUsername, setSoundcloudUsername] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [instagramConnecting, setInstagramConnecting] = useState(false);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState<{ name: string; image: string | null; genres: string[]; popularity: number }[]>([]);
  const [spotifyTopGenres, setSpotifyTopGenres] = useState<string[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const { userId } = useAuth();

  const connectSpotify = async () => {
    if (!userId) return;
    setSpotifyConnecting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/spotify/login?userId=${userId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setSpotifyConnecting(false);
      }
    } catch {
      setSpotifyConnecting(false);
    }
  };

  const connectInstagram = async () => {
    if (!userId) return;
    setInstagramConnecting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/instagram/login?userId=${userId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setInstagramConnecting(false);
      }
    } catch {
      setInstagramConnecting(false);
    }
  };

  useEffect(() => {
    // Check Spotify via localStorage (set by SpotifyCallback on success)
    const spotifyUserId = localStorage.getItem('spotify_user_id');
    if (spotifyUserId) {
      setSpotifyConnected(true);
      // Fetch top artists when Spotify is connected
      (async () => {
        setSpotifyLoading(true);
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/server/spotify/top-artists?userId=${spotifyUserId}`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );
          if (res.ok) {
            const data = await res.json();
            setSpotifyTopArtists(data.topArtists || []);
            setSpotifyTopGenres(data.topGenres || []);
          }
        } catch { /* silent */ }
        setSpotifyLoading(false);
      })();
    }

    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('instagram_handle, soundcloud_connected')
          .eq('id', userId)
          .single();
        setInstagramHandle(data?.instagram_handle ?? null);
        setSoundcloudUsername(data?.soundcloud_connected ? 'connected' : null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Placeholder for real social posts data from API
  const filteredPosts: any[] = [];

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-white/60 mb-6">Social Activity</h1>

        {/* Filter Pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 border text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === filter
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

        {/* Trending Venues - Placeholder */}
        {/* Coming soon: Real social data will be fetched from the API */}

        {/* Instagram / Live Dispatch Section */}
        <div className="space-y-10">
          <div className="px-6 flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Live Dispatch</h2>

            {loading ? (
              <Loader2 size={12} className="text-white/30 animate-spin" />
            ) : instagramHandle ? (
              <button
                onClick={() => window.open(`https://instagram.com/${instagramHandle}`, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-1.5 group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">@{instagramHandle}</span>
                <ExternalLink size={9} className="text-white/20 group-hover:text-white/60 transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => window.open('https://instagram.com', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 group hover:text-white transition-colors"
              >
                <Instagram size={12} className="text-white/30 group-hover:text-white" />
                <span className="text-[8px] uppercase tracking-widest text-white/30 group-hover:text-white border-b border-white/20">Add handle in profile</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-white/5">
            {filteredPosts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/30">No posts available</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="px-4 py-4 rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#060606] my-4 group"
                >
                  {/* User Header with Tier Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 rounded-xl platinum-border overflow-hidden bg-zinc-800">
                        <AvatarFallback className="bg-[#0a0a0a] text-[11px] font-bold text-[#E5E4E2] rounded-sm">
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
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-3" />

                  {/* Message */}
                  <p className="text-base font-serif font-light leading-relaxed text-white italic mb-3 text-[#E5E4E2]/95">
                    "{post.message}"
                  </p>

                  {/* Venue Card */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="mb-3 group/venue cursor-pointer rounded-xl border border-white/10 overflow-hidden bg-[#060606]"
                    onClick={() => onVenueClick(post.venue)}
                  >
                    <div className="flex h-20 overflow-hidden">
                      <div
                        className="w-24 h-full bg-cover bg-center flex-shrink-0 grayscale group-hover/venue:grayscale-0 transition-all duration-700 group-hover/venue:scale-110"
                        style={{ backgroundImage: `url(${post.venue.image})` }}
                      />
                      <div className="flex-1 p-3 flex flex-col justify-between">
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
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-3" />

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

        {/* Spotify Music Taste */}
        {spotifyConnected && (spotifyTopArtists.length > 0 || spotifyLoading) && (
          <div className="px-6 space-y-4">
            <div className="flex items-center gap-2">
              <Disc3 size={14} className="text-[#1DB954]" />
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Your Music DNA</h2>
            </div>

            {spotifyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="text-[#1DB954] animate-spin" />
              </div>
            ) : (
              <>
                {/* Top Genres */}
                {spotifyTopGenres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {spotifyTopGenres.slice(0, 8).map((genre) => (
                      <span
                        key={genre}
                        className="text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 border border-[#1DB954]/20 text-[#1DB954]/70 bg-[#1DB954]/5"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Top Artists */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                  {spotifyTopArtists.slice(0, 6).map((artist) => (
                    <div key={artist.name} className="flex-shrink-0 w-20 text-center">
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border border-white/10 bg-[#0a0a0a] mb-1.5">
                        {artist.image ? (
                          <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Headphones size={20} className="text-white/20" />
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-white/60 truncate">{artist.name}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Connected Accounts */}
        <div className="space-y-6 px-6">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Connected Accounts</h2>

          {/* Spotify */}
          <button
            onClick={spotifyConnected ? undefined : connectSpotify}
            disabled={spotifyConnecting}
            className={`w-full flex items-center justify-between px-5 py-4 border transition-all group ${spotifyConnected ? 'border-[#1DB954]/30 bg-[#1DB954]/5 cursor-default' : 'border-white/10 hover:border-[#1DB954]/40 hover:bg-[#1DB954]/5'} disabled:opacity-50`}
          >
            <div className="flex items-center gap-3">
              <Music size={16} className={spotifyConnected ? 'text-[#1DB954]' : 'text-white/40 group-hover:text-[#1DB954]'} />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Spotify</p>
                <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">
                  {spotifyConnected ? 'Account linked' : 'Connect for music recommendations'}
                </p>
              </div>
            </div>
            {spotifyConnecting ? (
              <Loader2 size={14} className="text-white/30 animate-spin" />
            ) : spotifyConnected ? (
              <Check size={14} className="text-[#1DB954]" />
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 group-hover:text-[#1DB954]/70 transition-colors">Connect</span>
            )}
          </button>

          {/* Instagram OAuth */}
          <button
            onClick={instagramHandle ? undefined : connectInstagram}
            disabled={instagramConnecting}
            className={`w-full flex items-center justify-between px-5 py-4 border transition-all group ${instagramHandle ? 'border-pink-500/30 bg-pink-500/5 cursor-default' : 'border-white/10 hover:border-pink-500/40 hover:bg-pink-500/5'} disabled:opacity-50`}
          >
            <div className="flex items-center gap-3">
              <Instagram size={16} className={instagramHandle ? 'text-pink-400' : 'text-white/40 group-hover:text-pink-400'} />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Instagram</p>
                <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">
                  {instagramHandle ? `@${instagramHandle}` : 'Connect your profile'}
                </p>
              </div>
            </div>
            {instagramConnecting ? (
              <Loader2 size={14} className="text-white/30 animate-spin" />
            ) : instagramHandle ? (
              <Check size={14} className="text-pink-400" />
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 group-hover:text-pink-400/70 transition-colors">Connect</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}