-- Add end date to course sessions
alter table if exists public.course_sessions
add column if not exists end_date date null;

