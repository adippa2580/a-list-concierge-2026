'use client';

import { useEffect, useState } from 'react';
import { AListLogo } from './AListLogo';
import { Loader2, CheckCircle, XCircle, Music } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface SoundCloudCallbackProps {
  onSuccess: () => void;
  onError: () => void;
}

export function SoundCloudCallback({ onSuccess, onError }: SoundCloudCallbackProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your SoundCloud account...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`SoundCloud authorization failed: ${error}`);
          setTimeout(() => onError(), 3000);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code. Please try again.');
          setTimeout(() => onError(), 3000);
          return;
        }

        // Exchange code for tokens via backend
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/server/soundcloud/callback?code=${code}&state=${state}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to connect' }));
          console.error('SoundCloud callback error:', errorData);
          setStatus('error');
          setMessage(errorData.error || 'Failed to complete SoundCloud connection');
          setTimeout(() => onError(), 3000);
          return;
        }

        const data = await response.json();

        if (data.success) {
          localStorage.setItem('soundcloud_user_id', data.userId);
          setStatus('success');
          setMessage(`Linked to SoundCloud${data.username ? ` as ${data.username}` : ''}!`);
          setTimeout(() => onSuccess(), 2000);
        } else {
          setStatus('error');
          setMessage('Failed to connect to SoundCloud');
          setTimeout(() => onError(), 3000);
        }
      } catch (error) {
        console.error('SoundCloud callback processing error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
        setTimeout(() => onError(), 3000);
      }
    };

    handleCallback();
  }, [onSuccess, onError]);

  return (
    <div className="min-h-screen bg-[#060606] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <AListLogo variant="splash" size="xl" />
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-sm border border-white/10 p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {status === 'loading' && (
              <>
                <div className="relative">
                  <Loader2 className="w-14 h-14 text-[#ff5500] animate-spin" />
                  <Music className="w-5 h-5 text-[#ff5500]/60 absolute inset-0 m-auto" />
                </div>
                <h2 className="text-base font-light tracking-widest uppercase text-white/80 text-center">{message}</h2>
                <p className="text-xs text-white/30 uppercase tracking-widest text-center">
                  This will only take a moment…
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-14 h-14 text-green-500" />
                <h2 className="text-base font-light tracking-widest uppercase text-white/80 text-center">{message}</h2>
                <p className="text-xs text-white/30 uppercase tracking-widest text-center">
                  Redirecting to your profile…
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-14 h-14 text-red-500" />
                <h2 className="text-base font-light tracking-widest uppercase text-white/80 text-center">Connection Failed</h2>
                <p className="text-xs text-white/40 text-center">{message}</p>
              </>
            )}
          </div>
        </div>

        {/* SoundCloud brand mark */}
        <p className="text-center text-[8px] uppercase tracking-[0.3em] text-white/20">
          Powered by SoundCloud
        </p>
      </div>
    </div>
  );
}
