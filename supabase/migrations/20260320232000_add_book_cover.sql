-- Add cover path for books (stored in Supabase Storage)
alter table if exists public.books
add column if not exists cover_path text null;

