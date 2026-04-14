'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Users, ZoomIn, ZoomOut, Maximize2, X, ChevronRight } from 'lucide-react';

// ── Category config ────────────────────────────────────────────────────────────
const CAT: Record<string, { color: string; glow: string; label: string; icon: string }> = {
  vip:         { color: '#a855f7', glow: 'rgba(168,85,247,0.4)', label: 'VIP',         icon: '★' },
  skybox:      { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  label: 'Skybox',     icon: '◈' },
  booth:       { color: '#10b981', glow: 'rgba(16,185,129,0.4)',  label: 'Booth',      icon: '▣' },
  stage_front: { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)',  label: 'Stage Front',icon: '♦' },
  patio:       { color: '#06b6d4', glow: 'rgba(6,182,212,0.4)',   label: 'Patio',      icon: '◎' },
  bar:         { color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   label: 'Bar',        icon: '▲' },
};

function catCfg(cat: string) { return CAT[cat] ?? CAT.vip; }

interface VenueTableMapProps {
  tables: any[];
  selectedTableId?: string | null;
  onSelectTable: (table: any) => void;
  onBook?: (table: any) => void;
  date?: string;
  venueName?: string;
}

export function VenueTableMap({ tables, selectedTableId, onSelectTable, onBook, date, venueName }: VenueTableMapProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pulseOn, setPulseOn] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPulseOn(p => !p), 1400);
    return () => clearInterval(t);
  }, []);

  const categories = [...new Set(tables.map(t => t.category))];
  const filtered = activeFilter === 'all' ? tables : tables.filter(t => t.category === activeFilter);
  const available = tables.filter(t => t.availability === 'available').length;
  const booked    = tables.filter(t => t.availability === 'booked').length;
  const selectedTable = tables.find(t => t.id === selectedTableId) ?? null;
  const hoveredTable  = hoveredId ? tables.find(t => t.id === hoveredId) ?? null : null;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-table]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);
  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(3.5, z - e.deltaY * 0.002)));
  }, []);

  const zoomIn  = () => setZoom(z => Math.min(z + 0.35, 3.5));
  const zoomOut = () => setZoom(z => Math.max(z - 0.35, 0.5));
  const reset   = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const dateLabel = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Tonight';

  return (
    <div className="flex flex-col gap-3 select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">
            {venueName ?? 'Floor Plan'}
          </p>
          <p className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3 text-[8px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white/50">{available} available</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-white/50">{booked} booked</span>
          </span>
        </div>
      </div>

      {/* ── Category filter pills ───────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {['all', ...categories].map(cat => {
          const isAll = cat === 'all';
          const active = activeFilter === cat;
          const cfg = isAll ? null : catCfg(cat);
          const avail = isAll ? available : tables.filter(t => t.category === cat && t.availability === 'available').length;
          const total = isAll ? tables.length : tables.filter(t => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(active && !isAll ? 'all' : cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border ${
                active
                  ? isAll ? 'bg-white text-black border-white' : 'text-black border-transparent'
                  : 'bg-white/5 text-white/40 border-white/10 hover:border-white/25 hover:text-white/60'
              }`}
              style={active && !isAll && cfg ? { background: cfg.color, borderColor: cfg.color } : {}}
            >
              {!isAll && <span className="opacity-70">{cfg!.icon}</span>}
              <span>{isAll ? 'All' : cfg!.label}</span>
              <span className={active ? (isAll ? 'text-black/50' : 'text-black/60') : 'text-white/25'}>
                {avail}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main map ───────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/8"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #0e0a1a 0%, #05050c 100%)',
          aspectRatio: '4/3',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.06 }}>
          <defs>
            <pattern id="vmap-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vmap-grid)" />
        </svg>

        {/* SVG viewport */}
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {Object.entries(CAT).map(([key, cfg]) => (
              <filter key={key} id={`glow-${key}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="blur" />
                <feFlood floodColor={cfg.color} floodOpacity="0.55" result="col" />
                <feComposite in="col" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
            <filter id="glow-sel" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feFlood floodColor="#ffffff" floodOpacity="0.6" result="col" />
              <feComposite in="col" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="stage-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <g transform={`translate(${(pan.x / 400) * 100} ${(pan.y / 300) * 100}) scale(${zoom})`}
             style={{ transformOrigin: '50px 50px' }}>

            {/* Venue perimeter */}
            <rect x="2" y="2" width="96" height="96" rx="4" fill="none" stroke="#ffffff07" strokeWidth="0.6" />

            {/* Stage glow zone */}
            <ellipse cx="50" cy="37" rx="28" ry="6" fill="url(#stage-grad)" />

            {/* Stage arc */}
            <path d="M 24 40 Q 50 32 76 40" fill="none" stroke="#7c3aed40" strokeWidth="0.8" />
            <text x="50" y="35.5" textAnchor="middle" fontSize="2" fill="#a78bfa50" fontFamily="system-ui" letterSpacing="1.5" fontWeight="600">STAGE</text>

            {/* DJ booth */}
            <rect x="30" y="41" width="40" height="7" rx="2" fill="#0d0820" stroke="#7c3aed30" strokeWidth="0.4" />
            <rect x="33" y="42.5" width="34" height="4" rx="1.2" fill="#7c3aed15" />
            <text x="50" y="46" textAnchor="middle" fontSize="1.9" fill="#a78bfa45" fontFamily="system-ui" letterSpacing="0.8">DJ BOOTH</text>

            {/* Dance floor */}
            <rect x="12" y="52" width="76" height="22" rx="2.5" fill="url(#floor-grad)" stroke="#ffffff08" strokeWidth="0.3" strokeDasharray="1.5 1.5" />
            <text x="50" y="64" textAnchor="middle" fontSize="2.8" fill="#ffffff10" fontFamily="system-ui" letterSpacing="2" fontWeight="700">DANCE FLOOR</text>

            {/* Left bar */}
            <rect x="3.5" y="55" width="7" height="16" rx="1.5" fill="#0a0a14" stroke="#ffffff18" strokeWidth="0.4" />
            <text x="7" y="64" textAnchor="middle" fontSize="1.7" fill="#ffffff35" fontFamily="system-ui" transform="rotate(-90,7,64)">BAR</text>

            {/* Right bar */}
            <rect x="89.5" y="55" width="7" height="16" rx="1.5" fill="#0a0a14" stroke="#ffffff18" strokeWidth="0.4" />
            <text x="93" y="64" textAnchor="middle" fontSize="1.7" fill="#ffffff35" fontFamily="system-ui" transform="rotate(90,93,64)">BAR</text>

            {/* Mezzanine */}
            <rect x="8" y="7" width="84" height="5.5" rx="2" fill="#0a0a18" stroke="#3b82f630" strokeWidth="0.4" />
            <text x="50" y="11" textAnchor="middle" fontSize="2" fill="#60a5fa50" fontFamily="system-ui" letterSpacing="1.2" fontWeight="600">MEZZANINE</text>

            {/* Outdoor patio indicator */}
            <rect x="8" y="80" width="84" height="10" rx="2" fill="#06b6d408" stroke="#06b6d420" strokeWidth="0.3" strokeDasharray="1 1" />
            <text x="50" y="86.5" textAnchor="middle" fontSize="1.8" fill="#22d3ee35" fontFamily="system-ui" letterSpacing="1">OUTDOOR PATIO</text>

            {/* Entrance */}
            <rect x="38" y="95.5" width="24" height="3" rx="1" fill="#0a0a14" stroke="#ffffff15" strokeWidth="0.3" />
            <text x="50" y="97.8" textAnchor="middle" fontSize="1.7" fill="#ffffff25" fontFamily="system-ui" letterSpacing="0.8">ENTRANCE</text>

            {/* ── Tables ─────────────────────────────────────────────────── */}
            {filtered.map(table => {
              const cfg = catCfg(table.category);
              const isSel  = selectedTableId === table.id;
              const isHov  = hoveredId === table.id;
              const isAvail = table.availability === 'available';
              const isBook  = table.availability === 'booked';

              const x = table.pos_x - table.width / 2;
              const y = table.pos_y - table.height / 2;
              const rx = 1.4;

              const fillC  = isBook ? '#ef444455' : isSel ? cfg.color : cfg.color;
              const fillOp = isSel ? 1 : isHov ? 0.92 : isAvail ? 0.75 : 0.25;
              const strokeC = isSel ? '#ffffff' : isHov ? '#ffffffaa' : '#ffffff25';
              const strokeW = isSel ? 0.55 : isHov ? 0.4 : 0.2;

              return (
                <g
                  key={table.id}
                  data-table={table.id}
                  style={{ cursor: isAvail ? 'pointer' : 'not-allowed' }}
                  onClick={() => isAvail && onSelectTable(table)}
                  onMouseEnter={() => { if (!isPanning) setHoveredId(table.id); }}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Pulse ring (available tables only) */}
                  {isAvail && !isSel && (
                    <rect
                      x={x - 1.2} y={y - 1.2}
                      width={table.width + 2.4} height={table.height + 2.4}
                      rx={rx + 0.8}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="0.5"
                      opacity={pulseOn ? (isHov ? 0.5 : 0.18) : 0.04}
                      style={{ transition: 'opacity 1.4s ease-in-out' }}
                    />
                  )}

                  {/* Table body */}
                  <rect
                    x={x} y={y}
                    width={table.width} height={table.height}
                    rx={rx}
                    fill={fillC}
                    fillOpacity={fillOp}
                    stroke={strokeC}
                    strokeWidth={strokeW}
                    filter={isSel ? 'url(#glow-sel)' : (isAvail ? `url(#glow-${table.category})` : undefined)}
                    style={{ transition: 'fill-opacity 0.15s, stroke 0.15s' }}
                  />

                  {/* Status indicator dot */}
                  <circle
                    cx={x + table.width - 1.6}
                    cy={y + 1.6}
                    r="1.1"
                    fill={isBook ? '#f87171' : '#4ade80'}
                    opacity={0.95}
                  />

                  {/* Short name */}
                  <text
                    x={table.pos_x} y={table.pos_y - 0.6}
                    textAnchor="middle" fontSize="2" fontWeight="700"
                    fill={isAvail ? '#ffffff' : '#ffffff35'}
                    fontFamily="system-ui" pointerEvents="none"
                  >
                    {table.name.replace(/^(VIP|Skybox|Booth|Stage Front|Patio|Main Stage|Mezzanine Box|Chelsea Terrace|Side Booth|Cabaret Row|Main Room VIP|Patio Lounge|Main Stage VIP)\s*/i, '')}
                  </text>

                  {/* Min spend */}
                  <text
                    x={table.pos_x} y={table.pos_y + 2.4}
                    textAnchor="middle" fontSize="1.5"
                    fill={isAvail ? '#ffffff65' : '#ffffff20'}
                    fontFamily="system-ui" pointerEvents="none"
                  >
                    ${(table.min_spend >= 1000 ? (table.min_spend / 1000).toFixed(0) + 'k' : table.min_spend)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── Zoom controls ─────────────────────────────────────────────────── */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {[
            { icon: <ZoomIn size={11} />, fn: zoomIn },
            { icon: <ZoomOut size={11} />, fn: zoomOut },
            { icon: <Maximize2 size={10} />, fn: reset },
          ].map((btn, i) => (
            <button key={i} onClick={btn.fn}
              className="w-7 h-7 bg-black/70 backdrop-blur-sm border border-white/8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all active:scale-90">
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Zoom level badge */}
        {zoom !== 1 && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm border border-white/8 rounded-lg px-2 py-1">
            <p className="text-[8px] text-white/40 font-mono">{Math.round(zoom * 100)}%</p>
          </div>
        )}

        {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
        {hoveredTable && hoveredTable.id !== selectedTableId && (
          <div className="absolute bottom-3 left-3 pointer-events-none z-10">
            <div className="bg-black/90 backdrop-blur-md border rounded-xl px-3 py-2.5"
              style={{ borderColor: `${catCfg(hoveredTable.category).color}40` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: catCfg(hoveredTable.category).color }} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-white">{hoveredTable.name}</p>
                <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                  hoveredTable.availability === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>{hoveredTable.availability}</span>
              </div>
              <p className="text-[8px] text-white/40 uppercase tracking-wider mb-1">{hoveredTable.section}</p>
              <div className="flex items-center gap-3 text-[8px] text-white/60">
                <span className="flex items-center gap-1"><Users size={7} /> {hoveredTable.capacity_min}–{hoveredTable.capacity_max} guests</span>
                <span>${hoveredTable.min_spend?.toLocaleString()} min</span>
              </div>
            </div>
          </div>
        )}

        {/* Hint text */}
        {zoom === 1 && !hoveredTable && (
          <p className="absolute bottom-3 right-3 text-[7px] uppercase tracking-widest text-white/12 pointer-events-none">
            Scroll to zoom · Drag to pan
          </p>
        )}
      </div>

      {/* ── Selected table booking panel ────────────────────────────────────── */}
      {selectedTable && (
        <div className="rounded-2xl border overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${catCfg(selectedTable.category).color}15 0%, #08080f 100%)`,
            borderColor: `${catCfg(selectedTable.category).color}35`,
          }}>
          <div className="p-4 space-y-3">
            {/* Title row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: `${catCfg(selectedTable.category).color}25`, color: catCfg(selectedTable.category).color }}>
                  {catCfg(selectedTable.category).icon}
                </div>
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-wider text-white leading-tight">{selectedTable.name}</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/35 mt-0.5">
                    {selectedTable.section} · {catCfg(selectedTable.category).label}
                  </p>
                </div>
              </div>
              <button onClick={() => onSelectTable(selectedTable)}
                className="w-6 h-6 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all">
                <X size={10} />
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Guests', value: `${selectedTable.capacity_min}–${selectedTable.capacity_max}` },
                { label: 'Min Spend', value: `$${selectedTable.min_spend >= 1000 ? (selectedTable.min_spend / 1000).toFixed(0) + 'k' : selectedTable.min_spend}` },
                { label: 'Status', value: 'Available', green: true },
              ].map(stat => (
                <div key={stat.label} className="bg-black/40 rounded-xl p-2.5 text-center">
                  <p className={`text-[11px] font-bold ${stat.green ? 'text-emerald-400' : 'text-white'}`}>{stat.value}</p>
                  <p className="text-[7px] uppercase tracking-widest text-white/25 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Perks */}
            {selectedTable.perks?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTable.perks.map((perk: string) => (
                  <span key={perk}
                    className="text-[7px] uppercase tracking-wider px-2 py-1 rounded-full border"
                    style={{
                      borderColor: `${catCfg(selectedTable.category).color}35`,
                      color: catCfg(selectedTable.category).color + 'cc',
                      background: `${catCfg(selectedTable.category).color}10`,
                    }}>
                    {perk}
                  </span>
                ))}
              </div>
            )}

            {/* Book CTA */}
            {onBook && (
              <button
                onClick={() => onBook(selectedTable)}
                className="w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.25em] flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
                style={{
                  background: `linear-gradient(135deg, ${catCfg(selectedTable.category).color} 0%, ${catCfg(selectedTable.category).color}bb 100%)`,
                  color: selectedTable.category === 'stage_front' ? '#000' : '#fff',
                  boxShadow: `0 6px 24px ${catCfg(selectedTable.category).glow}`,
                }}
              >
                Reserve This Table
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      {!selectedTable && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
          {categories.map(cat => {
            const cfg = catCfg(cat);
            const catTables = tables.filter(t => t.category === cat);
            const avail = catTables.filter(t => t.availability === 'available').length;
            return (
              <button key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? 'all' : cat)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-[8px] uppercase tracking-wider text-white/35">
                  {cfg.label} <span className="text-white/55">{avail}/{catTables.length}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
