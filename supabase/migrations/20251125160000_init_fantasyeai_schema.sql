-- FantasyEAi: initial schema mapped from Base44 entities (Phase 2 scaffold).
-- Service-role Edge Functions bypass RLS for backend writes (Analyze*, Refresh*, lockTeam, etc.).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (Base44 User: role on auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  legacy_base44_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_legacy_base44_id_idx on public.profiles (legacy_base44_id)
  where legacy_base44_id is not null;

-- ---------------------------------------------------------------------------
-- espn_leagues (Base44 EspnLeague)
-- ---------------------------------------------------------------------------
create table public.espn_leagues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id text not null,
  league_name text,
  season integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id)
);

create index espn_leagues_user_id_idx on public.espn_leagues (user_id);

-- ---------------------------------------------------------------------------
-- team_locks (Base44 TeamLock)
-- ---------------------------------------------------------------------------
create table public.team_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id text not null,
  team_id text not null,
  team_name text,
  espn_email text,
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id)
);

create index team_locks_user_id_league_id_idx on public.team_locks (user_id, league_id);

-- ---------------------------------------------------------------------------
-- refresh_states (Base44 RefreshState)
-- ---------------------------------------------------------------------------
create table public.refresh_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id text not null,
  last_refresh timestamptz,
  signatures jsonb not null default '{}'::jsonb,
  pending jsonb not null default '[]'::jsonb,
  waiver_cache jsonb,
  playoff_cache jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id)
);

create index refresh_states_user_id_league_id_idx on public.refresh_states (user_id, league_id);

-- ---------------------------------------------------------------------------
-- player_analyses (Base44 PlayerAnalysis)
-- ---------------------------------------------------------------------------
create table public.player_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  player_name text not null,
  verdict text check (verdict in ('Start', 'Sit', 'Trade', 'Hold')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  weighted_edge numeric,
  news_headline text,
  analysis text,
  factors jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz,
  input_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, player_id)
);

create index player_analyses_user_id_idx on public.player_analyses (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger espn_leagues_set_updated_at before update on public.espn_leagues
  for each row execute function public.set_updated_at();
create trigger team_locks_set_updated_at before update on public.team_locks
  for each row execute function public.set_updated_at();
create trigger refresh_states_set_updated_at before update on public.refresh_states
  for each row execute function public.set_updated_at();
create trigger player_analyses_set_updated_at before update on public.player_analyses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.espn_leagues enable row level security;
alter table public.team_locks enable row level security;
alter table public.refresh_states enable row level security;
alter table public.player_analyses enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- espn_leagues: user-owned
create policy "espn_leagues_select_own_or_admin"
  on public.espn_leagues for select
  using (user_id = auth.uid() or public.is_admin());
create policy "espn_leagues_insert_own"
  on public.espn_leagues for insert
  with check (user_id = auth.uid());
create policy "espn_leagues_update_own"
  on public.espn_leagues for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "espn_leagues_delete_own"
  on public.espn_leagues for delete
  using (user_id = auth.uid() or public.is_admin());

-- team_locks: read own + admin; writes primarily via service role
create policy "team_locks_select_own_or_admin"
  on public.team_locks for select
  using (user_id = auth.uid() or public.is_admin());

-- refresh_states
create policy "refresh_states_select_own_or_admin"
  on public.refresh_states for select
  using (user_id = auth.uid() or public.is_admin());

-- player_analyses (Base44: create/update/delete admin-only; read own + admin)
create policy "player_analyses_select_own_or_admin"
  on public.player_analyses for select
  using (user_id = auth.uid() or public.is_admin());

-- New auth users get a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();