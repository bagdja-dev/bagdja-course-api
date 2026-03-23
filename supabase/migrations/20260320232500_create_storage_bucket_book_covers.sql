-- Create storage bucket for book covers (public read).
-- Note: This uses Supabase Storage metadata table.

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do update set public = excluded.public;

