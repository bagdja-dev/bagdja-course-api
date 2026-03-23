-- Helper functions to provision admin users without hardcoding passwords in migrations.
-- Usage (run in Supabase SQL editor):
--   select public.create_admin_user('admin@bagdja.com','Admin','YOUR_STRONG_PASSWORD');
--   select public.set_admin_password('admin@bagdja.com','NEW_PASSWORD');

create extension if not exists pgcrypto;

-- Supabase commonly installs extensions into schema `extensions`, so `crypt()` may live at `extensions.crypt`.
-- These helpers resolve the correct function at runtime (works for both `public.crypt` and `extensions.crypt`).
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
  on conflict (email) do update
    set name = excluded.name,
        password_hash = excluded.password_hash,
        is_active = true,
        updated_at = now()
  returning admin_users.id, admin_users.email, admin_users.name into id, email, name;

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
  where email = v_email;

  if not found then
    raise exception 'admin user not found: %', v_email;
  end if;
end;
$$;

-- RPC helper for backend: returns row only when password matches (bcrypt via pgcrypto crypt()).
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
