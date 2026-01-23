'use client';

import { TrendingUp, Music, MapPin, Users, DollarSign, Star, Calendar, Award, Share2, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { AListLogo } from './AListLogo';

const yearStats = {
  year: 2025,
  nightsOut: 58,
  totalSpend: 31200,
  venuesVisited: 15,
  artistsSeen: 32,
  friendsMet: 210,
  topVenue: {
    name: 'LIV Miami',
    visits: 22,
    spend: 14500
  },
  topArtist: {
    name: 'Solomun',
    shows: 15,
    avatar: 'SO'
  },
  topGenre: 'Deep House / Techno',
  peakMonth: 'December',
  peakMonthNights: 12,
  avgGroupSize: 8,
  longestStreak: 6,
  favoriteDay: 'Friday',
  topCrew: 'Elite Miami District',
  badges: [
    { name: 'Night Owl', description: 'Went out every weekend in a month', icon: '🌙' },
    { name: 'Music Connoisseur', description: 'Saw 30+ different artists', icon: '🎧' },
    { name: 'VIP Elite', description: 'Reached Diamond tier status', icon: '💎' }
  ],
  milestones: [
    { title: 'First A-List Booking', date: 'Jan 15, 2025', venue: 'Story Miami' },
    { title: 'Diamond Status Achieved', date: 'Aug 22, 2025' },
    { title: 'Afterlife Miami Closing Set', date: 'Dec 31, 2025', venue: 'Marine Stadium' }
  ],
  monthlyActivity: [
    { month: 'Jan', nights: 4, spend: 1800 },
    { month: 'Feb', nights: 5, spend: 2200 },
    { month: 'Mar', nights: 7, spend: 3100 },
    { month: 'Apr', nights: 4, spend: 1900 },
    { month: 'May', nights: 6, spend: 2800 },
    { month: 'Jun', nights: 5, spend: 2300 },
    { month: 'Jul', nights: 8, spend: 3900 },
    { month: 'Aug', nights: 9, spend: 4500 },
    { month: 'Sep', nights: 4, spend: 1900 },
    { month: 'Oct', nights: 3, spend: 1200 },
    { month: 'Nov', nights: 5, spend: 2400 },
    { month: 'Dec', nights: 12, spend: 6500 }
  ]
};

export function YearInReview() {
  const maxSpend = Math.max(...yearStats.monthlyActivity.map(m => m.spend));

  return (
    <div className="min-h-screen bg-black pb-20 marble-bg">
      {/* Hero Header */}
      <div className="relative bg-zinc-950 border-b border-white/10 p-10 pt-20 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent)]" />
        </div>
        
        <div className="flex justify-center mb-6">
          <AListLogo variant="icon" size="lg" animated />
        </div>
        <div className="space-y-3 mb-10 relative z-10">
          <h1 className="text-5xl font-light tracking-[0.2em] uppercase gold-gradient">MMXXV</h1>
          <p className="text-xs font-bold tracking-[0.4em] uppercase text-white/40">The Year in Nightlife</p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto relative z-10">
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 space-y-2">
            <p className="text-3xl font-light tracking-tighter">{yearStats.nightsOut}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Nights Out</p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 space-y-2">
            <p className="text-3xl font-light tracking-tighter">${(yearStats.totalSpend / 1000).toFixed(1)}K</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Total Spend</p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 space-y-2">
            <p className="text-3xl font-light tracking-tighter">{yearStats.artistsSeen}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Artists Seen</p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 space-y-2">
            <p className="text-3xl font-light tracking-tighter">{yearStats.venuesVisited}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Venues</p>
          </div>
        </div>

        <div className="mt-10 flex gap-3 justify-center relative z-10">
          <Button className="bg-white text-black hover:bg-zinc-200 h-12 px-8 rounded-none uppercase tracking-widest text-[10px] font-bold !text-black">
            <Share2 size={14} className="mr-2" />
            Export Story
          </Button>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 h-12 px-8 rounded-none uppercase tracking-widest text-[10px] font-bold">
            <Download size={14} className="mr-2" />
            Archive
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-12">
        {/* Top Venue */}
        <div className="bg-zinc-950 border border-white/5 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <Star size={80} className="text-gold" />
          </div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-8">Primary Residency</h3>
          <div className="space-y-6 relative z-10">
            <h2 className="text-4xl font-light uppercase tracking-wide font-serif group-hover:gold-gradient transition-all">{yearStats.topVenue.name}</h2>
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Total Attendance</p>
                <p className="text-2xl font-light">{yearStats.topVenue.visits} Sessions</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Premium Spend</p>
                <p className="text-2xl font-light">${yearStats.topVenue.spend.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Artist */}
        <div className="bg-zinc-950 border border-white/5 p-8">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-8">Sonic Preference</h3>
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 rounded-none gold-border">
              <AvatarFallback className="rounded-none bg-zinc-900 text-2xl font-light text-white">
                {yearStats.topArtist.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-light uppercase tracking-widest">{yearStats.topArtist.name}</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{yearStats.topArtist.shows} Events Attended</p>
              <p className="text-[9px] uppercase tracking-widest text-white/40">Genre: {yearStats.topGenre}</p>
            </div>
          </div>
        </div>

        {/* Activity Visualizer */}
        <div className="space-y-8">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 px-2">Activity Cadence</h3>
          <div className="grid grid-cols-6 gap-2">
            {yearStats.monthlyActivity.map((month, index) => (
              <div key={index} className="space-y-2 flex flex-col items-center">
                <div className="flex-1 w-full bg-zinc-900 border border-white/5 min-h-[80px] relative flex flex-col justify-end">
                   <div 
                    className="w-full bg-white/20 hover:bg-gold transition-colors" 
                    style={{ height: `${(month.nights / 15) * 100}%` }}
                   />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">{month.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badges Earned */}
        <div className="space-y-8">
           <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 px-2">Elite Status</h3>
           <div className="grid grid-cols-1 gap-4">
            {yearStats.badges.map((badge, index) => (
              <div key={index} className="bg-zinc-950 border border-white/5 p-6 flex items-center gap-6 group hover:border-gold/30 transition-all">
                <div className="w-14 h-14 bg-zinc-900 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  {badge.icon}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1">{badge.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 leading-relaxed">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Timeline */}
        <div className="space-y-8">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 px-2">2025 Retrospective</h3>
          <div className="space-y-4 relative">
            <div className="absolute left-[23px] top-4 bottom-4 w-[1px] bg-white/10" />
            {yearStats.milestones.map((milestone, index) => (
              <div key={index} className="flex gap-8 items-start relative">
                <div className="w-12 h-12 border border-white/20 bg-black z-10 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 bg-gold" />
                </div>
                <div className="bg-zinc-950 border border-white/5 p-5 flex-1 hover:border-white/20 transition-all">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2">{milestone.title}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">{milestone.date}</p>
                    {milestone.venue && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gold">{milestone.venue}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="border border-white/10 bg-zinc-950 p-10 text-center space-y-6">
          <h3 className="text-2xl font-light uppercase tracking-widest">Public Dispatch</h3>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 leading-relaxed">
            Allow the community to witness your nightlife legacy
          </p>
          <Button className="w-full bg-white text-black hover:bg-zinc-200 uppercase tracking-widest text-[11px] font-bold h-14 rounded-none !text-black">
            Broadcast Summary
          </Button>
        </div>
      </div>
    </div>
  );
}