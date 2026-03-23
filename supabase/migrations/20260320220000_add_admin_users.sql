-- Add admin users table (separate auth realm)
-- NOTE: If you already pushed the initial migration before this table existed,
-- you MUST add it via a new migration (editing old applied migrations won't be re-run).

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

