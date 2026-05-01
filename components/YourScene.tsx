'use client';

import { useState, useEffect } from 'react';
import { Loader2, MapPin, Music, Disc3, Sparkles, TrendingUp, RefreshCw, SlidersHorizontal, Heart, Ticket, Calendar, Users, ChevronRight, MessageCircle, PenLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { TasteEditor } from './TasteEditor';
import { BlendView } from './BlendView';
import { ImageWithFallback } from './figma/ImageWithFallback';

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
  image_url?: string | null;
  ra_url?: string | null;
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

// Subset of SocialFeed's SocialPost type — just what the rail needs
interface CommunityPost {
  id: string;
  userName: string;
  userTier?: string;
  userAvatar?: string;
  message: string;
  venueName?: string;
  venueImage?: string;
  peopleGoing?: number;
  likes: number;
  createdAt: string;
}

const TG_BASE = `https://${projectId}.supabase.co/functions/v1/tg3`;
const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

export function YourScene({
  onEventClick,
  onOpenSocial,
}: {
  onEventClick?: (eventId: string) => void;
  /** Opens the full Community page (formerly the Social tab). When undefined, the rail's CTAs are hidden. */
  onOpenSocial?: () => void;
} = {}) {
  const { userId } = useAuth();
  const [scene, setScene] = useState<YourSceneData | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [crew, setCrew] = useState<CrewSuggestion[]>([]);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
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
      const [sRes, rRes, cRes, comRes] = await Promise.all([
        fetch(`${TG_BASE}/your-scene?userId=${userId}`, { headers }),
        fetch(`${TG_BASE}/recommendations?userId=${userId}${city ? `&city=${encodeURIComponent(city)}` : ''}&limit=10`, { headers }),
        fetch(`${TG_BASE}/crew-suggestions?userId=${userId}&limit=8`, { headers }),
        fetch(`${SERVER_BASE}/social/feed?userId=${userId}&limit=8`, { headers }),
      ]);
      const sceneData = sRes.ok ? await sRes.json() : null;
      if (sceneData) setScene(sceneData);
      if (rRes.ok) setRecs(await rRes.json());
      if (cRes.ok) setCrew(await cRes.json());
      if (comRes.ok) {
        const data = await comRes.json();
        const posts = (Array.isArray(data) ? data : data.posts || []).map((p: any): CommunityPost => ({
          id: p.id,
          userName: p.user_name || 'Anonymous',
          userTier: p.user_tier,
          userAvatar: p.user_avatar,
          message: p.message || '',
          venueName: p.venue_name,
          venueImage: p.venue_image,
          peopleGoing: p.people_going,
          likes: typeof p.likes === 'number' ? p.likes : 0,
          createdAt: p.created_at || new Date().toISOString(),
        }));
        setCommunity(posts);
      }

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

  // Hero = first recommendation with an image, fallback to first overall
  const heroRec = recs.find(r => r.image_url) ?? recs[0] ?? null;
  // Grid items below the hero (skip the hero, take next)
  const gridRecs = heroRec
    ? recs.filter(r => r !== heroRec).slice(0, 8)
    : recs.slice(0, 8);

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
    catch { return iso.slice(0, 10); }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white relative pb-24">
      {/* ── FLOATING FILTER BAR ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-4 pb-2"
        style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 bg-zinc-950/80 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/10 shadow-2xl">
          {/* City */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MapPin size={11} className="text-white/40" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 capitalize">
              {city || 'Worldwide'}
            </span>
          </div>

          <div className="w-px h-4 bg-white/15 flex-shrink-0" />

          {/* Density chip */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Sparkles size={10} className="text-white/40 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-white/60 truncate">
              {densityLabel}
            </span>
            <span className="text-[10px] text-white/30 tabular-nums flex-shrink-0">
              · {scene?.edge_count ?? 0}
            </span>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setBlendOpen(true)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Blend with friend"
          >
            <Heart size={11} /> Blend
          </button>
          <button
            onClick={() => setTasteEditorOpen(true)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Refine taste"
          >
            <SlidersHorizontal size={11} /> Refine
          </button>
          <button
            onClick={() => fetchAll()}
            disabled={refreshing}
            className="flex-shrink-0 p-1 text-white/40 hover:text-white transition-colors disabled:opacity-30"
            aria-label="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── HERO RECOMMENDATION ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {heroRec && (
          <motion.button
            key={heroRec.event_id ?? heroRec.event_canonical_key ?? 'hero'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => heroRec.event_id && onEventClick?.(heroRec.event_id)}
            className="relative mx-4 mt-3 rounded-2xl overflow-hidden cursor-pointer text-left w-[calc(100%-2rem)]"
            style={{ minHeight: 280 }}
          >
            <div className="absolute inset-0">
              {heroRec.image_url ? (
                <ImageWithFallback
                  src={heroRec.image_url}
                  alt={heroRec.event_title ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#0d0d0d] to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>

            <div className="relative z-10 p-6 flex items-end min-h-[280px]">
              <div className="flex gap-4 items-end w-full">
                {heroRec.image_url && (
                  <div className="flex-shrink-0 w-24 rounded-xl overflow-hidden shadow-2xl border border-white/10" style={{ aspectRatio: '3/4' }}>
                    <ImageWithFallback src={heroRec.image_url} alt={heroRec.event_title ?? ''} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#E5E4E2] mb-1">
                    Top match {city ? `in ${city}` : 'for you'}
                  </p>
                  <h2 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                    {heroRec.event_title ?? '(untitled)'}
                  </h2>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calendar size={10} /> {fmtDate(heroRec.start_time)}
                    {heroRec.venue_name && (<><span className="text-white/30">·</span> {heroRec.venue_name}</>)}
                  </p>
                  {heroRec.match_reasons && heroRec.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {heroRec.match_reasons.slice(0, 3).map((r) => (
                        <span key={r} className="text-[9px] uppercase tracking-wider text-white/70 bg-white/10 backdrop-blur-sm rounded-full px-2 py-0.5">
                          {r.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {heroRec.ra_url && (
                      <a
                        href={heroRec.ra_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full hover:bg-white/90 transition-colors active:scale-95"
                      >
                        <Ticket size={11} /> Tickets
                      </a>
                    )}
                    {typeof heroRec.match_score === 'number' && (
                      <span className="text-[10px] text-white/50 tabular-nums">
                        ×{heroRec.match_score.toFixed(2)} match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── EMPTY STATE (no signal) ─────────────────────────────────────────── */}
      {signalDensity === 0 && !heroRec && (
        <div className="mx-4 mt-3 rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/10 p-6 text-center">
          <Sparkles className="w-5 h-5 mx-auto mb-2 text-white/40" />
          <p className="text-[13px] text-white mb-1">No signal yet</p>
          <p className="text-[11px] text-white/50 leading-relaxed">
            Connect Spotify, book a table, or post a night out to start building your scene.
          </p>
        </div>
      )}

      {/* ── TOP GENRES ─────────────────────────────────────────────────────── */}
      {(scene?.top_genres?.length ?? 0) > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Disc3 className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Top genres</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scene!.top_genres.slice(0, 12).map((g, i) => (
              <span
                key={`${g.name}-${i}`}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-white/85 capitalize"
              >
                {g.label ?? g.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── TOP ARTISTS ────────────────────────────────────────────────────── */}
      {(scene?.top_artists?.length ?? 0) > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Top artists</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scene!.top_artists.slice(0, 12).map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-white/85"
              >
                {a.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── TOP VENUES ─────────────────────────────────────────────────────── */}
      {(scene?.top_venues?.length ?? 0) > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Top venues</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {scene!.top_venues.slice(0, 4).map((v, i) => (
              <div
                key={`${v.name}-${i}`}
                className="rounded-2xl bg-white/[0.04] border border-white/10 p-4"
              >
                <div className="text-[13px] text-white truncate">{v.name}</div>
                {v.city && <div className="text-[10px] text-white/40 capitalize mt-0.5">{v.city}</div>}
                <div className="text-[10px] text-white/50 tabular-nums mt-1">×{Number(v.weight).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── MORE RECOMMENDATIONS GRID ─────────────────────────────────────── */}
      {gridRecs.length > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
              {heroRec ? 'More for you' : 'Recommended'}
            </h2>
          </div>
          <div className="space-y-2">
            {gridRecs.map((r, i) => (
              <button
                key={r.event_id ?? r.event_canonical_key ?? i}
                onClick={() => r.event_id && onEventClick?.(r.event_id)}
                className="w-full text-left rounded-2xl overflow-hidden bg-white/[0.03] border border-white/8 hover:border-white/20 hover:bg-white/[0.06] transition group"
              >
                <div className="flex items-stretch">
                  {/* Left thumbnail (or gradient if no image) */}
                  <div className="w-24 flex-shrink-0 relative overflow-hidden">
                    {r.image_url ? (
                      <ImageWithFallback
                        src={r.image_url}
                        alt={r.event_title ?? ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                        <Music size={16} className="text-white/30" />
                      </div>
                    )}
                  </div>
                  {/* Right content */}
                  <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[13px] text-white truncate group-hover:text-white">{r.event_title ?? '(untitled)'}</div>
                      <div className="text-[10px] text-white/50 truncate mt-0.5 flex items-center gap-1.5">
                        {r.start_time && (<><Calendar size={9} /> {fmtDate(r.start_time)}</>)}
                        {(r.venue_name || r.city) && (
                          <>
                            <span className="text-white/20">·</span>
                            <span className="capitalize truncate">{r.venue_name ?? r.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      {r.match_reasons && r.match_reasons.length > 0 ? (
                        <div className="text-[9px] uppercase tracking-wider text-white/40 truncate">
                          {r.match_reasons.slice(0, 2).join(' · ').replace(/_/g, ' ')}
                        </div>
                      ) : <span />}
                      {typeof r.match_score === 'number' && (
                        <div className="text-[10px] text-white/50 tabular-nums shrink-0">
                          ×{r.match_score.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-white/20 self-center mr-2 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── PEOPLE YOUR SPEED ──────────────────────────────────────────────── */}
      {crew.length > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-white/60" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">People your speed</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {crew.slice(0, 8).map((p, i) => {
              const pid = p.person_id ?? `crew-${i}`;
              const displayName = p.name?.trim() || (typeof pid === 'string' ? `${pid.slice(0, 8)}…` : 'Member');
              const initials =
                p.name?.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
              return (
                <div
                  key={pid}
                  className="flex-shrink-0 w-32 rounded-2xl bg-white/[0.04] border border-white/10 p-3 text-center"
                >
                  <div className="w-12 h-12 rounded-full mx-auto mb-2 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[12px] font-bold text-white/60">{initials}</span>
                    )}
                  </div>
                  <div className="text-[12px] text-white truncate">{displayName}</div>
                  {p.tier && (
                    <div className="text-[8px] uppercase tracking-[0.2em] text-white/40 mt-0.5 truncate">{p.tier}</div>
                  )}
                  {typeof p.score === 'number' && (
                    <div className="text-[10px] text-white/50 tabular-nums mt-1">×{p.score.toFixed(1)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── COMMUNITY — recent posts + crew activity ─────────────────────── */}
      {community.length > 0 && (
        <section className="mx-4 mt-6">
          <div className="flex items-end justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-white/60" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Community</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {onOpenSocial && (
                <button
                  onClick={onOpenSocial}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Compose post"
                >
                  <PenLine size={11} /> Post
                </button>
              )}
              {onOpenSocial && (
                <button
                  onClick={onOpenSocial}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="See all community posts"
                >
                  See all <ChevronRight size={11} />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {community.slice(0, 8).map((p) => {
              const initials = p.userName.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '??';
              return (
                <button
                  key={p.id}
                  onClick={onOpenSocial}
                  className="flex-shrink-0 w-64 rounded-2xl border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.06] transition-colors text-left overflow-hidden"
                >
                  {/* Venue image header (if present) */}
                  {p.venueImage && (
                    <div className="relative h-24 overflow-hidden">
                      <img src={p.venueImage} alt={p.venueName ?? ''} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      {p.venueName && (
                        <div className="absolute bottom-2 left-3 right-3 z-10">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white truncate">{p.venueName}</p>
                        </div>
                      )}
                      {typeof p.peopleGoing === 'number' && p.peopleGoing > 0 && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/15">
                          <Users size={9} className="text-white/80" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-white">{p.peopleGoing} Going</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.userAvatar ? (
                          <img src={p.userAvatar} alt={p.userName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-bold text-white/70">{initials}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">{p.userName}</span>
                      {p.userTier && (
                        <span className="text-[7px] font-bold uppercase tracking-widest text-white/40 border border-white/15 px-1 py-0.5 rounded-full flex-shrink-0">
                          {p.userTier}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/70 leading-snug line-clamp-2">{p.message || (p.venueName ? `is at ${p.venueName}` : '')}</p>
                    {p.likes > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-[9px] text-white/40">
                        <Heart size={9} /> {p.likes}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Modals stay outside the scroll wrapper */}
      {userId && (
        <TasteEditor
          open={tasteEditorOpen}
          onClose={() => setTasteEditorOpen(false)}
          onSaved={() => fetchAll({ skipAutoIngest: true })}
          userId={userId}
        />
      )}
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
