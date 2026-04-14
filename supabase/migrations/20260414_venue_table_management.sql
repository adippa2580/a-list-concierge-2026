-- ── Venues ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  city          text NOT NULL,
  address       text,
  capacity      int DEFAULT 200,
  cover_image   text,
  logo_image    text,
  phone         text,
  email         text,
  website       text,
  instagram     text,
  description   text,
  -- Venue floor plan SVG/JSON for map view
  floorplan_svg text,
  -- External VMS integration (future: SevenRooms, OpenTable, etc.)
  vms_type      text DEFAULT 'internal', -- 'internal' | 'sevenrooms' | 'opentable' | 'resy'
  vms_venue_id  text,
  vms_api_key   text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Venue Table Categories ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_tables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  name          text NOT NULL,            -- e.g. "VIP 1", "Booth A", "Skybox 3"
  category      text NOT NULL,            -- 'vip' | 'booth' | 'skybox' | 'bar' | 'patio' | 'stage_front'
  section       text,                     -- e.g. "Main Floor", "Mezzanine", "Rooftop"
  capacity_min  int DEFAULT 2,
  capacity_max  int DEFAULT 8,
  min_spend     int DEFAULT 1000,         -- USD
  -- Floor plan positioning (% of floorplan width/height, 0-100)
  pos_x         float DEFAULT 50,
  pos_y         float DEFAULT 50,
  -- Shape on map: 'rect' | 'circle'
  shape         text DEFAULT 'rect',
  width         float DEFAULT 8,          -- % of floorplan
  height        float DEFAULT 6,
  rotation      float DEFAULT 0,          -- degrees
  -- Perks & notes
  perks         text[],                   -- ['Dedicated server', 'Priority entry', 'DJ adjacent']
  notes         text,
  is_active     boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Table Bookings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.table_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid REFERENCES public.venue_tables(id) ON DELETE CASCADE,
  venue_id        uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id         text NOT NULL,           -- Supabase auth user id
  booking_ref     text UNIQUE NOT NULL,    -- human-readable e.g. "AL-2026-001"
  event_date      date NOT NULL,
  event_name      text,
  party_size      int NOT NULL,
  status          text DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'cancelled' | 'completed'
  guest_name      text,
  guest_email     text,
  guest_phone     text,
  total_min_spend int,
  deposit_amount  int,
  deposit_paid    boolean DEFAULT false,
  notes           text,
  -- VMS sync
  vms_booking_id  text,
  vms_synced_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Table Availability Overrides ──────────────────────────────────────────────
