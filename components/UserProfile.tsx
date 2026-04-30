
import { User, Shield, Camera, Music, Music2, TrendingUp, Award, Star, Lock, CheckCircle2, Loader2, Edit2, Check, X, Instagram, Headphones, RefreshCw, ExternalLink, Zap, Building2, Plus, KeyRound, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  onProfileUpdate?: () => void;
}

const AVATAR_STORAGE_KEY    = 'alist_avatar_url';
const CUSTOM_NAME_KEY       = 'alist_custom_name';
const CUSTOM_BIO_KEY        = 'alist_custom_bio';
const CUSTOM_LOC_KEY        = 'alist_custom_location';
const CUSTOM_EMAIL_KEY      = 'alist_custom_email';
const CUSTOM_PHONE_KEY      = 'alist_custom_phone';
const CUSTOM_SINCE_KEY      = 'alist_custom_since';
const CUSTOM_USERNAME_KEY   = 'alist_custom_username';
const CLUBS_KEY             = 'alist_private_clubs';

// Known clubs users can connect — name must match what the backend registry accepts
const KNOWN_CLUBS = [
  'Park House Houston',
  'Park House Dallas',
  'The Crescent Club',
  'Soho House',
  'Zero Bond',
  'The Core Club',
  'Casa Cipriani',
  'The Battery',
  'Aman Club',
];


const ACHIEVEMENT_ICONS: Record<string, any> = {
  'First Table Booking': Star,
  '10 Nights Out': TrendingUp,
  'Crew Captain': Shield,
  '$10K Verified Spend': Award,
};

interface SocialProfile {
  spotify: {
    connected: boolean;
    display_name: string | null;
    avatar_url: string | null;
    followers: number | null;
    id: string | null;
  };
  soundcloud: {
    connected: boolean;
    username: string | null;
    avatar_url: string | null;
    sc_user_id: number | null;
  };
  instagram: {
    connected: boolean;
    username: string | null;
    days_until_expiry: number | null;
  };
  apple_music: {
    connected: boolean;
    storefront: string | null;
    days_until_expiry: number | null;
  };
}

