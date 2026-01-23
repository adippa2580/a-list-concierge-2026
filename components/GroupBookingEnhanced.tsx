'use client';

import { ArrowLeft, Users, DollarSign, Copy, Send, MessageCircle, Plus, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';

export function GroupBooking({ venue, selectedTable, onBack }: any) {
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-4 pt-12 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-300">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold uppercase tracking-widest">{venue.name}</h1>
            <p className="text-xs text-white/60">Group Reservation</p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="bg-zinc-900/50 border border-white/10 p-6 rounded-none">
          <h3 className="text-xl font-light uppercase tracking-widest mb-2">{selectedTable?.name || 'VIP Table'}</h3>
          <p className="text-2xl text-green-400 font-mono">${selectedTable?.minSpend || 1500}</p>
        </div>
        <Button className="w-full bg-white text-black hover:bg-zinc-200 h-14 rounded-none uppercase tracking-widest text-[11px] font-bold !text-black">
          Confirm Group Booking
        </Button>
      </div>
    </div>
  );
}