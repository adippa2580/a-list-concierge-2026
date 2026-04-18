import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase/client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userId: string;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  userId: 'default_user',
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Stay in sync with auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Create profile if user just signed up or logged in for the first time
      if (session?.user) {
        const userId = session.user.id;
        const email = session.user.email;
        
        try {
          // Check if profile exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();
          
          // If no profile exists, create one
          if (!existingProfile) {
            await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: email || '',
                display_name: email?.split('@')[0] || 'User',
                tier: 'standard',
                total_spend: 0,
                visits: 0,
                spotify_connected: false,
                soundcloud_connected: false,
                instagram_connected: false,
                onboarding_complete: false,
              });
          }
        } catch (err) {
          console.error('Failed to create profile:', err);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Fall back to 'default_user' only in prototype / pre-auth state
  const userId = user?.id ?? 'default_user';

  return (
    <AuthContext.Provider value={{ user, session, userId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