export function UserProfile({ onProfileUpdate }: UserProfileProps) {
  const { userId, user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('identity');

  // Avatar
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile data from API
  const [profile, setProfile]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  // Social connections
  const [social, setSocial]         = useState<SocialProfile | null>(null);
  const [socialLoading, setSocialLoading] = useState(true);

  // Custom overrides (stored in localStorage so they survive refreshes)
  const [customName, setCustomName]         = useState('');
  const [customBio, setCustomBio]           = useState('');
  const [customLoc, setCustomLoc]           = useState('');
  const [customUsername, setCustomUsername] = useState('');

  // Edit mode
  const [editing, setEditing]           = useState(false);
  const [editName, setEditName]         = useState('');
  const [editBio, setEditBio]           = useState('');
  const [editLoc, setEditLoc]           = useState('');
  const [editEmail, setEditEmail]       = useState('');
  const [editPhone, setEditPhone]       = useState('');
  const [editSince, setEditSince]       = useState('');
  const [editUsername, setEditUsername] = useState('');

  // Extra custom overrides
  const [customEmail, setCustomEmail] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customSince, setCustomSince] = useState('');

  // Private clubs
  const [clubs, setClubs]           = useState<Array<{ id: string; name: string; joinedAt: string }>>([]);
  const [showAddClub, setShowAddClub] = useState(false);
  const [clubInput, setClubInput]   = useState('');

  // Load clubs from localStorage
  const loadClubs = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CLUBS_KEY) || '[]');
      setClubs(stored);
    } catch { setClubs([]); }
  };

  const addClub = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = clubs.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) { toast.error('Club already connected'); return; }
    const newClub = { id: crypto.randomUUID(), name: trimmed, joinedAt: new Date().toISOString() };
    const updated = [...clubs, newClub];
    localStorage.setItem(CLUBS_KEY, JSON.stringify(updated));
    setClubs(updated);
    setClubInput('');
    setShowAddClub(false);
    toast.success(`${trimmed} connected`);
    // Persist to database
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ privateClubs: updated.map(c => ({ id: c.id, name: c.name, portalUrl: c.portalUrl || '', connected: true })) }),
    }).catch(() => {});
  };

  const removeClub = (id: string, name: string) => {
    const updated = clubs.filter(c => c.id !== id);
    localStorage.setItem(CLUBS_KEY, JSON.stringify(updated));
    setClubs(updated);
    toast.success(`${name} removed`);
    // Persist to database
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ privateClubs: updated.map(c => ({ id: c.id, name: c.name, portalUrl: c.portalUrl || '', connected: true })) }),
    }).catch(() => {});
  };


  // ── Load everything on mount ───────────────────────────────────────────────
  useEffect(() => {
    // localStorage overrides
    const savedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (savedAvatar) setAvatarUrl(savedAvatar);
    setCustomName(localStorage.getItem(CUSTOM_NAME_KEY) || '');
    setCustomBio(localStorage.getItem(CUSTOM_BIO_KEY) || '');
    setCustomLoc(localStorage.getItem(CUSTOM_LOC_KEY) || '');
    setCustomEmail(localStorage.getItem(CUSTOM_EMAIL_KEY) || '');
    setCustomPhone(localStorage.getItem(CUSTOM_PHONE_KEY) || '');
    setCustomSince(localStorage.getItem(CUSTOM_SINCE_KEY) || '');
    setCustomUsername(localStorage.getItem(CUSTOM_USERNAME_KEY) || '');

    fetchProfile();
    fetchSocialProfile();
    loadClubs();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setProfile(data);

        // Hydrate localStorage from DB if local values are empty (new device / cleared cache)
        if (!localStorage.getItem(CUSTOM_NAME_KEY) && data.name) {
          localStorage.setItem(CUSTOM_NAME_KEY, data.name);
          setCustomName(data.name);
        }
        if (!localStorage.getItem(CUSTOM_BIO_KEY) && data.bio) {
          localStorage.setItem(CUSTOM_BIO_KEY, data.bio);
          setCustomBio(data.bio);
        }
        if (!localStorage.getItem(CUSTOM_LOC_KEY) && data.personalDetails?.location) {
          localStorage.setItem(CUSTOM_LOC_KEY, data.personalDetails.location);
          setCustomLoc(data.personalDetails.location);
        }
        if (!localStorage.getItem(CUSTOM_EMAIL_KEY) && data.personalDetails?.email) {
          localStorage.setItem(CUSTOM_EMAIL_KEY, data.personalDetails.email);
          setCustomEmail(data.personalDetails.email);
        }
        if (!localStorage.getItem(CUSTOM_PHONE_KEY) && data.personalDetails?.phone) {
          localStorage.setItem(CUSTOM_PHONE_KEY, data.personalDetails.phone);
          setCustomPhone(data.personalDetails.phone);
        }
        if (!localStorage.getItem(CUSTOM_SINCE_KEY) && data.memberSince) {
          localStorage.setItem(CUSTOM_SINCE_KEY, data.memberSince);
          setCustomSince(data.memberSince);
        }
        if (!localStorage.getItem(CUSTOM_USERNAME_KEY) && data.username) {
          localStorage.setItem(CUSTOM_USERNAME_KEY, data.username);
          setCustomUsername(data.username);
        }
        // Restore avatar from DB if not in localStorage
        if (!localStorage.getItem(AVATAR_STORAGE_KEY) && data.avatarUrl) {
          localStorage.setItem(AVATAR_STORAGE_KEY, data.avatarUrl);
          setAvatarUrl(data.avatarUrl);
          window.dispatchEvent(new Event('alist-avatar-updated'));
        }
        // Restore private clubs from DB if not in localStorage
        if (data.privateClubs?.length) {
          const localClubs = JSON.parse(localStorage.getItem('alist_private_clubs') || '[]');
          if (localClubs.length === 0) {
            localStorage.setItem('alist_private_clubs', JSON.stringify(data.privateClubs));
            window.dispatchEvent(new Event('alist-clubs-updated'));
          }
        }
      }
    } catch (e) {
      console.error('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialProfile = async () => {
    setSocialLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/social/profile?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) setSocial(await res.json());
    } catch (e) {
      console.error('Social profile fetch error:', e);
    } finally {
      setSocialLoading(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  // Priority: custom override → Instagram username → Spotify display name → SoundCloud username → API default
  const derivedName = (() => {
    if (customName) return customName;
    if (social?.instagram.connected && social.instagram.username) return `@${social.instagram.username}`;
    if (social?.spotify.connected && social.spotify.display_name) return social.spotify.display_name;
    if (social?.soundcloud.connected && social.soundcloud.username) return social.soundcloud.username;
    return profile?.name || 'Your Name';
  })();

  const derivedUsername = (() => {
    if (customUsername) return customUsername.startsWith('@') ? customUsername : `@${customUsername}`;
    if (social?.instagram.connected && social.instagram.username) return `@${social.instagram.username}`;
    if (social?.spotify.connected && social.spotify.display_name) return `@${social.spotify.display_name?.toLowerCase().replace(/\s+/g, '')}`;
    if (social?.soundcloud.connected && social.soundcloud.username) return `@${social.soundcloud.username}`;
    // Don't fall back to the default profile username (it's mock data)
    return '@member';
  })();

  // Avatar: custom upload > social avatar (Spotify → SoundCloud) > null
  const socialAvatar = social?.spotify.avatar_url || social?.soundcloud.avatar_url || null;
  const displayAvatar = avatarUrl || socialAvatar;

  // Bio & location
  const derivedBio = customBio || '';
  const derivedLoc = customLoc || profile?.personalDetails?.location || 'Miami, FL';

  // ── Edit actions ───────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditName(customName || derivedName);
    setEditBio(derivedBio);
    setEditLoc(derivedLoc);
    setEditEmail(customEmail || profile?.personalDetails?.email || '');
    setEditPhone(customPhone || profile?.personalDetails?.phone || '');
    setEditSince(customSince || profile?.memberSince || '');
    // Strip leading @ for the input field
    setEditUsername(customUsername ? customUsername.replace(/^@/, '') : '');
    setEditing(true);
  };

  const saveEdit = async () => {
    localStorage.setItem(CUSTOM_NAME_KEY,     editName.trim());
    localStorage.setItem(CUSTOM_BIO_KEY,      editBio.trim());
    localStorage.setItem(CUSTOM_LOC_KEY,      editLoc.trim());
    localStorage.setItem(CUSTOM_EMAIL_KEY,    editEmail.trim());
    localStorage.setItem(CUSTOM_PHONE_KEY,    editPhone.trim());
    localStorage.setItem(CUSTOM_SINCE_KEY,    editSince.trim());
    localStorage.setItem(CUSTOM_USERNAME_KEY, editUsername.trim());
    setCustomName(editName.trim());
    setCustomBio(editBio.trim());
    setCustomLoc(editLoc.trim());
    setCustomEmail(editEmail.trim());
    setCustomPhone(editPhone.trim());
    setCustomSince(editSince.trim());
    setCustomUsername(editUsername.trim());
    setEditing(false);
    toast.success('Profile updated');
    onProfileUpdate?.();

    // Persist to database (survives across devices/browsers)
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            name: editName.trim(),
            bio: editBio.trim(),
            username: editUsername.trim(),
            personalDetails: {
              location: editLoc.trim(),
              email: editEmail.trim(),
              phone: editPhone.trim(),
            },
            memberSince: editSince.trim(),
          }),
        }
      );
    } catch (_) { /* silent — localStorage is the fallback */ }
  };

  const cancelEdit = () => setEditing(false);

  const resetToSocial = () => {
    localStorage.removeItem(CUSTOM_NAME_KEY);
    localStorage.removeItem(CUSTOM_BIO_KEY);
    localStorage.removeItem(CUSTOM_USERNAME_KEY);
    setCustomName('');
    setCustomBio('');
    setCustomUsername('');
    setEditing(false);
    // Also clear custom avatar to restore social avatar
    localStorage.removeItem(AVATAR_STORAGE_KEY);
    setAvatarUrl(null);
    toast.success('Reset to social profile');
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    const img = new Image();
    img.onload = async () => {
      const MAX = 400;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setUploading(false); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(async (blob) => {
        if (!blob) { toast.error('Failed to compress image'); setUploading(false); return; }
        try {
          const path = userId + '-' + Date.now() + '.jpg';
          const uploadRes = await fetch(
            'https://' + projectId + '.supabase.co/storage/v1/object/avatars/' + path,
            { method: 'POST', headers: { 'Authorization': 'Bearer ' + publicAnonKey, 'apikey': publicAnonKey, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: blob }
          );
          if (!uploadRes.ok) { console.error('Avatar upload failed:', uploadRes.status); toast.error('Could not upload photo'); setUploading(false); return; }
          const publicUrl = 'https://' + projectId + '.supabase.co/storage/v1/object/public/avatars/' + path;
          localStorage.setItem(AVATAR_STORAGE_KEY, publicUrl);
          setAvatarUrl(publicUrl);
          window.dispatchEvent(new Event('alist-avatar-updated'));
          toast.success('Profile photo updated');
          onProfileUpdate?.();
          await fetch('https://' + projectId + '.supabase.co/functions/v1/server/profile?userId=' + userId, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + publicAnonKey }, body: JSON.stringify({ avatarUrl: publicUrl }) });
        } catch (err) { console.error('Avatar upload error:', err); toast.error('Could not save photo'); }
        finally { setUploading(false); }
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { toast.error('Failed to read image'); setUploading(false); };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  // ── Social connect handlers ────────────────────────────────────────────────
  const connectSpotify = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/spotify/login?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('Could not connect Spotify', { description: data.error || 'Check that Spotify credentials are configured' });
      }
    } catch { toast.error('Could not connect Spotify'); }
  };

  const disconnectSpotify = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/spotify/disconnect?userId=${userId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      toast.success('Spotify disconnected');
      fetchSocialProfile();
    } catch { toast.error('Could not disconnect Spotify'); }
  };

  const connectSoundCloud = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/soundcloud/login?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('Could not connect SoundCloud', { description: data.error || 'Check that SoundCloud credentials are configured' });
      }
    } catch { toast.error('Could not connect SoundCloud'); }
  };

  const disconnectSoundCloud = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/soundcloud/disconnect?userId=${userId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      toast.success('SoundCloud disconnected');
      fetchSocialProfile();
    } catch { toast.error('Could not disconnect SoundCloud'); }
  };

  const connectInstagram = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/instagram/login?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('Could not connect Instagram', { description: data.error || 'Check that Instagram credentials are configured' });
      }
    } catch { toast.error('Could not connect Instagram'); }
  };

  const disconnectInstagram = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/instagram/disconnect?userId=${userId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      toast.success('Instagram disconnected');
      fetchSocialProfile();
    } catch { toast.error('Could not disconnect Instagram'); }
  };

  const disconnectAppleMusic = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/apple-music/disconnect?userId=${userId}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      toast.success('Apple Music disconnected');
      fetchSocialProfile();
    } catch { toast.error('Could not disconnect Apple Music'); }
  };

  // Apple Music uses MusicKit JS (in-page SDK) rather than a redirect OAuth flow.
  // We load the SDK, request a developer token from our backend, then prompt
  // the user to authorize — which returns a long-lived user music token we
  // store server-side for reading their taste profile.
  const connectAppleMusic = async () => {
    const loadMusicKit = () => new Promise<void>((resolve, reject) => {
      if ((window as any).MusicKit) return resolve();
      const existing = document.querySelector('script[src*="musickit"]') as HTMLScriptElement | null;
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.async = true;
      script.setAttribute('data-web-components', '');
      script.onload = () => {
        // MusicKit fires 'musickitloaded' after initial setup
        document.addEventListener('musickitloaded', () => resolve(), { once: true });
        setTimeout(() => resolve(), 2000); // fallback
      };
      script.onerror = () => reject(new Error('Failed to load MusicKit'));
      document.head.appendChild(script);
    });

    try {
      toast.loading('Loading Apple Music...', { id: 'apple-music-connect' });

      // 1. Get the developer token from our backend
      const tokenRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/apple-music/developer-token`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const tokenData = await tokenRes.json();
      if (!tokenData.token) {
        toast.error('Apple Music not configured', {
          id: 'apple-music-connect',
          description: tokenData.error || 'Missing developer token'
        });
        return;
      }

      // 2. Load the MusicKit JS SDK
      await loadMusicKit();

      const MusicKit = (window as any).MusicKit;
      if (!MusicKit) {
        toast.error('Could not load Apple Music', { id: 'apple-music-connect' });
        return;
      }

      // 3. Configure MusicKit with our developer token
      await MusicKit.configure({
        developerToken: tokenData.token,
        app: { name: 'A-List', build: '1.0.0' },
      });

      const instance = MusicKit.getInstance();
      toast.dismiss('apple-music-connect');

      // 4. Trigger authorization (Apple ID popup)
      const userToken = await instance.authorize();
      if (!userToken) {
        toast.error('Apple Music authorization cancelled');
        return;
      }

      const storefront = instance.storefrontId || 'us';

      // 5. Store the user token server-side
      const storeRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/apple-music/store-token?userId=${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ userToken, storefront }),
        }
      );
      if (!storeRes.ok) {
        toast.error('Failed to save Apple Music connection');
        return;
      }

      toast.success('Apple Music connected');
      fetchSocialProfile();
    } catch (e: unknown) {
      toast.dismiss('apple-music-connect');
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('denied')) {
        toast.error('Apple Music authorization cancelled');
      } else {
        toast.error('Could not connect Apple Music', { description: msg });
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={24} className="text-[#E5E4E2]/40 animate-spin mx-auto" />
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/30">Loading profile...</p>
        </div>
      </div>
    );
  }

  const stats       = profile?.stats || {};
  const achievements = profile?.achievements || [];

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">

      {/* ── Edit Profile Overlay Modal ──────────────────────────────── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end"
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-[#060d0a] border-t border-white/10 p-6 space-y-6 pb-12"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/50">Edit Profile</h3>
                <button onClick={cancelEdit} className="p-1 text-white/30 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Avatar row */}
              <div className="flex items-center gap-4">
                <div
                  className="relative w-16 h-16 border border-white/10 overflow-hidden bg-[#011410] flex items-center justify-center cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {displayAvatar
                    ? <img src={displayAvatar} alt="avatar" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <User size={24} className="text-white/20" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={14} className="text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/50 mb-1">Profile Photo</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[8px] uppercase tracking-widest text-white/30 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 transition-all"
                  >
                    {uploading ? 'Uploading…' : 'Change Photo'}
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                {/* @Handle — special field with @ prefix display */}
                <div className="space-y-1.5">
                  <label className="text-[8px] uppercase tracking-[0.25em] text-white/30">@ Handle</label>
                  <div className="flex items-center border-b border-white/15 focus-within:border-white/50 transition-colors py-2">
                    <span className="text-white/40 text-xs tracking-widest mr-0.5">@</span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value.replace(/^@+/, '').replace(/\s+/g, ''))}
                      placeholder="yourhandle"
                      className="flex-1 bg-transparent focus:outline-none placeholder:text-white/15 text-[11px] text-white uppercase tracking-widest"
                    />
                  </div>
                </div>

                {[
                  { label: 'Display Name', value: editName,  setter: setEditName,  placeholder: 'Your display name',    type: 'text',  bright: true },
                  { label: 'Bio',          value: editBio,   setter: setEditBio,   placeholder: 'Short bio about yourself', type: 'text',  bright: false },
                  { label: 'Location',     value: editLoc,   setter: setEditLoc,   placeholder: 'City, State',           type: 'text',  bright: false },
                  { label: 'Email',        value: editEmail, setter: setEditEmail, placeholder: 'your@email.com',        type: 'email', bright: false },
                  { label: 'Phone',        value: editPhone, setter: setEditPhone, placeholder: '+1 (000) 000-0000',     type: 'tel',   bright: false },
                  { label: 'Member Since', value: editSince, setter: setEditSince, placeholder: 'e.g. January 2025',    type: 'text',  bright: false },
                ].map(({ label, value, setter, placeholder, type, bright }) => (
                  <div key={label} className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-[0.25em] text-white/30">{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                      className={`w-full bg-transparent border-b border-white/15 focus:border-white/50 focus:outline-none py-2 placeholder:text-white/15 transition-colors text-xs uppercase tracking-widest ${
                        bright ? 'text-white text-sm' : 'text-white/70'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveEdit}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-black font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-[#E5E4E2] transition-colors"
                >
                  <Check size={12} /> Save Changes
                </button>
                {(customName || customBio || avatarUrl) && (
                  <button
                    onClick={resetToSocial}
                    className="px-4 py-3.5 border border-white/10 text-[8px] uppercase tracking-widest text-white/30 hover:text-white/60 hover:border-white/30 transition-all"
                  >
                    Reset
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile Header ───────────────────────────────────────────── */}
      <div className="relative px-6 pt-16 pb-6">
        {/* Social source badge */}
        {!socialLoading && (social?.instagram.connected || social?.spotify.connected || social?.soundcloud.connected) && !customName && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 mb-4"
          >
            <Zap size={9} className="text-[#E5E4E2]/40" />
            <span className="text-[8px] uppercase tracking-[0.25em] text-white/30 font-bold">
              Profile synced from&nbsp;
              {social?.instagram.connected ? 'Instagram' : social?.spotify.connected ? 'Spotify' : 'SoundCloud'}
            </span>
          </motion.div>
        )}

        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 platinum-border overflow-hidden bg-[#011410] flex items-center justify-center">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <User size={32} className="text-[#E5E4E2]/30" />
              )}
            </div>
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-white text-black flex items-center justify-center border border-[#E5E4E2]/20 hover:bg-[#E5E4E2] transition-all"
            >
              {uploading
                ? <div className="w-3 h-3 border border-[#060606] border-t-transparent rounded-full animate-spin" />
                : <Camera size={12} />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

            {/* Identity — no inline edit, pencil triggers modal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-2xl font-serif italic uppercase tracking-wider truncate">{derivedName}</h2>
                <button onClick={startEdit} className="flex-shrink-0 p-1 text-white/20 hover:text-white/60 transition-colors">
                  <Edit2 size={13} />
                </button>
              </div>
              {derivedBio && (
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1 truncate">{derivedBio}</p>
              )}
              <div className="flex items-center gap-3">
                <Badge className="bg-[#E5E4E2]/10 border border-[#E5E4E2]/20 text-[#E5E4E2] text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">
                  {profile?.tier || 'Platinum'}
                </Badge>
                <span className="text-[9px] uppercase tracking-widest text-white/30">{derivedUsername}</span>
              </div>
              {derivedLoc && (
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 mt-1">📍 {derivedLoc}</p>
              )}
            </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/5">
          {[
            { label: 'Sessions',    value: stats.sessions    ?? '—' },
            { label: 'Host Score',  value: stats.hostScore   ?? '—' },
            { label: 'Social Intel', value: stats.socialScore ?? '—' },
            { label: 'Total Spend', value: stats.totalSpend  ? `$${(stats.totalSpend / 1000).toFixed(1)}K` : '—' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-light font-serif italic">{stat.value}</p>
              <p className="text-[7px] uppercase tracking-[0.2em] text-white/30 font-bold mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="px-6 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-xl h-auto p-0 justify-start gap-6 overflow-x-auto scrollbar-hide">
            {['Identity', 'Connections', 'History', 'Vault'].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab.toLowerCase()}
                className="rounded-xl bg-transparent border-b-2 border-transparent px-0 py-3 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 data-[state=active]:text-white transition-all whitespace-nowrap flex-shrink-0"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <div className="px-6 space-y-8">

        {/* IDENTITY TAB */}
        {activeTab === 'identity' && (
          <>
            {/* Social Integration Hub */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
                  Connected Accounts
                </h3>
                <button
                  onClick={fetchSocialProfile}
                  className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
                >
                  <RefreshCw size={9} className={socialLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {/* Instagram */}
              <SocialRow
                icon={<Instagram size={16} className="text-[#E5E4E2]" />}
                name="Instagram"
                connected={social?.instagram.connected ?? false}
                loading={socialLoading}
                handle={social?.instagram.username ? `@${social.instagram.username}` : null}
                meta={social?.instagram.days_until_expiry ? `Token expires in ${social.instagram.days_until_expiry}d` : null}
                avatar={null}
                onConnect={connectInstagram}
                onDisconnect={disconnectInstagram}
                isSource={!customName && social?.instagram.connected === true}
              />

              {/* Spotify */}
              <SocialRow
                icon={<Music size={16} className="text-[#E5E4E2]" />}
                name="Spotify"
                connected={social?.spotify.connected ?? false}
                loading={socialLoading}
                handle={social?.spotify.display_name || null}
                meta={social?.spotify.followers != null ? `${social.spotify.followers.toLocaleString()} followers` : null}
                avatar={social?.spotify.avatar_url || null}
                onConnect={connectSpotify}
                onDisconnect={disconnectSpotify}
                isSource={!customName && !social?.instagram.connected && social?.spotify.connected === true}
              />

              {/* SoundCloud */}
              <SocialRow
                icon={<Headphones size={16} className="text-[#E5E4E2]" />}
                name="SoundCloud"
                connected={social?.soundcloud.connected ?? false}
                loading={socialLoading}
                handle={social?.soundcloud.username ? `@${social.soundcloud.username}` : null}
                meta={null}
                avatar={social?.soundcloud.avatar_url || null}
                onConnect={connectSoundCloud}
                onDisconnect={disconnectSoundCloud}
                isSource={!customName && !social?.instagram.connected && !social?.spotify.connected && social?.soundcloud.connected === true}
              />

              {/* Apple Music */}
              <SocialRow
                icon={<Music2 size={16} className="text-[#E5E4E2]" />}
                name="Apple Music"
                connected={social?.apple_music.connected ?? false}
                loading={socialLoading}
                handle={social?.apple_music.connected ? (social.apple_music.storefront ? `Storefront: ${social.apple_music.storefront.toUpperCase()}` : 'Connected') : null}
                meta={social?.apple_music.days_until_expiry != null ? `Token expires in ${social.apple_music.days_until_expiry}d` : null}
                avatar={null}
                onConnect={connectAppleMusic}
                onDisconnect={disconnectAppleMusic}
                isSource={false}
              />
            </div>

            {/* ── Private Club Memberships ─────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
                  Private Club Memberships
                </h3>
                <button
                  onClick={() => { setShowAddClub(v => !v); setClubInput(''); }}
                  className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors"
                >
                  <Plus size={9} />
                  Add Club
                </button>
              </div>

              {/* Add club panel */}
              <AnimatePresence>
                {showAddClub && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                      <p className="text-[8px] uppercase tracking-[0.2em] text-white/30">Enter your club name</p>
                      {/* Quick-select known clubs */}
                      <div className="flex flex-wrap gap-1.5">
                        {KNOWN_CLUBS.map(c => (
                          <button
                            key={c}
                            onClick={() => addClub(c)}
                            disabled={!!clubs.find(x => x.name.toLowerCase() === c.toLowerCase())}
                            className="px-2.5 py-1 text-[7px] uppercase tracking-widest border border-white/10 hover:border-white/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {/* Or type any custom club */}
                      <div className="flex gap-2">
                        <input
                          value={clubInput}
                          onChange={e => setClubInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addClub(clubInput); }}
                          placeholder="Or type any club…"
                          className="flex-1 bg-transparent border-b border-white/10 focus:border-white/40 outline-none text-[10px] uppercase tracking-widest py-1.5 placeholder:text-white/20 transition-colors"
                        />
                        <button
                          onClick={() => addClub(clubInput)}
                          className="px-3 py-1 bg-white text-black text-[8px] font-bold uppercase tracking-widest hover:bg-[#E5E4E2] transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Connected clubs list */}
              {clubs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 border border-dashed border-white/8">
                  <Building2 size={22} className="text-white/15" />
                  <p className="text-[8px] uppercase tracking-[0.2em] text-white/25">No clubs connected yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {clubs.map(club => (
                    <div key={club.id} className="flex items-center gap-3 p-3.5 border-b border-white/5 group">
                      <div className="w-7 h-7 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <KeyRound size={11} className="text-[#E5E4E2]/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest truncate">{club.name}</p>
                        <p className="text-[7px] uppercase tracking-widest text-white/25 mt-0.5">
                          Connected {new Date(club.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] uppercase tracking-widest text-green-500/70 font-bold">Active</span>
                        <button
                          onClick={() => removeClub(club.id, club.name)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-white/30 transition-all"
                          title="Remove club"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
                Personal Details
              </h3>
              {[
                { label: 'Display Name', value: derivedName },
                { label: 'Email',        value: customEmail || profile?.personalDetails?.email || '—' },
                { label: 'Phone',        value: customPhone || profile?.personalDetails?.phone || '—' },
                { label: 'Location',     value: derivedLoc },
                { label: 'Member Since', value: customSince || profile?.memberSince || 'January 2025' },
              ].map(field => (
                <div key={field.label} className="flex items-center justify-between p-4 border-b border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{field.label}</span>
                  <span className="text-[10px] uppercase tracking-widest">{field.value}</span>
                </div>
              ))}
              <button
                onClick={startEdit}
                className="w-full flex items-center justify-center gap-2 py-3 border border-white/10 hover:border-white/30 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-all"
              >
                <Edit2 size={10} /> Customise Profile
              </button>
            </div>
            {/* ── Discoverability / Privacy ────────────────────────── */}
            <DiscoverabilityToggle />
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Achievements</h3>
            {achievements.length === 0 ? (
              <p className="text-[9px] uppercase tracking-widest text-white/20 text-center py-12">No achievements yet</p>
            ) : achievements.map((achievement: any, index: number) => {
              const Icon = ACHIEVEMENT_ICONS[achievement.name] || Award;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-5 border border-white/10 bg-zinc-950/40"
                >
                  <div className="w-10 h-10 border border-[#E5E4E2]/20 bg-white/5 flex items-center justify-center">
                    <Icon size={16} className="text-[#E5E4E2]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold uppercase tracking-widest">{achievement.name}</h4>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{achievement.date}</p>
                  </div>
                  {achievement.earned && <CheckCircle2 size={14} className="text-green-500" />}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* VAULT TAB */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">Secure Vault</h3>
            <div className="p-12 border border-dashed border-white/10 text-center space-y-4">
              <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
                <Lock size={24} className="text-white/20" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2">Digital Vault</p>
                <p className="text-[9px] text-white/30 uppercase tracking-widest leading-loose">
                  Securely store payment methods, ID verification,<br />and exclusive membership documents.
                </p>
              </div>
              <Button className="bg-white text-black hover:bg-[#E5E4E2] rounded-full font-bold text-[9px] uppercase tracking-[0.3em] !text-black px-8">
                Set Up Vault
              </Button>
            </div>
          </div>
        )}

        {/* CONNECTIONS TAB */}
        {activeTab === 'connections' && (
          <ConnectionsTab
            instagramConnected={social?.instagram.connected ?? false}
            instagramUsername={social?.instagram.username ?? null}
            onConnectInstagram={connectInstagram}
          />
        )}
      </div>
    </div>
  );
}

// ── Discoverability Toggle ─────────────────────────────────────────────────────
function DiscoverabilityToggle() {
  const [discoverable, setDiscoverable] = useState(false); // off by default per spec

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
        Discoverability
      </h3>
      <div className="flex items-start justify-between p-4 border border-white/10 bg-zinc-950/40 gap-4">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white mb-1">Vibe Matching</p>
          <p className="text-[8px] uppercase tracking-widest text-white/30 leading-relaxed">
            Allow A-List to use your Instagram graph for crew matching suggestions. Off by default.
          </p>
        </div>
        <button
          onClick={() => setDiscoverable(d => !d)}
          className={`flex-shrink-0 w-11 h-6 border transition-all relative ${
            discoverable ? 'bg-white border-white' : 'bg-transparent border-white/20 hover:border-white/40'
          }`}
          aria-label="Toggle discoverability"
        >
          <span className={`absolute top-0.5 w-5 h-5 transition-all ${
            discoverable ? 'left-5 bg-[#060606]' : 'left-0.5 bg-white/30'
          }`} />
        </button>
      </div>
      {discoverable && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[7px] uppercase tracking-widest text-[#E5E4E2]/40 px-1"
        >
          ✓ Your Instagram graph is active for crew matching. Switch off anytime.
        </motion.p>
      )}
    </div>
  );
}

// ── Connections Tab ────────────────────────────────────────────────────────────
function ConnectionsTab({ instagramConnected, instagramUsername, onConnectInstagram }: {
  instagramConnected: boolean;
  instagramUsername: string | null;
  onConnectInstagram: () => void;
}) {
  const [inviteSent, setInviteSent] = useState<Record<number, boolean>>({});

  // Simulated vibe-matched connections derived from Instagram graph
  const vibeMatches = [
    {
      id: 1,
      name: 'Sofia R.',
      handle: '@sofiaramos',
      avatar: 'SR',
      mutualVenues: ['LIV Miami', 'E11even'],
      mutualCount: 3,
      vibeScore: 94,
      tags: ['House', 'Techno'],
      status: 'mutual',
    },
    {
      id: 2,
      name: 'Marco D.',
      handle: '@marcodeluca',
      avatar: 'MD',
      mutualVenues: ['Story', 'Treehouse'],
      mutualCount: 2,
      vibeScore: 87,
      tags: ['Hip-Hop', 'Latin'],
      status: 'mutual',
    },
    {
      id: 3,
      name: 'Jade K.',
      handle: '@jadekwon',
      avatar: 'JK',
      mutualVenues: ['LIV Miami'],
      mutualCount: 1,
      vibeScore: 79,
      tags: ['Afro House'],
      status: 'following',
    },
    {
      id: 4,
      name: 'Alex V.',
      handle: '@alexvera',
      avatar: 'AV',
      mutualVenues: ['Factory Town', 'E11even'],
      mutualCount: 4,
      vibeScore: 91,
      tags: ['Techno', 'House'],
      status: 'mutual',
    },
  ];

  if (!instagramConnected) {
    return (
      <div className="space-y-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
          Connections
        </h3>
        <div className="border border-dashed border-white/10 p-10 text-center space-y-5">
          <div className="w-12 h-12 border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
            <Instagram size={20} className="text-white/20" />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest">Connect Instagram</p>
            <p className="text-[8px] uppercase tracking-widest text-white/25 leading-relaxed">
              Link Instagram to surface mutual connections and shared taste as crew suggestions.
              Your graph is never shared publicly.
            </p>
          </div>
          <button
            onClick={onConnectInstagram}
            className="px-6 py-3 bg-white text-black font-bold text-[9px] uppercase tracking-[0.3em] hover:bg-[#E5E4E2] transition-all !text-black"
          >
            Connect Instagram
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 border-l-2 border-[#E5E4E2]/20 pl-4">
          Vibe Matches
        </h3>
        {instagramUsername && (
          <p className="text-[7px] uppercase tracking-widest text-white/20">@{instagramUsername}</p>
        )}
      </div>

      <p className="text-[8px] uppercase tracking-widest text-white/25 leading-relaxed">
        People from your Instagram network with overlapping venue history. Suggested as potential crew members — not shared without your invite.
      </p>

      <div className="space-y-3">
        {vibeMatches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="border border-white/10 bg-zinc-950/40 p-4"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-white/50">{match.avatar}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest truncate">{match.name}</p>
                    <span className="text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 border border-[#E5E4E2]/20 text-[#E5E4E2]/50 flex-shrink-0">
                      {match.status === 'mutual' ? 'Mutual' : 'Following'}
                    </span>
                  </div>
                  {/* Vibe score */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[9px] font-bold text-[#E5E4E2]">{match.vibeScore}%</p>
                    <p className="text-[6px] uppercase tracking-widest text-white/25">Vibe Match</p>
                  </div>
                </div>

                <p className="text-[8px] uppercase tracking-widest text-white/30 mb-2">{match.handle}</p>

                {/* Shared venues */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[7px] uppercase tracking-widest text-white/20">Both been to:</span>
                  {match.mutualVenues.map(v => (
                    <span key={v} className="text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border border-white/10 text-white/40">
                      {v}
                    </span>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex items-center gap-1.5 mb-3">
                  {match.tags.map(tag => (
                    <span key={tag} className="text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-[#E5E4E2]/5 border border-[#E5E4E2]/10 text-[#E5E4E2]/40">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Invite CTA */}
                {inviteSent[match.id] ? (
                  <div className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-green-500">
                    <Check size={11} />
                    In-app invite sent
                  </div>
                ) : (
                  <button
                    onClick={() => setInviteSent(prev => ({ ...prev, [match.id]: true }))}
                    className="text-[8px] font-bold uppercase tracking-widest text-[#E5E4E2] border-b border-[#E5E4E2]/40 pb-0.5 hover:border-[#E5E4E2] transition-all"
                  >
                    Invite to Crew →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-[7px] uppercase tracking-widest text-white/15 text-center leading-relaxed">
        Matches are derived from shared venues &amp; music taste. Turn off in Identity → Discoverability.
      </p>
    </div>
  );
}

// ── Social Row sub-component ───────────────────────────────────────────────────
function SocialRow({
  icon, name, connected, loading, handle, meta, avatar, onConnect, onDisconnect, isSource,
}: {
  icon: React.ReactNode;
  name: string;
  connected: boolean;
  loading: boolean;
  handle: string | null;
  meta: string | null;
  avatar: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isSource: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 border transition-all ${isSource ? 'border-[#E5E4E2]/30 bg-white/[0.03]' : 'border-white/10 bg-zinc-950/40'}`}>
      <div className="flex items-center gap-4">
        {/* Avatar or icon */}
        <div className="w-10 h-10 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-widest">{name}</h4>
            {isSource && (
              <span className="text-[7px] font-bold uppercase tracking-widest text-[#E5E4E2]/60 border border-[#E5E4E2]/20 px-1.5 py-0.5">
                Active Source
              </span>
            )}
          </div>
          {loading ? (
            <div className="w-16 h-2 bg-white/10 animate-pulse mt-1.5 rounded-sm" />
          ) : connected ? (
            <>
              {handle && <p className="text-[9px] text-white/50 uppercase tracking-widest mt-0.5">{handle}</p>}
              {meta && <p className="text-[8px] text-white/30 uppercase tracking-widest mt-0.5">{meta}</p>}
            </>
          ) : (
            <p className="text-[9px] text-white/20 uppercase tracking-widest mt-0.5">Not connected</p>
          )}
        </div>
      </div>

      {loading ? (
        <Loader2 size={12} className="text-white/20 animate-spin" />
      ) : connected ? (
        <div className="flex items-center gap-3">
          <Badge className="bg-green-500/10 border border-green-500/20 text-green-500 text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">
            Synced
          </Badge>
          <button
            onClick={onDisconnect}
            className="text-[8px] font-bold uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors border-b border-red-400/30 hover:border-red-400 pb-0.5"
            title="Disconnect this account"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="text-[9px] font-bold uppercase tracking-widest text-[#E5E4E2] hover:text-white transition-colors border-b border-[#E5E4E2] pb-0.5"
        >
          Connect
        </button>
      )}
    </div>
  );
}

