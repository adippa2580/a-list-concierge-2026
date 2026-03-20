-- ============================================================
-- A-List: User Profiles Table
-- Run in: https://supabase.com/dashboard/project/ofjcnikfebfgopytsgbm/sql/new
-- ============================================================

-- 1. Profiles table
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

-- 2. Row-level security
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. updated_at auto-stamp
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4. Auto-create profile row whenever a user signs up via Supabase Auth
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
