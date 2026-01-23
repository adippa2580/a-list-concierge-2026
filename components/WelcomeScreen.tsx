'use client';

import { AListLogo } from './AListLogo';
import { ChevronRight } from 'lucide-react';

export function WelcomeScreen({ onStart }: any) {
  return (
    <div onClick={onStart} className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden cursor-pointer bg-black">
       <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop)' }} />
       <div className="relative z-20">
          <AListLogo size="2xl" animated variant="splash" />
       </div>
       <div className="absolute bottom-12 z-20 flex flex-col items-center gap-3">
         <span className="text-[10px] tracking-[0.4em] uppercase font-medium text-white/60">Enter</span>
         <ChevronRight className="w-3 h-3 text-white animate-pulse" />
       </div>
    </div>
  );
}