'use client';

/**
 * ContactPicker
 *
 * Native (iOS/Android) bottom-sheet picker for the user's address-book contacts.
 *
 * Behaviour:
 *  - On web: renders an "iOS app required" notice. The web build doesn't have
 *    access to device contacts; sending crew invites still works via the
 *    free-text Direct Invite path.
 *  - On native: requests `contacts` permission (one-time iOS prompt is gated
 *    by the NSContactsUsageDescription string in Info.plist), fetches all
 *    contacts with name + phones, renders a searchable list, and reports the
 *    chosen one back via `onSelect({ name, phone })`.
 *
 * Native compat note: @capacitor-community/contacts@7.2.0 declares its iOS
 * dep on capacitor-swift-pm in the 7.x range, which conflicts with the
 * project's Capacitor 8.2 by default. We patch the plugin's Package.swift
 * locally to allow 8.x (the runtime API surface we use is unchanged).
 */
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Loader2, UserPlus, AlertCircle, Settings } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface Contact {
  contactId: string;
  displayName: string;
  initials: string;
  phones: string[];
  emails: string[];
}

interface ContactPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (picked: { name: string; phone?: string; email?: string }) => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'denied'; reason: string }
  | { kind: 'error'; message: string }
  | { kind: 'web' }
  | { kind: 'ready'; contacts: Contact[] };

export function ContactPicker({ open, onClose, onSelect }: ContactPickerProps) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;

    // Web build has no native contacts access. Tell the user explicitly.
    if (!Capacitor.isNativePlatform()) {
      setState({ kind: 'web' });
      return;
    }

    let cancelled = false;
    (async () => {
      setState({ kind: 'loading' });
      try {
        // Dynamic import keeps the contacts plugin out of the web bundle.
        const { Contacts } = await import('@capacitor-community/contacts');

        const perm = await Contacts.requestPermissions();
        if (perm.contacts !== 'granted') {
          if (cancelled) return;
          setState({
            kind: 'denied',
            reason:
              perm.contacts === 'denied'
                ? 'You denied contacts access. Re-enable it in iOS Settings → A-List → Contacts.'
                : 'Contacts permission was not granted.',
          });
          return;
        }

        const result = await Contacts.getContacts({
          projection: { name: true, phones: true, emails: true },
        });
        if (cancelled) return;

        // deno-lint-ignore no-explicit-any
        const raw = (result?.contacts ?? []) as any[];
        const normalised: Contact[] = raw
          .map((c) => {
            const display =
              c?.name?.display?.trim() ||
              [c?.name?.given, c?.name?.family].filter(Boolean).join(' ').trim() ||
              c?.name?.given?.trim() ||
              '';
            const phones = (c?.phones ?? [])
              .map((p: { number?: string }) => (p?.number ?? '').toString().trim())
              .filter((s: string) => s.length > 0);
            const emails = (c?.emails ?? [])
              .map((e: { address?: string }) => (e?.address ?? '').toString().trim())
              .filter((s: string) => s.length > 0);

            // Skip rows with neither a name nor any way to reach them.
            if (!display && phones.length === 0 && emails.length === 0) return null;

            const initials =
              (display.split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)) ||
              '??';

            return {
              contactId: c?.contactId ?? `${display}-${phones[0] ?? ''}`,
              displayName: display || phones[0] || emails[0] || 'Unknown',
              initials,
              phones,
              emails,
            };
          })
          .filter((c): c is Contact => c !== null)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        setState({ kind: 'ready', contacts: normalised });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ kind: 'error', message: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset query each time the sheet opens
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.contacts;
    return state.contacts.filter((c) => {
      if (c.displayName.toLowerCase().includes(q)) return true;
      if (c.phones.some((p) => p.toLowerCase().includes(q))) return true;
      if (c.emails.some((e) => e.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [state, query]);

  const pick = (c: Contact) => {
    onSelect({
      name: c.displayName,
      phone: c.phones[0],
      email: c.emails[0],
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[61] bg-[#060606] border-t border-[#E5E4E2]/20 max-h-[85vh] flex flex-col"
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-3 flex-shrink-0">
                <div className="w-10 h-1 bg-white/10" />
              </div>

              {/* Header */}
              <div className="px-6 pb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="font-serif text-lg font-light tracking-widest text-white">From your contacts</h2>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-1">Pick someone to invite</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-white/50 hover:text-white transition"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 flex flex-col">
                {state.kind === 'web' && (
                  <div className="px-6 py-10 text-center">
                    <UserPlus size={20} className="mx-auto mb-3 text-white/30" />
                    <p className="text-[12px] text-white/60 leading-relaxed">
                      Contacts picker is iOS-only.
                    </p>
                    <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                      Open the A-List iOS app to pick from your contacts, or use Direct Invite to type their info manually.
                    </p>
                  </div>
                )}

                {state.kind === 'loading' && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-white/40" />
                  </div>
                )}

                {state.kind === 'denied' && (
                  <div className="px-6 py-8 text-center">
                    <AlertCircle size={20} className="mx-auto mb-3 text-amber-400" />
                    <p className="text-[12px] text-white/70 leading-relaxed mb-3">{state.reason}</p>
                    <button
                      onClick={() => {
                        // Best-effort deep link to app settings on iOS
                        try { window.open('app-settings:', '_blank'); } catch { /* noop */ }
                      }}
                      className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#E5E4E2] hover:text-white border-b border-[#E5E4E2]/40 pb-0.5"
                    >
                      <Settings size={12} /> Open iOS Settings
                    </button>
                  </div>
                )}

                {state.kind === 'error' && (
                  <div className="px-6 py-8 text-center">
                    <AlertCircle size={20} className="mx-auto mb-3 text-red-400" />
                    <p className="text-[12px] text-white/70">Could not load contacts</p>
                    <p className="text-[10px] text-white/40 mt-1 break-words">{state.message}</p>
                  </div>
                )}

                {state.kind === 'ready' && (
                  <>
                    {/* Search */}
                    <div className="px-6 pb-3 flex-shrink-0">
                      <div className="relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search name, phone, email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="w-full bg-transparent border border-white/10 pl-11 pr-4 py-3 text-white placeholder:text-white/20 text-[14px] focus:border-[#E5E4E2]/40 outline-none transition-colors"
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-2">
                        {filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}
                        {query && ` matching "${query}"`}
                      </p>
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8">
                      {filtered.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-[12px] text-white/40">No matches</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filtered.slice(0, 200).map((c) => (
                            <button
                              key={c.contactId}
                              onClick={() => pick(c)}
                              className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] hover:border-[#E5E4E2]/20 transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-white/60">{c.initials}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] text-white truncate">{c.displayName}</div>
                                {c.phones[0] && (
                                  <div className="text-[10px] text-white/40 truncate">{c.phones[0]}</div>
                                )}
                              </div>
                            </button>
                          ))}
                          {filtered.length > 200 && (
                            <p className="text-center text-[10px] text-white/30 pt-2">
                              Showing first 200 — refine your search to find more.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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
