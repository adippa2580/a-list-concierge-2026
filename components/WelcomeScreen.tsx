'use client';

import { AListLogo } from './AListLogo';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-24 overflow-hidden bg-[#000504]">
      {/* Background image with overlays */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 scale-110"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=1080&auto=format&fit=crop)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000504] via-[#000504]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#000504]/60 via-transparent to-[#000504]" />
      </div>

      {/* Logo with glow */}
      <div className="absolute top-1/3 -translate-y-1/2 z-10 flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-16 bg-gradient-radial from-[#E5E4E2]/5 via-transparent to-transparent blur-3xl" />
          <AListLogo variant="splash" size="xl" theme="gradient" animated />
        </div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none z-5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-[#E5E4E2]/20 rounded-full animate-pulse"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8 w-full max-w-sm">
        <button 
          onClick={onGetStarted}
          className="w-full py-5 border border-[#E5E4E2]/20 bg-white/5 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-white/10 hover:border-[#E5E4E2]/40 transition-all duration-500 active:scale-[0.98]"
        >
          Login / Apply
        </button>
        <p className="text-[8px] text-white/20 uppercase tracking-[0.3em] text-center">
          By entering you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}