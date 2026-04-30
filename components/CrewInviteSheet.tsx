'use client';

/**
 * CrewInviteSheet
 *
 * Bottom-sheet UI for inviting people to a crew.
 *
 * Two paths:
 *  1. Quick Share — generates a 24h shareable link, opens the OS share sheet
 *     (or copies to clipboard on desktop). Not bound to a specific contact.
 *  2. Direct Invite — captain enters firstName + phone + Instagram handle.
 *     Backend creates a pending member and a 7-day token bound to that contact.
 *     Then we open the SMS share sheet pre-filled with the friend's phone if
 *     given, otherwise we prep the link for IG DM and copy to clipboard.
 *
 * Hits the new `crew2` Supabase edge function:
 *   POST /crew2/:id/invite-link
 *   POST /crew2/:id/invite-direct
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Send, Loader2, Phone, Instagram, Copy, MessageCircle, Sparkles, BookUser } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { ContactPicker } from './ContactPicker';

const CREW2_BASE = `https://${projectId}.supabase.co/functions/v1/crew2`;
const TG3_BASE   = `https://${projectId}.supabase.co/functions/v1/tg3`;

// Matches what tg3 /crew-suggestions returns (seed-filtered server-side)
interface CrewSuggestion {
  person_id: string;
  name?: string;
  tier?: string;
  score?: number;
  avatar_url?: string | null;
}

interface CrewInviteSheetProps {
  open: boolean;
  onClose: () => void;
  onInviteSent: () => void;          // parent should refresh crews
  crewId: number;
  crewName: string;
  crewEmoji: string;
  userId: string;
}

type Mode = 'quick' | 'suggested' | 'direct';

export function CrewInviteSheet({
  open, onClose, onInviteSent,
  crewId, crewName, crewEmoji, userId,
}: CrewInviteSheetProps) {
  const [mode, setMode] = useState<Mode>('quick');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Direct invite fields
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');

  // Suggested members (from taste graph) — null = not yet fetched
  const [suggestions, setSuggestions] = useState<CrewSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // ContactPicker overlay (iOS-only)
  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  const headers = {
    'Authorization': `Bearer ${publicAnonKey}`,
    'apikey': publicAnonKey,
    'Content-Type': 'application/json',
  };

  // Lazy-load suggestions the first time the user lands on the Suggested tab.
  // We don't pre-fetch on sheet open because most invites are Quick Share; only
  // pay the network cost when the captain actually wants to browse picks.
  useEffect(() => {
    if (!open || mode !== 'suggested' || suggestions !== null || !userId) return;
    setLoadingSuggestions(true);
    fetch(`${TG3_BASE}/crew-suggestions?userId=${userId}&limit=12`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, userId, suggestions]);

  // Reset cached suggestions when the sheet closes so the next open refetches
  // (taste graph evolves; we want fresh picks each session).
  useEffect(() => {
    if (!open) setSuggestions(null);
  }, [open]);

  // Tap a suggested member: pre-fill firstName + jump to the Direct Invite tab
  // so the captain can add a phone/IG (we don't have those for taste-graph
  // members) and ship it. Score is preserved as a hint in the toast.
  const useSuggestion = (s: CrewSuggestion) => {
    setFirstName((s.name?.trim() || '').split(/\s+/)[0]);
    setMode('direct');
    toast.success(`Pre-filled ${s.name?.trim() || 'member'} — add a phone or IG to send`);
  };

  // ── Quick Share ─────────────────────────────────────────────────────────
  const handleQuickShare = async () => {
    if (generatingLink) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`${CREW2_BASE}/${crewId}/invite-link?userId=${userId}`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Could not generate invite link');
        return;
      }
      const { joinUrl, smsBody } = await res.json();

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Join ${crewName} on A-List`,
            text: smsBody,
            url: joinUrl,
          });
          toast.success('Invite shared');
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
          // Fallback to clipboard if share fails for any other reason
          await navigator.clipboard.writeText(joinUrl).catch(() => {});
          toast.success('Invite link copied');
        }
      } else {
        await navigator.clipboard.writeText(joinUrl).catch(() => {});
        toast.success('Invite link copied');
      }
      onInviteSent();
      handleClose();
    } catch (_e) {
      toast.error('Could not share invite link');
    } finally {
      setGeneratingLink(false);
    }
  };

  // ── Direct Invite ───────────────────────────────────────────────────────
  const handleDirectInvite = async () => {
    if (submitting) return;
    const name = firstName.trim();
    const ph = phone.trim();
    const ig = instagram.trim().replace(/^@/, '');
    if (!name) {
      toast.error('Add a first name');
      return;
    }
    if (!ph && !ig) {
      toast.error('Add a phone number or Instagram handle');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${CREW2_BASE}/${crewId}/invite-direct?userId=${userId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ firstName: name, phone: ph, instagram: ig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Could not create invite');
        return;
      }
      const { joinUrl, smsBody } = await res.json();

      // If we have a phone number, open native SMS app pre-filled.
      // sms: scheme works on iOS/Android; ?body= is iOS-supported and Android-mostly-supported.
      if (ph) {
        const smsHref = `sms:${ph}${navigator.userAgent.match(/iPhone|iPad|iPod/i) ? '&' : '?'}body=${encodeURIComponent(smsBody)}`;
        window.location.href = smsHref;
        toast.success(`Pending invite sent to ${name}`);
      } else if (ig) {
        // No phone but we have IG — copy the link to clipboard so the captain
        // can paste it into the IG DM.
        await navigator.clipboard.writeText(joinUrl).catch(() => {});
        toast.success(`Link copied — paste into @${ig}'s DMs`);
      }

      onInviteSent();
      // Reset for next invite
      setFirstName('');
      setPhone('');
      setInstagram('');
      handleClose();
    } catch (_e) {
      toast.error('Could not send invite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (generatingLink || submitting) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-[#060606] border-t border-[#E5E4E2]/15"
          >
            <div className="max-w-2xl mx-auto pb-8">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-10 h-1 bg-white/10" />
              </div>

              {/* Header */}
              <div className="px-6 pb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl font-light tracking-widest text-white">
                    Invite to {crewEmoji} {crewName}
                  </h2>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">
                    Bring your people in
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={generatingLink || submitting}
                  className="p-2 text-white/50 hover:text-white transition disabled:opacity-30"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mode tabs */}
              <div className="px-6 mb-6">
                <div className="flex border border-[#E5E4E2]/15">
                  <button
                    onClick={() => setMode('quick')}
                    className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors ${
                      mode === 'quick'
                        ? 'bg-[#E5E4E2] text-black'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    Quick Share
                  </button>
                  <button
                    onClick={() => setMode('suggested')}
                    className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors ${
                      mode === 'suggested'
                        ? 'bg-[#E5E4E2] text-black'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    Suggested
                  </button>
                  <button
                    onClick={() => setMode('direct')}
                    className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors ${
                      mode === 'direct'
                        ? 'bg-[#E5E4E2] text-black'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    Direct
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6">
                {mode === 'quick' && (
                  <div className="space-y-5">
                    <p className="text-[12px] text-white/60 leading-relaxed">
                      Generate a link to share via your group chat, iMessage, or however you like. Anyone with the link can join. Expires in 24 hours.
                    </p>
                    <button
                      onClick={handleQuickShare}
                      disabled={generatingLink}
                      className="w-full h-14 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {generatingLink ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Share2 size={14} />
                          Generate &amp; Share Link
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-white/30 leading-relaxed text-center">
                      Doesn't track who you sent it to. For specific friends, use Direct Invite.
                    </p>
                  </div>
                )}

                {mode === 'suggested' && (
                  <div className="space-y-4">
                    <p className="text-[12px] text-white/60 leading-relaxed">
                      A-List members whose taste graph overlaps with yours. Tap one to pre-fill their name in Direct Invite — add a phone or IG and send.
                    </p>

                    {loadingSuggestions && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={20} className="animate-spin text-white/40" />
                      </div>
                    )}

                    {!loadingSuggestions && suggestions && suggestions.length === 0 && (
                      <div className="bg-white/[0.03] border border-white/5 px-4 py-8 text-center">
                        <Sparkles size={16} className="mx-auto mb-2 text-white/30" />
                        <p className="text-[12px] text-white/50">No suggestions yet</p>
                        <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                          As your crew connects Spotify and books venues, we'll surface people with shared taste.
                        </p>
                      </div>
                    )}

                    {!loadingSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {suggestions.map((s, i) => {
                          const pid = s.person_id ?? `s-${i}`;
                          const displayName = (s.name?.trim() || (typeof s.person_id === 'string' ? `${s.person_id.slice(0, 8)}…` : 'Member'));
                          const initials = (s.name?.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)) || '??';
                          return (
                            <button
                              key={pid}
                              onClick={() => useSuggestion(s)}
                              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03] border border-[#E5E4E2]/10 hover:bg-white/[0.06] hover:border-[#E5E4E2]/25 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {s.avatar_url ? (
                                    <img src={s.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-bold text-white/60">{initials}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[13px] text-white truncate">{displayName}</div>
                                  {s.tier && (
                                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-0.5">{s.tier}</div>
                                  )}
                                </div>
                              </div>
                              {typeof s.score === 'number' && (
                                <div className="text-[10px] text-white/40 tabular-nums shrink-0">
                                  ×{s.score.toFixed(1)}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'direct' && (
                  <div className="space-y-4">
                    <p className="text-[12px] text-white/60 leading-relaxed">
                      Add their info — they'll appear as <span className="text-[#E5E4E2]">pending</span> in your crew until they accept. We'll open your SMS app pre-filled, or copy the link for Instagram.
                    </p>

                    {/* Pick from contacts (iOS only — picker handles the web fallback) */}
                    <button
                      type="button"
                      onClick={() => setContactPickerOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-[#E5E4E2]/20 hover:bg-white/[0.04] hover:border-[#E5E4E2]/40 transition-colors text-[10px] uppercase tracking-[0.3em] text-white/70"
                    >
                      <BookUser size={13} className="text-[#E5E4E2]/70" />
                      Pick from contacts
                    </button>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">
                          First name <span className="text-[#E5E4E2]">*</span>
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="e.g. Sarah"
                          maxLength={40}
                          className="w-full bg-transparent border border-white/10 px-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">
                          Phone <span className="text-white/30 normal-case tracking-normal text-[10px]">(or Instagram below)</span>
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
                            placeholder="@theirhandle"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full bg-transparent border border-white/10 pl-11 pr-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* What happens preview */}
                    {(phone.trim() || instagram.trim()) && firstName.trim() && (
                      <div className="bg-white/[0.03] border-l-2 border-[#E5E4E2]/30 px-4 py-3 mt-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1.5">
                          What happens next
                        </p>
                        <p className="text-[12px] text-white/70 leading-relaxed flex items-start gap-2">
                          {phone.trim() ? (
                            <>
                              <MessageCircle size={12} className="mt-0.5 text-[#E5E4E2]/60" />
                              SMS opens with your invite for {firstName.trim()}
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="mt-0.5 text-[#E5E4E2]/60" />
                              Link copied — paste into @{instagram.trim().replace(/^@/, '')}'s DMs
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleDirectInvite}
                      disabled={submitting || !firstName.trim() || (!phone.trim() && !instagram.trim())}
                      className="w-full h-14 rounded-full bg-[#E5E4E2] text-black font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed mt-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Send Invite
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Contacts picker overlay — fires from "Pick from contacts" button.
              Renders inside the same AnimatePresence so it stacks above the sheet. */}
          <ContactPicker
            open={contactPickerOpen}
            onClose={() => setContactPickerOpen(false)}
            onSelect={({ name, phone: pickedPhone }) => {
              const trimmedName = (name || '').trim();
              const firstWord = trimmedName.split(/\s+/)[0] || '';
              setFirstName(firstWord);
              if (pickedPhone) setPhone(pickedPhone);
              toast.success(`Pre-filled ${trimmedName || 'contact'} — review and send`);
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}
