'use client';

import { Search, Bell, BellOff, Music, MapPin, Calendar, Users, Play, ArrowUpRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

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
  const [followedArtists, setFollowedArtists] = useState<number[]>(
    artists.filter(a => a.following).map(a => a.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const toggleFollow = (artistId: number) => {
    setFollowedArtists(prev =>
      prev.includes(artistId)
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenre = selectedGenre === 'All' || 
      artist.genre.toLowerCase().includes(selectedGenre.toLowerCase()) ||
      (selectedGenre === 'House' && artist.genre.includes('House')) ||
      (selectedGenre === 'Techno' && artist.genre.includes('Tech')) ||
      (selectedGenre === 'Latin' && artist.genre.includes('Reggaeton'));

    return matchesSearch && matchesGenre;
  });

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10 marble-bg">
        <h1 className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/60 mb-6 gold-gradient">Talent & Events</h1>

        {/* Minimal Search */}
        <div className="relative mb-6 group">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-gold transition-all" size={14} />
          <Input
            type="text"
            placeholder="SEARCH ARTISTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-2 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:border-gold transition-all tracking-[0.2em] text-[11px] font-bold uppercase h-10 w-full"
          />
        </div>

        {/* Genre Filter */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {genres.map((genre, index) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-2 border text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                selectedGenre === genre
                  ? 'bg-white text-black border-white !text-black'
                  : 'bg-transparent text-white/80 border-white/20 hover:border-gold hover:text-gold'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        
        {/* Following Section */}
        {followedArtists.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Following</h2>
            </div>

            <div className="space-y-1">
              {filteredArtists
                .filter(artist => followedArtists.includes(artist.id))
                .map((artist) => (
                  <ArtistRow
                    key={artist.id}
                    artist={artist}
                    isFollowing={true}
                    onToggleFollow={() => toggleFollow(artist.id)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* All Artists */}
        <div className="space-y-6">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Discover</h2>

          <div className="space-y-1">
            {filteredArtists.map((artist, index) => (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <ArtistRow
                  artist={artist}
                  isFollowing={followedArtists.includes(artist.id)}
                  onToggleFollow={() => toggleFollow(artist.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtistRow({ artist, isFollowing, onToggleFollow }: any) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="group platinum-border rounded-sm overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#000504] mb-6 transition-all duration-500"
    >
      {/* Card Header with Image */}
      <div className="relative h-48 overflow-hidden bg-zinc-900 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {artist.image && (
          <img
            src={artist.image}
            alt={artist.name}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        {/* Trending Badge */}
        {artist.trending && (
          <div className="absolute top-4 right-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-3 py-2">
            TRENDING
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
          className={`w-full py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${
            isFollowing
              ? 'border-[#E5E4E2]/40 text-[#E5E4E2] bg-white/5 hover:bg-white/10 hover:border-[#E5E4E2]'
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
                    <p className="text-[9px] text-white/40 mt-2">{show.location}</p>
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