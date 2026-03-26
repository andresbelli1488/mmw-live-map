create extension if not exists pgcrypto;

create table if not exists events (
  id text primary key,
  slug text not null unique,
  title text not null,
  venue text not null,
  area text not null,
  day text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  time_label text not null,
  active_now boolean not null default false,
  trending boolean not null default false,
  underground boolean not null default false,
  genres text[] not null default '{}',
  ticket_url text not null,
  location_hint text not null,
  map_x numeric not null,
  map_y numeric not null,
  lineup jsonb not null default '[]'::jsonb,
  set_times jsonb not null default '[]'::jsonb,
  promo_code text null,
  insider_note text null,
  price text null,
  updated_at timestamptz not null default now(),
  source jsonb not null default '{}'::jsonb
);

create table if not exists leads (
  id text primary key,
  email text not null,
  source text not null,
  event_id text null references events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists artists (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists artist_event_links (
  id text primary key,
  artist_id text not null references artists(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  role text not null,
  confidence numeric not null default 1.0,
  created_at timestamptz not null default now(),
  unique (artist_id, event_id)
);

create table if not exists underground_connections (
  id text primary key,
  event_id_a text not null references events(id) on delete cascade,
  event_id_b text not null references events(id) on delete cascade,
  shared_artist_count integer not null default 1,
  weight numeric not null default 1.0,
  created_at timestamptz not null default now(),
  unique (event_id_a, event_id_b)
);

create table if not exists event_admin_overrides (
  id text primary key,
  event_id text not null references events(id) on delete cascade unique,
  promo_code text null,
  set_times jsonb null,
  underground boolean null,
  location_hint text null,
  insider_note text null,
  price text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_sources (
  id text primary key,
  provider_name text not null,
  event_url text not null unique,
  status text not null default 'active',
  last_ingested_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pulse (
  id text primary key,
  text text not null,
  urgency text not null check (urgency in ('breaking', 'headsup', 'vibecheck')),
  created_at timestamptz not null default now()
);

create table if not exists deployment_sync_state (
  id text primary key,
  environment text not null,
  git_branch text not null,
  git_commit text not null,
  remote_url text not null,
  app_base_url text null,
  status text not null default 'unknown',
  generated_at timestamptz not null default now(),
  notes text null
);

create table if not exists deployment_audit_log (
  id text primary key,
  level text not null check (level in ('info', 'warn', 'error')),
  source text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
