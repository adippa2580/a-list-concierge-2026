'use client';

import { useState, useEffect } from 'react';
import { MapPin, Instagram, Loader2, ExternalLink, Trophy, ArrowUpRight, Users, Music, Check, Disc3, Headphones, PenLine, X, Globe, Lock, UserCheck, Heart, Trash2, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion } from 'motion/react';
import { supabase } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const filters = ['All', 'Friends', 'Clubs', 'Lounges'];

interface SocialFeedProps {
  onVenueClick: (venue: { name: string; location?: string; image?: string; time?: string }) => void;
}

interface SocialPost {
  id: string;
  userId: string;
  userName: string;
  userTier?: string;
  userAvatar?: string;
  message: string;
  venueId?: string;
  venueName?: string;
  venueLocation?: string;
  venueImage?: string;
  venueTime?: string;
  peopleGoing?: number;
  totalCost?: number;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  createdAt: string;
  likes: number;
  likedByUser: boolean;
}

interface TrendingVenue {
  id: string;
  name: string;
  location: string;
  attendees: number;
  price: string;
  image?: string;
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
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [trendingVenues, setTrendingVenues] = useState<TrendingVenue[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postVenue, setPostVenue] = useState('');
  const [postPeople, setPostPeople] = useState('');
  const [postVisibility, setPostVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');
  const [posting, setPosting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Fetch trending venues for tonight
  const fetchTrendingVenues = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/venues?limit=5&sort=popularity`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const venues = (Array.isArray(data) ? data : data.venues || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          location: v.location,
          attendees: Math.floor(Math.random() * 100) + 20,
          price: ['$', '$$', '$$$', '$$$$'][Math.floor(Math.random() * 4)],
          image: v.image_url
        }));
        setTrendingVenues(venues);
      }
    } catch (e) {
      console.error('Failed to fetch trending venues:', e);
    }
  };

  // Fetch social posts from friends/community
  const fetchSocialPosts = async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/social/feed?userId=${userId}&limit=10`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const posts = (Array.isArray(data) ? data : data.posts || []).map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          userName: p.user_name || 'Anonymous',
          userTier: p.user_tier,
          userAvatar: p.user_avatar,
          message: p.message,
          venueId: p.venue_id,
          venueName: p.venue_name,
          venueLocation: p.venue_location,
          venueImage: p.venue_image,
          venueTime: p.venue_time,
          peopleGoing: p.people_going,
          totalCost: p.total_cost,
          visibility: p.visibility || 'PUBLIC',
          createdAt: p.created_at,
          likes: p.likes ?? 0,
          likedByUser: p.liked_by_user ?? false
        }));
        setSocialPosts(posts);
      }
    } catch (e) {
      console.error('Failed to fetch social posts:', e);
    } finally {
      setPostsLoading(false);
    }
  };

  // Toggle like with optimistic update
  const toggleLike = async (postId: string) => {
    if (!userId) return;
    // Optimistic update
    setSocialPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likedByUser: !p.likedByUser, likes: p.likedByUser ? Math.max(0, p.likes - 1) : p.likes + 1 }
        : p
    ));
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/social/posts/${postId}/like?userId=${userId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Reconcile to authoritative server state
      setSocialPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likedByUser: !!data.liked, likes: data.likes ?? p.likes } : p
      ));
    } catch (e) {
      // Roll back
      setSocialPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, likedByUser: !p.likedByUser, likes: p.likedByUser ? Math.max(0, p.likes - 1) : p.likes + 1 }
          : p
      ));
      console.error('Toggle like failed:', e);
    }
  };

  // Delete own post
  const deletePost = async (postId: string) => {
    if (!userId) return;
    setMenuOpenId(null);
    setDeletingId(postId);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/social/posts/${postId}?userId=${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      if (res.ok) {
        setSocialPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        console.error('Delete failed:', await res.text());
      }
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeletingId(null);
    }
  };

  // Long-press handler factory: triggers menu after 500ms touch/mouse hold
  // (Not a real hook — no useState/useEffect — just a binding factory)
  const getLongPressBindings = (postId: string, ownPost: boolean) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = (e: React.TouchEvent | React.MouseEvent) => {
      if (!ownPost) return;
      timer = setTimeout(() => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(15); } catch {}
        }
        setMenuOpenId(postId);
        timer = null;
      }, 500);
    };
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };
    return {
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchMove: cancel,
      onTouchCancel: cancel,
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel
    };
  };

  // Filter posts based on active filter
  const getFilteredPosts = () => {
    if (activeFilter === 'All') return socialPosts;
    if (activeFilter === 'Friends') return socialPosts.filter(p => p.visibility === 'FRIENDS' || p.visibility === 'PUBLIC');
    if (activeFilter === 'Clubs') return socialPosts; // TODO: add club category to social posts
    if (activeFilter === 'Lounges') return socialPosts; // TODO: add lounge category to social posts
    return socialPosts;
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

    // Fetch social data
    fetchTrendingVenues();
    fetchSocialPosts();
  }, [userId]);

  const filteredPosts = getFilteredPosts();

  const submitPost = async () => {
    if (!postMessage.trim() || !userId) return;
    setPosting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/social/posts`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            message: postMessage.trim(),
            venueName: postVenue.trim() || undefined,
            peopleGoing: postPeople ? parseInt(postPeople) : undefined,
            visibility: postVisibility,
          }),
        }
      );
      if (res.ok) {
        setPostMessage('');
        setPostVenue('');
        setPostPeople('');
        setPostVisibility('PUBLIC');
        setComposing(false);
        fetchSocialPosts();
      }
    } catch (e) {
      console.error('Failed to post:', e);
    } finally {
      setPosting(false);
    }
  };

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

        {/* Trending Venues */}
        {trendingVenues.length > 0 && (
          <div className="space-y-6 px-6">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-500" />
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Tonight's Top Venues</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
              {trendingVenues.map((venue) => (
                <motion.div
                  key={venue.id}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => onVenueClick({ name: venue.name, location: venue.location, image: venue.image })}
                  className="flex-shrink-0 w-48 group cursor-pointer rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0a] hover:border-amber-500/40 transition-all"
                >
                  {venue.image && (
                    <div
                      className="h-32 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110"
                      style={{ backgroundImage: `url(${venue.image})` }}
                    />
                  )}
                  <div className="p-3 space-y-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white group-hover:text-amber-500">{venue.name}</h3>
                    <p className="text-[9px] text-white/50 uppercase tracking-widest">{venue.location}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[9px] font-bold text-amber-500">{venue.attendees} Going</span>
                      <span className="text-[9px] text-white/40">{venue.price}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

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
            {postsLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader2 size={16} className="text-white/30 animate-spin" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/30">No posts available</p>
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isOwn = post.userId === userId;
                const longPressBindings = getLongPressBindings(post.id, isOwn);
                const isDeleting = deletingId === post.id;
                const menuOpen = menuOpenId === post.id;
                return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isDeleting ? { opacity: 0, y: -10 } : undefined}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  {...longPressBindings}
                  className="relative px-4 py-4 rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#060606] my-4 group select-none"
                >
                  {/* Long-press menu overlay (own posts only) */}
                  {menuOpen && isOwn && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 rounded-xl bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
                      onClick={() => setMenuOpenId(null)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePost(post.id); }}
                        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-red-400 border border-red-400/40 px-4 py-2.5 hover:bg-red-500/10 active:scale-95 transition-all"
                      >
                        <Trash2 size={14} />
                        Delete post
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}
                        className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}

                  {/* User Header with Tier Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800">
                        <AvatarFallback className="bg-[#0a0a0a] text-[10px] font-bold text-[#E5E4E2]">
                          {post.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold uppercase tracking-wider text-white">{post.userName}</span>
                          {post.userTier && (
                            <span className="text-[8px] bg-[#E5E4E2]/10 text-[#E5E4E2] border border-[#E5E4E2]/30 px-1.5 py-0.5 uppercase tracking-widest font-bold">
                              {post.userTier}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-white/40 uppercase tracking-widest">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : post.id); }}
                          className="text-white/40 hover:text-white/80 active:scale-95 transition-all p-1"
                          aria-label="Post options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      )}
                      <div className="text-[8px] uppercase tracking-widest text-white/50 border border-[#E5E4E2]/20 px-2 py-1 bg-white/5">
                        {post.visibility}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-3" />

                  {/* Message */}
                  <p className="text-sm font-light leading-relaxed text-white mb-3 text-[#E5E4E2]/95">
                    {post.message}
                  </p>

                  {/* Venue Card */}
                  {post.venueName && (
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="mb-3 group/venue cursor-pointer rounded-lg border border-white/10 overflow-hidden bg-[#060606]"
                      onClick={() => onVenueClick({ name: post.venueName!, location: post.venueLocation, image: post.venueImage })}
                    >
                      <div className="flex h-20 overflow-hidden">
                        {post.venueImage && (
                          <div
                            className="w-24 h-full bg-cover bg-center flex-shrink-0 grayscale group-hover/venue:grayscale-0 transition-all duration-700 group-hover/venue:scale-110"
                            style={{ backgroundImage: `url(${post.venueImage})` }}
                          />
                        )}
                        <div className="flex-1 p-3 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-white group-hover/venue:text-amber-500 transition-all">{post.venueName}</h3>
                            {post.venueTime && <p className="text-[9px] text-white/50 uppercase tracking-widest mt-0.5">{post.venueTime}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            {post.venueLocation && <span className="text-[9px] text-white/40">{post.venueLocation}</span>}
                            <ArrowUpRight size={12} className="text-white/30 group-hover/venue:text-amber-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mb-3" />

                  {/* Stats & CTA */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-[9px] uppercase tracking-widest text-white/60">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                        className="flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all"
                        aria-label={post.likedByUser ? 'Unlike' : 'Like'}
                      >
                        <Heart
                          size={12}
                          className={post.likedByUser ? 'text-red-500' : 'text-[#E5E4E2]/40'}
                          fill={post.likedByUser ? 'currentColor' : 'none'}
                        />
                        <span className={post.likedByUser ? 'text-red-400' : ''}>{post.likes}</span>
                      </button>
                      {post.peopleGoing !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <Users size={10} className="text-[#E5E4E2]/40" />
                          <span>{post.peopleGoing} Going</span>
                        </div>
                      )}
                      {post.totalCost !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#E5E4E2]/60">${post.totalCost.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {post.venueName && (
                      <button
                        onClick={() => onVenueClick({ name: post.venueName!, location: post.venueLocation, image: post.venueImage })}
                        className="text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2] border border-[#E5E4E2]/40 px-3 py-1.5 hover:bg-white/5 hover:border-[#E5E4E2]/70 transition-all active:scale-95"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </motion.div>
                );
              })
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
                        className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 border border-[#1DB954]/20 text-[#1DB954]/70 bg-[#1DB954]/5"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Top Artists */}
                {spotifyTopArtists.length > 0 && (
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
                        <p className="text-[7px] font-bold uppercase tracking-wider text-white/60 truncate">{artist.name}</p>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Floating Compose Button */}
      <button
        onClick={() => setComposing(true)}
        className="fixed bottom-28 right-6 z-40 w-14 h-14 bg-white text-black flex items-center justify-center shadow-2xl shadow-white/20 hover:scale-105 active:scale-95 transition-transform"
        aria-label="Post to social"
      >
        <PenLine size={20} />
      </button>

      {/* Compose Modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setComposing(false)} />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full bg-[#0a0a0a] border-t border-white/10 rounded-t-2xl p-6 space-y-5 z-10"
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-white/20 rounded-full" />

            {/* Header */}
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Post to Social</h3>
              <button onClick={() => setComposing(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Message */}
            <textarea
              autoFocus
              value={postMessage}
              onChange={e => setPostMessage(e.target.value)}
              placeholder="What's happening tonight..."
              maxLength={280}
              rows={3}
              className="w-full bg-transparent text-white text-sm placeholder-white/20 resize-none outline-none border-b border-white/10 pb-3 leading-relaxed"
            />
            <div className="text-right text-[9px] text-white/20 -mt-3">{postMessage.length}/280</div>

            {/* Venue + People row */}
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-2 border border-white/10 px-3 py-2.5">
                <MapPin size={12} className="text-white/30 flex-shrink-0" />
                <input
                  value={postVenue}
                  onChange={e => setPostVenue(e.target.value)}
                  placeholder="Venue (optional)"
                  className="bg-transparent text-white text-[11px] placeholder-white/20 outline-none w-full"
                />
              </div>
              <div className="flex items-center gap-2 border border-white/10 px-3 py-2.5 w-28">
                <Users size={12} className="text-white/30 flex-shrink-0" />
                <input
                  value={postPeople}
                  onChange={e => setPostPeople(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Going"
                  inputMode="numeric"
                  className="bg-transparent text-white text-[11px] placeholder-white/20 outline-none w-full"
                />
              </div>
            </div>

            {/* Visibility + Post row */}
            <div className="flex items-center justify-between">
              {/* Visibility toggle */}
              <div className="flex gap-2">
                {([['PUBLIC', <Globe size={11} />, 'Public'], ['FRIENDS', <UserCheck size={11} />, 'Friends'], ['PRIVATE', <Lock size={11} />, 'Only me']] as const).map(([val, icon, label]) => (
                  <button
                    key={val}
                    onClick={() => setPostVisibility(val)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-[9px] font-bold uppercase tracking-widest transition-all ${
                      postVisibility === val
                        ? 'border-white text-white bg-white/10'
                        : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/50'
                    }`}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>

              {/* Post button */}
              <button
                onClick={submitPost}
                disabled={!postMessage.trim() || posting}
                className="px-6 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 hover:bg-white/90 active:scale-95 transition-all flex items-center gap-2"
              >
                {posting ? <Loader2 size={12} className="animate-spin" /> : null}
                Post
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

