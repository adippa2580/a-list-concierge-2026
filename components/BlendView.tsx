'use client';

/**
 * BlendView
 *
 * Spotify-style "Blend" with another A-List member.
 *
 *  Step 1 — Pick a friend.
 *           Tabs: "Suggested" (tg3 /crew-suggestions, taste-graph matches)
 *           and "My Crew" (members from /server/crews who have userIds).
 *           Crew members without a stored userId are surfaced but shown
 *           non-tappable with an info note.
 *
 *  Step 2 — See the Blend.
 *           Events ranked by combined taste of both users (tg3 /blend).
 *           "Both match" badge on overlap; per-user score breakdown +
 *           shared reasons. CTA at the bottom to spawn a real Spotify
 *           playlist combining both top-tracks (server /spotify/blend-playlist).
 *           Spotify playlist requires both users to have Spotify connected
 *           AND the captain to have the playlist-modify scope (added to
 *           /spotify/login this same release). On a 409 from the playlist
 *           endpoint, prompts re-auth.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Sparkles, Users, ArrowLeft, Music, ExternalLink, Heart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const TG3_BASE    = `https://${projectId}.supabase.co/functions/v1/tg3`;
const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

const headers = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  'Content-Type': 'application/json',
};

interface CrewSuggestion {
  person_id: string;
  name?: string;
  tier?: string;
  score?: number;
  avatar_url?: string | null;
}

interface CrewMember {
  name: string;
  avatar?: string;
  role?: string;
  userId?: string;        // confirmed-via-crew2 members carry their userId
  pending?: boolean;
}

interface CrewListItem {
  id: number;
  name: string;
  emoji?: string;
  members?: CrewMember[];
}

interface BlendEvent {
  event_id?: string;
  event_canonical_key?: string;
  event_title?: string;
  venue_name?: string;
  city?: string;
  start_time?: string;
  image_url?: string;
  ra_url?: string;
  blend_score: number;
  score_a: number;
  score_b: number;
  reasons_a: string[];
  reasons_b: string[];
  shared_reasons: string[];
  both_match: boolean;
}

interface BlendResponse {
  blend: BlendEvent[];
  counts: { both_match: number; only_a: number; only_b: number; total_pool: number };
}

interface BlendViewProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName?: string | null;
  /** Optional city filter (defaults to user's saved location). */
  city?: string | null;
  onEventClick?: (eventId: string) => void;
}

type FriendTab = 'suggested' | 'crew';

