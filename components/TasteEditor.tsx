'use client';

/**
 * TasteEditor
 *
 * Two-step bottom-sheet for refining the user's music taste signal.
 *
 *  Step 1 (Genres)  — every genre on the user's taste graph as a chip.
 *                     Tap to mute/unmute. Continue to Step 2.
 *  Step 2 (Artists) — every top-artist on the user's taste graph.
 *                     Tap to mute/unmute. Save.
 *
 * Save behaviour: POSTs `{ mutedGenres, mutedArtists }` to the existing
 * server /preferences endpoint (free-form merge — these fields just join
 * the existing genres/eventTypes prefs). The tg3 endpoints
 * /your-scene, /recommendations and /crew-suggestions read this on each
 * call and stable-sort items whose ONLY tie to the user's taste is a
 * muted genre or artist down to the bottom.
 *
 * Mute is RE-RANK, not filter — nothing gets dropped from the page.
 *
 * Canonicalisation note: the backend canon()s every reason before checking
 * mute membership ("Hip Hop" -> "hip_hop"). We send the raw labels to the
 * server (so it shows up nicely in the UI) and rely on the backend to
 * canonicalise on read.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Music, Disc3, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const TG3_BASE    = `https://${projectId}.supabase.co/functions/v1/tg3`;
const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

interface SceneGenre  { name: string; weight: number; label?: string }
interface SceneArtist { name: string; weight: number; image_url?: string | null }

interface SceneShape {
  top_genres?: SceneGenre[];
  top_artists?: SceneArtist[];
  muted_genres?: string[];
  muted_artists?: string[];
}

interface TasteEditorProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so the parent page can refetch. */
  onSaved?: () => void;
  userId: string;
}

type Step = 'genres' | 'artists';

const headers = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  'Content-Type': 'application/json',
};

