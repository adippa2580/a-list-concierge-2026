'use client';

import { Search, Filter, Mail } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useState } from 'react';

export function Inbox() {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="bg-black/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-8 pb-4 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-white/60 mb-6">Invitations</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 justify-start gap-8">
            <TabsTrigger value="all" className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white text-[10px] font-bold uppercase tracking-[0.2em]">All</TabsTrigger>
            <TabsTrigger value="received" className="rounded-none bg-transparent border-b-2 border-transparent px-0 py-2 data-[state=active]:border-white text-[10px] font-bold uppercase tracking-[0.2em]">Received</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="p-10 text-center space-y-4 opacity-40">
        <Mail size={40} className="mx-auto" />
        <p className="text-xs uppercase tracking-widest">No invitations at the moment.</p>
      </div>
    </div>
  );
}