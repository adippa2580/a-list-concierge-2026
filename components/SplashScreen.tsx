'use client';

import { useEffect } from 'react';
import { AListLogo } from './AListLogo';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 4000 }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060606] overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-gradient-radial from-[#011410]/30 via-transparent to-transparent" />
      
      {/* Corner decoration */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l border-t border-[#E5E4E2]/10" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r border-t border-[#E5E4E2]/10" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l border-b border-[#E5E4E2]/10" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-[#E5E4E2]/10" />
      
      <div className="flex flex-col items-center gap-12 relative z-10">
        <AListLogo variant="splash" size="2xl" theme="gradient" animated />
        
        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#E5E4E2]/60 to-transparent"
              style={{ animation: 'shimmer 2s infinite linear' }}
            />
          </div>
          <span className="text-[8px] tracking-[0.4em] uppercase text-white/20 font-bold">
            Initializing
          </span>
        </div>
      </div>
    </div>
  );
}