-- Used to manually block/release tables outside of bookings
CREATE TABLE IF NOT EXISTS public.table_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid REFERENCES public.venue_tables(id) ON DELETE CASCADE,
  date        date NOT NULL,
  status      text DEFAULT 'available',   -- 'available' | 'blocked' | 'hold'
  reason      text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(table_id, date)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venue_tables_venue_id ON public.venue_tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_table_id ON public.table_bookings(table_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_venue_id ON public.table_bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_date ON public.table_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_table_bookings_user ON public.table_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_table_availability_date ON public.table_availability(table_id, date);

-- ── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_availability ENABLE ROW LEVEL SECURITY;

-- Venues: publicly readable
DROP POLICY IF EXISTS "venues_public_read" ON public.venues;
CREATE POLICY "venues_public_read" ON public.venues FOR SELECT USING (true);

-- Tables: publicly readable
DROP POLICY IF EXISTS "venue_tables_public_read" ON public.venue_tables;
CREATE POLICY "venue_tables_public_read" ON public.venue_tables FOR SELECT USING (true);

-- Bookings: users can read/create their own
DROP POLICY IF EXISTS "bookings_own" ON public.table_bookings;
CREATE POLICY "bookings_own" ON public.table_bookings FOR ALL USING (user_id = auth.uid()::text);

-- Availability: publicly readable
DROP POLICY IF EXISTS "availability_public_read" ON public.table_availability;
CREATE POLICY "availability_public_read" ON public.table_availability FOR SELECT USING (true);

-- ── Seed: sample venue with tables ───────────────────────────────────────────
INSERT INTO public.venues (slug, name, city, address, capacity, description, vms_type)
VALUES 
  ('liv-miami', 'LIV', 'Miami', '4441 Collins Ave, Miami Beach, FL 33140', 700,
   'Miami''s most iconic nightclub inside the Fontainebleau Hotel. Home to the biggest names in music and the most exclusive VIP experience in South Beach.', 'internal'),
  ('e11even-miami', 'E11EVEN', 'Miami', '29 NE 11th St, Miami, FL 33132', 300,
   '24/7 ultraclub in the heart of downtown Miami. Six floors of entertainment, world-class performers, and ultra-premium bottle service.', 'internal'),
  ('marquee-nyc', 'Marquee', 'New York', '289 10th Ave, New York, NY 10001', 500,
   'New York''s premier nightclub in Chelsea. Three rooms, world-class DJs, and the most sought-after tables in Manhattan.', 'internal')
ON CONFLICT (slug) DO NOTHING;

-- Seed tables for LIV Miami
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.venues WHERE slug = 'liv-miami';
  IF v_id IS NOT NULL THEN
    INSERT INTO public.venue_tables (venue_id, name, category, section, capacity_min, capacity_max, min_spend, pos_x, pos_y, width, height, perks, sort_order)
    VALUES
      (v_id, 'VIP 1', 'vip', 'Main Floor', 4, 8, 5000, 20, 30, 10, 7, ARRAY['Dedicated server','Priority entry','Champagne setup'], 1),
      (v_id, 'VIP 2', 'vip', 'Main Floor', 4, 8, 5000, 35, 30, 10, 7, ARRAY['Dedicated server','Priority entry'], 2),
      (v_id, 'VIP 3', 'vip', 'Main Floor', 4, 8, 5000, 50, 30, 10, 7, ARRAY['Dedicated server','DJ adjacent'], 3),
      (v_id, 'VIP 4', 'vip', 'Main Floor', 4, 8, 7500, 65, 30, 10, 7, ARRAY['Dedicated server','Stage front','Best sightlines'], 4),
      (v_id, 'VIP 5', 'vip', 'Main Floor', 4, 8, 7500, 80, 30, 10, 7, ARRAY['Dedicated server','Stage front'], 5),
      (v_id, 'Skybox 1', 'skybox', 'Mezzanine', 8, 16, 15000, 25, 15, 14, 9, ARRAY['Private entrance','360 view','Personal host','Champagne toast'], 6),
      (v_id, 'Skybox 2', 'skybox', 'Mezzanine', 8, 16, 15000, 60, 15, 14, 9, ARRAY['Private entrance','360 view','Personal host'], 7),
      (v_id, 'Booth A', 'booth', 'Bar Area', 2, 4, 1500, 15, 65, 8, 6, ARRAY['Intimate setting','Bar adjacent'], 8),
      (v_id, 'Booth B', 'booth', 'Bar Area', 2, 4, 1500, 28, 65, 8, 6, ARRAY['Intimate setting'], 9),
      (v_id, 'Booth C', 'booth', 'Bar Area', 2, 4, 1500, 41, 65, 8, 6, ARRAY['Intimate setting'], 10),
      (v_id, 'Booth D', 'booth', 'Bar Area', 2, 4, 2000, 54, 65, 8, 6, ARRAY['Intimate setting','Premium view'], 11),
      (v_id, 'Stage Front 1', 'stage_front', 'Stage', 6, 12, 10000, 30, 50, 12, 8, ARRAY['Closest to stage','Artist interaction'], 12),
      (v_id, 'Stage Front 2', 'stage_front', 'Stage', 6, 12, 10000, 50, 50, 12, 8, ARRAY['Closest to stage'], 13),
      (v_id, 'Patio 1', 'patio', 'Outdoor', 4, 10, 3000, 15, 82, 12, 8, ARRAY['Outdoor terrace','Ocean breeze'], 14),
      (v_id, 'Patio 2', 'patio', 'Outdoor', 4, 10, 3000, 35, 82, 12, 8, ARRAY['Outdoor terrace'], 15)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