export function TasteEditor({ open, onClose, onSaved, userId }: TasteEditorProps) {
  const [step, setStep] = useState<Step>('genres');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scene, setScene] = useState<SceneShape | null>(null);

  // Local mute state (label-keyed, matching the canonicalisation backend does)
  const [mutedGenreSet, setMutedGenreSet]   = useState<Set<string>>(new Set());
  const [mutedArtistSet, setMutedArtistSet] = useState<Set<string>>(new Set());

  // Load scene + current mutes when opening
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setStep('genres');
    fetch(`${TG3_BASE}/your-scene?userId=${userId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then((data: SceneShape | null) => {
        if (cancelled || !data) return;
        setScene(data);
        setMutedGenreSet(new Set(data.muted_genres ?? []));
        setMutedArtistSet(new Set(data.muted_artists ?? []));
      })
      .catch(() => { /* leave empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, userId]);

  const genres  = useMemo(() => scene?.top_genres  ?? [], [scene]);
  const artists = useMemo(() => scene?.top_artists ?? [], [scene]);

  const toggleGenre = (key: string) =>
    setMutedGenreSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleArtist = (key: string) =>
    setMutedArtistSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    if (saving || !userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${SERVER_BASE}/preferences?userId=${userId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mutedGenres:  Array.from(mutedGenreSet),
          mutedArtists: Array.from(mutedArtistSet),
        }),
      });
      if (!res.ok) {
        toast.error('Could not save taste preferences');
        return;
      }
      const muted = mutedGenreSet.size + mutedArtistSet.size;
      toast.success(
        muted === 0
          ? 'Taste reset — full graph in play'
          : `Saved — ${muted} ${muted === 1 ? 'item' : 'items'} de-prioritised`,
      );
      onSaved?.();
      onClose();
    } catch {
      toast.error('Could not save taste preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const totalMuted = mutedGenreSet.size + mutedArtistSet.size;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            // Anchor ABOVE the bottom-nav so the Save button isn't hidden behind it.
            // Nav height ≈ pt-4 + content + max(1.5rem, env(safe-area-inset-bottom)).
            // Allowing 5rem + safe-area gives the sheet a clean lift over the nav
            // strip on every device.
            className="fixed inset-x-0 z-[56] bg-[#060606] border-t border-[#E5E4E2]/20 max-h-[85vh] flex flex-col"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0">
              <div className="flex justify-center pt-2 pb-3 flex-shrink-0">
                <div className="w-10 h-1 bg-white/10" />
              </div>

              {/* Header */}
              <div className="px-6 pb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="font-serif text-lg font-light tracking-widest text-white">
                    Refine your taste
                  </h2>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">
                    {step === 'genres' ? 'Step 1 of 2 · Genres' : 'Step 2 of 2 · Artists'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="p-2 text-white/50 hover:text-white transition disabled:opacity-30"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Step rail */}
              <div className="px-6 mb-4 flex-shrink-0">
                <div className="flex gap-1.5">
                  <span className={`h-0.5 flex-1 ${step === 'genres' ? 'bg-[#E5E4E2]' : 'bg-[#E5E4E2]/40'}`} />
                  <span className={`h-0.5 flex-1 ${step === 'artists' ? 'bg-[#E5E4E2]' : 'bg-white/10'}`} />
                </div>
              </div>

              {/* Body — scrolls */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6">
                {loading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-white/40" />
                  </div>
                )}

                {!loading && step === 'genres' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-white/60">
                      <Disc3 size={14} />
                      <p className="text-[12px] leading-relaxed">
                        Tap any genre you don't actually want recommendations for.
                        Muted genres get pushed to the bottom — nothing is hidden.
                      </p>
                    </div>

                    {genres.length === 0 ? (
                      <div className="bg-white/[0.03] border border-white/5 px-4 py-8 text-center">
                        <p className="text-[12px] text-white/50">No genres on your taste graph yet</p>
                        <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                          Connect Spotify or pick some vibes during onboarding to populate this.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {genres.map((g, i) => {
                          const key = g.name;
                          const isMuted = mutedGenreSet.has(key);
                          const display = g.label ?? key.replace(/_/g, ' ');
                          return (
                            <button
                              key={`${key}-${i}`}
                              onClick={() => toggleGenre(key)}
                              className={`px-3 py-2 text-[12px] capitalize transition-all border ${
                                isMuted
                                  ? 'bg-transparent border-white/10 text-white/30 line-through'
                                  : 'bg-white/[0.04] border-white/5 text-white/80 hover:border-[#E5E4E2]/30'
                              }`}
                            >
                              {display}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {!loading && step === 'artists' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-white/60">
                      <Music size={14} />
                      <p className="text-[12px] leading-relaxed">
                        Now your top artists. Mute any you don't actually like — they'll
                        stop pulling matching events to the top.
                      </p>
                    </div>

                    {artists.length === 0 ? (
                      <div className="bg-white/[0.03] border border-white/5 px-4 py-8 text-center">
                        <p className="text-[12px] text-white/50">No artists on your taste graph yet</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {artists.map((a, i) => {
                          const key = a.name;
                          const isMuted = mutedArtistSet.has(key);
                          return (
                            <button
                              key={`${key}-${i}`}
                              onClick={() => toggleArtist(key)}
                              className={`px-3 py-2 text-[12px] transition-all border flex items-center gap-2 ${
                                isMuted
                                  ? 'bg-transparent border-white/10 text-white/30 line-through'
                                  : 'bg-white/[0.04] border-white/5 text-white/80 hover:border-[#E5E4E2]/30'
                              }`}
                            >
                              {a.image_url && !isMuted && (
                                <img src={a.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                              )}
                              {a.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  {totalMuted === 0
                    ? 'All in play'
                    : `${totalMuted} muted`}
                </p>

                {step === 'genres' ? (
                  <button
                    onClick={() => setStep('artists')}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E5E4E2] text-black text-[10px] font-bold uppercase tracking-[0.3em] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition"
                  >
                    Next · Artists <ArrowRight size={12} />
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStep('genres')}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 hover:text-white transition disabled:opacity-30"
                    >
                      <ArrowLeft size={12} /> Back
                    </button>
                    <button
                      onClick={save}
                      disabled={saving || loading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E5E4E2] text-black text-[10px] font-bold uppercase tracking-[0.3em] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition"
                    >
                      {saving ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving</>
                      ) : (
                        <><Check size={12} /> Save</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
