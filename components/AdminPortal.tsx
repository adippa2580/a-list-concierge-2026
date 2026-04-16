'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, Music, Instagram, Cloud, CheckCircle, XCircle, MapPin, Calendar, Search, X, Shield } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';

const ADMIN_SECRET = 'alist-admin-2026';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  name: string | null;
  location: string | null;
  member_since: string | null;
  vibe_tags: string[];
  spotify: string | null;
  soundcloud: string | null;
  instagram: string | null;
  has_profile: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminPortal() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'unconfirmed' | 'spotify' | 'instagram' | 'soundcloud'>('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/admin/users?adminKey=${ADMIN_SECRET}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users ?? []);
      setLastRefresh(new Date());
    } catch (e: any) {
      toast.error('Failed to load users', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  // Filter + search
  useEffect(() => {
    let result = users;
    if (filter === 'confirmed') result = result.filter(u => u.email_confirmed);
    if (filter === 'unconfirmed') result = result.filter(u => !u.email_confirmed);
    if (filter === 'spotify') result = result.filter(u => u.spotify);
    if (filter === 'instagram') result = result.filter(u => u.instagram);
    if (filter === 'soundcloud') result = result.filter(u => u.soundcloud);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.location?.toLowerCase().includes(q) ||
        u.spotify?.toLowerCase().includes(q) ||
        u.instagram?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [users, filter, search]);

  const totalConfirmed = users.filter(u => u.email_confirmed).length;
  const totalSpotify = users.filter(u => u.spotify).length;
  const totalInstagram = users.filter(u => u.instagram).length;
  const totalSoundCloud = users.filter(u => u.soundcloud).length;

  const FILTERS = [
    { key: 'all', label: 'All Users' },
    { key: 'confirmed', label: 'Verified' },
    { key: 'unconfirmed', label: 'Unverified' },
    { key: 'spotify', label: 'Spotify' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'soundcloud', label: 'SoundCloud' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-24">

      {/* Header */}
      <div className="px-6 pt-8 pb-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-[#E5E4E2]/50" />
            <span className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-bold">Admin Portal</span>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            {lastRefresh ? `Updated ${timeAgo(lastRefresh.toISOString())}` : 'Refresh'}
          </button>
        </div>
        <h1 className="text-2xl font-serif italic tracking-widest uppercase platinum-gradient">
          Registered Users
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 border-b border-white/5">
        {[
          { label: 'Total', value: users.length, icon: Users },
          { label: 'Verified', value: totalConfirmed, icon: CheckCircle },
          { label: 'Spotify', value: totalSpotify, icon: Music },
          { label: 'Instagram', value: totalInstagram, icon: Instagram },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center py-4 border-r border-white/5 last:border-r-0">
            <Icon size={11} className="text-white/30 mb-1" />
            <span className="text-xl font-light">{loading ? '—' : value}</span>
            <span className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, location..."
            className="w-full bg-transparent border-b border-white/10 pl-5 pr-6 pb-1.5 text-[10px] uppercase tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-0 top-1/2 -translate-y-1/2">
              <X size={10} className="text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-3 py-1 text-[8px] font-bold uppercase tracking-widest border transition-all ${
              filter === key
                ? 'bg-white text-black border-white'
                : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="px-6 pb-3">
        <span className="text-[8px] uppercase tracking-widest text-white/20">
          {loading ? 'Loading...' : `${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}`}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {/* User list */}
      <div className="px-6 space-y-2">
        {loading && users.length === 0 ? (
          <div className="py-16 text-center">
            <RefreshCw size={20} className="mx-auto text-white/10 animate-spin mb-3" />
            <p className="text-[9px] uppercase tracking-widest text-white/20">Loading users...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-white/10">
            <Users size={24} className="mx-auto text-white/10 mb-3" />
            <p className="text-[9px] uppercase tracking-widest text-white/20">No users found</p>
          </div>
        ) : (
          filtered.map(user => (
            <div key={user.id} className="border border-white/5 hover:border-white/15 transition-all p-4 space-y-2">
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {user.email_confirmed
                      ? <CheckCircle size={9} className="text-emerald-400 flex-shrink-0" />
                      : <XCircle size={9} className="text-white/20 flex-shrink-0" />
                    }
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                      {user.name || user.email}
                    </span>
                  </div>
                  {user.name && (
                    <p className="text-[8px] text-white/30 truncate pl-[13px]">{user.email}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[8px] text-white/40">{timeAgo(user.last_sign_in_at)}</p>
                  <p className="text-[7px] text-white/20">last active</p>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 pl-[13px]">
                {user.location && (
                  <span className="flex items-center gap-1 text-[7px] uppercase tracking-wider text-white/30">
                    <MapPin size={7} /> {user.location}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[7px] uppercase tracking-wider text-white/20">
                  <Calendar size={7} /> {timeAgo(user.created_at)}
                </span>
              </div>

              {/* Connectors */}
              <div className="flex items-center gap-2 pl-[13px]">
                <span className={`flex items-center gap-1 text-[7px] uppercase tracking-wider px-1.5 py-0.5 border ${user.spotify ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-white/5 text-white/15'}`}>
                  <Music size={7} /> {user.spotify ?? 'Spotify'}
                </span>
                <span className={`flex items-center gap-1 text-[7px] uppercase tracking-wider px-1.5 py-0.5 border ${user.instagram ? 'border-pink-500/30 text-pink-400 bg-pink-500/5' : 'border-white/5 text-white/15'}`}>
                  <Instagram size={7} /> {user.instagram ?? 'Instagram'}
                </span>
                <span className={`flex items-center gap-1 text-[7px] uppercase tracking-wider px-1.5 py-0.5 border ${user.soundcloud ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' : 'border-white/5 text-white/15'}`}>
                  <Cloud size={7} /> {user.soundcloud ?? 'SoundCloud'}
                </span>
              </div>

              {/* Vibe tags */}
              {user.vibe_tags?.length > 0 && (
                <div className="flex items-center gap-1.5 pl-[13px] flex-wrap">
                  {user.vibe_tags.slice(0, 4).map(tag => (
                    <span key={tag} className="text-[6px] uppercase tracking-widest px-1.5 py-0.5 border border-white/10 text-white/30">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
