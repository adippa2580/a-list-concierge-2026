-- ============================================================
-- A-List: Full Persistence Rebuild
-- Applies all required tables for database persistence
-- ============================================================

-- 1. KV Store (profiles, crews, bookings, oauth tokens)
create table if not exists public.kv_store_8fcc84de (
  key   text not null primary key,
  value jsonb not null
);

alter table public.kv_store_8fcc84de enable row level security;

drop policy if exists "Service role full access" on public.kv_store_8fcc84de;
create policy "Service role full access"
  on public.kv_store_8fcc84de for all
  using (auth.role() = 'service_role');

-- 2. Profiles table
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text,
  display_name         text,
  phone                text,
  city                 text,
  avatar_url           text,
  tier                 text default 'standard' check (tier in ('standard', 'premium', 'elite')),
  total_spend          numeric(10,2) default 0,
  visits               integer default 0,
  instagram_handle     text,
  spotify_connected    boolean default false,
  soundcloud_connected boolean default false,
  onboarding_complete  boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Service role full access" on public.profiles;
create policy "Service role full access"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- updated_at auto-stamp
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. User intelligence (AI concierge memory)
create table if not exists public.user_intelligence (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  favorite_venues    text[]      default '{}',
  music_genres       text[]      default '{}',
  preferred_vibes    text[]      default '{}',
  cities             text[]      default '{}',
  typical_party_size int         default null,
  price_tier         text        default null,
  context_summary    text        default null,
  turn_count         int         default 0,
  updated_at         timestamptz default now()
);

alter table public.user_intelligence enable row level security;

drop policy if exists "Users can read own intelligence" on public.user_intelligence;
create policy "Users can read own intelligence"
  on public.user_intelligence for select
  using (auth.uid() = id);

drop policy if exists "Users can upsert own intelligence" on public.user_intelligence;
create policy "Users can upsert own intelligence"
  on public.user_intelligence for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own intelligence" on public.user_intelligence;
create policy "Users can update own intelligence"
  on public.user_intelligence for update
  using (auth.uid() = id);

drop policy if exists "Service role full access" on public.user_intelligence;
create policy "Service role full access"
  on public.user_intelligence for all
  using (auth.role() = 'service_role');
