'use client';

import { useState, useEffect } from 'react';
import { X, Music, Music2, Sparkles, Check, Loader2, ChevronRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../utils/AuthContext';

const GENRE_OPTIONS = [
  'House', 'Tech House', 'Deep House', 'Techno', 'EDM', 'Trance',
  'Hip-Hop', 'R&B', 'Trap', 'Drill', 'Reggaeton', 'Latin',
  'Afrobeats', 'Amapiano', 'Dancehall', 'Soca',
  'Pop', 'Indie', 'Rock', 'Alternative',
  'Jazz', 'Soul', 'Funk', 'Disco',
  'Drum & Bass', 'Jungle', 'Garage', 'Dubstep',
  'K-Pop', 'Bachata', 'Salsa', 'Acoustic',
];

const EVENT_TYPE_OPTIONS = [
  'Club Night', 'Rooftop Party', 'Pool Party', 'Brunch & Beats',
  'Live DJ Set', 'Live Band', 'Concert', 'Festival',
  'Warehouse Rave', 'Underground', 'Members Only', 'Industry Night',
  'Comedy Night', 'Drag Show', 'Art & Music', 'Wine & Dine',
  'Day Party', 'After Hours', 'Boat Party', 'Themed Night',
];

interface PreferencesScreenProps {
  onClose: () => void;
}

export function PreferencesScreen({ onClose }: PreferencesScreenProps) {
  const { userId } = useAuth();
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [spotifyGenres, setSpotifyGenres] = useState<string[]>([]);
  const [spotifyArtists, setSpotifyArtists] = useState<{ name: string; image: string | null }[]>([]);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [appleMusicGenres, setAppleMusicGenres] = useState<string[]>([]);
  const [appleMusicArtists, setAppleMusicArtists] = useState<{ name: string; image: string | null }[]>([]);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing preferences
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/server/preferences?userId=${userId}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.genres?.length) setSelectedGenres(new Set(data.genres));
          if (data.eventTypes?.length) setSelectedTypes(new Set(data.eventTypes));
        }
      } catch (_) {}
      setLoadingPrefs(false);
    })();
  }, [userId]);

  // Fetch Spotify taste
  const fetchSpotifyTaste = async () => {
    setLoadingSpotify(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/spotify/top-artists?userId=${userId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSpotifyGenres(data.topGenres || []);
        setSpotifyArtists((data.topArtists || []).slice(0, 6));
        // Auto-select Spotify genres
        const newGenres = new Set(selectedGenres);
        for (const g of (data.topGenres || []).slice(0, 5)) {
          // Match to our genre options (fuzzy)
          const match = GENRE_OPTIONS.find(opt =>
            opt.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(opt.toLowerCase())
          );
          if (match) newGenres.add(match);
        }
        setSelectedGenres(newGenres);
      }
    } catch (_) {}
    setLoadingSpotify(false);
  };

  // Fetch Apple Music taste
  const fetchAppleMusicTaste = async () => {
    setLoadingAppleMusic(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/apple-music/top-artists?userId=${userId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setAppleMusicGenres(data.topGenres || []);
        setAppleMusicArtists((data.topArtists || []).slice(0, 6));
        // Auto-select Apple Music genres (fuzzy match to our options)
        const newGenres = new Set(selectedGenres);
        for (const g of (data.topGenres || []).slice(0, 5)) {
          const match = GENRE_OPTIONS.find(opt =>
            opt.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(opt.toLowerCase())
          );
          if (match) newGenres.add(match);
        }
        setSelectedGenres(newGenres);
      }
    } catch (_) {}
    setLoadingAppleMusic(false);
  };

  const toggleGenre = (g: string) => {
    const next = new Set(selectedGenres);
    next.has(g) ? next.delete(g) : next.add(g);
    setSelectedGenres(next);
  };

  const toggleType = (t: string) => {
    const next = new Set(selectedTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    setSelectedTypes(next);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/preferences?userId=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ genres: [...selectedGenres], eventTypes: [...selectedTypes] }),
        }
      );
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (_) {}
    setSaving(false);
  };

  if (loadingPrefs) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      {/* Header */}
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-white/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold">Personalize</p>
            <h2 className="text-2xl font-serif italic text-white">Your Vibe</h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white"><X size={20} /></button>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        {/* Spotify Import */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Music size={14} className="text-green-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Import from Spotify</h3>
          </div>
          {spotifyArtists.length > 0 ? (
            <div>
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                {spotifyArtists.map((a, i) => (
                  <div key={i} className="flex-shrink-0 text-center w-16">
                    {a.image ? (
                      <img src={a.image} alt={a.name} className="w-14 h-14 rounded-full object-cover mx-auto border border-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/10 mx-auto flex items-center justify-center text-xs font-bold">{a.name[0]}</div>
                    )}
                    <p className="text-[8px] text-white/50 mt-1.5 truncate">{a.name}</p>
                  </div>
                ))}
              </div>
              {spotifyGenres.length > 0 && (
                <div className="mt-3">
                  <p className="text-[8px] uppercase tracking-widest text-white/30 mb-2">Your top genres from Spotify</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spotifyGenres.slice(0, 8).map((g, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] text-green-400 font-medium">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={fetchSpotifyTaste}
              disabled={loadingSpotify}
              className="w-full py-3 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 text-[10px] font-bold uppercase tracking-widest text-[#1DB954] hover:bg-[#1DB954]/20 transition-all flex items-center justify-center gap-2"
            >
              {loadingSpotify ? <Loader2 size={12} className="animate-spin" /> : <Music size={12} />}
              {loadingSpotify ? 'Analyzing...' : 'Import My Music Taste'}
            </button>
          )}
        </div>

        {/* Apple Music Import */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Music2 size={14} className="text-pink-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Import from Apple Music</h3>
          </div>
          {appleMusicArtists.length > 0 ? (
            <div>
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                {appleMusicArtists.map((a, i) => (
                  <div key={i} className="flex-shrink-0 text-center w-16">
                    {a.image ? (
                      <img src={a.image} alt={a.name} className="w-14 h-14 rounded-full object-cover mx-auto border border-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/10 mx-auto flex items-center justify-center text-xs font-bold">{a.name[0]}</div>
                    )}
                    <p className="text-[8px] text-white/50 mt-1.5 truncate">{a.name}</p>
                  </div>
                ))}
              </div>
              {appleMusicGenres.length > 0 && (
                <div className="mt-3">
                  <p className="text-[8px] uppercase tracking-widest text-white/30 mb-2">Your top genres from Apple Music</p>
                  <div className="flex flex-wrap gap-1.5">
                    {appleMusicGenres.slice(0, 8).map((g, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[9px] text-pink-400 font-medium">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={fetchAppleMusicTaste}
              disabled={loadingAppleMusic}
              className="w-full py-3 rounded-full bg-pink-500/10 border border-pink-500/20 text-[10px] font-bold uppercase tracking-widest text-pink-400 hover:bg-pink-500/20 transition-all flex items-center justify-center gap-2"
            >
              {loadingAppleMusic ? <Loader2 size={12} className="animate-spin" /> : <Music2 size={12} />}
              {loadingAppleMusic ? 'Analyzing...' : 'Import My Apple Music Taste'}
            </button>
          )}
        </div>

        {/* Genre Selection */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-purple-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Preferred Genres</h3>
            <span className="text-[8px] text-white/20 ml-auto">{selectedGenres.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map(g => {
              const active = selectedGenres.has(g);
              return (
                <button key={g} onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {active && <Check size={9} className="inline mr-1 -mt-0.5" />}
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Event Type Selection */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-amber-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Event Types You Love</h3>
            <span className="text-[8px] text-white/20 ml-auto">{selectedTypes.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPE_OPTIONS.map(t => {
              const active = selectedTypes.has(t);
              return (
                <button key={t} onClick={() => toggleType(t)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {active && <Check size={9} className="inline mr-1 -mt-0.5" />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#060606] via-[#060606]/95 to-transparent z-30">
        <button
          onClick={savePreferences}
          disabled={saving || saved}
          className="w-full h-14 rounded-full bg-white text-black font-bold text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          {saved ? (
            <><Check size={14} /> Saved</>
          ) : saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <><span>Save Preferences</span><ChevronRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
}
