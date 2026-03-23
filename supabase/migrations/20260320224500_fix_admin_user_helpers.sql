-- Fix: PL/pgSQL variable conflict in `create_admin_user()` when OUT params were named `email`/`name`.
-- Supabase SQL editor may show: column reference "email" is ambiguous.
--
-- This migration safely replaces the helper functions.

create extension if not exists pgcrypto;

create or replace function public._pgcrypto_crypt(p_password text, p_salt text)
returns text
language plpgsql
security definer
as $$
declare
  v text;
begin
  if to_regprocedure('extensions.crypt(text,text)') is not null then
    execute 'select extensions.crypt($1,$2)' into v using p_password, p_salt;
    return v;
  end if;
  if to_regprocedure('crypt(text,text)') is not null then
    execute 'select crypt($1,$2)' into v using p_password, p_salt;
    return v;
  end if;
  raise exception 'pgcrypto crypt() not available; ensure extension pgcrypto is installed';
end;
$$;

create or replace function public._pgcrypto_gen_salt(p_alg text, p_rounds int)
returns text
language plpgsql
security definer
as $$
declare
  v text;
begin
  if to_regprocedure('extensions.gen_salt(text,int)') is not null then
    execute 'select extensions.gen_salt($1,$2)' into v using p_alg, p_rounds;
    return v;
  end if;
  if to_regprocedure('gen_salt(text,int)') is not null then
    execute 'select gen_salt($1,$2)' into v using p_alg, p_rounds;
    return v;
  end if;
  raise exception 'pgcrypto gen_salt() not available; ensure extension pgcrypto is installed';
end;
$$;

drop function if exists public.create_admin_user(text, text, text);

create or replace function public.create_admin_user(p_email text, p_name text, p_password text)
returns table (id uuid, email text, name text)
language plpgsql
security definer
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;

  insert into public.admin_users (email, name, password_hash, is_active)
  values (v_email, coalesce(p_name, ''), public._pgcrypto_crypt(p_password, public._pgcrypto_gen_salt('bf', 12)), true)
  on conflict on constraint admin_users_email_key do update
    set name = excluded.name,
        password_hash = excluded.password_hash,
        is_active = true,
        updated_at = now()
  returning public.admin_users.id, public.admin_users.email, public.admin_users.name
  into id, email, name;

  return next;
end;
$$;

create or replace function public.set_admin_password(p_email text, p_password text)
returns void
language plpgsql
security definer
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;

  update public.admin_users
  set password_hash = public._pgcrypto_crypt(p_password, public._pgcrypto_gen_salt('bf', 12)),
      updated_at = now()
  where public.admin_users.email = v_email;

  if not found then
    raise exception 'admin user not found: %', v_email;
  end if;
end;
$$;

create or replace function public.admin_authenticate(p_email text, p_password text)
returns table (id uuid, email text, name text, is_active boolean)
language sql
security definer
as $$
  select a.id, a.email, a.name, a.is_active
  from public.admin_users a
  where a.email = lower(trim(p_email))
    and a.is_active = true
    and a.password_hash = public._pgcrypto_crypt(p_password, a.password_hash)
  limit 1;
$$;
