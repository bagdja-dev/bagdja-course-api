-- Bagdja Course schema (public)
-- This migration intentionally does NOT create a `users` table, because auth is handled by `bagdja-auth`.
-- The `user_id` columns store `bagdja-auth.users.id` (UUID).

create extension if not exists pgcrypto;

create table if not exists public.locations (
  id text primary key,
  city text not null,
  address text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text not null default '',
  mode text not null check (mode in ('online', 'offline')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  duration_hours int not null default 0,
  lessons int not null default 0,
  price int not null default 0,
  rating numeric not null default 0,
  highlights jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_mode_idx on public.courses(mode);

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  label text not null,
  start_date date not null,
  time text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_sessions_course_id_idx on public.course_sessions(course_id);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  author text not null default '',
  pages int not null default 0,
  price int not null default 0,
  rating numeric not null default 0,
  topics jsonb not null default '[]'::jsonb,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('course', 'book')),
  currency text not null default 'IDR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  subtotal int not null default 0,
  total int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx on public.orders(user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_type text not null check (product_type in ('course', 'book')),
  product_slug text not null,
  title text not null,
  unit_price int not null default 0,
  quantity int not null default 1,
  amount int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.courses(id),
  session_id uuid not null references public.course_sessions(id),
  location_id text null references public.locations(id),
  attendee_name text not null,
  attendee_email text not null,
  attendee_phone text not null,
  quantity int not null default 1,
  order_id uuid null references public.orders(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_id_created_at_idx on public.bookings(user_id, created_at desc);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
