import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Home } from "./components/Home";
import { VIPStatus } from "./components/VIPStatus";
import { SocialFeed } from "./components/SocialFeed";
import { ArtistDiscovery } from "./components/ArtistDiscovery";
import { VenueDetail } from "./components/VenueDetail";
import { GroupBooking } from "./components/GroupBookingEnhanced";
import { UserProfile } from "./components/UserProfile";
import { Inbox } from "./components/Inbox";
import { CrewBuilder } from "./components/CrewBuilder";
import { YearInReview } from "./components/YearInReview";
import { EventCalendar } from "./components/EventCalendar";
import { BookingsSchedule } from "./components/BookingsSchedule";
import { SplashScreen } from "./components/SplashScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LoginScreen } from "./components/LoginScreen";
import { SpotifyCallback } from "./components/SpotifyCallback";
import { SoundCloudCallback } from "./components/SoundCloudCallback";
import { InstagramCallback } from "./components/InstagramCallback";
import { JoinCrewScreen } from "./components/JoinCrewScreen";
import { OnboardingScreen, ONBOARDING_DONE_KEY } from "./components/OnboardingScreen";
import { MemberClubsFeed } from "./components/MemberClubsFeed";
import { AIConcierge } from "./components/AIConcierge";
import { AdminPortal } from "./components/AdminPortal";
import { HomeV2 } from "./components/HomeV2";
import { PreferencesScreen } from "./components/PreferencesScreen";
import { PasswordResetScreen } from "./components/PasswordResetScreen";
import { AdminGateScreen } from "./components/AdminGateScreen";
import { AListLogo } from "./components/AListLogo";
import { projectId, publicAnonKey } from './utils/supabase/info';
import { supabase } from './utils/supabase/client';
import { useAuth } from './contexts/AuthContext';
import {
  Home as HomeIcon,
  Users,
  Trophy,
  Music,
  User,
  Mail,
  Sparkles,
  Menu,
  X,
  Calendar,
  Shield,
  Crown,
  Building2,
  Share2,
} from "lucide-react";
import { Button } from "./components/ui/button";

type ViewType =
  | "home"
  | "vip"
  | "social"
  | "artists"
  | "venue"
  | "group"
  | "profile"
  | "inbox"
  | "crews"
  | "year-review"
  | "ai-concierge"
  | "calendar"
  | "member-clubs"
  | "bookings"
  | "invite"
  | "admin";

type AppState = "splash" | "welcome" | "login" | "onboarding" | "app" | "spotify-callback" | "soundcloud-callback" | "instagram-callback" | "join-crew" | "password-reset" | "admin-gate";

