-- Add lat/lng + images for locations

create extension if not exists pgcrypto;

alter table if exists public.locations
add column if not exists lat double precision null,
add column if not exists lng double precision null;

create table if not exists public.location_images (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id) on delete cascade,
  path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists location_images_location_id_idx on public.location_images(location_id);

-- Storage bucket for location images (public read)
insert into storage.buckets (id, name, public)
values ('location-images', 'location-images', true)
on conflict (id) do nothing;

