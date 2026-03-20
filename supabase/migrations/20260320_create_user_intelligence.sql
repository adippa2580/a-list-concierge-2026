-- user_intelligence: stores learned preferences per user
-- populated by Gemini extraction after each concierge session

create table if not exists public.user_intelligence (
  id              uuid primary key references public.profiles(id) on delete cascade,
  favorite_venues text[]   default '{}',
  music_genres    text[]   default '{}',
  preferred_vibes text[]   default '{}',           -- e.g. 'rooftop', 'pool party', 'underground'
  cities          text[]   default '{}',
  typical_party_size int   default null,
  price_tier      text     default null,            -- 'mid' | 'high' | 'ultra'
  context_summary text     default null,            -- free-form Gemini-written memory
  turn_count      int      default 0,               -- total conversation turns seen
  updated_at      timestamptz default now()
);

alter table public.user_intelligence enable row level security;

create policy "Users can read own intelligence"
  on public.user_intelligence for select
  using (auth.uid() = id);

create policy "Users can upsert own intelligence"
  on public.user_intelligence for insert
  with check (auth.uid() = id);

create policy "Users can update own intelligence"
  on public.user_intelligence for update
  using (auth.uid() = id);

-- Service role can upsert (used by edge function)
create policy "Service role full access"
  on public.user_intelligence for all
  using (auth.role() = 'service_role');