// ── Invite Screen ─────────────────────────────────────────────────────────────
function InviteScreen({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  const referralCode = userId.slice(0, 8).toUpperCase();
  const inviteUrl = `https://a-list-core-application.web.app?ref=${referralCode}`;
  const inviteMessage = `Join me on A-List \u2014 the exclusive nightlife app for curated events, VIP tables, and crew experiences. Use my invite link: ${inviteUrl}`;

  useEffect(() => {
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.invitesSent) setInviteCount(data.invitesSent);
    }).catch(() => {});
  }, [userId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const shareNative = async () => {
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ invitesSent: inviteCount + 1 }),
    }).catch(() => {});
    setInviteCount(c => c + 1);

    if (navigator.share) {
      try {
        await navigator.share({ title: 'A-List \u2014 Your World, Curated', text: inviteMessage, url: inviteUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-32">
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <p className="text-[7px] uppercase tracking-[0.4em] text-white/30 font-bold">Exclusive Access</p>
        <h1 className="text-3xl font-serif italic text-white mt-1">Invite to A-List</h1>
      </div>

      <div className="px-6 py-8 space-y-8">
        <div className="relative overflow-hidden border border-white/10 p-6 bg-gradient-to-br from-purple-900/20 to-pink-900/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <p className="text-[8px] uppercase tracking-[0.4em] text-purple-400 font-bold mb-3">Your Referral Code</p>
            <p className="text-3xl font-mono font-bold tracking-[0.2em] text-white mb-1">{referralCode}</p>
            <p className="text-[10px] text-white/40 mt-2">Share this code with friends to give them exclusive access to A-List</p>
          </div>
        </div>

        <div>
          <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-3">Invite Link</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/5 border border-white/10 px-4 py-3 text-[10px] text-white/60 font-mono truncate">
              {inviteUrl}
            </div>
            <button onClick={copyLink} className={`px-4 py-3 text-[9px] font-bold uppercase tracking-widest transition-all ${copied ? 'bg-green-500 text-black' : 'bg-white text-black hover:bg-white/90'}`}>
              {copied ? '\u2713 Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <button onClick={shareNative} className="w-full py-4 bg-white text-black font-bold text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white/90 transition-all">
          <Share2 size={16} />
          Share Invite
        </button>

        <div className="grid grid-cols-3 gap-3">
          <a href={`sms:&body=${encodeURIComponent(inviteMessage)}`} className="flex flex-col items-center gap-2 py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <span className="text-lg">\ud83d\udcac</span>
            <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">iMessage</span>
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener" className="flex flex-col items-center gap-2 py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <span className="text-lg">\ud83d\udcf1</span>
            <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">WhatsApp</span>
          </a>
          <a href={`mailto:?subject=${encodeURIComponent('Join A-List')}&body=${encodeURIComponent(inviteMessage)}`} className="flex flex-col items-center gap-2 py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <span className="text-lg">\u2709\ufe0f</span>
            <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Email</span>
          </a>
        </div>

        <div className="border border-white/10 p-5">
          <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-4">Your Invites</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-serif italic text-white">{inviteCount}</p>
              <p className="text-[9px] text-white/40 mt-1">Friends invited</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">
                {inviteCount >= 10 ? 'Ambassador' : inviteCount >= 5 ? 'Connector' : inviteCount >= 1 ? 'Member' : 'Start Inviting'}
              </p>
              <p className="text-[8px] text-white/30 mt-1">
                {inviteCount < 5 ? `${5 - inviteCount} more for Connector status` : inviteCount < 10 ? `${10 - inviteCount} more for Ambassador` : 'Top tier reached'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mb-3">How It Works</p>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your unique invite link with friends' },
              { step: '2', text: 'They sign up using your referral code' },
              { step: '3', text: 'Both of you unlock exclusive perks and status' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white/50 flex-shrink-0">{step}</div>
                <p className="text-[10px] text-white/50">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { userId } = useAuth();
  const [appState, setAppState] = useState<AppState>("splash");
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [useHomeV2, setUseHomeV2] = useState(() => {
    try { return localStorage.getItem('alist_use_v2') === 'true'; } catch { return false; }
  });
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [joinCrewToken, setJoinCrewToken] = useState<string | null>(null);
  const [unreadInvites, setUnreadInvites] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const AVATAR_KEY = 'alist_avatar_url';

  // Load avatar: localStorage (user upload) takes priority over server default
  const loadAvatar = () => {
    const local = localStorage.getItem(AVATAR_KEY);
    if (local) {
      setUserAvatar(local);
      return;
    }
    fetchProfile();
  };

  useEffect(() => {
    loadAvatar();

    // Listen for custom event dispatched by UserProfile after a successful upload
    const handleAvatarUpdated = () => {
      const latest = localStorage.getItem(AVATAR_KEY);
      if (latest) setUserAvatar(latest);
    };
    window.addEventListener('alist-avatar-updated', handleAvatarUpdated);

    // Cross-tab support via the native storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) setUserAvatar(e.newValue);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('alist-avatar-updated', handleAvatarUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/server/invites?userId=${userId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    })
      .then(r => r.json())
      .then(data => setUnreadInvites((data.incoming || []).filter((i: any) => i.status === 'pending').length))
      .catch(() => {});
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Only use server avatar if no local upload exists
        if (data.avatarUrl && !localStorage.getItem(AVATAR_KEY)) {
          localStorage.setItem(AVATAR_KEY, data.avatarUrl);
          setUserAvatar(data.avatarUrl);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Check for OAuth callbacks, email confirmation links, and crew invite links on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const pathname = window.location.pathname;

    // ── Direct admin route: /admin ───────────────────────────────────────────
    if (pathname === '/admin' || pathname === '/admin/') {
      window.history.replaceState({}, document.title, '/');
      setAppState('admin-gate');
      return;
    }

    // ── Email confirmation / magic link ─────────────────────────────────────
    // Supabase sends ?token_hash=xxx&type=email or #access_token=xxx&type=recovery
    const tokenHash = urlParams.get('token_hash');
    const type = urlParams.get('type') ?? hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (tokenHash && type) {
      // Exchange the token for a session then route appropriately
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any })
        .then(({ data, error }) => {
          window.history.replaceState({}, document.title, '/');
          if (!error && data.session) {
            // Recovery type = password reset — show the update password screen
            if (type === 'recovery') {
              setAppState('password-reset');
            } else {
              setAppState('app');
            }
          } else {
            setAppState('login');
          }
        });
      return;
    }

    if (accessToken) {
      // Fragment-based session — Supabase default for password recovery emails
      // MUST check type=recovery BEFORE routing, otherwise lands in app instead of reset screen
      const fragmentType = hashParams.get('type');
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') ?? '',
      }).then(({ error }) => {
        window.history.replaceState({}, document.title, '/');
        if (error) {
          setAppState('login');
        } else if (fragmentType === 'recovery') {
          setAppState('password-reset');
        } else {
          setAppState('app');
        }
      });
      return;
    }

    // ── Crew invite deep link: ?joinCrew=TOKEN ───────────────────────────────
    const joinToken = urlParams.get('joinCrew');
    if (joinToken) {
      setJoinCrewToken(joinToken);
      setAppState('join-crew');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (urlParams.has('code') && urlParams.has('state')) {
      const rawState = urlParams.get('state') ?? '';
      if (rawState.startsWith('soundcloud:')) {
        setAppState('soundcloud-callback');
      } else if (rawState.startsWith('instagram:')) {
        setAppState('instagram-callback');
      } else {
        // Default to Spotify (state = "spotify:userId" or legacy plain userId)
        setAppState('spotify-callback');
      }
    }
  }, []);

  // Auto-transition from splash — check for existing session first
  useEffect(() => {
    if (appState !== "splash") return;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // User has a valid session — go straight to the app
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('onboarding_complete')
              .eq('id', session.user.id)
              .single();
            if (profile?.onboarding_complete) {
              setAppState('app');
              return;
            }
          } catch {
            const done = localStorage.getItem(ONBOARDING_DONE_KEY);
            if (done) { setAppState('app'); return; }
          }
          setAppState('onboarding');
          return;
        }
      } catch {
        // getSession failed — fall through to welcome
      }
      setTimeout(() => setAppState('welcome'), 2500);
    };

    const timer = setTimeout(checkSession, 500);
    return () => clearTimeout(timer);
  }, [appState]);

  const handleLogin = async () => {
    // DB is the source of truth — check onboarding_complete on the profile.
    // Fall back to localStorage only if the DB check fails (e.g. offline).
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();
        if (profile?.onboarding_complete) {
          setAppState('app');
          return;
        }
      }
    } catch {
      // Network failure — fall back to localStorage
      const done = localStorage.getItem(ONBOARDING_DONE_KEY);
      if (done) { setAppState('app'); return; }
    }
    setAppState('onboarding');
  };

  const handleVenueClick = (venue: any) => {
    setSelectedVenue(venue);
    setCurrentView("venue");
    setMenuOpen(false);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };

  const handleBookTable = (venue: any, table?: any) => {
    setSelectedVenue(venue);
    if (table) {
      setSelectedTable(table);
    } else {
      setSelectedTable({
        name: 'Standard Table',
        min: 500,
        capacity: '4-6'
      });
    }
    setCurrentView("group");
    setMenuOpen(false);
  };

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    setMenuOpen(false);
    // Reset scroll position so new screens always start at the top
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };

  // Show splash screen
  if (appState === "splash") {
    return <SplashScreen />;
  }

  // Show welcome screen
  if (appState === "welcome") {
    return <WelcomeScreen onGetStarted={() => setAppState("login")} />;
  }

  // Show login screen
  if (appState === "login") {
    return <LoginScreen onSuccess={handleLogin} />;
  }

  // Show onboarding (first-time only)
  if (appState === "onboarding") {
    return <OnboardingScreen onComplete={() => setAppState("app")} />;
  }

  // Handle Spotify callback
  if (appState === "spotify-callback") {
    return (
      <SpotifyCallback
        onSuccess={handleLogin}
        onError={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          handleLogin();
        }}
      />
    );
  }

  // Handle crew invite deep link
  if (appState === 'join-crew' && joinCrewToken) {
    return (
      <JoinCrewScreen
        token={joinCrewToken}
        onAccepted={() => {
          setJoinCrewToken(null);
          setAppState('app');
          setCurrentView('crews');
        }}
        onDeclined={() => {
          setJoinCrewToken(null);
          setAppState('app');
        }}
      />
    );
  }

  // Handle SoundCloud callback
  if (appState === "soundcloud-callback") {
    return (
      <SoundCloudCallback
        onSuccess={handleLogin}
        onError={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setAppState('login');
        }}
      />
    );
  }

  // Handle Instagram callback
  if (appState === "instagram-callback") {
    return (
      <InstagramCallback
        onSuccess={handleLogin}
        onError={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setAppState('login');
        }}
      />
    );
  }

  // Handle password reset — user arrived via email link, session is active, collect new password
  if (appState === "password-reset") {
    return <PasswordResetScreen onComplete={() => setAppState('app')} />;
  }

  if (appState === "admin-gate") {
    return <AdminGateScreen onUnlock={() => { setAppState('app'); setCurrentView('admin'); }} />;
  }

  // Main app
  return (
    <div className="dark">
      <div className="min-h-screen bg-[#000504] text-white font-sans selection:bg-white/20">
        {/* Mobile App Container */}
        <div className="max-w-md mx-auto bg-[#000504] min-h-screen relative shadow-2xl overflow-hidden">

          {/* Top Bar — Platinum Theme */}
          <div className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-gradient-to-b from-[#000504]/90 to-transparent backdrop-blur-md px-5 py-4 z-50 flex items-center justify-between pointer-events-auto border-b border-[#E5E4E2]/5" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo("profile")} className="relative group">
                <div className="w-10 h-10 platinum-border overflow-hidden bg-[#011410] flex items-center justify-center">
                  {userAvatar ? (
                    <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" loading="eager" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <User size={18} className="text-[#E5E4E2]/40" />
                  )}
                </div>
              </button>
              <AListLogo size="sm" animated variant="icon" />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo("ai-concierge")}
                className="relative p-2 hover:bg-white/5 transition-all group"
              >
                <Sparkles size={18} className="text-[#E5E4E2]/60 group-hover:text-[#E5E4E2] transition-colors" />
              </button>
              <button
                onClick={() => navigateTo("inbox")}
                className="relative p-2 hover:bg-white/5 transition-all group"
              >
                <Mail size={18} className="text-[#E5E4E2]/60 group-hover:text-[#E5E4E2] transition-colors" />
                {unreadInvites > 0 && (
                  <span className="absolute top-1 right-1 bg-white text-[#000504] text-[7px] font-bold w-3.5 h-3.5 flex items-center justify-center">
                    {unreadInvites}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-white/5 transition-all group"
              >
                {menuOpen ? (
                  <X size={20} className="text-white transition-transform duration-300 rotate-90" />
                ) : (
                  <Menu size={20} className="text-[#E5E4E2]/60 group-hover:text-white transition-colors" />
                )}
              </button>
            </div>
          </div>

          {/* Full Screen Side Menu Overlay */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 flex justify-end"
              >
                <div
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative w-full max-w-xs h-full bg-[#000504] border-l border-[#E5E4E2]/10 p-8 shadow-2xl"
                >
                  <div className="pt-20 flex flex-col h-full">
                    <div className="mb-8">
                      <h2 className="text-[10px] font-bold tracking-[0.4em] text-white/30 uppercase mb-6 border-l-2 border-[#E5E4E2]/20 pl-4">Navigation</h2>
                      <div className="space-y-1">
                        <MenuButton icon={User} label="My Profile" onClick={() => navigateTo("profile")} />
                        <MenuButton icon={Users} label="My Crews" onClick={() => navigateTo("crews")} />
                        <MenuButton icon={Building2} label="Member Clubs" onClick={() => navigateTo("member-clubs")} highlight />
                        <MenuButton icon={Calendar} label="Events Calendar" onClick={() => navigateTo("calendar")} />
                        <MenuButton icon={Calendar} label="My Bookings" onClick={() => navigateTo("bookings")} highlight />
                        <MenuButton icon={Shield} label="VIP Status" onClick={() => navigateTo("vip")} />
                        <MenuButton icon={Trophy} label="2025 Year in Review" onClick={() => navigateTo("year-review")} />
                        <MenuButton icon={Sparkles} label="AI Concierge" onClick={() => navigateTo("ai-concierge")} highlight />
                        <MenuButton icon={Share2} label="Invite to A-List" onClick={() => navigateTo("invite")} highlight />
                        <div className="my-3 border-t border-white/8" />
                        <MenuButton icon={Shield} label="Admin Portal" onClick={() => navigateTo("admin")} danger />
                        <MenuButton
                          icon={Sparkles}
                          label={useHomeV2 ? "Switch to Classic Feed" : "Try New Feed (V2)"}
                          onClick={() => {
                            const next = !useHomeV2;
                            setUseHomeV2(next);
                            try { localStorage.setItem('alist_use_v2', String(next)); } catch {}
                            setMenuOpen(false);
                            navigateTo("home");
                          }}
                          highlight
                        />
                      </div>
                    </div>

                    <div className="mt-auto border-t border-white/10 pt-6">
                      <MenuButton
                        icon={User}
                        label="Sign Out"
                        onClick={() => {
                          setAppState("login");
                          setMenuOpen(false);
                        }}
                        danger
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div
            ref={scrollContainerRef}
            className="app-scroll-container overflow-y-auto no-scrollbar scroll-smooth"
            style={{
              height: '100dvh',
              paddingTop: currentView === 'home' && useHomeV2 ? '0' : 'calc(5rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                {currentView === "home" && (
                  useHomeV2 ? (
                    <HomeV2
                      onVenueClick={handleVenueClick}
                      onBookTable={(venue: any) => handleBookTable(venue, null)}
                      onOpenCalendar={() => navigateTo("calendar")}
                      onViewAllArtists={() => navigateTo("artists")}
                      onViewMemberClubs={() => navigateTo("member-clubs")}
                      onOpenPreferences={() => setShowPreferences(true)}
                    />
                  ) : (
                    <Home
                      onVenueClick={handleVenueClick}
                      onBookTable={(venue: any) => handleBookTable(venue, null)}
                      onOpenCalendar={() => navigateTo("calendar")}
                      onViewAllArtists={() => navigateTo("artists")}
                      onViewMemberClubs={() => navigateTo("member-clubs")}
                    />
                  )
                )}
                {currentView === "vip" && <VIPStatus />}
                {currentView === "social" && (
                  <SocialFeed onVenueClick={handleVenueClick} />
                )}
                {currentView === "artists" && <ArtistDiscovery />}
                {currentView === "venue" && selectedVenue && (
                  <VenueDetail
                    venue={selectedVenue}
                    onBookTable={(venue: any) => handleBookTable(venue)}
                    onBack={() => setCurrentView("home")}
                  />
                )}
                {currentView === "group" && selectedVenue && (
                  <GroupBooking
                    venue={{ ...selectedVenue, selectedTable }}
                    onBack={() => setCurrentView("venue")}
                  />
                )}
                {currentView === "profile" && <UserProfile onProfileUpdate={fetchProfile} />}
                {currentView === "inbox" && <Inbox />}
                {currentView === "crews" && <CrewBuilder />}
                {currentView === "year-review" && <YearInReview />}
                {currentView === "ai-concierge" && <AIConcierge />}
                {currentView === "calendar" && <EventCalendar />}
                {currentView === "bookings" && <BookingsSchedule />}
                {currentView === "invite" && <InviteScreen userId={userId} />}
                {currentView === "admin" && <AdminPortal />}
                {currentView === "member-clubs" && (
                  <MemberClubsFeed onManageClubs={() => navigateTo("profile")} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Navigation — Platinum */}
          <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30">
            <div className="absolute inset-0 bg-gradient-to-t from-[#000504] via-[#000504]/95 to-transparent h-24 pointer-events-none" />
            <div className="relative px-6 pt-4 flex items-center justify-between" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <NavButton
                icon={HomeIcon}
                label="Home"
                isActive={currentView === "home"}
                onClick={() => navigateTo("home")}
              />
              <NavButton
                icon={Music}
                label="Artists"
                isActive={currentView === "artists"}
                onClick={() => navigateTo("artists")}
              />
              <NavButton
                icon={Users}
                label="Social"
                isActive={currentView === "social"}
                onClick={() => navigateTo("social")}
              />
              <NavButton
                icon={Building2}
                label="Members"
                isActive={currentView === "member-clubs"}
                onClick={() => navigateTo("member-clubs")}
              />
            </div>
          </nav>

          {/* Floating AI Concierge Button */}
          <AnimatePresence>
            {currentView === 'home' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigateTo("ai-concierge")}
                className="absolute bottom-28 right-6 z-40 bg-white text-[#000504] p-4 shadow-[0_20px_50px_rgba(229,228,226,0.15)] border border-[#E5E4E2]/30 flex items-center gap-0 hover:gap-3 group transition-all duration-500 ease-out"
              >
                <Sparkles size={22} className="text-[#000504] group-hover:rotate-12 transition-transform duration-500 !text-black" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] !text-black max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-500 ease-out whitespace-nowrap opacity-0 group-hover:opacity-100">
                  Concierge
                </span>

                {/* Platinum Glow Pulse */}
                <motion.div
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0, 0.15, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-[#E5E4E2] -z-10"
                />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
      {showPreferences && (
        <div className="fixed inset-0 z-50">
          <PreferencesScreen onClose={() => setShowPreferences(false)} />
        </div>
      )}
    </div>
  );
}

// Helper Components — Platinum Theme

function MenuButton({ icon: Icon, label, onClick, highlight, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 border-l-2 transition-all group ${danger
          ? 'border-transparent text-red-500 hover:bg-red-500/10'
          : highlight
            ? 'border-[#E5E4E2] text-[#E5E4E2] bg-[#E5E4E2]/5 hover:bg-[#E5E4E2]/10'
            : 'border-transparent text-white/40 hover:text-white hover:border-[#E5E4E2]/50 hover:bg-white/5'
        }`}
    >
      <Icon size={18} className={danger ? "" : highlight ? "text-[#E5E4E2]" : "group-hover:text-white transition-colors"} />
      <span className="text-[11px] font-bold tracking-[0.2em] uppercase">{label}</span>
    </button>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 group ${isActive ? "text-white scale-105" : "text-white/25 hover:text-white/60"
        }`}
    >
      <div className={`p-2 transition-all ${isActive ? 'bg-white/10 border border-[#E5E4E2]/20' : 'bg-transparent'}`}>
        <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-[0.3em] ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        {label}
      </span>
    </button>
  );
}