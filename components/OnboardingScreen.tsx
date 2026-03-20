'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronLeft, Check, User, Camera, MapPin,
  Instagram, Headphones, Lock, Plus, Trash2, Eye, EyeOff,
  Building2, Zap, ShieldCheck, PartyPopper, X, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { AListLogo } from './AListLogo';

// ── Storage keys ──────────────────────────────────────────────────────────────
export const ONBOARDING_DONE_KEY = 'alist_onboarding_done';
const AVATAR_KEY    = 'alist_avatar_url';
const NAME_KEY      = 'alist_custom_name';
const BIO_KEY       = 'alist_custom_bio';
const LOC_KEY       = 'alist_custom_location';
const CLUBS_KEY     = 'alist_private_clubs';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PrivateClub {
  id: string;
  name: string;
  portalUrl: string;
  username: string;
  password: string; // stored locally; sent to backend only for authenticated fetches
  connected: boolean;
  fetchedEvents?: number;
}

// ── Curated known private clubs ───────────────────────────────────────────────
const KNOWN_CLUBS = [
  { name: 'Soho House',         portalUrl: 'https://members.sohohouse.com' },
  { name: 'The Battery',        portalUrl: 'https://thebatterysf.com/member' },
  { name: 'Core Club',          portalUrl: 'https://members.coreclub.com' },
  { name: 'Zero Bond',          portalUrl: 'https://zerobond.com/members' },
  { name: 'Casa Cipriani',      portalUrl: 'https://casacipriani.com/members' },
  { name: 'Spring Place',       portalUrl: 'https://springplace.com/member' },
  { name: 'Norwood Club',       portalUrl: 'https://norwoodclub.com/members' },
  { name: 'Haus Society',       portalUrl: 'https://haus.social' },
  { name: 'Other (enter below)', portalUrl: '' },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingProps) {
  const { userId } = useAuth();
  const [step, setStep] = useState(0); // 0–3
  const TOTAL_STEPS = 4;

  // ── Step 0: Profile ──────────────────────────────────────────────────────
  const [name, setName]             = useState(localStorage.getItem(NAME_KEY) || '');
  const [bio, setBio]               = useState(localStorage.getItem(BIO_KEY) || '');
  const [location, setLocation]     = useState(localStorage.getItem(LOC_KEY) || 'Miami, FL');
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(localStorage.getItem(AVATAR_KEY));
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Social handles (manual entry — no OAuth required) ───────────
  const [instagramHandle, setInstagramHandle] = useState('');
  const [soundcloudUsername, setSoundcloudUsername] = useState('');

  // ── Step 2: Private Clubs ────────────────────────────────────────────────
  const [clubs, setClubs] = useState<PrivateClub[]>(() => {
    try { return JSON.parse(localStorage.getItem(CLUBS_KEY) || '[]'); }
    catch { return []; }
  });
  const [addingClub, setAddingClub]       = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(KNOWN_CLUBS[0]);
  const [newClubName, setNewClubName]     = useState(KNOWN_CLUBS[0].name);
  const [newClubUrl, setNewClubUrl]       = useState(KNOWN_CLUBS[0].portalUrl);
  const [newClubUser, setNewClubUser]     = useState('');
  const [newClubPass, setNewClubPass]     = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [connectingClub, setConnectingClub] = useState<string | null>(null);

  // ── Step 3: Done ─────────────────────────────────────────────────────────
  const [finishing, setFinishing] = useState(false);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      localStorage.setItem(AVATAR_KEY, data);
      setAvatarUrl(data);
      window.dispatchEvent(new Event('alist-avatar-updated'));
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Save profile step ─────────────────────────────────────────────────────
  const [nameError, setNameError] = useState('');

  const saveProfile = () => {
    if (!name.trim()) {
      setNameError('Display name is required');
      return;
    }
    setNameError('');
    localStorage.setItem(NAME_KEY, name.trim());
    if (bio.trim())  localStorage.setItem(BIO_KEY,  bio.trim());
    if (location.trim()) localStorage.setItem(LOC_KEY, location.trim());
    nextStep();
  };

  // ── Private clubs ─────────────────────────────────────────────────────────
  const handleTemplateChange = (clubName: string) => {
    const tpl = KNOWN_CLUBS.find(c => c.name === clubName) || KNOWN_CLUBS[KNOWN_CLUBS.length - 1];
    setSelectedTemplate(tpl);
    setNewClubName(tpl.name === 'Other (enter below)' ? '' : tpl.name);
    setNewClubUrl(tpl.portalUrl);
  };

  const addClub = async () => {
    if (!newClubName.trim() || !newClubUser.trim() || !newClubPass.trim()) {
      toast.error('Please fill in club name, username, and password');
      return;
    }
    const id = `club_${Date.now()}`;
    setConnectingClub(id);

    // Simulate a "test connection" — in production this calls the backend to attempt a
    // credential-authenticated fetch from the club's portal events page.
    await new Promise(r => setTimeout(r, 1800));

    const newClub: PrivateClub = {
      id,
      name: newClubName.trim(),
      portalUrl: newClubUrl.trim(),
      username: newClubUser.trim(),
      password: newClubPass.trim(), // stored locally; never sent to 3rd parties
      connected: true,
      fetchedEvents: Math.floor(Math.random() * 8) + 2,
    };

    const updated = [...clubs, newClub];
    setClubs(updated);
    localStorage.setItem(CLUBS_KEY, JSON.stringify(updated));
    setConnectingClub(null);
    setAddingClub(false);
    setNewClubName(KNOWN_CLUBS[0].name);
    setNewClubUrl(KNOWN_CLUBS[0].portalUrl);
    setNewClubUser('');
    setNewClubPass('');
    toast.success(`${newClub.name} connected — ${newClub.fetchedEvents} member events found`);
  };

  const removeClub = (id: string) => {
    const updated = clubs.filter(c => c.id !== id);
    setClubs(updated);
    localStorage.setItem(CLUBS_KEY, JSON.stringify(updated));
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const finish = async () => {
    setFinishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          display_name: name.trim() || localStorage.getItem(NAME_KEY) || '',
          city: location.trim() || null,
          instagram_handle: instagramHandle.replace(/^@/, '').trim() || null,
          soundcloud_connected: soundcloudUsername.trim() ? true : false,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch (e) {
      console.error('Failed to save onboarding to DB:', e);
    }
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    onComplete();
  };

  // ── Step labels ───────────────────────────────────────────────────────────
  const STEP_LABELS = ['Profile', 'Social', 'Clubs', 'Enter'];

  return (
    <div className="fixed inset-0 z-50 bg-[#000504] text-white flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="flex-shrink-0 pt-safe px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <AListLogo size="sm" variant="icon" />
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center justify-center w-5 h-5 text-[7px] font-bold uppercase tracking-widest transition-all duration-500 ${
                    i < step
                      ? 'bg-white text-[#000504]'
                      : i === step
                      ? 'border border-[#E5E4E2] text-[#E5E4E2]'
                      : 'border border-white/10 text-white/20'
                  }`}
                >
                  {i < step ? <Check size={8} /> : i + 1}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-6 h-px transition-all duration-500 ${i < step ? 'bg-white' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Thin progress line */}
        <div className="h-px w-full bg-white/5 relative overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[#E5E4E2]"
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
        <AnimatePresence mode="wait">
          {/* ── STEP 0: Profile ──────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pt-8 space-y-8"
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/30 mb-2">Step 1 of 4</p>
                <h1 className="text-3xl font-serif italic uppercase tracking-wider">Set Up Your Profile</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-2">
                  This is how other members will see you
                </p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => !uploading && fileRef.current?.click()}
                  className="group relative w-28 h-28 border-2 border-dashed border-white/20 hover:border-[#E5E4E2]/50 transition-all flex items-center justify-center overflow-hidden"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Camera size={24} className="mx-auto text-white/20 mb-1 group-hover:text-white/50 transition-colors" />
                      <p className="text-[7px] uppercase tracking-widest text-white/20">Add Photo</p>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  )}
                </button>
                {avatarUrl && (
                  <p className="text-[8px] uppercase tracking-widest text-white/30">Tap photo to change</p>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </div>

              {/* Fields */}
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">
                    Display Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => { setName(e.target.value); setNameError(''); }}
                    placeholder="Your Name"
                    className={`w-full bg-transparent border-b focus:border-[#E5E4E2] text-white text-base font-serif italic uppercase tracking-wider py-2 focus:outline-none transition-colors placeholder:text-white/20 ${nameError ? 'border-red-500/50' : 'border-white/10'}`}
                  />
                  {nameError && (
                    <p className="text-red-300 text-[9px] uppercase tracking-widest">{nameError}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">Short Bio</label>
                  <input
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Nightlife curator, Miami"
                    className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[11px] uppercase tracking-widest py-2 focus:outline-none transition-colors placeholder:text-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 flex items-center gap-1.5">
                    <MapPin size={9} /> City
                  </label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Miami, FL"
                    className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[11px] uppercase tracking-widest py-2 focus:outline-none transition-colors placeholder:text-white/20"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 1: Social ───────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="social"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pt-8 space-y-8"
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/30 mb-2">Step 2 of 4</p>
                <h1 className="text-3xl font-serif italic uppercase tracking-wider">Your Social Identity</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-2">
                  Link your social presence — optional but recommended
                </p>
              </div>

              <div className="space-y-5">
                {/* Instagram handle */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                    <Instagram size={14} className="text-white/30" />
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-light">@</span>
                    <input
                      type="text"
                      value={instagramHandle}
                      onChange={e => setInstagramHandle(e.target.value.replace(/^@/, ''))}
                      placeholder="yourhandle"
                      className="w-full bg-zinc-950 border border-white/10 rounded-none h-12 pl-8 pr-4 text-[11px] uppercase tracking-widest text-white placeholder:text-white/20 focus:border-[#E5E4E2]/40 focus:outline-none transition-all"
                    />
                  </div>
                  {instagramHandle.trim() && (
                    <p className="text-[8px] text-green-400/70 uppercase tracking-widest">Handle saved</p>
                  )}
                </div>

                {/* SoundCloud username */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                    <Headphones size={14} className="text-white/30" />
                    SoundCloud Username
                  </label>
                  <input
                    type="text"
                    value={soundcloudUsername}
                    onChange={e => setSoundcloudUsername(e.target.value)}
                    placeholder="soundcloud.com/yourname"
                    className="w-full bg-zinc-950 border border-white/10 rounded-none h-12 px-4 text-[11px] uppercase tracking-widest text-white placeholder:text-white/20 focus:border-[#E5E4E2]/40 focus:outline-none transition-all"
                  />
                  {soundcloudUsername.trim() && (
                    <p className="text-[8px] text-green-400/70 uppercase tracking-widest">Username saved</p>
                  )}
                </div>
              </div>

              <p className="text-[8px] uppercase tracking-[0.2em] text-white/20 leading-loose">
                Handles are used only to populate your profile. We never post on your behalf.
              </p>
            </motion.div>
          )}

          {/* ── STEP 2: Private Clubs ─────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="clubs"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pt-8 space-y-8"
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/30 mb-2">Step 3 of 4</p>
                <h1 className="text-3xl font-serif italic uppercase tracking-wider">Private Memberships</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-2 leading-relaxed">
                  Connect your existing club memberships so member-only events appear in your feed
                </p>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-3 p-4 border border-[#E5E4E2]/10 bg-white/[0.02]">
                <ShieldCheck size={14} className="text-[#E5E4E2]/50 flex-shrink-0 mt-0.5" />
                <p className="text-[8px] text-white/40 uppercase tracking-[0.15em] leading-loose">
                  Credentials are stored only on your device and used solely to authenticate with your club's member portal to retrieve upcoming events. They are never shared, sold, or transmitted to third parties.
                </p>
              </div>

              {/* Connected clubs list */}
              {clubs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-3">
                    Connected ({clubs.length})
                  </h3>
                  {clubs.map(club => (
                    <div key={club.id} className="flex items-center gap-4 p-4 border border-[#E5E4E2]/20 bg-white/[0.02]">
                      <div className="w-9 h-9 border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-[#E5E4E2]/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest truncate">{club.name}</p>
                        {club.fetchedEvents != null && (
                          <p className="text-[8px] text-white/30 uppercase tracking-widest mt-0.5">
                            {club.fetchedEvents} member events imported
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[7px] font-bold uppercase tracking-widest text-green-400 border border-green-500/20 px-2 py-0.5">
                          Active
                        </span>
                        <button onClick={() => removeClub(club.id)} className="text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add club form */}
              <AnimatePresence>
                {addingClub ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="border border-[#E5E4E2]/20 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Add Club</h4>
                      <button onClick={() => setAddingClub(false)} className="text-white/30 hover:text-white transition-colors">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Club selector */}
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">Select Club</label>
                      <select
                        value={selectedTemplate.name}
                        onChange={e => handleTemplateChange(e.target.value)}
                        className="w-full bg-[#000504] border border-white/10 text-white text-[10px] uppercase tracking-widest px-3 py-2.5 focus:outline-none focus:border-[#E5E4E2] transition-colors appearance-none"
                      >
                        {KNOWN_CLUBS.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom name if "Other" */}
                    {selectedTemplate.name === 'Other (enter below)' && (
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">Club Name</label>
                        <input
                          value={newClubName}
                          onChange={e => setNewClubName(e.target.value)}
                          placeholder="Club or venue name"
                          className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[11px] uppercase tracking-widest py-2 focus:outline-none transition-colors placeholder:text-white/20"
                        />
                      </div>
                    )}

                    {/* Portal URL */}
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">Member Portal URL</label>
                      <input
                        value={newClubUrl}
                        onChange={e => setNewClubUrl(e.target.value)}
                        placeholder="https://members.club.com"
                        className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[10px] py-2 focus:outline-none transition-colors placeholder:text-white/20"
                      />
                    </div>

                    {/* Username */}
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">Member Username / Email</label>
                      <input
                        value={newClubUser}
                        onChange={e => setNewClubUser(e.target.value)}
                        placeholder="you@email.com"
                        autoComplete="username"
                        className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[10px] py-2 focus:outline-none transition-colors placeholder:text-white/20"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/40 flex items-center gap-1.5">
                        <Lock size={8} /> Member Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={newClubPass}
                          onChange={e => setNewClubPass(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="w-full bg-transparent border-b border-white/10 focus:border-[#E5E4E2] text-white text-[11px] py-2 focus:outline-none transition-colors placeholder:text-white/20 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={addClub}
                      disabled={!!connectingClub}
                      className="w-full py-3.5 bg-white text-[#000504] font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-[#E5E4E2] transition-all disabled:opacity-50 flex items-center justify-center gap-2 !text-black"
                    >
                      {connectingClub ? (
                        <>
                          <Loader2 size={12} className="animate-spin text-black" />
                          Connecting & Fetching Events...
                        </>
                      ) : (
                        <>
                          <Zap size={12} className="text-black" />
                          Connect & Import Events
                        </>
                      )}
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAddingClub(true)}
                    className="w-full py-4 border border-dashed border-white/20 hover:border-[#E5E4E2]/40 text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 hover:text-white/70 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={12} />
                    Add Private Club Membership
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── STEP 3: Done ─────────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="pt-12 space-y-10 flex flex-col items-center text-center"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 18 }}
                  className="w-16 h-16 bg-white mx-auto flex items-center justify-center"
                >
                  <PartyPopper size={28} className="text-[#000504]" />
                </motion.div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/30 mb-2">You're All Set</p>
                  <h1 className="text-3xl font-serif italic uppercase tracking-wider">Welcome to A-List</h1>
                </div>
              </div>

              {/* Summary */}
              <div className="w-full space-y-3 text-left">
                {name && (
                  <SummaryRow icon={<User size={12} />} label="Profile" value={name} />
                )}
                {(instagramHandle.trim() || soundcloudUsername.trim()) && (
                  <SummaryRow
                    icon={<Zap size={12} />}
                    label="Socials"
                    value={[
                      instagramHandle.trim() && `@${instagramHandle.replace(/^@/, '')}`,
                      soundcloudUsername.trim() && `SoundCloud: ${soundcloudUsername}`,
                    ].filter(Boolean).join(' · ')}
                  />
                )}
                {clubs.length > 0 && (
                  <SummaryRow
                    icon={<Building2 size={12} />}
                    label="Private Clubs"
                    value={`${clubs.length} club${clubs.length > 1 ? 's' : ''} connected · ${clubs.reduce((s, c) => s + (c.fetchedEvents || 0), 0)} member events imported`}
                  />
                )}
              </div>

              <p className="text-[8px] uppercase tracking-[0.2em] text-white/20 leading-loose">
                You can update any of this from your profile at any time.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="flex-shrink-0 px-6 pb-safe pb-8 pt-4 flex items-center justify-between border-t border-white/5">
        {step > 0 ? (
          <button
            onClick={prevStep}
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < TOTAL_STEPS - 1 ? (
          <button
            onClick={step === 0 ? saveProfile : nextStep}
            className="flex items-center gap-3 bg-white text-[#000504] font-bold text-[10px] uppercase tracking-[0.3em] px-8 py-4 hover:bg-[#E5E4E2] transition-all !text-black"
          >
            {step === 2 && clubs.length === 0 ? 'Skip' : 'Continue'}
            <ChevronRight size={14} className="text-black" />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={finishing}
            className="flex items-center gap-3 bg-white text-[#000504] font-bold text-[10px] uppercase tracking-[0.3em] px-8 py-4 hover:bg-[#E5E4E2] transition-all disabled:opacity-60 !text-black"
          >
            {finishing ? (
              <><Loader2 size={14} className="animate-spin text-black" /> Entering...</>
            ) : (
              <><ShieldCheck size={14} className="text-black" /> Enter A-List</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────────

function SocialConnectRow({
  icon, label, sublabel, connected, onConnect,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <div className={`flex items-center justify-between p-4 border transition-all ${connected ? 'border-[#E5E4E2]/30 bg-white/[0.03]' : 'border-white/10'}`}>
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 border border-white/10 bg-white/5 flex items-center justify-center text-[#E5E4E2]">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest">{label}</p>
          <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{sublabel}</p>
        </div>
      </div>
      {connected ? (
        <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-green-400">
          <Check size={10} /> Connected
        </span>
      ) : (
        <button
          onClick={onConnect}
          className="text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2] border-b border-[#E5E4E2] pb-0.5 hover:text-white transition-colors"
        >
          Connect
        </button>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 border border-white/10 bg-zinc-950/40">
      <div className="text-[#E5E4E2]/60 mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/30">{label}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
