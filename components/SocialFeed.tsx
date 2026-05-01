'use client';

import { useState, useEffect } from 'react';
import { MapPin, Instagram, Loader2, ExternalLink, Trophy, ArrowUpRight, Users, PenLine, X, Globe, Lock, UserCheck, Heart, Trash2, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion } from 'motion/react';
import { supabase } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const filters = ['All', 'Friends', 'Clubs', 'Lounges'];

interface SocialFeedProps {
  onVenueClick: (venue: { name: string; location?: string; image?: string; time?: string }) => void;
  /**
   * When provided, renders a back chevron in the floating filter bar that calls this handler.
   * Used when SocialFeed is reached from My Scene's Community rail (no longer in bottom nav).
   */
  onBack?: () => void;
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

export function SocialFeed({ onVenueClick, onBack }: SocialFeedProps) {
  const [loading, setLoading] = useState(true);
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
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

  // Fetch trending venues for tonight
  const fetchTrendingVenues = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/venues?limit=5&sort=popularity`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const venues = (Array.isArray(data) ? data : data.venues || []).map((v: any) => {
          // DB stores images under cover_image / logo_image. The legacy mapping
          // referenced a non-existent v.image_url, which silently null'd every
          // tile. Try the real fields first, then fall back to a deterministic
          // dark-club Unsplash photo per venue (hashed by id) so every tile
          // always renders an image — never a placeholder gradient.
          const FALLBACK_IMAGES = [
            'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1571266028243-d220c6582bb1?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1487180144351-b8472da7d491?q=80&w=600&auto=format&fit=crop',
          ];
          const idHash = String(v.id || v.slug || v.name || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
          const fallback = FALLBACK_IMAGES[Math.abs(idHash) % FALLBACK_IMAGES.length];
          return {
            id: v.id,
            name: v.name,
            location: v.location || v.city || '',
            attendees: Math.floor(Math.random() * 100) + 20,
            price: ['$', '$$', '$$$', '$$$$'][Math.floor(Math.random() * 4)],
            image: v.cover_image || v.image_url || v.logo_image || fallback,
          };
        });
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
    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('instagram_handle')
          .eq('id', userId)
          .single();
        setInstagramHandle(data?.instagram_handle ?? null);
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
    <div className="min-h-screen bg-[#060606] text-white pb-32">
      {/* ── V2 FLOATING FILTER BAR ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-4 pb-2"
        style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/10 shadow-2xl">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="flex-shrink-0 -ml-1 mr-1 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowUpRight size={13} className="-rotate-[135deg]" />
            </button>
          )}
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 flex-shrink-0">
            Community
          </span>
          <div className="w-px h-4 bg-white/15 flex-shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
            {filters.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    isActive ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setComposing(true)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Compose post"
          >
            <PenLine size={11} /> Post
          </button>
        </div>
      </div>

      <div className="space-y-12 pt-3">

        {/* Trending Venues — V2 image-forward cards with gradient overlay */}
        {trendingVenues.length > 0 && (
          <div className="space-y-3 px-4">
            <div className="flex items-center gap-2 px-2">
              <Trophy size={14} className="text-amber-500" />
              <h2 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/50">Tonight's Top Venues</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {trendingVenues.map((venue) => (
                <motion.button
                  key={venue.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onVenueClick({ name: venue.name, location: venue.location, image: venue.image })}
                  className="flex-shrink-0 w-56 relative rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-colors text-left"
                  style={{ minHeight: 180 }}
                >
                  <div className="absolute inset-0">
                    {venue.image ? (
                      <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${venue.image})` }} />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  </div>
                  <div className="relative z-10 p-3 flex flex-col justify-end h-[180px]">
                    <h3 className="text-[14px] font-bold uppercase tracking-wider text-white leading-tight">{venue.name}</h3>
                    <p className="text-[9px] text-white/50 uppercase tracking-[0.2em] mt-1">{venue.location}</p>
                    <div className="flex items-center justify-between mt-2 text-[9px] uppercase tracking-widest">
                      <span className="text-amber-400 font-bold">{venue.attendees} Going</span>
                      <span className="text-white/50">{venue.price}</span>
                    </div>
                  </div>
                </motion.button>
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
                  className="relative px-3 py-3 rounded-2xl border border-white/10 bg-zinc-950/60 backdrop-blur-sm hover:border-white/20 mx-4 my-2 group select-none transition-colors"
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800">
                        <AvatarFallback className="bg-[#0a0a0a] text-[9px] font-bold text-[#E5E4E2]">
                          {post.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[12px] font-bold uppercase tracking-wider text-white leading-tight">{post.userName}</span>
                          {post.userTier && (
                            <span className="text-[7px] bg-[#E5E4E2]/10 text-[#E5E4E2] border border-[#E5E4E2]/30 px-1 py-0.5 uppercase tracking-widest font-bold rounded-full">
                              {post.userTier}
                            </span>
                          )}
                        </div>
                        <span className="text-[7px] text-white/40 uppercase tracking-widest">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : post.id); }}
                          className="text-white/40 hover:text-white/80 active:scale-95 transition-all p-1"
                          aria-label="Post options"
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      )}
                      <div className="text-[7px] uppercase tracking-widest text-white/50 border border-[#E5E4E2]/20 px-1.5 py-0.5 bg-white/5 rounded-full">
                        {post.visibility}
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <p className="text-[12px] font-light leading-snug text-white mb-2 text-[#E5E4E2]/95">
                    {post.message}
                  </p>

                  {/* Venue Card — compact */}
                  {post.venueName && (
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="mb-2 group/venue cursor-pointer rounded-lg border border-white/10 overflow-hidden bg-[#060606]"
                      onClick={() => onVenueClick({ name: post.venueName!, location: post.venueLocation, image: post.venueImage })}
                    >
                      <div className="flex h-14 overflow-hidden">
                        {post.venueImage && (
                          <div
                            className="w-16 h-full bg-cover bg-center flex-shrink-0 group-hover/venue:scale-110 transition-transform duration-700"
                            style={{ backgroundImage: `url(${post.venueImage})` }}
                          />
                        )}
                        <div className="flex-1 px-2.5 py-1.5 flex flex-col justify-between">
                          <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white group-hover/venue:text-amber-500 transition-all leading-tight">{post.venueName}</h3>
                            {post.venueTime && <p className="text-[8px] text-white/50 uppercase tracking-widest mt-0.5">{post.venueTime}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            {post.venueLocation && <span className="text-[8px] text-white/40 truncate">{post.venueLocation}</span>}
                            <ArrowUpRight size={11} className="text-white/30 group-hover/venue:text-amber-500 transition-colors flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Stats & CTA — single row, no extra divider */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-[8px] uppercase tracking-widest text-white/60">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                        className="flex items-center gap-1 hover:opacity-80 active:scale-95 transition-all"
                        aria-label={post.likedByUser ? 'Unlike' : 'Like'}
                      >
                        <Heart
                          size={11}
                          className={post.likedByUser ? 'text-red-500' : 'text-[#E5E4E2]/40'}
                          fill={post.likedByUser ? 'currentColor' : 'none'}
                        />
                        <span className={post.likedByUser ? 'text-red-400' : ''}>{post.likes}</span>
                      </button>
                      {post.peopleGoing !== undefined && (
                        <div className="flex items-center gap-1">
                          <Users size={9} className="text-[#E5E4E2]/40" />
                          <span>{post.peopleGoing} Going</span>
                        </div>
                      )}
                      {post.totalCost !== undefined && (
                        <span className="text-[#E5E4E2]/60">${post.totalCost.toLocaleString()}</span>
                      )}
                    </div>
                    {post.venueName && (
                      <button
                        onClick={() => onVenueClick({ name: post.venueName!, location: post.venueLocation, image: post.venueImage })}
                        className="text-[8px] font-bold uppercase tracking-widest text-[#E5E4E2] border border-[#E5E4E2]/40 px-2.5 py-1 rounded-full hover:bg-white/5 hover:border-[#E5E4E2]/70 transition-all active:scale-95"
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

