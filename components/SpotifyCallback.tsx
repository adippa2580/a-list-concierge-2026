'use client';

import { useEffect, useState, useRef } from 'react';
import { AListLogo } from './AListLogo';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface SpotifyCallbackProps {
  onSuccess: () => void;
  onError: () => void;
}

export function SpotifyCallback({ onSuccess, onError }: SpotifyCallbackProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Spotify account...');
  const didRun = useRef(false);

  useEffect(() => {
    // Prevent double-fire in React strict mode
    if (didRun.current) return;
    didRun.current = true;

    const handleCallback = async () => {
      // Clear URL params immediately to prevent re-fire on navigation
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Spotify authorization was declined`);
          setTimeout(() => onError(), 2000);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code. Please try again.');
          setTimeout(() => onError(), 2000);
          return;
        }

        // Exchange code for tokens via backend
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/server/spotify/callback?code=${code}&state=${state}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        const data = await response.json().catch(() => ({ error: 'Failed to connect' }));

        if (response.ok && data.success) {
          localStorage.setItem('spotify_user_id', data.userId);
          setStatus('success');
          setMessage('Spotify connected!');
          setTimeout(() => onSuccess(), 1500);
        } else {
          console.error('Spotify callback error:', data);
          setStatus('error');
          setMessage(data.spotify_error ? 'Connection failed — please try again' : (data.error || 'Failed to connect'));
          setTimeout(() => onSuccess(), 2500); // Go to app anyway — user is logged in
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
        setTimeout(() => onSuccess(), 2500); // Go to app anyway
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-pink-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <AListLogo variant="splash" size="xl" />
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-3xl p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-[#E5E4E2]/40 animate-spin" />
                <h2 className="text-xl text-center">{message}</h2>
                <p className="text-[9px] uppercase tracking-widest text-white/30 text-center">
                  This will only take a moment...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-500" />
                <h2 className="text-xl text-center">{message}</h2>
                <p className="text-[9px] uppercase tracking-widest text-white/30 text-center">
                  Redirecting to your account...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-red-500" />
                <h2 className="text-xl text-center">Connection Failed</h2>
                <p className="text-[9px] uppercase tracking-widest text-white/30 text-center">{message}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
