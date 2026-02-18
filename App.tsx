import { useState, useEffect } from "react";
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
import { SplashScreen } from "./components/SplashScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LoginScreen } from "./components/LoginScreen";
import { SpotifyCallback } from "./components/SpotifyCallback";
import { AIConcierge } from "./components/AIConcierge";
import { AListLogo } from "./components/AListLogo";
import { projectId, publicAnonKey } from './utils/supabase/info';
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
  | "calendar";

type AppState = "splash" | "welcome" | "login" | "app" | "spotify-callback";

export default function App() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [currentView, setCurrentView] =
    useState<ViewType>("home");
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const unreadInvites = 3;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server/profile?userId=default_user`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) setUserAvatar(data.avatarUrl);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Check for Spotify callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && urlParams.has('state')) {
      setAppState('spotify-callback');
    }
  }, []);

  // Auto-transition from splash to login after 3 seconds
  useEffect(() => {
    if (appState === "splash") {
      const timer = setTimeout(() => {
        setAppState("welcome");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const handleLogin = () => {
    setAppState("app");
  };

  const handleVenueClick = (venue: any) => {
    setSelectedVenue(venue);
    setCurrentView("venue");
    setMenuOpen(false);
  };

  const handleBookTable = (venue: any, table?: any) => {
    setSelectedVenue(venue);
    if (table) {
      setSelectedTable(table);
    } else {
      // Fallback or default table if none passed
      setSelectedTable({
        name: 'Standard Table',
        minSpend: 500,
        capacity: '4-6 people'
      });
    }
    setCurrentView("group");
    setMenuOpen(false);
  };

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    setMenuOpen(false);
  };

  // Show splash screen
  if (appState === "splash") {
    return <SplashScreen />;
  }

  // Show welcome screen
  if (appState === "welcome") {
    return <WelcomeScreen onStart={() => setAppState("login")} />;
  }

  // Show login screen
  if (appState === "login") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Handle Spotify callback
  if (appState === "spotify-callback") {
    return (
      <SpotifyCallback
        onSuccess={handleLogin}
        onError={() => {
          // Clear URL params and return to login
          window.history.replaceState({}, document.title, window.location.pathname);
          setAppState('login');
        }}
      />
    );
  }

  // Main app
  return (
    <div className="dark">
      <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20">
        {/* Mobile App Container */}
        <div className="max-w-md mx-auto bg-black min-h-screen relative shadow-2xl overflow-hidden">

          {/* Top Bar */}
          <div className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-gradient-to-b from-black/80 to-transparent backdrop-blur-md px-5 py-4 z-50 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo("profile")} className="relative group">
                <div className="w-10 h-10 gold-border overflow-hidden bg-zinc-900 flex items-center justify-center">
                  {userAvatar ? (
                    <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-white/40" />
                  )}
                </div>
              </button>
              <AListLogo size="sm" animated variant="icon" />
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateTo("ai-concierge")}
                className="relative p-2 hover:bg-white/5 rounded-full transition-all group"
              >
                <Sparkles size={18} className="text-white/70 group-hover:text-white transition-colors" />
              </button>
              <button
                onClick={() => navigateTo("inbox")}
                className="relative p-2 hover:bg-white/5 rounded-full transition-all group"
              >
                <Mail size={18} className="text-white/70 group-hover:text-white transition-colors" />
                {unreadInvites > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-white text-black text-[8px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
                    {unreadInvites}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-white/5 rounded-full transition-all group"
              >
                {menuOpen ? (
                  <X size={20} className="text-white transition-transform duration-300 rotate-90" />
                ) : (
                  <Menu size={20} className="text-white/70 group-hover:text-white transition-colors" />
                )}
              </button>
            </div>
          </div>

          {/* Full Screen Side Menu Overlay */}
          {menuOpen && (
            <div className="fixed inset-0 z-40 flex justify-end">
              <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setMenuOpen(false)}
              />
              <div className="relative w-full max-w-xs h-full bg-zinc-950 border-l border-white/10 p-8 shadow-2xl animate-in slide-in-from-right duration-500">
                <div className="pt-20 flex flex-col h-full">
                  <div className="mb-8">
                    <h2 className="text-xs font-bold tracking-[0.2em] text-white/40 uppercase mb-4">Navigation</h2>
                    <div className="space-y-2">
                      <MenuButton icon={User} label="My Profile" onClick={() => navigateTo("profile")} />
                      <MenuButton icon={Users} label="My Crews" onClick={() => navigateTo("crews")} />
                      <MenuButton icon={Calendar} label="Events Calendar" onClick={() => navigateTo("calendar")} />
                      <MenuButton icon={Trophy} label="2024 Year in Review" onClick={() => navigateTo("year-review")} />
                      <MenuButton icon={Sparkles} label="AI Concierge" onClick={() => navigateTo("ai-concierge")} highlight />
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
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="h-screen overflow-y-auto pb-24 pt-20 no-scrollbar scroll-smooth">
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
                  <Home
                    onVenueClick={handleVenueClick}
                    onBookTable={(venue) => handleBookTable(venue, null)}
                    onOpenCalendar={() => navigateTo("calendar")}
                    onViewAllArtists={() => navigateTo("artists")}
                  />
                )}
                {currentView === "vip" && <VIPStatus />}
                {currentView === "social" && (
                  <SocialFeed onVenueClick={handleVenueClick} />
                )}
                {currentView === "artists" && <ArtistDiscovery />}
                {currentView === "venue" && selectedVenue && (
                  <VenueDetail
                    venue={selectedVenue}
                    onBook={(table) => handleBookTable(selectedVenue, table)}
                    onBack={() => setCurrentView("home")}
                  />
                )}
                {currentView === "group" && selectedVenue && (
                  <GroupBooking
                    venue={selectedVenue}
                    selectedTable={selectedTable}
                    onBack={() => setCurrentView("venue")}
                  />
                )}
                {currentView === "profile" && <UserProfile onProfileUpdate={fetchProfile} />}
                {currentView === "inbox" && <Inbox />}
                {currentView === "crews" && <CrewBuilder />}
                {currentView === "year-review" && <YearInReview />}
                {currentView === "ai-concierge" && <AIConcierge />}
                {currentView === "calendar" && <EventCalendar />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-transparent h-24 pointer-events-none" />
            <div className="relative px-6 pb-6 pt-4 flex items-center justify-between">
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
                icon={Trophy}
                label="VIP"
                isActive={currentView === "vip"}
                onClick={() => navigateTo("vip")}
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
                className="absolute bottom-28 right-6 z-40 bg-white text-zinc-950 p-4 rounded-full shadow-[0_20px_50px_rgba(255,255,255,0.2)] border border-white/20 flex items-center gap-0 hover:gap-3 group transition-all duration-500 ease-out"
              >
                <Sparkles size={22} className="text-zinc-950 group-hover:rotate-12 transition-transform duration-500 !text-black" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] !text-black max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-500 ease-out whitespace-nowrap opacity-0 group-hover:opacity-100">
                  Concierge
                </span>

                {/* Premium Glow Effect */}
                <motion.div
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0, 0.2, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-white rounded-full -z-10"
                />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function MenuButton({ icon: Icon, label, onClick, highlight, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-none border-l-2 transition-all group ${danger
          ? 'border-transparent text-red-500 hover:bg-red-500/10'
          : highlight
            ? 'border-purple-500 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10'
            : 'border-transparent text-gray-400 hover:text-white hover:border-white/50 hover:bg-white/5'
        }`}
    >
      <Icon size={18} className={danger ? "" : highlight ? "text-purple-400" : "group-hover:text-white transition-colors"} />
      <span className="text-sm font-medium tracking-wide uppercase">{label}</span>
    </button>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 group ${isActive ? "text-white scale-105" : "text-white/30 hover:text-white/70"
        }`}
    >
      <div className={`p-2 rounded-full transition-all ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        {label}
      </span>
    </button>
  );
}