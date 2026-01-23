'use client';

import { Search, Bell, BellOff, Music, MapPin, Calendar, Users, Play, ArrowUpRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { motion } from 'motion/react';
import { useState } from 'react';

const artists = [
  {
    id: 1,
    name: 'Martin Garrix',
    genre: 'Progressive House',
    followers: '245K',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=600&auto=format&fit=crop',
    upcomingShows: [
      {
        venue: 'LIV Miami',
        location: 'South Beach, Miami',
        date: 'Tonight, 11:30 PM',
        distance: '2.3 mi'
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
    upcomingShows: [
      {
        venue: 'E11EVEN Miami',
        location: 'Downtown, Miami',
        date: 'Friday, 11:00 PM',
        distance: '3.1 mi'
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
    upcomingShows: [
      {
        venue: 'Space Miami',
        location: 'Downtown, Miami',
        date: 'Sunday, 12:00 AM',
        distance: '3.5 mi'
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
    upcomingShows: [
      {
        venue: 'Soho Beach House',
        location: 'Mid-Beach, Miami',
        date: 'Saturday, 10:00 PM',
        distance: '4.2 mi'
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
    upcomingShows: [
      {
        venue: 'Story Miami',
        location: 'South Beach, Miami',
        date: 'Tonight, 12:00 AM',
        distance: '2.8 mi'
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
    upcomingShows: [
      {
        venue: 'Brooklyn Mirage',
        location: 'Brooklyn, NY',
        date: 'Friday, 10:00 PM',
        distance: '1.2 mi'
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
    upcomingShows: [
      {
        venue: 'Factory Town',
        location: 'Hialeah, Miami',
        date: 'Saturday, 1:00 AM',
        distance: '8.5 mi'
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
    upcomingShows: [
      {
        venue: 'Factory Town',
        location: 'Hialeah, Miami',
        date: 'Sunday, 10:00 PM',
        distance: '5.1 mi'
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
    upcomingShows: [
      {
        venue: 'Hyde Beach',
        location: 'South Beach, Miami',
        date: 'Tomorrow, 2:00 PM',
        distance: '2.5 mi'
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
    <div className="border-b border-white/10 last:border-0 py-4 group">
      <div className="flex items-center gap-4">
        <Avatar className="w-12 h-12 rounded-none bg-zinc-900 gold-border overflow-hidden">
          {artist.image && (
            <img 
              src={artist.image} 
              alt={artist.name} 
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          )}
          <AvatarFallback className="rounded-none bg-zinc-900 text-[10px] font-bold text-white/40 border-0">
            {artist.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm uppercase tracking-wider truncate text-white group-hover:gold-gradient transition-all">
              {artist.name}
            </h3>
            {artist.trending && (
               <span className="text-[10px] font-bold uppercase tracking-widest text-gold border border-gold/30 px-1 py-0.5">Hot</span>
            )}
          </div>
          <p className="text-[10px] text-white/60 uppercase tracking-widest truncate">{artist.genre}</p>
        </div>

        <button
          onClick={onToggleFollow}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${
            isFollowing 
              ? 'border-white/40 text-white/60 hover:text-white hover:border-white' 
              : 'bg-white text-black border-white hover:bg-white/90 !text-black'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>

      {/* Expandable Upcoming Shows */}
      {expanded && artist.upcomingShows.length > 0 && (
        <div className="mt-4 pl-16 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Upcoming</p>
          {artist.upcomingShows.map((show: any, index: number) => (
            <div key={index} className="bg-zinc-900/50 p-3 border border-white/10 hover:border-gold/40 transition-colors flex items-center justify-between group/show cursor-pointer marble-bg">
               <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-white group-hover/show:gold-gradient transition-all">{show.venue}</h4>
                  <p className="text-[10px] uppercase tracking-widest text-white/70 mt-1">{show.date}</p>
               </div>
               <ArrowUpRight size={14} className="text-white/50 group-hover/show:text-gold transition-colors" />
            </div>
          ))}
          
          <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gold hover:text-gold/70 mt-2">
            <Play size={10} fill="currentColor" />
            <span>Listen on Spotify</span>
          </button>
        </div>
      )}
    </div>
  );
}