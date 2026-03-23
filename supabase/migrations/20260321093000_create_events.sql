-- Events (for marketing / portal)

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  location text not null default '',
  type text not null default 'webinar' check (type in ('webinar', 'workshop', 'meetup')),
  start_at timestamptz not null,
  end_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_start_at_idx on public.events(start_at);
create index if not exists events_is_active_idx on public.events(is_active);

