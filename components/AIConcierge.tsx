'use client';

import { Sparkles, Send, ArrowLeft, MapPin, Star, Users, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AListLogo } from './AListLogo';
import { BookingModal } from './BookingModal';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Message {
  id: number;
  role: 'user' | 'ai';
  content: string;
  tiles?: Tile[];
}

interface Tile {
  name: string;
  type: string;
  priceRange: string;
  meta: string;
  description?: string;
  imageUrl?: string;
  bookingEnabled?: boolean;
}

const suggestions = [
  "Best tables tonight?",
  "VIP bottle service options",
  "Where's the hottest party?",
  "Book me a table for 6"
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'ai',
    content: "Good evening. I'm your A-List Concierge — your private intelligence layer for Miami's nightlife. How may I assist you tonight?",
    tiles: []
  }
];

export function AIConcierge() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bookingModal, setBookingModal] = useState<{ isOpen: boolean; tile: Tile | null }>({ isOpen: false, tile: null });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  useEffect(() => {
    // Immediate scroll when message first appears
    scrollToBottom('smooth');

    // The latest message — check if it has tiles
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.tiles && lastMsg.tiles.length > 0) {
      // Re-scroll after tile animations finish expanding the container
      const tileAnimDuration = (lastMsg.tiles.length * 100) + 200; // stagger delay + buffer
      const t = setTimeout(() => scrollToBottom('smooth'), tileAnimDuration);
      return () => clearTimeout(t);
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const message = text || inputValue;
    if (!message.trim()) return;

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: message
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Build conversation history for context (exclude the initial AI greeting)
    const history = messages
      .filter(m => m.id !== 1)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            message,
            conversationHistory: history,
            location: null
          })
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Map server tile format to our Tile interface
      const tiles: Tile[] = (data.tiles || []).map((t: any) => ({
        name: t.name,
        type: t.type || 'Club',
        priceRange: t.priceRange || '$$$',
        meta: t.description || '',
        description: t.description,
        imageUrl: t.imageUrl
          ? `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(t.imageUrl)}`
          : `https://source.unsplash.com/featured/800x600/?nightclub`,
        bookingEnabled: t.bookingEnabled ?? true
      }));

      const aiResponse: Message = {
        id: Date.now() + 1,
        role: 'ai',
        content: data.message || "I'm recalibrating. Try again shortly.",
        tiles
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const aiResponse: Message = {
        id: Date.now() + 1,
        role: 'ai',
        content: "I'm temporarily offline. Please try again in a moment.",
        tiles: []
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000504] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#000504]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AListLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-[10px] font-bold tracking-[0.4em] uppercase text-white/30">AI Intelligence</h1>
              <h2 className="text-xl font-serif italic platinum-gradient tracking-tight">Agent Concierge</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[8px] uppercase tracking-widest text-white/30">Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-56">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-4 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-[#E5E4E2]/10 border border-[#E5E4E2]/20 flex items-center justify-center">
                    <Sparkles size={10} className="text-[#E5E4E2]" />
                  </div>
                  <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-white/20">Agent Concierge</span>
                </div>
              )}
              <div className={`px-5 py-4 ${
                msg.role === 'user'
                  ? 'bg-white text-[#000504] ml-auto'
                  : 'bg-zinc-950 border border-white/10 text-white'
              }`}>
                <p className={`text-sm leading-relaxed font-light ${msg.role === 'user' ? 'text-[#000504]' : ''}`}>
                  {msg.content}
                </p>
              </div>

              {/* Venue Tiles */}
              {msg.tiles && msg.tiles.length > 0 && (
                <div className="space-y-3 w-full mt-3">
                  {msg.tiles.map((tile, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => setBookingModal({ isOpen: true, tile })}
                      className="border border-white/10 bg-zinc-950 cursor-pointer hover:border-[#E5E4E2]/30 transition-all group overflow-hidden"
                    >
                      <div className="relative h-28 overflow-hidden">
                        <ImageWithFallback
                          src={tile.imageUrl || ''}
                          alt={tile.name}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-wide">{tile.name}</h4>
                            <p className="text-[8px] uppercase tracking-widest text-white/50">{tile.type}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#E5E4E2]">{tile.priceRange}</span>
                        </div>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <p className="text-[9px] text-white/40 uppercase tracking-widest flex-1 pr-4">{tile.meta}</p>
                        <div className="flex items-center gap-1 text-white/30 group-hover:text-[#E5E4E2] transition-colors">
                          <span className="text-[8px] uppercase tracking-widest font-bold">Book</span>
                          <ChevronRight size={12} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-950 border border-white/10 px-5 py-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#E5E4E2]/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-[8px] uppercase tracking-widest text-white/20">Processing intelligence</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions — always visible */}
      <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-5 pb-2 z-30">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="flex-shrink-0 px-4 py-2 border border-[#E5E4E2]/20 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:border-[#E5E4E2]/50 bg-[#000504]/90 backdrop-blur-md transition-all whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#000504]/95 backdrop-blur-xl border-t border-white/10 px-5 py-4 z-40">
        <div className="flex gap-3 items-center">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
            placeholder="Ask your concierge..."
            className="flex-1 bg-zinc-950 border-white/10 rounded-none h-12 text-sm placeholder:text-white/20 focus:border-[#E5E4E2]/40 focus:ring-0 transition-all"
            disabled={isTyping}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            className="h-12 w-12 bg-white text-[#000504] hover:bg-[#E5E4E2] rounded-none disabled:opacity-30 flex-shrink-0 !text-black"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModal.tile && (
        <BookingModal
          isOpen={bookingModal.isOpen}
          onClose={() => setBookingModal({ isOpen: false, tile: null })}
          tile={bookingModal.tile}
        />
      )}
    </div>
  );
}