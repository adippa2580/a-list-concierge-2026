'use client';

import { Calendar, Clock, MapPin, Users, CheckCircle2, Clock3, X, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';

interface Booking {
  id: string;
  venueId: string;
  venueName: string;
  date: Date;
  time: string;
  tableType: string;
  capacity: string;
  crewMembers: string[];
  reference: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  notes?: string;
}

// No mock data — bookings are fetched live from /bookings API

export function BookingsSchedule() {
  const { userId } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/bookings?userId=${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Normalise API booking shape to local Booking interface
        const normalised: Booking[] = (data.bookings || []).map((b: any) => ({
          id: String(b.id),
          venueId: b.venueId || String(b.id),
          venueName: b.venueName || 'Venue',
          date: new Date(b.date || b.createdAt),
          time: b.time || '',
          tableType: b.tableType || 'Table',
          capacity: b.guestCount ? `${b.guestCount} guests` : '',
          crewMembers: (b.members || []).map((m: any) => m.name),
          reference: `ALT-${String(b.id).slice(-8).toUpperCase()}`,
          status: b.status || 'pending',
          notes: b.notes,
        }));
        setAllBookings(normalised);
      }
    } catch (_e) {
      // silently retain empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [userId]);

  const upcomingBookings = useMemo(() => {
    return allBookings
      .filter(b => b.date >= new Date(Date.now() - 86_400_000)) // include today
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [allBookings]);

  const monthBookings = useMemo(() => {
    return upcomingBookings.filter(b => {
      const bDate = new Date(b.date);
      return bDate.getMonth() === selectedMonth.getMonth() &&
             bDate.getFullYear() === selectedMonth.getFullYear();
    });
  }, [selectedMonth, upcomingBookings]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = Array(startingDayOfWeek).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [selectedMonth]);

  const getBookingsForDay = (day: number) => {
    return monthBookings.filter(b => b.date.getDate() === day);
  };

  const statusColor = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-[#E5E4E2]/10 text-[#E5E4E2]/80 border-[#E5E4E2]/25';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
  };

  const statusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 size={14} />;
      case 'pending':
        return <Clock3 size={14} />;
      case 'cancelled':
        return <X size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-40">
      {/* Header */}
      <div className="bg-[#060606]/90 backdrop-blur-xl border-b border-[#E5E4E2]/10 px-6 pt-16 pb-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-serif italic platinum-gradient leading-none tracking-tight">My Bookings</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-2">
              {upcomingBookings.length} upcoming reservation{upcomingBookings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="w-12 h-12 platinum-border flex items-center justify-center bg-[#011410] hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            {loading
              ? <Loader2 size={18} className="text-[#E5E4E2] animate-spin" strokeWidth={1.5} />
              : <RefreshCw size={18} className="text-[#E5E4E2]" strokeWidth={1.5} />
            }
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 border text-[9px] font-bold uppercase tracking-widest transition-all ${
              viewMode === 'list'
                ? 'bg-white text-black border-white'
                : 'border-white/10 text-white/40 hover:border-white/30'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 border text-[9px] font-bold uppercase tracking-widest transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-black border-white'
                : 'border-white/10 text-white/40 hover:border-white/30'
            }`}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={24} className="animate-spin text-white/30" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-bold">Loading reservations</p>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            // LIST VIEW
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {upcomingBookings.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10">
                  <Calendar size={32} className="mx-auto text-white/10 mb-4" />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">
                    No upcoming reservations
                  </p>
                  <button
                    onClick={fetchBookings}
                    className="mt-4 flex items-center gap-2 mx-auto text-[9px] uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>
              ) : (
                upcomingBookings.map((booking, index) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-950/60 border border-white/5 hover:border-[#E5E4E2]/20 transition-all p-5 space-y-4 group"
                  >
                    {/* Header with venue and status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-serif italic leading-tight mb-1">{booking.venueName}</h3>
                        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40">
                          <span className="font-bold">{booking.reference}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${statusColor(booking.status)} border text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-1 h-fit flex items-center gap-1 rounded-xl whitespace-nowrap`}>
                        {statusIcon(booking.status)}
                        <span>{booking.status}</span>
                      </Badge>
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
                        <Calendar size={14} className="text-[#E5E4E2]/60" />
                        <span>{booking.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
                        <Clock size={14} className="text-[#E5E4E2]/60" />
                        <span>{booking.time}</span>
                      </div>
                    </div>

                    {/* Table & Capacity */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-[#E5E4E2]/40" />
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold">Table Type</p>
                          <p className="text-sm font-bold">{booking.tableType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[#E5E4E2]/40" />
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold">Capacity</p>
                          <p className="text-sm font-bold">{booking.capacity}</p>
                        </div>
                      </div>
                    </div>

                    {/* Crew Members */}
                    {booking.crewMembers.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">
                          Crew ({booking.crewMembers.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {booking.crewMembers.map((member, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-white/5 text-white/70 border-white/10 text-[8px] font-bold uppercase tracking-[0.1em] rounded-sm">
                              {member}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {booking.notes && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">Notes</p>
                        <p className="text-[10px] text-white/70">{booking.notes}</p>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            // CALENDAR VIEW
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Month Navigation */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 p-4">
                <button
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                  className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:border-[#E5E4E2]/50 transition-colors"
                >
                  Previous
                </button>
                <h3 className="text-base font-serif italic tracking-tight">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                  className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:border-[#E5E4E2]/50 transition-colors"
                >
                  Next
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[9px] font-bold uppercase tracking-widest text-white/40 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const bookingsForDay = day ? getBookingsForDay(day) : [];
                  const isToday = day && new Date().getDate() === day && new Date().getMonth() === selectedMonth.getMonth();

                  return (
                    <div
                      key={index}
                      className={`min-h-24 border transition-all ${
                        day
                          ? isToday
                            ? 'border-[#E5E4E2] bg-white/5'
                            : 'border-white/10 bg-zinc-950/40 hover:border-[#E5E4E2]/50'
                          : 'border-transparent bg-transparent'
                      }`}
                    >
                      {day && (
                        <div className="h-full p-2 flex flex-col">
                          <span className={`text-sm font-bold mb-1 ${isToday ? 'text-[#E5E4E2]' : 'text-white'}`}>
                            {day}
                          </span>
                          <div className="space-y-1">
                            {bookingsForDay.map((booking, idx) => (
                              <motion.div
                                key={booking.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`text-[7px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 truncate cursor-pointer hover:opacity-100 transition-opacity ${
                                  booking.status === 'confirmed'
                                    ? 'bg-green-500/15 text-green-400'
                                    : booking.status === 'pending'
                                    ? 'bg-[#E5E4E2]/10 text-[#E5E4E2]/80'
                                    : 'bg-red-500/20 text-red-300'
                                }`}
                                title={`${booking.venueName} - ${booking.time}`}
                              >
                                {booking.venueName}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-6 text-[9px] uppercase tracking-widest border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500/25 border border-green-500/40" />
                  <span className="text-white/60">Confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#E5E4E2]/20 border border-[#E5E4E2]/35" />
                  <span className="text-white/60">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500/30 border border-red-500/50" />
                  <span className="text-white/60">Cancelled</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>
    </div>
  );
}
