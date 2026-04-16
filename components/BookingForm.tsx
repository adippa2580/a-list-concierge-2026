'use client';

import { motion } from 'motion/react';
import { Calendar, Users, MapPin, CreditCard, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

interface BookingFormProps {
  eventName?: string;
  venueName?: string;
  price?: string;
  onSuccess?: () => void;
}

export function BookingForm({ eventName, venueName, price, onSuccess }: BookingFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Reservation Request Sent", {
      description: "Your A-List status is being verified for this venue.",
      style: { background: '#000', color: '#fff', border: '1px solid #d4af37' }
    });
    onSuccess?.();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-950 border border-white/10 p-6 space-y-8 relative overflow-hidden group"
    >
      {/* Decorative Gold Accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-50" />
      
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[#d4af37]">Reservation Request</h2>
            <h3 className="text-lg font-light tracking-tight">{eventName || 'VIP Table Access'}</h3>
          </div>
          <Badge className="bg-white/5 border-white/10 text-[8px] uppercase tracking-widest px-2 py-0.5">
            ALIST Exclusive
          </Badge>
        </div>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.1em] flex items-center gap-1.5">
          <MapPin size={10} /> {venueName || 'Secret Venue, Miami'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[9px] uppercase tracking-widest text-white/40">Guests</Label>
            <Select defaultValue="2">
              <SelectTrigger className="bg-black border-white/10 rounded-xl h-10 text-xs">
                <SelectValue placeholder="Guests" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="2">2 PERSONS</SelectItem>
                <SelectItem value="4">4 PERSONS</SelectItem>
                <SelectItem value="6">6 PERSONS</SelectItem>
                <SelectItem value="8">8+ PERSONS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] uppercase tracking-widest text-white/40">Section</Label>
            <Select defaultValue="vip">
              <SelectTrigger className="bg-black border-white/10 rounded-xl h-10 text-xs">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="dancefloor">DANCEFLOOR</SelectItem>
                <SelectItem value="vip">VIP LOUNGE</SelectItem>
                <SelectItem value="booth">PRIVATE BOOTH</SelectItem>
                <SelectItem value="terrace">TERRACE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-white/5 pb-2">
            <span className="text-white/40">Minimum Spend</span>
            <span className="font-bold text-white">{price || '$2,500.00'}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-white/5 pb-2">
            <span className="text-white/40">Verification Fee</span>
            <span className="font-bold text-[#d4af37]">$15.00</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-3 border border-white/5">
          <ShieldCheck size={14} className="text-[#d4af37]" />
          <p className="text-[9px] text-white/60 leading-tight">
            ALIST members receive priority entry and a dedicated concierge host upon arrival.
          </p>
        </div>

        <Button 
          type="submit"
          className="w-full bg-white hover:bg-zinc-200 text-black rounded-xl h-12 text-[10px] font-bold uppercase tracking-[0.2em] transition-all group-hover:bg-[#d4af37]"
        >
          REQUEST INVITATION
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </form>
    </motion.div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </span>
  );
}
