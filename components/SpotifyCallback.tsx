'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code and state from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Spotify authorization failed: ${error}`);
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
          `https://${projectId}.supabase.co/functions/v1/server/spotify/callback?code=${code}&state=${state}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to connect' }));
          console.error('Spotify callback error:', errorData);
          setStatus('error');
          setMessage(errorData.error || 'Failed to complete Spotify connection');
          setTimeout(() => onError(), 3000);
          return;
        }

        const data = await response.json();

        if (data.success) {
          // Store the userId for future API calls
          localStorage.setItem('spotify_user_id', data.userId);

          setStatus('success');
          setMessage('Successfully connected to Spotify!');
          setTimeout(() => onSuccess(), 2000);
        } else {
          setStatus('error');
          setMessage('Failed to connect to Spotify');
          setTimeout(() => onError(), 3000);
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
        setTimeout(() => onError(), 3000);
      }
    };

    handleCallback();
  }, [onSuccess, onError]);

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
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                <h2 className="text-xl text-center">{message}</h2>
                <p className="text-sm text-gray-400 text-center">
                  This will only take a moment...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-500" />
                <h2 className="text-xl text-center">{message}</h2>
                <p className="text-sm text-gray-400 text-center">
                  Redirecting to your account...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-red-500" />
                <h2 className="text-xl text-center">Connection Failed</h2>
                <p className="text-sm text-gray-400 text-center">{message}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
