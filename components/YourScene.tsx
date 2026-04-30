'use client';

import { useState, useEffect } from 'react';
import { Loader2, MapPin, Music, Disc3, Sparkles, TrendingUp, RefreshCw, SlidersHorizontal, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { TasteEditor } from './TasteEditor';
import { BlendView } from './BlendView';

interface YourSceneData {
  edge_count: number;
  source_count: number;
  top_genres: Array<{ name: string; weight: number; label?: string }>;
  top_venues: Array<{ name: string; city: string | null; weight: number }>;
  top_artists: Array<{ name: string; weight: number }>;
}

interface Recommendation {
  event_id?: string;
  event_title?: string;
  event_canonical_key?: string;
  venue_name?: string;
  city?: string;
  start_time?: string;
  match_score?: number;
  match_reasons?: string[];
}

// Matches what tg3 /crew-suggestions actually returns:
//   { name, tier, score, person_id, avatar_url }
// (Earlier shape — person_external_id / shared_venues / affinity_score —
// would crash render with TypeError on the undefined fields.)
interface CrewSuggestion {
  person_id: string;
  name?: string;
  tier?: string;
  score?: number;
  avatar_url?: string | null;
}

const TG_BASE = `https://${projectId}.supabase.co/functions/v1/tg3`;

export function YourScene({ onEventClick }: { onEventClick?: (eventId: string) => void } = {}) {
  const { userId } = useAuth();
  const [scene, setScene] = useState<YourSceneData | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [crew, setCrew] = useState<CrewSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [tasteEditorOpen, setTasteEditorOpen] = useState(false);
  const [blendOpen, setBlendOpen] = useState(false);

  // Pull stored city from local storage (matches existing app pattern)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem('alist_location');
      if (saved) {
        const justCity = saved.split(',')[0]?.trim().toLowerCase();
        if (justCity) setCity(justCity);
      }
    }
  }, []);

  // Try platform ingest if the user has it connected but no taste graph signal yet.
  // Best-effort, silent — failure here just leaves the scene sparse and the user can manually refresh.
  const maybeAutoIngest = async (
    provider: 'spotify' | 'soundcloud',
    headers: Record<string, string>,
  ) => {
    try {
      const probe = await fetch(`${TG_BASE}/${provider}-status?userId=${userId}`, { headers });
      if (!probe.ok) return false;
      const status = await probe.json() as { connected?: boolean; needs_ingest?: boolean; stale?: boolean };
      if (!status.connected) return false;
      if (!status.needs_ingest && !status.stale) return false;
      const ingest = await fetch(`${TG_BASE}/ingest/${provider}?userId=${userId}`, { method: 'POST', headers });
      return ingest.ok;
    } catch {
      return false;
    }
  };

  const fetchAll = async (opts?: { skipAutoIngest?: boolean }) => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const headers = { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey };

      // Initial fetch
      const [sRes, rRes, cRes] = await Promise.all([
        fetch(`${TG_BASE}/your-scene?userId=${userId}`, { headers }),
        fetch(`${TG_BASE}/recommendations?userId=${userId}${city ? `&city=${encodeURIComponent(city)}` : ''}&limit=10`, { headers }),
        fetch(`${TG_BASE}/crew-suggestions?userId=${userId}&limit=8`, { headers }),
      ]);
      const sceneData = sRes.ok ? await sRes.json() : null;
      if (sceneData) setScene(sceneData);
      if (rRes.ok) setRecs(await rRes.json());
      if (cRes.ok) setCrew(await cRes.json());

      // If signal is sparse and we haven't tried this load yet, attempt
      // Spotify FIRST (richer artist/genre data), then SoundCloud as fallback.
      // Either ingest succeeding triggers a single refetch.
      const sparse = !sceneData || ((sceneData.edge_count ?? 0) === 0);
      if (sparse && !opts?.skipAutoIngest) {
        const ingested =
          (await maybeAutoIngest('spotify', headers)) ||
          (await maybeAutoIngest('soundcloud', headers));
        if (ingested) {
          // Refetch scene + recs after ingest
          const [s2, r2] = await Promise.all([
            fetch(`${TG_BASE}/your-scene?userId=${userId}`, { headers }),
            fetch(`${TG_BASE}/recommendations?userId=${userId}${city ? `&city=${encodeURIComponent(city)}` : ''}&limit=10`, { headers }),
          ]);
          if (s2.ok) setScene(await s2.json());
          if (r2.ok) setRecs(await r2.json());
        }
      }
    } catch (e) {
      console.error('YourScene fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, city]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  const signalDensity = (scene?.edge_count ?? 0) + (scene?.source_count ?? 0);
  const densityLabel =
    signalDensity === 0 ? 'No signal yet' :
    signalDensity < 5 ? 'Just starting' :
    signalDensity < 20 ? 'Building' :
    signalDensity < 50 ? 'Strong' : 'Rich';

  return (
    <div className="px-4 pt-6 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-light uppercase tracking-widest text-white">Your Scene</h1>
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">Built from your taste signals</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBlendOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/70 hover:text-white border border-[#E5E4E2]/20 hover:border-[#E5E4E2]/40 transition-colors"
            aria-label="Blend with friend"
          >
            <Heart className="w-3 h-3" />
            Blend
          </button>
          <button
            onClick={() => setTasteEditorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/70 hover:text-white border border-[#E5E4E2]/20 hover:border-[#E5E4E2]/40 transition-colors"
            aria-label="Refine taste"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Refine
          </button>
          <button
            onClick={fetchAll}
            disabled={refreshing}
            className="p-2 text-white/60 hover:text-white transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Signal density */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="marble-bg border border-[#E5E4E2]/10 p-5 mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              <Sparkles className="w-3 h-3" />
              Signal density
            </div>
            <div className="text-[20px] font-light text-white mt-1">{densityLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.3em] text-white/30">edges · sources</div>
            <div className="text-[16px] font-light text-white tabular-nums">
              {scene?.edge_count ?? 0} · {scene?.source_count ?? 0}
            </div>
          </div>
        </div>
        {signalDensity === 0 && (
          <p className="text-[10px] text-white/40 mt-3 leading-relaxed">
            Connect Spotify, book a table, or post about a night out to start building your scene.
          </p>
        )}
      </motion.div>

      {/* Top venues */}
      {(scene?.top_venues?.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Top venues</h2>
          </div>
          <div className="space-y-2">
            {scene!.top_venues.slice(0, 5).map((v, i) => (
              <div
                key={`${v.name}-${i}`}
                className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-[#E5E4E2]/8 hover:border-[#E5E4E2]/15 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-white truncate">{v.name}</div>
                  {v.city && <div className="text-[11px] text-white/40 capitalize">{v.city}</div>}
                </div>
                <div className="text-[11px] text-white/50 tabular-nums shrink-0 ml-3">
                  ×{Number(v.weight).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top artists */}
      {(scene?.top_artists?.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Top artists</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scene!.top_artists.slice(0, 12).map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className="px-2.5 py-1 bg-white/[0.04] border border-white/5 text-[12px] text-white/80"
              >
                {a.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Top genres */}
      {(scene?.top_genres?.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Disc3 className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Top genres</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scene!.top_genres.slice(0, 10).map((g, i) => (
              <span
                key={`${g.name}-${i}`}
                className="px-2.5 py-1 bg-white/[0.04] border border-white/5 text-[12px] text-white/80 capitalize"
              >
                {g.label ?? g.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-white/60" />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Recommended {city ? `in ${city}` : 'for you'}
          </h2>
        </div>
        {recs.length === 0 ? (
          <div className="px-3 py-6 text-center bg-white/[0.02] border border-white/5">
            <p className="text-[12px] text-white/40">
              {signalDensity === 0
                ? 'Add taste signals to unlock personalized recommendations.'
                : 'No matches yet — check back as new events drop.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recs.slice(0, 8).map((r, i) => (
              <button
                key={r.event_id ?? r.event_canonical_key ?? i}
                onClick={() => r.event_id && onEventClick?.(r.event_id)}
                className="w-full text-left px-3 py-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white truncate">{r.event_title ?? '(untitled)'}</div>
                    <div className="text-[11px] text-white/50 truncate">
                      {[r.venue_name, r.city].filter(Boolean).join(' · ')}
                    </div>
                    {r.match_reasons && r.match_reasons.length > 0 && (
                      <div className="text-[10px] text-white/40 mt-1">
                        {r.match_reasons.slice(0, 2).join(' · ')}
                      </div>
                    )}
                  </div>
                  {typeof r.match_score === 'number' && (
                    <div className="text-[10px] text-white/50 tabular-nums shrink-0">
                      {(r.match_score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Crew suggestions — matches tg3 /crew-suggestions response shape */}
      {crew.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">People your speed</h2>
          </div>
          <div className="space-y-2">
            {crew.slice(0, 5).map((p, i) => {
              const pid = p.person_id ?? `crew-${i}`;
              const displayName = p.name?.trim() || (typeof pid === 'string' ? `${pid.slice(0, 8)}…` : 'Member');
              const initials =
                p.name?.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
              return (
                <div
                  key={pid}
                  className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-[#E5E4E2]/8 hover:border-[#E5E4E2]/15 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-white/60">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] text-white truncate">{displayName}</div>
                      {p.tier && (
                        <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-0.5">{p.tier}</div>
                      )}
                    </div>
                  </div>
                  {typeof p.score === 'number' && (
                    <div className="text-[11px] text-white/50 tabular-nums shrink-0">
                      ×{p.score.toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Refine-taste editor — saves to /preferences, then we refetch so the
          re-rank applied by tg3 v6 takes effect immediately. */}
      {userId && (
        <TasteEditor
          open={tasteEditorOpen}
          onClose={() => setTasteEditorOpen(false)}
          onSaved={() => fetchAll({ skipAutoIngest: true })}
          userId={userId}
        />
      )}

      {/* Blend with a friend — events ranked by combined taste, plus
          optional Spotify playlist generation. */}
      {userId && (
        <BlendView
          open={blendOpen}
          onClose={() => setBlendOpen(false)}
          userId={userId}
          city={city}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
