'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Users, DollarSign, Info } from 'lucide-react';

const CATEGORY_COLORS: Record<string, { available: string; booked: string; blocked: string; label: string }> = {
  vip:         { available: '#9333ea', booked: '#ef4444', blocked: '#52525b', label: 'VIP' },
  skybox:      { available: '#2563eb', booked: '#ef4444', blocked: '#52525b', label: 'Skybox' },
  booth:       { available: '#059669', booked: '#ef4444', blocked: '#52525b', label: 'Booth' },
  stage_front: { available: '#d97706', booked: '#ef4444', blocked: '#52525b', label: 'Stage Front' },
  patio:       { available: '#0891b2', booked: '#ef4444', blocked: '#52525b', label: 'Patio' },
  bar:         { available: '#dc2626', booked: '#7f1d1d', blocked: '#52525b', label: 'Bar' },
};

function getColor(table: any) {
  const cat = CATEGORY_COLORS[table.category] ?? CATEGORY_COLORS.vip;
  if (table.availability === 'booked') return cat.booked;
  if (table.availability === 'blocked') return cat.blocked;
  return cat.available;
}

interface VenueTableMapProps {
  tables: any[];
  selectedTableId?: string | null;
  onSelectTable: (table: any) => void;
  date?: string;
}

export function VenueTableMap({ tables, selectedTableId, onSelectTable, date }: VenueTableMapProps) {
  const [tooltip, setTooltip] = useState<any>(null);

  // Group by section for legend
  const categories = [...new Set(tables.map(t => t.category))];

  const availableCount = tables.filter(t => t.availability === 'available').length;
  const bookedCount = tables.filter(t => t.availability === 'booked').length;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold">
          {date ? `Floor Plan · ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Floor Plan'}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            <span className="text-[8px] text-white/40 uppercase tracking-wider">{availableCount} avail</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-[8px] text-white/40 uppercase tracking-wider">{bookedCount} booked</span>
          </span>
        </div>
      </div>

      {/* SVG Floor Plan */}
      <div className="relative bg-zinc-950 rounded-xl border border-white/5 overflow-hidden">
        <svg
          viewBox="0 0 100 100"
          className="w-full"
          style={{ aspectRatio: '4/3' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background sections */}
          {/* Stage */}
          <rect x="25" y="43" width="50" height="5" rx="1" fill="#ffffff08" />
          <text x="50" y="47" textAnchor="middle" fontSize="2" fill="#ffffff30" fontFamily="sans-serif">STAGE</text>

          {/* Dance floor */}
          <rect x="10" y="55" width="80" height="20" rx="1" fill="#ffffff04" />
          <text x="50" y="66" textAnchor="middle" fontSize="2.5" fill="#ffffff15" fontFamily="sans-serif">DANCE FLOOR</text>

          {/* Bar */}
          <rect x="5" y="58" width="3" height="14" rx="0.5" fill="#ffffff10" />
          <rect x="92" y="58" width="3" height="14" rx="0.5" fill="#ffffff10" />

          {/* Mezzanine */}
          <rect x="10" y="10" width="80" height="3" rx="1" fill="#ffffff08" />
          <text x="50" y="13.5" textAnchor="middle" fontSize="2" fill="#ffffff25" fontFamily="sans-serif">MEZZANINE</text>

          {/* Entrance */}
          <rect x="40" y="94" width="20" height="3" rx="0.5" fill="#ffffff08" />
          <text x="50" y="97" textAnchor="middle" fontSize="2" fill="#ffffff20" fontFamily="sans-serif">ENTRANCE</text>

          {/* Tables */}
          {tables.map((table) => {
            const isSelected = selectedTableId === table.id;
            const color = getColor(table);
            const isAvailable = table.availability === 'available';

            return (
              <g key={table.id} onClick={() => isAvailable && onSelectTable(table)}
                onMouseEnter={() => setTooltip(table)}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: isAvailable ? 'pointer' : 'default' }}
              >
                {/* Selection glow */}
                {isSelected && (
                  <rect
                    x={table.pos_x - table.width / 2 - 0.8}
                    y={table.pos_y - table.height / 2 - 0.8}
                    width={table.width + 1.6}
                    height={table.height + 1.6}
                    rx={table.shape === 'circle' ? 50 : 1.5}
                    fill="none"
                    stroke="#E5E4E2"
                    strokeWidth="0.6"
                    opacity="0.8"
                  />
                )}

                {/* Table shape */}
                {table.shape === 'circle' ? (
                  <ellipse
                    cx={table.pos_x}
                    cy={table.pos_y}
                    rx={table.width / 2}
                    ry={table.height / 2}
                    fill={color}
                    fillOpacity={isAvailable ? 0.85 : 0.35}
                    stroke={isSelected ? '#E5E4E2' : '#ffffff20'}
                    strokeWidth="0.3"
                  />
                ) : (
                  <rect
                    x={table.pos_x - table.width / 2}
                    y={table.pos_y - table.height / 2}
                    width={table.width}
                    height={table.height}
                    rx="1"
                    fill={color}
                    fillOpacity={isAvailable ? 0.85 : 0.35}
                    stroke={isSelected ? '#E5E4E2' : '#ffffff20'}
                    strokeWidth="0.3"
                  />
                )}

                {/* Label */}
                <text
                  x={table.pos_x}
                  y={table.pos_y + 0.9}
                  textAnchor="middle"
                  fontSize="2"
                  fill={isAvailable ? '#ffffff' : '#ffffff60'}
                  fontFamily="sans-serif"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {table.name.replace(/^(VIP|Skybox|Booth|Stage Front|Patio)\s*/i, '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div className="absolute top-2 left-2 bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-[9px] uppercase tracking-wider pointer-events-none max-w-[140px]">
            <p className="font-bold text-white mb-1">{tooltip.name}</p>
            <p className="text-white/50">{tooltip.section}</p>
            <p className="text-white/70">{tooltip.capacity_min}–{tooltip.capacity_max} guests</p>
            <p className="text-white/70">${tooltip.min_spend?.toLocaleString()} min</p>
            <p className={`mt-1 font-bold ${
              tooltip.availability === 'available' ? 'text-green-400' :
              tooltip.availability === 'booked' ? 'text-red-400' : 'text-zinc-400'
            }`}>{tooltip.availability}</p>
          </div>
        )}
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {categories.map(cat => {
          const cfg = CATEGORY_COLORS[cat];
          const catTables = tables.filter(t => t.category === cat);
          const avail = catTables.filter(t => t.availability === 'available').length;
          return (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg?.available ?? '#9333ea' }} />
              <span className="text-[8px] uppercase tracking-wider text-white/40">
                {cfg?.label ?? cat} · {avail}/{catTables.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
