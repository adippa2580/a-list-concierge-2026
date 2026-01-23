'use client';

import { Send, Sparkles, User, MapPin, Calendar, Users, DollarSign, Music, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { AListLogo } from './AListLogo';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { BookingModal } from './BookingModal';
import { useState, useEffect, useRef } from 'react';

const quickSuggestions = [
  { text: 'Find me a venue tonight', type: 'venue' },
  { text: 'Match me with similar people', type: 'people' },
  { text: 'Plan a night with my crew', type: 'plan' },
  { text: 'What is trending this weekend?', type: 'trending' }
];

const initialMessages = [
  {
    id: 1,
    type: 'ai',
    content: "Hey! I am your A-List AI Concierge. I can help you discover venues, find events, and plan nights out based on your location and music taste. Where are you heading out tonight?",
    timestamp: new Date()
  }
];

export function AIConcierge() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedTile, setSelectedTile] = useState<any>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Error getting location:", error);
        }
      );
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const userId = localStorage.getItem('alist_user_id') || 'default_user';
      
      const conversationHistory = messages
        .filter(m => m.type === 'user' || m.type === 'ai')
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-82c84e62/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            message: text,
            conversationHistory,
            userId,
            location: userLocation
          })
        }
      );

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      
      const aiResponse = {
        id: messages.length + 2,
        type: 'ai',
        content: data.message,
        tiles: data.tiles || [],
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error calling ChatGPT:', error);
      const aiResponse = {
        id: messages.length + 2,
        type: 'ai',
        content: "I'm having trouble connecting to the network. Please ensure your A-List credentials are valid and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickSuggestion = (suggestion: any) => {
    sendMessage(suggestion.text);
  };

  const handleBooking = (tile: any) => {
    setSelectedTile(tile);
    setIsBookingOpen(true);
  };

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40">
      {/* Booking Modal */}
      <BookingModal 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        tile={selectedTile} 
      />

      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-6 pt-12 sticky top-0 z-20 marble-bg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 gold-border flex items-center justify-center bg-zinc-900">
             <AListLogo variant="icon" size="sm" animated />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] gold-gradient">Concierge</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40">AI-Powered Nightlife Intelligence</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="px-6 py-10 space-y-12">
        {messages.map((message: any) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
          >
            <div className={`flex items-center gap-3 mb-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-[10px] font-bold uppercase tracking-[0.3em] ${message.type === 'ai' ? 'text-gold' : 'text-white/40'}`}>
                {message.type === 'ai' ? 'AL-CONCIERGE' : 'MEMBER'}
              </div>
              <div className="w-1 h-1 bg-white/10 rounded-full" />
              <div className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div
              className={`max-w-[90%] p-6 text-sm font-light leading-relaxed border shadow-2xl ${
                message.type === 'user'
                  ? 'bg-white text-zinc-950 border-white rounded-none !text-black'
                  : 'bg-zinc-900/50 backdrop-blur-md text-white border-white/10 rounded-none marble-bg'
              }`}
            >
              <div className={message.type === 'ai' ? 'font-serif text-lg leading-relaxed italic' : 'font-sans text-[11px] uppercase tracking-widest leading-loose'}>
                {message.content}
              </div>

              {message.tiles && message.tiles.length > 0 && (
                <div className="mt-8 flex flex-col gap-6">
                  {message.tiles.map((tile: any, idx: number) => (
                    <div 
                      key={`${tile.id}-${idx}`}
                      className="group bg-black border border-white/10 overflow-hidden hover:border-gold/40 transition-all cursor-pointer shadow-2xl"
                    >
                      <div className="relative h-48 w-full overflow-hidden">
                        <ImageWithFallback 
                          src={`https://images.unsplash.com/photo-${tile.imageUrl || '1514525253361-bee8718a74a2'}?auto=format&fit=crop&w=600&q=80`}
                          alt={tile.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] grayscale group-hover:grayscale-0"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-white text-black text-[10px] font-bold uppercase tracking-[0.3em] border-0 rounded-none px-3 py-1 !text-black">
                            {tile.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xl font-light uppercase tracking-wide font-serif text-white group-hover:gold-gradient transition-all">{tile.name}</h3>
                          <span className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-bold">{tile.meta}</span>
                        </div>
                        <p className="text-[11px] text-white/60 font-light leading-relaxed uppercase tracking-widest line-clamp-2">{tile.description}</p>
                        
                        {tile.bookingEnabled && (
                          <div className="pt-4 flex justify-between items-center border-t border-white/10">
                            <span className="text-[10px] font-bold text-white tracking-[0.3em] gold-gradient">{tile.priceRange}</span>
                            <Button 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBooking(tile);
                              }}
                              className="h-10 bg-white text-zinc-950 hover:bg-zinc-200 rounded-none text-[10px] font-bold uppercase tracking-[0.3em] px-6 !text-black"
                            >
                              Secure Access
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col items-start animate-in fade-in duration-300">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Concierge is thinking...</div>
            <div className="bg-zinc-900 border border-white/10 p-5 rounded-none flex gap-1.5 marble-bg">
              <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        )}

        {/* Quick Suggestions */}
        {messages.length === 1 && !isTyping && (
          <div className="space-y-6 pt-10">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10"></div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Intelligence Suggestions</p>
              <div className="h-px flex-1 bg-white/10"></div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {quickSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickSuggestion(suggestion)}
                  className="bg-transparent hover:bg-white/5 border border-white/10 p-4 text-left transition-all group flex justify-between items-center marble-bg"
                >
                  <p className="text-[11px] uppercase tracking-widest text-white/80 group-hover:text-gold transition-colors">{suggestion.text}</p>
                  <TrendingUp size={12} className="text-white/20 group-hover:text-gold group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-20 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-6 z-40 marble-bg">
        <div className="max-w-2xl mx-auto flex gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isTyping && handleSend()}
            placeholder="ASK CONCIERGE..."
            className="flex-1 bg-transparent border-b border-white/20 text-white placeholder:text-white/20 text-[11px] font-bold uppercase tracking-[0.2em] focus:outline-none focus:border-gold transition-all py-2"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="text-white/40 hover:text-white disabled:opacity-20 transition-colors px-2"
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}