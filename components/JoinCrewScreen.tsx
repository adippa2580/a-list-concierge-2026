
/**
 * JoinCrewScreen
 *
 * The screen a friend lands on when they tap an invite link.
 * Four-step flow:
 *   1. Welcome    — preview of the crew, captain, and tier
 *   2. Identify   — first name, phone, IG handle (phone/IG optional but encouraged)
 *   3. Vibe       — city + 3 vibes (multi-select)
 *   4. Spotify    — optional Spotify connect (skippable)
 *   5. Done       — "you're in" + auto-route to YourScene
 *
 * Hits the new `crew2` Supabase edge function:
 *   GET  /crew2/preview/:token
 *   POST /crew2/join
 *
 * On success, also fires a fire-and-forget Spotify ingest if the joiner
 * connected Spotify, so YourScene has data when they land there.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Users, CheckCircle, XCircle, ArrowRight, ChevronLeft,
  Phone, Instagram, MapPin, Sparkles, Music,
} from 'lucide-react';
import { AListLogo } from './AListLogo';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

const CREW2_BASE = `https://${projectId}.supabase.co/functions/v1/crew2`;
const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/server`;
const TG3_BASE = `https://${projectId}.supabase.co/functions/v1/tg3`;

const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  'Content-Type': 'application/json',
};

interface CrewPreview {
  crewName: string;
  crewEmoji: string;
  crewLevel: string;
  memberCount: number;
  expiresAt: number;
  captainName: string | null;
  captainAvatar: string | null;
  pendingFirstName: string | null;
  isDirect: boolean;
}

interface JoinCrewScreenProps {
  token: string;
  onAccepted: () => void;
  onDeclined: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze:   'text-[#CD7F32]',
  Silver:   'text-[#C0C0C0]',
  Gold:     'text-yellow-400',
  Platinum: 'text-[#E5E4E2]',
  Diamond:  'text-[#B9F2FF]',
};

const VIBE_OPTIONS = [
  'electronic', 'house', 'techno',
  'hip-hop', 'r&b', 'indie',
  'rock', 'pop', 'latin',
  'afrobeats', 'jazz', 'soul',
];

const CITY_OPTIONS = [
  'Miami', 'New York', 'Los Angeles', 'Chicago', 'Houston',
  'Dallas', 'London', 'Berlin', 'Ibiza', 'Toronto',
  'Sydney', 'Melbourne', 'Tokyo', 'Paris', 'Amsterdam',
];

type Step = 'loading' | 'welcome' | 'identify' | 'vibe' | 'spotify' | 'done' | 'error';

export function JoinCrewScreen({ token, onAccepted, onDeclined }: JoinCrewScreenProps) {
  const { userId } = useAuth();

  // Preview state
  const [preview, setPreview] = useState<CrewPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState<Step>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form values
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [vibes, setVibes] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);

  // ── Load preview ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${CREW2_BASE}/preview/${token}`, { headers: HEADERS });
        if (!active) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setLoadError(err.error || 'This invite link is invalid or has expired.');
          setStep('error');
          return;
        }
        const data: CrewPreview = await res.json();
        setPreview(data);
        // If the captain pre-filled a name (direct invite), use it
        if (data.pendingFirstName) setFirstName(data.pendingFirstName);
        setStep('welcome');
      } catch (_e) {
        if (!active) return;
        setLoadError('Could not load invite. Try again in a moment.');
        setStep('error');
      }
    })();
    return () => { active = false; };
  }, [token]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const toggleVibe = (v: string) => {
    setVibes(prev =>
      prev.includes(v)
        ? prev.filter(x => x !== v)
        : prev.length >= 5 ? prev : [...prev, v]
    );
  };

  const goNext = () => {
    if (step === 'welcome') setStep('identify');
    else if (step === 'identify') setStep('vibe');
    else if (step === 'vibe') setStep('spotify');
  };

  const goBack = () => {
    if (step === 'identify') setStep('welcome');
    else if (step === 'vibe') setStep('identify');
    else if (step === 'spotify') setStep('vibe');
  };

  // ── Step validity ───────────────────────────────────────────────────────
  const identifyValid = firstName.trim().length > 0;

  // ── Submit join ─────────────────────────────────────────────────────────
  const submitJoin = async (opts?: { connectSpotify?: boolean }) => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const finalCity = (showCustomCity && customCity.trim())
      ? customCity.trim()
      : city.trim();

    // Stash the join intent so it survives any auth round-trip (Spotify OAuth,
    // signup, etc.). App.tsx can pick this up on next boot if the user lands
    // back without an authed session and re-trigger the join with their new
    // userId. Cleared on success.
    try {
      localStorage.setItem('alist_pending_crew_join', JSON.stringify({
        token,
        firstName: firstName.trim(),
        phone: phone.trim() || undefined,
        instagram: instagram.trim().replace(/^@/, '') || undefined,
        city: finalCity || undefined,
        vibes,
        stashedAt: Date.now(),
      }));
    } catch { /* localStorage might be disabled — proceed anyway */ }

    try {
      const res = await fetch(`${CREW2_BASE}/join`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          token,
          joinerUserId: userId || undefined,
          firstName: firstName.trim(),
          phone: phone.trim() || undefined,
          instagram: instagram.trim().replace(/^@/, '') || undefined,
          city: finalCity || undefined,
          vibes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Could not accept invite. Try again.');
        setSubmitting(false);
        return;
      }

      // If they opted into Spotify, kick off the OAuth flow now.
      // Otherwise jump straight to "done".
      if (opts?.connectSpotify && userId) {
        // Fire OAuth — we expect this to redirect away from the page entirely.
        try {
          const sRes = await fetch(`${SERVER_BASE}/spotify/login?userId=${userId}`, { headers: HEADERS });
          if (sRes.ok) {
            const { authUrl } = await sRes.json();
            if (authUrl) {
              window.location.href = authUrl;
              return;
            }
          }
        } catch { /* fall through to done */ }
      }

      // Fire-and-forget tg3 onboarding-seed (live since tg3 v2 — Apr 29).
      // Best-effort; failures are silently swallowed because the user-facing
      // flow has already succeeded and a missed seed only delays personalization.
      if (userId) {
        fetch(`${TG3_BASE}/seed-from-onboarding`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            userId,
            city: finalCity || null,
            vibes,
          }),
        }).catch(() => { /* silent */ });
      }

      // Successful join — clear the stash.
      try { localStorage.removeItem('alist_pending_crew_join'); } catch { /* */ }

      setStep('done');
      // Auto-redirect after a beat
      setTimeout(() => onAccepted(), 1800);
    } catch (_e) {
      setErrorMsg('Network hiccup. Try again.');
      setSubmitting(false);
    }
  };

  // ── Render: shared frame ────────────────────────────────────────────────
  const Frame = ({ children, showBack }: { children: React.ReactNode; showBack?: boolean }) => (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-12 pb-4">
        <div className="w-9 h-9 flex items-center justify-center">
          {showBack ? (
            <button
              onClick={goBack}
              disabled={submitting}
              className="text-white/40 hover:text-white transition disabled:opacity-30"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
        </div>
        <AListLogo variant="splash" size="md" />
        <button
          onClick={onDeclined}
          disabled={submitting}
          className="text-[9px] uppercase tracking-[0.3em] text-white/40 hover:text-white transition disabled:opacity-30"
        >
          Skip
        </button>
      </div>
      <div className="flex-1 flex flex-col px-6 pb-8 max-w-md mx-auto w-full">
        {children}
      </div>
    </div>
  );

  // ── Loading ─────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <Loader2 size={24} className="text-[#E5E4E2]/40 animate-spin" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#060606] flex flex-col items-center justify-center px-6">
        <XCircle size={36} className="text-red-400 mb-4" />
        <h2 className="font-serif text-xl font-light tracking-widest text-white mb-2 text-center">Invite Unavailable</h2>
        <p className="text-[11px] text-white/50 text-center mb-8 max-w-xs leading-relaxed">{loadError}</p>
        <button
          onClick={onDeclined}
          className="px-8 h-12 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em]"
        >
          Continue
        </button>
      </div>
    );
  }

  // ── Welcome ─────────────────────────────────────────────────────────────
  if (step === 'welcome' && preview) {
    const levelClass = LEVEL_COLORS[preview.crewLevel] ?? 'text-[#E5E4E2]';
    return (
      <Frame>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col justify-center"
        >
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 text-center mb-2">
            {preview.captainName ? `${preview.captainName} invited you to` : 'You\'ve been invited to'}
          </p>
          <h1 className="font-serif text-3xl font-light text-center tracking-widest mb-1">
            {preview.crewEmoji} {preview.crewName}
          </h1>
          <p className={`text-[10px] font-bold uppercase tracking-[0.4em] text-center mb-10 ${levelClass}`}>
            {preview.crewLevel} Crew
          </p>

          {/* Captain + member count */}
          <div className="marble-bg border border-[#E5E4E2]/15 p-5 mb-8">
            <div className="flex items-center gap-4">
              {preview.captainAvatar ? (
                <img src={preview.captainAvatar} alt="" className="w-12 h-12 rounded-full object-cover border border-[#E5E4E2]/20" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#E5E4E2]/10 border border-[#E5E4E2]/20 flex items-center justify-center">
                  <Users size={18} className="text-[#E5E4E2]/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Captain</p>
                <p className="text-[14px] text-white truncate">{preview.captainName ?? 'A friend'}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Members</p>
                <p className="text-[16px] font-light tabular-nums">{preview.memberCount}</p>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-white/60 text-center leading-relaxed mb-8">
            ALIST is a private nightlife concierge. Your crew unlocks group bookings,
            VIP table service, and personalized recommendations from your shared taste.
          </p>

          <button
            onClick={goNext}
            className="w-full h-14 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            Accept Invite
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onDeclined}
            className="w-full mt-3 py-3 text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-white/70 transition"
          >
            Not Now
          </button>
        </motion.div>
      </Frame>
    );
  }

  // ── Identify ────────────────────────────────────────────────────────────
  if (step === 'identify') {
    return (
      <Frame showBack>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="mb-8">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-2">Step 1 of 3</p>
            <h2 className="font-serif text-2xl font-light tracking-widest mb-2">Who are you?</h2>
            <p className="text-[12px] text-white/60 leading-relaxed">
              Just a first name and how to reach you. Phone or Instagram — pick one (or both).
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">
                First name <span className="text-[#E5E4E2]">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={40}
                autoFocus
                className="w-full bg-transparent border border-white/10 px-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">
                Phone <span className="text-white/30 normal-case tracking-normal text-[10px]">(recommended)</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 305 555 0123"
                  className="w-full bg-transparent border border-white/10 pl-11 pr-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">
                Instagram handle
              </label>
              <div className="relative">
                <Instagram size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E1306C]" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@yourhandle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-transparent border border-white/10 pl-11 pr-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={!identifyValid}
            className="w-full h-14 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed mt-auto"
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </motion.div>
      </Frame>
    );
  }

  // ── Vibe ────────────────────────────────────────────────────────────────
  if (step === 'vibe') {
    return (
      <Frame showBack>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="mb-6">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-2">Step 2 of 3</p>
            <h2 className="font-serif text-2xl font-light tracking-widest mb-2">Your scene</h2>
            <p className="text-[12px] text-white/60 leading-relaxed">
              Pick a city and up to 5 vibes. We'll use this to surface events you'll actually want.
            </p>
          </div>

          {/* City picker */}
          <div className="mb-6">
            <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 flex items-center gap-1.5">
              <MapPin size={11} /> Home city
            </label>
            <div className="flex flex-wrap gap-2">
              {CITY_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => { setCity(c); setShowCustomCity(false); }}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all border ${
                    city === c && !showCustomCity
                      ? 'bg-[#E5E4E2] text-black border-[#E5E4E2]'
                      : 'border-white/10 text-white/60 hover:border-[#E5E4E2]/40 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
              <button
                onClick={() => { setShowCustomCity(true); setCity(''); }}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all border ${
                  showCustomCity
                    ? 'bg-[#E5E4E2] text-black border-[#E5E4E2]'
                    : 'border-white/10 text-white/60 hover:border-[#E5E4E2]/40 hover:text-white'
                }`}
              >
                Other
              </button>
            </div>
            {showCustomCity && (
              <input
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Type your city"
                autoFocus
                className="mt-3 w-full bg-transparent border border-white/10 px-4 py-2.5 text-white placeholder:text-white/20 text-[12px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
              />
            )}
          </div>

          {/* Vibes */}
          <div className="mb-8">
            <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 flex items-center gap-1.5">
              <Sparkles size={11} /> Vibes <span className="text-white/30 normal-case tracking-normal text-[10px] ml-auto">{vibes.length}/5</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map(v => {
                const active = vibes.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggleVibe(v)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all border ${
                      active
                        ? 'bg-[#E5E4E2] text-black border-[#E5E4E2]'
                        : 'border-white/10 text-white/60 hover:border-[#E5E4E2]/40 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={goNext}
            className="w-full h-14 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3 mt-auto"
          >
            Continue
            <ArrowRight size={14} />
          </button>
          <button
            onClick={goNext}
            className="w-full mt-2 py-3 text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white/60 transition"
          >
            Skip — surprise me
          </button>
        </motion.div>
      </Frame>
    );
  }

  // ── Spotify ─────────────────────────────────────────────────────────────
  if (step === 'spotify') {
    return (
      <Frame showBack>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="mb-8">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-2">Step 3 of 3</p>
            <h2 className="font-serif text-2xl font-light tracking-widest mb-2">Connect Spotify?</h2>
            <p className="text-[12px] text-white/60 leading-relaxed">
              Optional. We'll use your top artists and genres to surface events featuring music you actually love. Takes 5 seconds.
            </p>
          </div>

          <div className="marble-bg border border-[#E5E4E2]/15 p-5 mb-auto">
            <div className="flex items-center gap-3 mb-3">
              <Music size={16} className="text-[#1DB954]" />
              <p className="text-[11px] uppercase tracking-[0.3em] text-white font-bold">What you get</p>
            </div>
            <ul className="space-y-2 text-[12px] text-white/60 leading-relaxed">
              <li>· Events from artists in your rotation</li>
              <li>· Crews and friends with shared taste</li>
              <li>· Better recommendations from day one</li>
            </ul>
          </div>

          {errorMsg && (
            <p className="text-[11px] text-red-400 text-center my-4">{errorMsg}</p>
          )}

          <div className="space-y-3 mt-8">
            <button
              onClick={() => submitJoin({ connectSpotify: true })}
              disabled={submitting}
              className="w-full h-14 rounded-full bg-[#1DB954] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-[#1DB954]/90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Music size={14} />
                  Connect Spotify
                </>
              )}
            </button>
            <button
              onClick={() => submitJoin()}
              disabled={submitting}
              className="w-full py-3 text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white transition disabled:opacity-30"
            >
              Skip — finish without Spotify
            </button>
          </div>
        </motion.div>
      </Frame>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (step === 'done' && preview) {
    return (
      <Frame>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center"
        >
          <CheckCircle size={48} className="text-green-400 mb-6" />
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-2">You're in</p>
          <h2 className="font-serif text-2xl font-light tracking-widest mb-1">
            {preview.crewEmoji} {preview.crewName}
          </h2>
          <p className="text-[11px] text-white/50 mt-4 max-w-xs leading-relaxed">
            Heading to your scene...
          </p>
        </motion.div>
      </Frame>
    );
  }

  return null;
}

