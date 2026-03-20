'use client';

import { Users, Crown, ChevronRight, Plus, X, Loader2, UserPlus, Trash2, UserMinus, Share2, Copy } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

type Member = { name: string; avatar: string; role: string; spend: number };
type NextLevel = { name: string; spend: number } | null;
type Crew = {
  id: number;
  name: string;
  emoji: string;
  level: string;
  members: Member[];
  totalSpend: number;
  nightsOut: number;
  nextLevel: NextLevel;
  perks: string[];
};
type LeaderboardEntry = { rank: number; name: string; spend: number; nights: number; avatar: string };

const LEVEL_COLORS: Record<string, string> = {
  Bronze:   'text-amber-600 border-amber-600/30 bg-amber-600/10',
  Silver:   'text-[#C0C0C0] border-[#C0C0C0]/30 bg-[#C0C0C0]/10',
  Gold:     'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  Platinum: 'text-[#E5E4E2] border-[#E5E4E2]/30 bg-[#E5E4E2]/10',
  Diamond:  'text-cyan-300 border-cyan-300/30 bg-cyan-300/10',
};

export function CrewBuilder() {
  const { userId: USER_ID } = useAuth();
  const [activeTab, setActiveTab] = useState('crews');
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [crewList, setCrewList] = useState<Crew[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMemberIdx, setRemovingMemberIdx] = useState<number | null>(null);

  // Create crew form
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewEmoji, setNewCrewEmoji] = useState('🎉');

  const emojiOptions = ['🎉', '🔥', '👑', '🦋', '⚡', '🌟', '🎭', '💎', '🌙', '🦅'];

  useEffect(() => { fetchCrews(); }, []);

  // Keep selectedCrew in sync with crewList after mutations
  const syncSelected = (crews: Crew[]) => {
    if (selectedCrew) {
      const fresh = crews.find(c => c.id === selectedCrew.id);
      setSelectedCrew(fresh ?? null);
    }
    setCrewList(crews);
  };

  const fetchCrews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/crews?userId=${USER_ID}`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        setCrewList(data.crews || []);
        setLeaderboard(data.leaderboard || []);
      }
    } catch (_e) {
      toast.error('Failed to load crews');
    } finally {
      setLoading(false);
    }
  };

  // ── Create Crew ────────────────────────────────────────────────────────────
  const handleCreateCrew = async () => {
    if (!newCrewName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/crews?userId=${USER_ID}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ name: newCrewName.trim().toUpperCase(), emoji: newCrewEmoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setCrewList(data.crews);
        setShowCreateModal(false);
        setNewCrewName('');
        setNewCrewEmoji('🎉');
        toast.success(`${newCrewName.trim().toUpperCase()} crew created!`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create crew');
      }
    } catch (_e) {
      toast.error('Failed to create crew');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete Crew ────────────────────────────────────────────────────────────
  const handleDeleteCrew = async () => {
    if (!selectedCrew || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/crews/${selectedCrew.id}?userId=${USER_ID}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      if (res.ok) {
        const data = await res.json();
        setCrewList(data.crews);
        setSelectedCrew(null);
        setShowDeleteConfirm(false);
        toast.success(`${selectedCrew.name} disbanded`);
      } else {
        toast.error('Failed to delete crew');
      }
    } catch (_e) {
      toast.error('Failed to delete crew');
    } finally {
      setDeleting(false);
    }
  };

  // ── Generate & Share Invite Link ───────────────────────────────────────────
  const handleShareInvite = async () => {
    if (!selectedCrew || generatingLink) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`${API}/crews/${selectedCrew.id}/invite-link?userId=${USER_ID}`, {
        method: 'POST',
        headers: HEADERS,
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate invite link');
        return;
      }
      const { token } = await res.json();
      const joinUrl = `${window.location.origin}${window.location.pathname}?joinCrew=${token}`;

      // Use native share sheet if available (mobile), otherwise copy to clipboard
      if (navigator.share) {
        await navigator.share({
          title: `Join Group — ${selectedCrew.name} on A-List`,
          text: `You've been invited to join the ${selectedCrew.name} group ${selectedCrew.emoji} on A-List. Link expires in 24 hours.`,
          url: joinUrl,
        });
        toast.success('Invite sent!');
      } else {
        await navigator.clipboard.writeText(joinUrl).catch(() => {});
        toast.success('Invite link copied to clipboard!');
      }
    } catch (e: unknown) {
      // User cancelled the share sheet — not an error
      if (e instanceof Error && e.name !== 'AbortError') {
        toast.error('Failed to share invite link');
      }
    } finally {
      setGeneratingLink(false);
    }
  };

  // ── Remove Member ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberIdx: number) => {
    if (!selectedCrew || memberIdx === 0 || removingMemberIdx !== null) return;
    setRemovingMemberIdx(memberIdx);
    try {
      const res = await fetch(
        `${API}/crews/${selectedCrew.id}/member/${memberIdx}?userId=${USER_ID}`,
        { method: 'DELETE', headers: HEADERS }
      );
      if (res.ok) {
        const data = await res.json();
        syncSelected(data.crews);
        toast.success('Member removed');
      } else {
        toast.error('Failed to remove member');
      }
    } catch (_e) {
      toast.error('Failed to remove member');
    } finally {
      setRemovingMemberIdx(null);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#000504] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={24} className="text-[#E5E4E2]/40 animate-spin mx-auto" />
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Loading crews...</p>
        </div>
      </div>
    );
  }

  // ── Level badge color ──────────────────────────────────────────────────────
  const levelClass = (level: string) =>
    LEVEL_COLORS[level] ?? 'text-[#E5E4E2] border-[#E5E4E2]/20 bg-[#E5E4E2]/5';

  return (
    <>
    <div className="min-h-screen bg-[#000504] text-white pb-40 marble-bg">
      {/* Header */}
      <div className="bg-[#000504]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-8 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">Crews &amp; Alliances</h2>
          </div>
          <div className="w-12 h-12 platinum-border flex items-center justify-center bg-[#011410]">
            <Users size={20} className="text-[#E5E4E2]" strokeWidth={1.5} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); setSelectedCrew(null); }} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-8">
            {[
              { value: 'crews', label: 'My Crews' },
              { value: 'leaderboard', label: 'Leaderboard' }
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-3 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 data-[state=active]:text-white transition-all"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-6 py-8 space-y-8">

        {/* ── Crew List ─────────────────────────────────────────────────── */}
        {activeTab === 'crews' && !selectedCrew && (
          <>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full p-6 border border-dashed border-[#E5E4E2]/20 flex items-center justify-center gap-4 hover:border-[#E5E4E2]/40 hover:bg-white/5 transition-all group"
            >
              <Plus size={20} className="text-[#E5E4E2]/40 group-hover:text-[#E5E4E2]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#E5E4E2]/40 group-hover:text-[#E5E4E2]">Create New Crew</span>
            </button>

            {crewList.map((crew) => (
              <motion.div
                key={crew.id}
                onClick={() => setSelectedCrew(crew)}
                className="bg-zinc-950 border border-white/10 p-6 cursor-pointer hover:border-[#E5E4E2]/30 transition-all relative overflow-hidden group"
                whileHover={{ y: -2 }}
              >
                <div className="absolute inset-0 marble-bg opacity-10 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                        {crew.emoji}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold uppercase tracking-wider">{crew.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`border text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-none font-bold ${levelClass(crew.level)}`}>
                            {crew.level}
                          </Badge>
                          <span className="text-[8px] uppercase tracking-widest text-white/30">{crew.members?.length || 1} Members</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white/60" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <p className="text-lg font-light font-serif italic">${((crew.totalSpend || 0) / 1000).toFixed(1)}K</p>
                      <p className="text-[7px] uppercase tracking-widest text-white/30 mt-1">Total Spend</p>
                    </div>
                    <div className="text-center border-x border-white/5">
                      <p className="text-lg font-light font-serif italic">{crew.nightsOut || 0}</p>
                      <p className="text-[7px] uppercase tracking-widest text-white/30 mt-1">Nights Out</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-light font-serif italic">{crew.perks?.length || 0}</p>
                      <p className="text-[7px] uppercase tracking-widest text-white/30 mt-1">Perks</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {crewList.length === 0 && (
              <div className="text-center py-16">
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/20">No crews yet — create your first alliance</p>
              </div>
            )}
          </>
        )}

        {/* ── Crew Detail ───────────────────────────────────────────────── */}
        {activeTab === 'crews' && selectedCrew && (
          <div className="space-y-8">
            {/* Back + actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedCrew(null)}
                className="text-white/40 hover:text-white transition-colors text-[9px] uppercase tracking-widest font-bold"
              >
                ← Back
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-red-400/50 hover:text-red-400 transition-colors text-[9px] uppercase tracking-widest font-bold"
              >
                <Trash2 size={12} />
                Disband
              </button>
            </div>

            {/* Crew header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                {selectedCrew.emoji}
              </div>
              <div>
                <h3 className="text-2xl font-serif italic uppercase tracking-wider">{selectedCrew.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`border text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-none font-bold ${levelClass(selectedCrew.level)}`}>
                    {selectedCrew.level}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 p-6 bg-zinc-950 border border-white/10">
              {[
                { label: 'Total Spend', value: `$${((selectedCrew.totalSpend || 0) / 1000).toFixed(1)}K` },
                { label: 'Nights Out', value: selectedCrew.nightsOut || 0 },
                { label: 'Members', value: selectedCrew.members?.length || 1 }
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-light font-serif italic">{s.value}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Level progress */}
            {selectedCrew.nextLevel && (
              <div className="space-y-3">
                <div className="flex justify-between text-[8px] uppercase tracking-widest text-white/30 font-bold">
                  <span>{selectedCrew.level}</span>
                  <span>{selectedCrew.nextLevel.name} (${selectedCrew.nextLevel.spend?.toLocaleString()})</span>
                </div>
                <div className="h-0.5 w-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(((selectedCrew.totalSpend || 0) / selectedCrew.nextLevel.spend) * 100, 100)}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-[#8E8E93] via-[#E5E4E2] to-[#F5F5F7]"
                  />
                </div>
              </div>
            )}

            {/* Members */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Members</h4>
                <button
                  onClick={handleShareInvite}
                  disabled={generatingLink}
                  className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2]/40 hover:text-[#E5E4E2] transition-colors disabled:opacity-40"
                >
                  {generatingLink ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                  {generatingLink ? 'Generating...' : 'Share Invite'}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {(selectedCrew.members || []).map((member: Member, i: number) => (
                  <motion.div
                    key={`${member.name}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-4 border border-white/5 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-white/5 border border-white/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold">{member.avatar}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">{member.name}</p>
                        <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-light font-serif italic">${((member.spend || 0) / 1000).toFixed(1)}K</p>
                      {i !== 0 && (
                        <button
                          onClick={() => handleRemoveMember(i)}
                          disabled={removingMemberIdx === i}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/50 hover:text-red-400 disabled:opacity-30"
                          title="Remove member"
                        >
                          {removingMemberIdx === i
                            ? <Loader2 size={12} className="animate-spin" />
                            : <UserMinus size={12} />
                          }
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Perks */}
            {selectedCrew.perks?.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Crew Perks</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCrew.perks.map((perk: string, i: number) => (
                    <span key={i} className="text-[8px] font-bold uppercase tracking-widest border border-[#E5E4E2]/20 px-3 py-1.5 text-[#E5E4E2]/60">
                      {perk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Leaderboard ───────────────────────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4 mb-6">Global Rankings</h3>
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-4 p-5 border transition-all ${
                  entry.rank === 1 ? 'border-[#E5E4E2]/30 bg-[#E5E4E2]/5' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center font-bold text-[11px] ${
                  entry.rank === 1 ? 'bg-[#E5E4E2] text-[#000504]' : 'bg-white/5 text-white/40'
                }`}>
                  {entry.rank === 1 ? <Crown size={14} /> : `#${entry.rank}`}
                </div>
                <div className="text-2xl">{entry.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest truncate">{entry.name}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{entry.nights} nights</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-light font-serif italic">${((entry.spend || 0) / 1000).toFixed(0)}K</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">Total Spend</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ── Create Crew Modal ──────────────────────────────────────────────── */}
    <AnimatePresence>
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !creating && setShowCreateModal(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-sm bg-zinc-950 border border-white/10 p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-white/30">New Alliance</p>
                <h3 className="text-xl font-serif italic uppercase tracking-wider mt-0.5">Create Crew</h3>
              </div>
              <button onClick={() => !creating && setShowCreateModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 block">Crew Name</label>
                <Input
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  placeholder="ENTER CREW NAME..."
                  maxLength={20}
                  className="bg-transparent border-white/10 rounded-none h-12 text-[10px] uppercase tracking-widest placeholder:text-white/20 focus:border-white transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCrew()}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 block">Crew Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {emojiOptions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewCrewEmoji(emoji)}
                      className={`w-10 h-10 text-xl border transition-all flex items-center justify-center ${
                        newCrewEmoji === emoji ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {newCrewName && (
                <div className="p-4 border border-white/10 bg-zinc-900/40 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                    {newCrewEmoji}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest">{newCrewName.toUpperCase()}</p>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">Bronze • 1 Member</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreateCrew}
                disabled={!newCrewName.trim() || creating}
                className="w-full h-12 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none font-bold text-[9px] uppercase tracking-[0.3em] disabled:opacity-30 !text-black"
              >
                {creating ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                {creating ? 'Creating...' : 'Create Crew'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Invite flow is handled inline by handleShareInvite — no modal needed */}

    {/* ── Disband Confirm Modal ──────────────────────────────────────────── */}
    <AnimatePresence>
      {showDeleteConfirm && selectedCrew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleting && setShowDeleteConfirm(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-sm bg-zinc-950 border border-red-500/20 p-8"
          >
            <div className="mb-6">
              <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-red-400/60 mb-1">Irreversible Action</p>
              <h3 className="text-xl font-serif italic uppercase tracking-wider">Disband Crew?</h3>
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider leading-relaxed mb-8">
              {selectedCrew.emoji} {selectedCrew.name} and all its history will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                className="flex-1 h-12 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:border-white/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCrew}
                disabled={deleting}
                className="flex-1 h-12 bg-red-600/80 hover:bg-red-600 text-white text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Disbanding...' : 'Disband'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}