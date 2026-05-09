-- Migration to add local user mirroring and notifications for SSO/Event integration

-- Clear existing data that violates FK constraints (as requested)
truncate table public.orders cascade;
truncate table public.bookings cascade;

create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  username text not null unique,
  full_name text not null default '',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users(email);
create index if not exists users_username_idx on public.users(username);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  delivery_id uuid null unique,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

do $$ 
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_orders_user_id'
  ) then
    alter table public.orders 
    add constraint fk_orders_user_id 
    foreign key (user_id) references public.users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_bookings_user_id'
  ) then
    alter table public.bookings 
    add constraint fk_bookings_user_id 
    foreign key (user_id) references public.users(id);
  end if;
end $$;