export function BlendView({ open, onClose, userId, userName, city, onEventClick }: BlendViewProps) {
  const [friend, setFriend] = useState<{ id: string; name: string; avatar?: string | null } | null>(null);
  const [friendTab, setFriendTab] = useState<FriendTab>('suggested');

  const [suggestions, setSuggestions] = useState<CrewSuggestion[] | null>(null);
  const [crews, setCrews] = useState<CrewListItem[] | null>(null);
  const [loadingPicker, setLoadingPicker] = useState(false);

  const [blend, setBlend] = useState<BlendResponse | null>(null);
  const [loadingBlend, setLoadingBlend] = useState(false);

  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlist, setPlaylist] = useState<{ url: string | null; name: string; track_count: number; provider: 'spotify' | 'soundcloud' } | null>(null);

  // Which streaming platforms both users share — drives the CTA fallback chain.
  const [shared, setShared] = useState<{ spotify: boolean; soundcloud: boolean } | null>(null);

  // Load picker data when sheet opens
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setFriend(null);
    setBlend(null);
    setPlaylist(null);
    setLoadingPicker(true);
    Promise.all([
      fetch(`${TG3_BASE}/crew-suggestions?userId=${userId}&limit=15`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${SERVER_BASE}/crews?userId=${userId}`, { headers }).then(r => r.ok ? r.json() : { crews: [] }),
    ])
      .then(([s, c]) => {
        if (cancelled) return;
        setSuggestions(Array.isArray(s) ? s : []);
        setCrews(Array.isArray(c?.crews) ? c.crews : []);
      })
      .catch(() => { if (!cancelled) { setSuggestions([]); setCrews([]); } })
      .finally(() => { if (!cancelled) setLoadingPicker(false); });
    return () => { cancelled = true; };
  }, [open, userId]);

  // Run the blend once a friend is picked, alongside a probe of which
  // streaming platforms BOTH users have connected. The probe drives which
  // playlist-creation CTA we show (Spotify preferred for fidelity, SC fallback).
  useEffect(() => {
    if (!friend) return;
    let cancelled = false;
    setLoadingBlend(true);
    setPlaylist(null);
    setShared(null);

    const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
    const blendP = fetch(`${TG3_BASE}/blend?userIdA=${userId}&userIdB=${encodeURIComponent(friend.id)}&limit=20${cityParam}`, { headers })
      .then(r => r.ok ? r.json() : null);

    // Status check: probe each platform for both users in parallel.
    type Status = { connected?: boolean };
    const probe = (provider: 'spotify' | 'soundcloud', uid: string) =>
      fetch(`${TG3_BASE}/${provider}-status?userId=${encodeURIComponent(uid)}`, { headers })
        .then(r => r.ok ? r.json() as Promise<Status> : { connected: false } as Status)
        .catch(() => ({ connected: false } as Status));
    const sharedP = Promise.all([
      probe('spotify',    userId),
      probe('spotify',    friend.id),
      probe('soundcloud', userId),
      probe('soundcloud', friend.id),
    ]).then(([sa, sb, ca, cb]) => ({
      spotify:    !!(sa.connected && sb.connected),
      soundcloud: !!(ca.connected && cb.connected),
    }));

    Promise.all([blendP, sharedP])
      .then(([data, sh]) => { if (!cancelled) { setBlend(data); setShared(sh); } })
      .catch(() => { if (!cancelled) { setBlend(null); setShared({ spotify: false, soundcloud: false }); } })
      .finally(() => { if (!cancelled) setLoadingBlend(false); });

    return () => { cancelled = true; };
  }, [friend, userId, city]);

  const crewMembersWithUserIds = useMemo(() => {
    const list: { id: string; name: string; avatar?: string; crewName: string }[] = [];
    for (const cr of crews ?? []) {
      for (const m of cr.members ?? []) {
        if (m.userId && !m.pending) {
          list.push({ id: m.userId, name: m.name, avatar: m.avatar, crewName: cr.name });
        }
      }
    }
    return list;
  }, [crews]);

  const crewMembersWithoutUserIds = useMemo(() => {
    let count = 0;
    for (const cr of crews ?? []) for (const m of cr.members ?? []) if (!m.userId) count++;
    return count;
  }, [crews]);

  const createPlaylist = async (provider: 'spotify' | 'soundcloud') => {
    if (!friend || creatingPlaylist) return;
    setCreatingPlaylist(true);
    try {
      const res = await fetch(`${SERVER_BASE}/${provider}/blend-playlist?userIdA=${userId}&userIdB=${encodeURIComponent(friend.id)}`, {
        method: 'POST', headers,
      });
      const data = await res.json().catch(() => ({}));

      // Spotify-specific scope reconnect prompt
      if (provider === 'spotify' && res.status === 409 && data?.action === 'reconnect_spotify') {
        toast.error('Reconnect Spotify to create Blend playlists', {
          description: 'Disconnect from Profile → Spotify, then connect again. New scope grants playlist creation.',
        });
        return;
      }
      // SoundCloud-specific app-review error — suggest Spotify if available
      if (provider === 'soundcloud' && data?.action === 'soundcloud_app_review_required') {
        toast.error('SoundCloud needs API approval for playlist creation', {
          description: shared?.spotify
            ? "Try the Spotify playlist option instead."
            : 'This is on SoundCloud’s side — we’re working on it.',
        });
        return;
      }
      if (!res.ok) {
        const label = provider === 'spotify' ? 'Spotify' : 'SoundCloud';
        toast.error(data?.error || `Could not create ${label} playlist`);
        return;
      }
      setPlaylist({
        url: data?.playlist?.url ?? null,
        name: data?.playlist?.name ?? 'Blend playlist',
        track_count: data?.playlist?.track_count ?? 0,
        provider,
      });
      toast.success(`Playlist created — ${data?.playlist?.track_count ?? 0} tracks`);
    } catch {
      toast.error(`Could not create ${provider === 'spotify' ? 'Spotify' : 'SoundCloud'} playlist`);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const initials = (n?: string | null) =>
    (n?.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)) || '??';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[56] bg-[#060606] border-t border-[#E5E4E2]/20 max-h-[90vh] flex flex-col"
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0">
              <div className="flex justify-center pt-2 pb-3 flex-shrink-0">
                <div className="w-10 h-1 bg-white/10" />
              </div>

              {/* Header */}
              <div className="px-6 pb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="font-serif text-lg font-light tracking-widest text-white">
                    {friend ? `Blend with ${friend.name}` : 'Blend with a friend'}
                  </h2>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">
                    {friend ? 'Events both of you would love' : 'Pick someone to combine taste with'}
                  </p>
                </div>
                <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition" aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8">
                {/* ── Picker step ─────────────────────────────────────── */}
                {!friend && (
                  <>
                    {/* Tabs */}
                    <div className="flex border border-[#E5E4E2]/15 mb-4">
                      <button
                        onClick={() => setFriendTab('suggested')}
                        className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors ${
                          friendTab === 'suggested' ? 'bg-[#E5E4E2] text-black' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        Suggested
                      </button>
                      <button
                        onClick={() => setFriendTab('crew')}
                        className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors ${
                          friendTab === 'crew' ? 'bg-[#E5E4E2] text-black' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        My Crew
                      </button>
                    </div>

                    {loadingPicker && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={20} className="animate-spin text-white/40" />
                      </div>
                    )}

                    {!loadingPicker && friendTab === 'suggested' && (
                      <>
                        {(suggestions?.length ?? 0) === 0 ? (
                          <div className="bg-white/[0.03] border border-white/5 px-4 py-8 text-center">
                            <Sparkles size={16} className="mx-auto mb-2 text-white/30" />
                            <p className="text-[12px] text-white/50">No suggestions yet</p>
                            <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                              As more A-Listers connect Spotify and book venues, taste-graph matches will appear here.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {suggestions!.map((s, i) => {
                              const display = s.name?.trim() || `${s.person_id.slice(0, 8)}…`;
                              return (
                                <button
                                  key={s.person_id ?? i}
                                  onClick={() => setFriend({ id: s.person_id, name: display, avatar: s.avatar_url })}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-[#E5E4E2]/10 hover:bg-white/[0.06] hover:border-[#E5E4E2]/30 transition text-left"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                      {s.avatar_url
                                        ? <img src={s.avatar_url} alt={display} className="w-full h-full object-cover" />
                                        : <span className="text-[10px] font-bold text-white/60">{initials(display)}</span>}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[13px] text-white truncate">{display}</div>
                                      {s.tier && (
                                        <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-0.5">{s.tier}</div>
                                      )}
                                    </div>
                                  </div>
                                  {typeof s.score === 'number' && (
                                    <div className="text-[10px] text-white/40 tabular-nums shrink-0">×{s.score.toFixed(1)}</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {!loadingPicker && friendTab === 'crew' && (
                      <>
                        {crewMembersWithUserIds.length === 0 ? (
                          <div className="bg-white/[0.03] border border-white/5 px-4 py-8 text-center">
                            <Users size={16} className="mx-auto mb-2 text-white/30" />
                            <p className="text-[12px] text-white/50">No crew members linked to A-List yet</p>
                            <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                              {crewMembersWithoutUserIds > 0
                                ? `You have ${crewMembersWithoutUserIds} crew ${crewMembersWithoutUserIds === 1 ? 'member' : 'members'} added by name only — Blend needs them to have an A-List account. Invite them via Direct Invite to link their account.`
                                : 'Build your crew first, then come back to Blend with them.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {crewMembersWithUserIds.map((m, i) => (
                              <button
                                key={`${m.id}-${i}`}
                                onClick={() => setFriend({ id: m.id, name: m.name })}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-[#E5E4E2]/10 hover:bg-white/[0.06] hover:border-[#E5E4E2]/30 transition text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[10px] font-bold text-white/60">{m.avatar || initials(m.name)}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[13px] text-white truncate">{m.name}</div>
                                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-0.5">in {m.crewName}</div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── Blend results step ──────────────────────────────── */}
                {friend && (
                  <>
                    <button
                      onClick={() => setFriend(null)}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white mb-4"
                    >
                      <ArrowLeft size={11} /> Pick a different friend
                    </button>

                    {/* Both-headers card */}
                    <div className="flex items-center justify-center gap-4 py-4 bg-white/[0.02] border border-white/5 mb-4">
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
                          <span className="text-[10px] font-bold text-white/60">{initials(userName ?? 'You')}</span>
                        </div>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-1.5 max-w-[80px] truncate">You</p>
                      </div>
                      <Heart size={16} className="text-[#E5E4E2]/60" />
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mx-auto overflow-hidden">
                          {friend.avatar
                            ? <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                            : <span className="text-[10px] font-bold text-white/60">{initials(friend.name)}</span>}
                        </div>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-1.5 max-w-[80px] truncate">{friend.name}</p>
                      </div>
                    </div>

                    {loadingBlend && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={20} className="animate-spin text-white/40" />
                      </div>
                    )}

                    {!loadingBlend && blend && (
                      <>
                        {/* Counts strip */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                          <div className="bg-white/[0.03] border border-white/5 py-2">
                            <div className="text-[14px] text-white tabular-nums">{blend.counts.both_match}</div>
                            <p className="text-[8px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Both match</p>
                          </div>
                          <div className="bg-white/[0.03] border border-white/5 py-2">
                            <div className="text-[14px] text-white tabular-nums">{blend.counts.only_a}</div>
                            <p className="text-[8px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Only you</p>
                          </div>
                          <div className="bg-white/[0.03] border border-white/5 py-2">
                            <div className="text-[14px] text-white tabular-nums">{blend.counts.only_b}</div>
                            <p className="text-[8px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Only {friend.name.split(/\s+/)[0]}</p>
                          </div>
                        </div>

                        {/* Events list */}
                        {blend.blend.length === 0 ? (
                          <div className="bg-white/[0.03] border border-white/5 px-4 py-10 text-center">
                            <p className="text-[12px] text-white/50">No upcoming events match either of you yet.</p>
                            <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                              Check back as your taste graphs grow, or remove the city filter to widen the pool.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {blend.blend.map((e, i) => (
                              <button
                                key={e.event_id ?? e.event_canonical_key ?? i}
                                onClick={() => e.event_id && onEventClick?.(e.event_id)}
                                className="w-full text-left bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-[#E5E4E2]/20 transition p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      {e.both_match && (
                                        <span className="text-[8px] uppercase tracking-[0.2em] text-[#E5E4E2] border border-[#E5E4E2]/40 px-1.5 py-0.5">Both match</span>
                                      )}
                                      <span className="text-[10px] text-white/40 tabular-nums">×{e.blend_score.toFixed(1)}</span>
                                    </div>
                                    <div className="text-[13px] text-white truncate">{e.event_title ?? '(untitled)'}</div>
                                    <div className="text-[10px] text-white/50 truncate">
                                      {[e.venue_name, e.city, (e.start_time ?? '').slice(0, 10)].filter(Boolean).join(' · ')}
                                    </div>
                                    {e.shared_reasons.length > 0 && (
                                      <div className="text-[10px] text-white/50 mt-1">
                                        Shared: <span className="text-white/70">{e.shared_reasons.slice(0, 3).join(' · ')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Playlist CTA — Spotify only.
                            SoundCloud taste-graph signal is fully wired (see
                            tg3 /ingest/soundcloud + /soundcloud-status) but
                            SoundCloud's API gates playlist creation behind an
                            app-review flow we haven't completed yet. The
                            /soundcloud/blend-playlist server endpoint stays
                            deployed for when that lands; we just don't expose
                            it in the UI today. */}
                        {shared?.spotify && (
                          <div className="mt-6 border-t border-white/5 pt-5">
                            <div className="flex items-start gap-3 mb-3">
                              <Music size={16} className="text-[#1DB954] mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] text-white">Bonus: spawn a real Spotify playlist</p>
                                <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">
                                  We'll mix your top tracks with {friend.name}'s and drop a fresh playlist on your Spotify.
                                </p>
                              </div>
                            </div>
                            {playlist?.url && playlist.provider === 'spotify' ? (
                              <a
                                href={playlist.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1DB954] text-black text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#1ed760] transition"
                              >
                                <Check size={14} />
                                Open "{playlist.name}" ({playlist.track_count} tracks)
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <button
                                onClick={() => createPlaylist('spotify')}
                                disabled={creatingPlaylist}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1DB954] text-black text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#1ed760] disabled:opacity-30 disabled:cursor-not-allowed transition"
                              >
                                {creatingPlaylist ? (
                                  <><Loader2 size={14} className="animate-spin" /> Creating playlist…</>
                                ) : (
                                  <><Music size={13} /> Create Spotify playlist</>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
