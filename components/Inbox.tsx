'use client';

import { Calendar, MapPin, Users, Check, X, Clock, Search, Filter, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { AListLogo } from './AListLogo';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

interface InboxProps {
  onBack?: () => void;
}

const API = `https://${projectId}.supabase.co/functions/v1/server`;
const HEADERS = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

export function Inbox({ onBack }: InboxProps) {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [inviteData, setInviteData] = useState<{ incoming: any[]; sent: any[] }>({ incoming: [], sent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/invites?userId=${userId}`, { headers: HEADERS });
      if (res.ok) setInviteData(await res.json());
    } catch (e) {
      console.error('Failed to load invites', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      const res = await fetch(`${API}/invites?userId=${userId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ id, status: 'accepted' })
      });
      if (res.ok) {
        setInviteData(await res.json());
        toast.success('Invitation Accepted');
      }
    } catch (_e) {
      toast.error('Failed to accept invite');
    }
  };

  const handleDecline = async (id: number) => {
    try {
      const res = await fetch(`${API}/invites?userId=${userId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ id, status: 'declined' })
      });
      if (res.ok) {
        setInviteData(await res.json());
        toast('Invitation Declined');
      }
    } catch (_e) {
      toast.error('Failed to decline invite');
    }
  };

  const visibleIncoming = inviteData.incoming.filter(inv => inv.status !== 'declined');
  const unreadCount = inviteData.incoming.filter(inv => inv.unread && inv.status === 'pending').length;

  const filterBySearch = (arr: any[]) =>
    searchQuery
      ? arr.filter(inv =>
          inv.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.from?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.message?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : arr;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000504] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={24} className="text-[#E5E4E2]/40 animate-spin mx-auto" />
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Loading invitations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000504] text-white pb-20 marble-bg">
      {/* Header */}
      <div className="bg-[#000504]/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-16 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">Invitations</h1>
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <span className="text-[9px] font-bold uppercase tracking-widest bg-white text-black px-2 py-0.5">
                {unreadCount} New
              </span>
            )}
            <button
              onClick={() => setFilterActive(f => !f)}
              className={`transition-colors ${filterActive ? 'text-white' : 'text-white/60 hover:text-white'}`}
              title={filterActive ? 'Showing unread only' : 'Show all'}
            >
              <Filter size={18} className={filterActive ? 'fill-white/20' : ''} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 group">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white transition-colors" size={14} />
          <Input
            type="text"
            placeholder="SEARCH INVITES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-transparent border-0 border-b border-white/20 rounded-none px-0 py-2 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:border-white transition-all tracking-[0.2em] text-[10px] font-bold uppercase h-10 w-full"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-8">
            {[
              { value: 'all', label: 'All' },
              { value: 'incoming', label: 'Received' },
              { value: 'sent', label: 'Sent' }
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 data-[state=active]:text-white transition-all"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-4">
        {activeTab === 'all' && filterBySearch([
          ...visibleIncoming.map(inv => ({ ...inv, _type: 'incoming' as const })),
          ...inviteData.sent.map(inv => ({ ...inv, _type: 'sent' as const }))
        ])
          .filter(inv => !filterActive || (inv._type === 'incoming' && inv.status === 'pending'))
          .map((invite: any) => (
            <InviteCard key={invite.id} invite={invite} type={invite._type}
              onAccept={handleAccept} onDecline={handleDecline} />
          ))
        }

        {activeTab === 'incoming' && filterBySearch(visibleIncoming)
          .filter(inv => !filterActive || inv.status === 'pending')
          .map((invite) => (
            <InviteCard key={invite.id} invite={invite} type="incoming"
              onAccept={handleAccept} onDecline={handleDecline} />
          ))
        }

        {activeTab === 'sent' && filterBySearch(inviteData.sent).map((invite) => (
          <InviteCard key={invite.id} invite={invite} type="sent" />
        ))}

        {/* Empty states */}
        {activeTab === 'all' && filterBySearch(visibleIncoming).length === 0 && inviteData.sent.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/20">No invitations yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InviteCard({ invite, type, onAccept, onDecline }: {
  invite: any;
  type: 'incoming' | 'sent';
  onAccept?: (id: number) => void;
  onDecline?: (id: number) => void;
}) {
  const accepted = invite.status === 'accepted';

  if (type === 'incoming') {
    return (
      <div className={`border p-5 group transition-all ${
        accepted ? 'border-green-500/30 bg-green-500/5 opacity-70' :
        invite.unread && invite.status === 'pending' ? 'border-white bg-white/5' : 'border-white/10 bg-transparent hover:border-white/40'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-zinc-900 border border-white/30 flex items-center justify-center">
              <span className="text-[10px] text-white/80">{invite.from?.avatar}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">{invite.from?.name}</span>
                <span className="text-[8px] uppercase tracking-widest text-white/60 border border-white/20 px-1">{invite.from?.tier}</span>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">{invite.time}</p>
            </div>
          </div>
          {accepted ? (
            <span className="text-[8px] font-bold uppercase tracking-widest text-green-500 border border-green-500/30 px-2 py-0.5">Accepted</span>
          ) : invite.unread && invite.status === 'pending' ? (
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          ) : null}
        </div>

        <div className="pl-14 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-light uppercase tracking-wide">{invite.venue}</h4>
            <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-white/80">
              <span>{invite.date}</span>
              <span>•</span>
              <span>{invite.tableType}</span>
            </div>
          </div>

          <div className="border border-white/20 p-3 bg-zinc-900/30">
            <p className="text-xs font-light italic text-white">"{invite.message}"</p>
          </div>

          <div className="flex justify-between items-center border-t border-white/10 pt-3">
            <div className="text-[9px] uppercase tracking-widest text-white/80">
              {invite.currentPeople}/{invite.totalPeople} Confirmed • ${invite.costPerPerson}/person
            </div>
            {!accepted && (
              <div className="flex gap-4">
                <button
                  onClick={() => onDecline?.(invite.id)}
                  className="text-[9px] font-bold uppercase tracking-widest text-white/60 hover:text-red-400 transition-colors"
                >Decline</button>
                <button
                  onClick={() => onAccept?.(invite.id)}
                  className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-white/70 border-b border-white pb-0.5"
                >Accept</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sent invite
  return (
    <div className="border border-white/10 p-5 bg-transparent hover:border-white/40 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest text-white/60">To:</span>
          <div className="flex -space-x-2">
            {(invite.to || []).slice(0, 3).map((recipient: any, index: number) => (
              <div key={index} className="w-6 h-6 bg-zinc-900 border border-white/30 flex items-center justify-center">
                <span className="text-[8px] text-white/80">{recipient.avatar}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-white/60">{invite.time}</span>
      </div>

      <div className="space-y-1 mb-4">
        <h4 className="text-sm font-light uppercase tracking-wide">{invite.venue}</h4>
        <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-white/80">
          <span>{invite.date}</span>
          <span>•</span>
          <span>{invite.tableType}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[9px] uppercase tracking-widest border-t border-white/10 pt-3">
        <div className="text-white/60">
          <span className="block text-xs font-bold text-white">{invite.accepted ?? '—'}</span>
          Accepted
        </div>
        <div className="text-white/60">
          <span className="block text-xs font-bold text-white">{invite.pending ?? '—'}</span>
          Pending
        </div>
        <div className="text-white/60">
          <span className="block text-xs font-bold text-white">{invite.declined ?? '—'}</span>
          Declined
        </div>
      </div>
    </div>
  );
}