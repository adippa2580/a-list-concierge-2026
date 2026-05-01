'use client';

import { Search, Bell, BellOff, Music, MapPin, Calendar, Users, Play, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const eventRecaps = [
  {
    id: 1,
    artist: 'Sonoshvq',
    venue: 'Soho Beach House',
    date: 'March 15, 2026',
    vibeDescription: 'Electric peak hour set with curated house selection',
    attendanceCount: '340+',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 2,
    artist: 'Charlotte de Witte',
    venue: 'Factory Town',
    date: 'March 13, 2026',
    vibeDescription: 'Hypnotic techno voyage pushing boundaries',
    attendanceCount: '520+',
    image: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 3,
    artist: 'Peggy Gou',
    venue: 'LIV Miami',
    date: 'March 10, 2026',
    vibeDescription: 'Disco-tinged deep house journey',
    attendanceCount: '680+',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop'
  }
];

const tracksOfTheWeek = [
  {
    id: 1,
    trackName: 'Phosphene',
    artist: 'Sonoshvq',
    vibe: 'PEAK HOUR',
    playCount: '3.2K'
  },
  {
    id: 2,
    trackName: 'Berghain',
    artist: 'Charlotte de Witte',
    vibe: 'DEEP CUT',
    playCount: '2.8K'
  },
  {
    id: 3,
    trackName: 'Eyes',
    artist: 'Peggy Gou',
    vibe: 'OPENER',
    playCount: '4.1K'
  },
  {
    id: 4,
    trackName: 'Frequency of Love',
    artist: 'John Summit',
    vibe: 'PEAK HOUR',
    playCount: '3.9K'
  },
  {
    id: 5,
    trackName: 'Motions',
    artist: 'Fisher',
    vibe: 'DEEP CUT',
    playCount: '2.4K'
  },
  {
    id: 6,
    trackName: 'You Can Leave in a Body Bag',
    artist: 'Black Coffee',
    vibe: 'CLOSER',
    playCount: '1.8K'
  }
];

const artists = [
  {
    id: 1,
    name: 'Martin Garrix',
    genre: 'Progressive House',
    followers: '245K',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Martin%20Garrix/artists',
    upcomingShows: [
      {
        venue: 'LIV Miami',
        location: 'South Beach, Miami',
        date: 'Tonight, 11:30 PM',
        distance: '2.3 mi',
        eventUrl: 'https://www.livnightclub.com'
      }
    ],
    following: true,
    trending: true
  },
  {
    id: 2,
    name: 'Tiesto',
    genre: 'Electronic / Dance',
    followers: '189K',
    image: 'https://images.unsplash.com/photo-1670613074622-8c8ba08265ce?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Tiesto/artists',
    upcomingShows: [
      {
        venue: 'E11EVEN Miami',
        location: 'Downtown, Miami',
        date: 'Friday, 11:00 PM',
        distance: '3.1 mi',
        eventUrl: 'https://www.11miami.com'
      }
    ],
    following: true,
    trending: false
  },
  {
    id: 3,
    name: 'John Summit',
    genre: 'Tech House',
    followers: '312K',
    image: 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/John%20Summit/artists',
    upcomingShows: [
      {
        venue: 'Space Miami',
        location: 'Downtown, Miami',
        date: 'Sunday, 12:00 AM',
        distance: '3.5 mi',
        eventUrl: 'https://www.clubspace.com'
      }
    ],
    following: false,
    trending: true
  },
  {
    id: 4,
    name: 'Peggy Gou',
    genre: 'House / Disco',
    followers: '156K',
    image: 'https://images.unsplash.com/photo-1625872778166-7b133d560b82?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Peggy%20Gou/artists',
    upcomingShows: [
      {
        venue: 'Soho Beach House',
        location: 'Mid-Beach, Miami',
        date: 'Saturday, 10:00 PM',
        distance: '4.2 mi',
        eventUrl: 'https://www.sohohouse.com/houses/soho-beach-house'
      }
    ],
    following: true,
    trending: true
  },
  {
    id: 5,
    name: 'Fisher',
    genre: 'Tech House',
    followers: '284K',
    image: 'https://images.unsplash.com/photo-1560443797-0b2389cb632b?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Fisher/artists',
    upcomingShows: [
      {
        venue: 'Story Miami',
        location: 'South Beach, Miami',
        date: 'Tonight, 12:00 AM',
        distance: '2.8 mi',
        eventUrl: 'https://www.storynightclub.com'
      }
    ],
    following: false,
    trending: true
  },
  {
    id: 6,
    name: 'Black Coffee',
    genre: 'Deep House',
    followers: '210K',
    image: 'https://images.unsplash.com/photo-1629869343830-37a495211abf?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Black%20Coffee/artists',
    upcomingShows: [
      {
        venue: 'Brooklyn Mirage',
        location: 'Brooklyn, NY',
        date: 'Friday, 10:00 PM',
        distance: '1.2 mi',
        eventUrl: 'https://www.brooklynmirage.com'
      }
    ],
    following: true,
    trending: false
  },
  {
    id: 7,
    name: 'Charlotte de Witte',
    genre: 'Techno',
    followers: '175K',
    image: 'https://images.unsplash.com/photo-1748867424431-eebe9aadf19f?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Charlotte%20de%20Witte/artists',
    upcomingShows: [
      {
        venue: 'Factory Town',
        location: 'Hialeah, Miami',
        date: 'Saturday, 1:00 AM',
        distance: '8.5 mi',
        eventUrl: 'https://www.factorytownmiami.com'
      }
    ],
    following: false,
    trending: true
  },
  {
    id: 8,
    name: 'Solomun',
    genre: 'Deep House',
    followers: '198K',
    image: 'https://images.unsplash.com/photo-1619241805829-34fb64299391?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Solomun/artists',
    upcomingShows: [
      {
        venue: 'Factory Town',
        location: 'Hialeah, Miami',
        date: 'Sunday, 10:00 PM',
        distance: '5.1 mi',
        eventUrl: 'https://www.factorytownmiami.com'
      }
    ],
    following: false,
    trending: false
  },
  {
    id: 9,
    name: 'Vintage Culture',
    genre: 'Brazilian Bass',
    followers: '142K',
    image: 'https://images.unsplash.com/photo-1764014353572-bcdfce164b73?q=80&w=600&auto=format&fit=crop',
    spotifyUrl: 'https://open.spotify.com/search/Vintage%20Culture/artists',
    upcomingShows: [
      {
        venue: 'Hyde Beach',
        location: 'South Beach, Miami',
        date: 'Tomorrow, 2:00 PM',
        distance: '2.5 mi',
        eventUrl: 'https://www.sbe.com/nightlife/hyde/hyde-beach-miami'
      }
    ],
    following: false,
    trending: true
  }
];

const genres = ['All', 'House', 'Techno', 'EDM', 'Hip-Hop', 'Latin'];

export function ArtistDiscovery() {
  const { userId } = useAuth();
  const [followedArtists, setFollowedArtists] = useState<number[]>(
    artists.filter(a => a.following).map(a => a.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [userArtists, setUserArtists] = useState<typeof artists>([]);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  // Load followed artists and user taste from DB
  useEffect(() => {
    if (!userId || userId === 'default_user') return;

    // Load saved followed artists
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.followedArtists?.length) setFollowedArtists(data.followedArtists);
    }).catch(() => {});

    // Load user taste (Spotify + Apple Music artists) AND their upcoming shows
    // (cross-referenced against Ticketmaster + Bandsintown + SeatGeek server-side).
    fetch(`https://${projectId}.supabase.co/functions/v1/server/events/personalized?userId=${userId}&city=Miami`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setUserGenres(data.userGenres || []);

        // Build a per-artist event map from data.events. Each event already
        // carries `matchedArtist` + `matchedFrom: ['spotify' | 'apple_music']`.
        const eventsByArtist: Record<string, any[]> = {};
        const provenanceByArtist: Record<string, ('spotify' | 'apple_music')[]> = {};
        for (const ev of (data.events || [])) {
          const key = String(ev.matchedArtist || '').toLowerCase();
          if (!key) continue;
          if (!eventsByArtist[key]) eventsByArtist[key] = [];
          if (eventsByArtist[key].length < 5) {
            eventsByArtist[key].push({
              venue: ev.venue?.name || 'Venue TBA',
              location: ev.snippet || '',
              date: new Date(ev.start?.local || Date.now()).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              }),
              distance: '',
              eventUrl: ev.ticketUrl || null,
              source: ev.source || null,
              matchedFrom: Array.isArray(ev.matchedFrom) ? ev.matchedFrom : [],
            });
          }
          provenanceByArtist[key] = Array.from(new Set([
            ...(provenanceByArtist[key] || []),
            ...((ev.matchedFrom as string[]) || []),
          ])) as ('spotify' | 'apple_music')[];
        }

        if (data.artistNames?.length) {
          const userArtistList = data.artistNames.slice(0, 6).map((name: string, i: number) => {
            const lc = name.toLowerCase();
            const provenance = provenanceByArtist[lc] || [];
            return {
              id: 1000 + i,
              name: name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              genre: data.userGenres?.[i % (data.userGenres.length || 1)] || 'Music',
              followers: '',
              image: `https://images.unsplash.com/photo-${1501386761578 + i * 111}?q=80&w=600&auto=format&fit=crop`,
              spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(name)}/artists`,
              upcomingShows: eventsByArtist[lc] || [],
              following: true,
              trending: false,
              fromUserTaste: true,
              fromSpotify: provenance.includes('spotify'),
              fromAppleMusic: provenance.includes('apple_music'),
            };
          });
          setUserArtists(userArtistList);
        }
      }
    }).catch(() => {});
  }, [userId]);

  const toggleFollow = (artistId: number) => {
    setFollowedArtists(prev => {
      const next = prev.includes(artistId)
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId];
      // Save to DB
      fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ followedArtists: next }),
      }).catch(() => {});
      return next;
    });
  };

  // Combine user taste artists + hardcoded artists, then filter
  const allArtists = [...userArtists, ...artists];
  const filteredArtists = allArtists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenre = selectedGenre === 'All' || 
      artist.genre.toLowerCase().includes(selectedGenre.toLowerCase()) ||
      (selectedGenre === 'House' && artist.genre.includes('House')) ||
      (selectedGenre === 'Techno' && artist.genre.includes('Tech')) ||
      (selectedGenre === 'Latin' && artist.genre.includes('Reggaeton'));

    return matchesSearch && matchesGenre;
  });

  // Sort: user taste artists first, then preference-genre matches, then rest
  filteredArtists.sort((a: any, b: any) => {
    const fromTaste = (x: any) => x.fromUserTaste ? 0 : 1;
    if (fromTaste(a) !== fromTaste(b)) return fromTaste(a) - fromTaste(b);
    const genreMatch = (x: any) => {
      const g = x.genre.toLowerCase();
      return userGenres.some(ug => g.includes(ug) || ug.includes(g)) ? 0 : 1;
    };
    return genreMatch(a) - genreMatch(b);
  });

  // ── Hero carousel: top 3 artists (user-taste / trending / first 3) ────────
  const heroArtists = (() => {
    const taste = userArtists.filter(a => (a as any).image).slice(0, 3);
    if (taste.length >= 3) return taste;
    const trending = artists.filter(a => a.trending && a.image).slice(0, 3 - taste.length);
    const merged = [...taste, ...trending];
    if (merged.length >= 3) return merged.slice(0, 3);
    // Fallback: pad with first artists by image
    return [...merged, ...artists.filter(a => a.image && !merged.includes(a))].slice(0, 3);
  })();

  // Auto-advance hero every 6s, pausing on user interaction (drag / dot click)
  useEffect(() => {
    if (heroArtists.length < 2) return;
    const t = setInterval(() => {
      setHeroIndex(i => (i + 1) % heroArtists.length);
    }, 6000);
    return () => clearInterval(t);
  }, [heroArtists.length, heroIndex]);

  const heroArtist = heroArtists[heroIndex] ?? heroArtists[0] ?? null;
  const isHeroFollowing = heroArtist ? followedArtists.includes(heroArtist.id) : false;

  // ── Genre rails: bucket filteredArtists into broad genre groups ──────────
  type Bucket = { key: string; label: string; match: (g: string) => boolean };
  const genreBuckets: Bucket[] = [
    { key: 'house', label: 'House', match: (g) => /house|disco/i.test(g) && !/tech\s*house/i.test(g) },
    { key: 'tech-house', label: 'Tech House', match: (g) => /tech\s*house/i.test(g) },
    { key: 'techno', label: 'Techno', match: (g) => /\btechno\b/i.test(g) },
    { key: 'electronic', label: 'Electronic & Dance', match: (g) => /electronic|edm|dance|progressive|trance|brazilian\s*bass/i.test(g) },
    { key: 'hiphop', label: 'Hip-Hop & Latin', match: (g) => /hip[\s-]?hop|reggaeton|latin/i.test(g) },
  ];

  const forYouArtists = filteredArtists.filter(a =>
    (a as any).fromUserTaste || followedArtists.includes(a.id)
  );

  // Each artist appears in the FIRST matching rail; otherwise lands in "More to Discover"
  const seen = new Set<number>();
  forYouArtists.forEach(a => seen.add(a.id));

  const railRows: { key: string; label: string; artists: typeof filteredArtists }[] = [];
  for (const bucket of genreBuckets) {
    const list = filteredArtists.filter(a => !seen.has(a.id) && bucket.match(a.genre));
    list.forEach(a => seen.add(a.id));
    if (list.length > 0) railRows.push({ key: bucket.key, label: bucket.label, artists: list });
  }
  const leftover = filteredArtists.filter(a => !seen.has(a.id));
  if (leftover.length > 0) railRows.push({ key: 'more', label: 'More to Discover', artists: leftover });

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-32">
      {/* ── V2 FLOATING FILTER BAR ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-4 pb-2"
        style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="bg-zinc-950/80 backdrop-blur-xl rounded-3xl px-3 py-2 border border-white/10 shadow-2xl">
          {/* Top row: title + search */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 flex-shrink-0">
              Talent
            </span>
            <div className="w-px h-4 bg-white/15 flex-shrink-0" />
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" size={12} />
              <input
                type="text"
                placeholder="Search artists, tracks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent pl-7 pr-2 py-1.5 text-[11px] uppercase tracking-wider text-white placeholder:text-white/30 outline-none border-0"
              />
            </div>
          </div>
          {/* Bottom row: genre filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1.5 px-1">
            {genres.map((genre) => {
              const isActive = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    isActive ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HERO CAROUSEL — 3 trending / taste artists ─────────────────────── */}
      {heroArtist && (
        <div className="px-4 pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`hero-${(heroArtist as any).id ?? heroIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="relative rounded-3xl overflow-hidden border border-white/10 cursor-pointer group"
              style={{ height: 280 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50 && heroArtists.length > 1) {
                  setHeroIndex(i => (i + 1) % heroArtists.length);
                } else if (info.offset.x > 50 && heroArtists.length > 1) {
                  setHeroIndex(i => (i - 1 + heroArtists.length) % heroArtists.length);
                }
              }}
            >
              {/* Image */}
              <img
                src={(heroArtist as any).image}
                alt={(heroArtist as any).name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />

              {/* Top-right: trending / taste badges */}
              <div className="absolute top-4 right-4 flex gap-1.5">
                {(heroArtist as any).fromUserTaste && (
                  <span className="text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-full bg-white/15 text-white border border-white/30 backdrop-blur-sm">
                    Your Taste
                  </span>
                )}
                {(heroArtist as any).trending && (
                  <span className="text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-full bg-white text-black">
                    Trending
                  </span>
                )}
              </div>

              {/* Content bottom */}
              <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                <p className="text-[8px] uppercase tracking-[0.3em] text-white/50 mb-1">Featured Artist</p>
                <h2 className="font-serif text-[34px] leading-[1.05] font-light text-white mb-1">
                  {(heroArtist as any).name}
                </h2>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/65 mb-4">
                  {(heroArtist as any).genre}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFollow((heroArtist as any).id); }}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      isHeroFollowing
                        ? 'bg-white/10 text-white border border-white/25 hover:bg-white/20'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    {isHeroFollowing ? '★ Following' : '+ Follow'}
                  </button>
                  {(heroArtist as any).spotifyUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open((heroArtist as any).spotifyUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="flex-shrink-0 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-colors flex items-center gap-1.5"
                    >
                      <Play size={11} fill="currentColor" /> Listen
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          {heroArtists.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-3">
              {heroArtists.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1 rounded-full transition-all ${
                    i === heroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-6 space-y-10">

        {/* SONOVOS HQ FEED */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Sonovos HQ</h2>
              <p className="text-[8px] uppercase tracking-widest text-white/25 mt-0.5">Weekly drops · Event recaps · Artist revenue</p>
            </div>
            <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 border border-[#E5E4E2]/20 text-[#E5E4E2]/40">Live</span>
          </div>

          <div className="space-y-3">
            {[
              {
                type: 'WEEKLY DROP',
                title: 'This Week in Miami',
                body: 'Calvin Harris closes out WMC. LIV tables at 3× baseline. Four artists hitting personal revenue highs on Sonovos.',
                date: 'Apr 14',
                accent: true,
                image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
              },
              {
                type: 'ARTIST REVENUE',
                title: 'John Summit — $48K weekend',
                body: 'Highest single-weekend revenue on the platform. Factory Town + Treehouse back-to-back drove 2.3K group bookings.',
                date: 'Apr 13',
                accent: false,
                image: 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?q=80&w=400&auto=format&fit=crop',
              },
              {
                type: 'EVENT RECAP',
                title: 'Peggy Gou @ LIV — Sold Out',
                body: '680+ attended. 94% of VIP tables pre-booked via A-List. Average group size: 5.2. Repeat booking rate: 61%.',
                date: 'Apr 10',
                accent: false,
                image: 'https://images.unsplash.com/photo-1625872778166-7b133d560b82?q=80&w=400&auto=format&fit=crop',
              },
              {
                type: 'TRENDING',
                title: 'Afro House surging in MIA',
                body: 'Black Coffee, Themba, and Enoo Napa showing 3× streaming velocity this week. Venue demand up 40% YoY.',
                date: 'Apr 9',
                accent: false,
                image: 'https://images.unsplash.com/photo-1629869343830-37a495211abf?q=80&w=400&auto=format&fit=crop',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`relative rounded-2xl border backdrop-blur-sm transition-colors cursor-pointer group overflow-hidden flex ${
                  item.accent
                    ? 'border-white/20 bg-white/5 hover:border-white/30'
                    : 'border-white/10 bg-zinc-950/60 hover:border-white/20'
                }`}
              >
                {/* Left: image */}
                <div className="relative w-24 flex-shrink-0 overflow-hidden">
                  <img
                    src={item.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40" />
                </div>
                {/* Right: content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span className={`text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      item.accent
                        ? 'border-white/25 text-white bg-white/10'
                        : 'border-white/15 text-white/50'
                    }`}>{item.type}</span>
                    <span className="text-[7px] uppercase tracking-widest text-white/25 flex-shrink-0">{item.date}</span>
                  </div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-white mb-1 truncate">
                    {item.title}
                  </h4>
                  <p className="text-[9px] text-white/55 leading-relaxed line-clamp-2">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* EVENT RECAPS Section */}
        <div className="space-y-6">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Event Recaps</h2>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {eventRecaps.map((recap, index) => (
              <motion.div
                key={recap.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex-shrink-0 w-72 rounded-2xl border border-white/10 overflow-hidden hover:border-white/30 group cursor-pointer transition-colors relative"
                style={{ minHeight: 260 }}
              >
                <div className="absolute inset-0">
                  <img src={recap.image} alt={recap.artist} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
                </div>

                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/20">
                  {recap.attendanceCount}
                </div>

                <div className="relative z-10 p-4 flex flex-col justify-end h-full min-h-[260px]">
                  <p className="text-[8px] uppercase tracking-[0.3em] text-white/50 mb-1">{recap.date}</p>
                  <h4 className="text-[14px] font-bold uppercase tracking-wider text-white leading-tight">
                    {recap.artist}
                  </h4>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/60 mt-1">{recap.venue}</p>
                  <p className="text-[10px] text-white/70 leading-relaxed mt-3 line-clamp-2">{recap.vibeDescription}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* TRACKS OF THE WEEK Section */}
        <div className="space-y-6">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Tracks of the Week</h2>

          <div className="space-y-2">
            {tracksOfTheWeek.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group rounded-2xl border border-white/10 p-4 bg-zinc-950/60 backdrop-blur-sm hover:border-white/25 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-white truncate">
                    {track.trackName}
                  </h4>
                  <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1 truncate">{track.artist}</p>

                  <div className="flex gap-2 mt-2 flex-wrap items-center">
                    <span className="inline-block text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                      {track.vibe}
                    </span>
                    <span className="inline-block text-[9px] uppercase tracking-widest text-white/40">
                      {track.playCount} Plays
                    </span>
                  </div>
                </div>

                {/* Play Button — opens Spotify search */}
                <button
                  onClick={() => window.open(`https://open.spotify.com/search/${encodeURIComponent(`${track.trackName} ${track.artist}`)}`, '_blank', 'noopener,noreferrer')}
                  className="flex-shrink-0 w-11 h-11 rounded-full bg-white text-black hover:scale-105 transition-transform flex items-center justify-center"
                  aria-label={`Play ${track.trackName} on Spotify`}
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── FOR YOU rail (followed + user taste) ─────────────────────── */}
        {forYouArtists.length > 0 && (
          <ArtistRail
            label="For You"
            sublabel="Your follows + music-taste matches"
            artists={forYouArtists}
            followedArtists={followedArtists}
            onToggleFollow={toggleFollow}
          />
        )}

        {/* ── GENRE RAILS — one rail per matched bucket ─────────────────── */}
        {railRows.map((row, idx) => (
          <ArtistRail
            key={row.key}
            label={row.label}
            sublabel={`${row.artists.length} artist${row.artists.length === 1 ? '' : 's'}`}
            artists={row.artists}
            followedArtists={followedArtists}
            onToggleFollow={toggleFollow}
            delay={idx * 0.04}
          />
        ))}

        {/* Empty state when search/filter returns nothing */}
        {forYouArtists.length === 0 && railRows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 backdrop-blur-sm p-10 text-center">
            <p className="text-[11px] uppercase tracking-widest text-white/50">No artists match your filter</p>
            <p className="text-[9px] uppercase tracking-widest text-white/30 mt-2">
              Try a different genre or clear the search
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistRow({ artist, isFollowing, onToggleFollow }: any) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="group rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/60 backdrop-blur-sm hover:border-white/25 mb-4 transition-colors"
    >
      {/* Card Header with Image */}
      <div className="relative h-56 overflow-hidden bg-zinc-900 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {artist.image && (
          <img
            src={artist.image}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

        {/* Trending Badge */}
        {artist.trending && (
          <div className="absolute top-3 right-3 bg-white text-black text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
            TRENDING
          </div>
        )}

        {/* Provenance pill — when this artist came from the user's Spotify / Apple Music */}
        {(artist.fromSpotify || artist.fromAppleMusic) && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {artist.fromSpotify && (
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 backdrop-blur-sm flex items-center gap-1">
                <Music size={9} />
                Spotify
              </span>
            )}
            {artist.fromAppleMusic && (
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-full bg-[#FA243C]/20 text-[#FA243C] border border-[#FA243C]/40 backdrop-blur-sm flex items-center gap-1">
                <Music size={9} />
                Apple Music
              </span>
            )}
          </div>
        )}

        {/* Artist Name Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="font-serif text-3xl font-light uppercase tracking-wider text-white mb-2 group-hover:platinum-gradient transition-all">
            {artist.name}
          </h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E5E4E2]/60">{artist.genre}</p>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-4">
        {/* Stats Row */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/50 border-b border-white/10 pb-4">
          <span className="flex items-center gap-2">
            <Users size={12} className="text-[#E5E4E2]/40" />
            {artist.followers} FOLLOWERS
          </span>
          <span className="flex items-center gap-2">
            <Music size={12} className="text-[#E5E4E2]/40" />
            {artist.upcomingShows.length} SHOW
            {artist.upcomingShows.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {/* Follow Button */}
        <button
          onClick={onToggleFollow}
          className={`w-full py-3 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isFollowing
              ? 'border-white/20 text-white bg-white/5 hover:bg-white/10'
              : 'bg-white text-black border-white hover:bg-white/90'
          }`}
        >
          {isFollowing ? '★ Following' : '+ Follow'}
        </button>

        {/* Expandable Shows Section */}
        <AnimatePresence>
          {expanded && artist.upcomingShows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 pt-4 border-t border-white/10"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">UPCOMING SETS</p>
              {artist.upcomingShows.map((show: any, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border border-white/20 hover:border-[#E5E4E2]/50 bg-white/5 hover:bg-white/10 transition-all group/show cursor-pointer flex items-start justify-between gap-4"
                  onClick={() => show.eventUrl && window.open(show.eventUrl, '_blank', 'noopener,noreferrer')}
                >
                  <div className="flex-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-white group-hover/show:platinum-gradient transition-all">{show.venue}</h4>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{show.date}</p>
                    {show.location && (
                      <p className="text-[9px] text-white/40 mt-2 whitespace-pre-line">{show.location}</p>
                    )}
                    {show.source && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {show.source === 'ticketmaster' && (
                          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border bg-[#008CFF]/15 text-[#008CFF] border-[#008CFF]/35">Ticketmaster</span>
                        )}
                        {show.source === 'bandsintown' && (
                          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border bg-[#00CEC8]/15 text-[#00CEC8] border-[#00CEC8]/35">Bandsintown</span>
                        )}
                        {show.source === 'seatgeek' && (
                          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 border bg-[#FF5B49]/15 text-[#FF5B49] border-[#FF5B49]/35">SeatGeek</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight size={14} className="text-white/30 group-hover/show:text-[#E5E4E2] transition-colors flex-shrink-0 mt-1" />
                </motion.div>
              ))}

              <button
                className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#E5E4E2] hover:text-[#E5E4E2]/70 border border-[#E5E4E2]/20 py-3 mt-4 transition-all"
                onClick={() => artist.spotifyUrl && window.open(artist.spotifyUrl, '_blank', 'noopener,noreferrer')}
              >
                <Play size={11} fill="currentColor" />
                Listen on Spotify
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── ArtistRail: horizontal scroll of ArtistTile ────────────────────────────
function ArtistRail({
  label,
  sublabel,
  artists,
  followedArtists,
  onToggleFollow,
  delay = 0,
}: {
  label: string;
  sublabel?: string;
  artists: any[];
  followedArtists: number[];
  onToggleFollow: (id: number) => void;
  delay?: number;
}) {
  if (!artists || artists.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="space-y-3"
    >
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-white">{label}</h2>
          {sublabel && (
            <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
        {artists.map((artist, i) => (
          <ArtistTile
            key={artist.id ?? `${label}-${i}`}
            artist={artist}
            isFollowing={followedArtists.includes(artist.id)}
            onToggleFollow={() => onToggleFollow(artist.id)}
            index={i}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── ArtistTile: image-forward 3:4 tile, follow heart overlay ──────────────
function ArtistTile({
  artist,
  isFollowing,
  onToggleFollow,
  index = 0,
}: {
  artist: any;
  isFollowing: boolean;
  onToggleFollow: () => void;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      className="relative flex-shrink-0 w-40 rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-colors group cursor-pointer"
      style={{ aspectRatio: '3 / 4' }}
      onClick={() => artist.spotifyUrl && window.open(artist.spotifyUrl, '_blank', 'noopener,noreferrer')}
    >
      {/* Image */}
      {artist.image ? (
        <img
          src={artist.image}
          alt={artist.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {/* Top-left: provenance pill */}
      {(artist.fromSpotify || artist.fromAppleMusic) && (
        <div className="absolute top-2 left-2 flex gap-1">
          {artist.fromSpotify && (
            <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full bg-[#1DB954]/25 text-[#1DB954] border border-[#1DB954]/40 backdrop-blur-sm">
              Spotify
            </span>
          )}
          {artist.fromAppleMusic && (
            <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full bg-[#FA243C]/25 text-[#FA243C] border border-[#FA243C]/40 backdrop-blur-sm">
              Apple
            </span>
          )}
        </div>
      )}

      {/* Top-right: trending pill */}
      {artist.trending && (
        <div className="absolute top-2 right-2">
          <span className="text-[7px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full bg-white text-black">
            Hot
          </span>
        </div>
      )}

      {/* Heart toggle bottom-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFollow(); }}
        aria-label={isFollowing ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
        className={`absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${
          isFollowing
            ? 'bg-white text-black hover:scale-105'
            : 'bg-black/40 text-white border border-white/30 hover:bg-white/15 hover:border-white/60'
        }`}
      >
        <span className="text-[12px] leading-none">{isFollowing ? '★' : '+'}</span>
      </button>

      {/* Name + genre bottom-left */}
      <div className="absolute inset-x-0 bottom-0 p-3 pr-10">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-white leading-tight truncate">
          {artist.name}
        </h3>
        <p className="text-[9px] uppercase tracking-widest text-white/55 mt-0.5 truncate">
          {artist.genre}
        </p>
      </div>
    </motion.div>
  );
}