'use client';

import { Settings, Share2, Music, Users, Award, DollarSign, Edit, Calendar, Instagram, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { AListLogo } from './AListLogo';
import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';

const userProfileDefault = {
  name: 'Alex Rivera',
  username: '@alexrivera',
  tier: 'Platinum',
  points: 8450,
  nextTierPoints: 12000,
  totalSpend: 24500,
  badges: ['Early Adopter', 'Club Hopper', 'Music Guru', 'Top Spender'],
  memberSince: 'Jan 2024',
  nightsOut: 47,
  averageSpend: 521,
  avatarUrl: null
};

export function UserProfile({ onClose, onProfileUpdate }: UserProfileProps) {
  const [connections, setConnections] = useState({
    instagram: false,
    spotify: false,
    soundcloud: false
  });
  const [profile, setProfile] = useState<any>(userProfileDefault);
  const [loading, setLoading] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkConnections();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const userId = 'default_user';
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/profile?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          setProfile((prev: any) => ({ ...prev, avatarUrl: data.avatarUrl }));
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const userId = 'default_user';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/profile/upload?userId=${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev: any) => ({ ...prev, avatarUrl: data.avatarUrl }));
        toast.success('Profile picture updated');
        if (onProfileUpdate) onProfileUpdate();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const checkConnections = async () => {
    const userId = 'default_user';
    try {
      // Check Spotify status
      const spotifyRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/spotify/status?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const spotifyData = await spotifyRes.json();
      
      setConnections(prev => ({
        ...prev,
        spotify: spotifyData.connected
      }));

      // Check Instagram status
      const instaRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/instagram/media?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      setConnections(prev => ({
        ...prev,
        instagram: instaRes.ok
      }));
    } catch (e) {
      console.error('Connection check failed', e);
    }
  };

  const handleConnect = async (platform: 'instagram' | 'spotify' | 'soundcloud') => {
    setLoading(platform);
    const userId = 'default_user';
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/${platform}/login?userId=${userId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(`Failed to initiate ${platform} connection`);
      }
    } catch (error) {
      toast.error(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/*"
      />
      <div className="px-6 pt-10 space-y-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-light uppercase tracking-wide leading-none">{profile.name}</h1>
            <p className="text-xs text-white/60 uppercase tracking-widest">{profile.username}</p>
          </div>
          <div className="relative group">
            <Avatar className="w-24 h-24 rounded-none bg-zinc-900 border border-white/10 overflow-hidden gold-border">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <AvatarFallback className="rounded-none bg-zinc-900 text-2xl font-light text-white">
                  {profile.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            >
              <Edit size={20} className="text-white" />
            </button>
          </div>
        </div>
        {/* Remaining UI elements... */}
      </div>
    </div>
  );
}