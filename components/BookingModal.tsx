'use client';

import { X, Calendar, Users, Clock, CreditCard, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tile: {
    name: string;
    type: string;
    priceRange: string;
    meta: string;
    imageUrl?: string;
  } | null;
}

export function BookingModal({ isOpen, onClose, tile }: BookingModalProps) {
  const { userId } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    guests: '2',
    date: new Date().toISOString().split('T')[0],
    time: '11:00 PM',
    request: ''
  });

  if (!isOpen || !tile) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => { setStep(1); setSubmitting(false); }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/bookings?userId=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            venueName: tile.name,
            tableType: tile.type || 'Table',
            date: formData.date,
            time: formData.time,
            guestCount: parseInt(formData.guests),
            notes: formData.request,
            members: [{ name: formData.name, amount: 0, paid: false }],
            totalCost: 0,
          }),
        }
      );
      if (!res.ok) throw new Error('Booking failed');
      setStep(3);
    } catch {
      toast.error('Could not submit request', { description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-950 border border-white/10 p-8 overflow-hidden"
        >
          {/* Header */}
          <div className="space-y-6 mb-8">
            {tile.imageUrl && (
              <div className="h-32 w-full overflow-hidden platinum-border relative">
                <ImageWithFallback 
                  src={tile.imageUrl} 
                  className="w-full h-full object-cover grayscale"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
              </div>
            )}
            
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#E5E4E2]/40">Request Access</span>
                  <div className="w-1 h-1 bg-[#E5E4E2]/20 rounded-full" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#E5E4E2]/40">{tile.priceRange || '$$$$'}</span>
                </div>
                <h2 className="text-2xl font-serif italic uppercase tracking-wider text-white">{tile.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                   <MapPin size={10} className="text-[#E5E4E2]/40" />
                   <span className="text-[9px] uppercase tracking-widest text-white/30">{tile.meta}</span>
                </div>
              </div>
              <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors p-2">
                <X size={20} />
              </button>
            </div>
          </div>

          {step < 3 ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 block ml-1">Guest Details</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Input 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="NAME"
                        required
                        className="bg-transparent border-white/10 rounded-none h-12 text-[10px] uppercase tracking-widest placeholder:text-white/20 focus:border-white transition-all"
                      />
                    </div>
                    <div className="relative">
                      <select 
                        value={formData.guests}
                        onChange={(e) => setFormData({...formData, guests: e.target.value})}
                        className="w-full bg-transparent border border-white/10 h-12 text-[10px] uppercase tracking-widest px-4 focus:border-white outline-none appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <option key={n} value={n} className="bg-black text-white">{n} GUESTS</option>
                        ))}
                      </select>
                      <Users size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 block ml-1">Arrival Window</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="bg-transparent border-white/10 rounded-none h-12 text-[10px] uppercase tracking-widest focus:border-white transition-all invert brightness-200"
                      />
                    </div>
                    <div className="relative">
                      <select 
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full bg-transparent border border-white/10 h-12 text-[10px] uppercase tracking-widest px-4 focus:border-white outline-none appearance-none cursor-pointer"
                      >
                        {['10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM', '12:30 AM', '01:00 AM'].map(t => (
                          <option key={t} value={t} className="bg-black text-white">{t}</option>
                        ))}
                      </select>
                      <Clock size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 block ml-1">Special Requests</label>
                  <textarea 
                    value={formData.request}
                    onChange={(e) => setFormData({...formData, request: e.target.value})}
                    placeholder="BOTTLE SERVICE, TABLE PREFERENCE, ETC."
                    className="w-full bg-transparent border border-white/10 h-24 text-[10px] uppercase tracking-widest p-4 focus:border-white outline-none resize-none placeholder:text-white/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !formData.name.trim()}
                className="w-full h-14 bg-white text-zinc-950 hover:bg-zinc-200 rounded-none font-bold text-[10px] uppercase tracking-[0.3em] flex items-center justify-between px-8 !text-black disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin !text-black" /><span>Submitting...</span></>
                ) : (
                  <><span>Submit Reservation</span><ChevronRight size={16} /></>
                )}
              </Button>

              <div className="flex items-center gap-2 justify-center py-2 opacity-40">
                <CreditCard size={10} />
                <span className="text-[7px] font-bold uppercase tracking-widest">No prepayment required for A-List members</span>
              </div>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-10 text-center space-y-6"
            >
              <div className="w-16 h-16 border border-white/20 flex items-center justify-center mx-auto mb-4 bg-white/5">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-8 h-8 bg-white rounded-full"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-[0.2em] mb-2">Request Received</h3>
                <p className="text-[10px] text-white/40 font-light leading-relaxed uppercase tracking-widest">
                  Your reservation for {tile.name} is being prioritized. <br />
                  A concierge will contact you shortly.
                </p>
              </div>
              <Button 
                onClick={handleClose}
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/5 rounded-none font-bold text-[9px] uppercase tracking-[0.3em]"
              >
                Return to Concierge
              </Button>
            </motion.div>
          )}

          {/* Decorative Texture */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rotate-45 translate-x-16 -translate-y-16 pointer-events-none" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}