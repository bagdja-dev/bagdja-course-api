# bagdja-course/backend

NestJS API for Bagdja Course (courses online/offline + eBook store).

## Features

- NestJS (TypeScript)
- Supabase Postgres (via `@supabase/supabase-js`)
- JWT verification compatible with `bagdja-auth` (`HS256` shared `JWT_SECRET`)
- Swagger docs at `/docs`
- Supabase SQL migrations in `supabase/migrations`

## Env

Copy `.env.example` to `.env` and fill values.

## Run

```bash
cd bagdja-course/backend
npm install
npm run start:dev
```

Open:

- `http://localhost:3008/docs`

## Deploy (Coolify)

This service includes a production `Dockerfile` for Coolify.

- Container port: `3008` (configurable via `PORT`)
- Required env vars: see `.env.example`
- Start command: `node dist/main.js` (handled by the Dockerfile)

## Supabase migrations

This repo includes Supabase CLI folder `supabase/`.

- Apply migrations locally (if you run Supabase locally):
  - `supabase start`
  - `supabase db reset`

- Apply to a remote project: configure Supabase CLI for your project and run:
  - `supabase link --project-ref <ref>`
  - `supabase db push`

## Admin auth (separate)

Admin uses a separate JWT (`ADMIN_JWT_SECRET`) and a separate table `admin_users`.

Recommended: create admin via Supabase SQL helper (from migrations):

- `select public.create_admin_user('admin@bagdja.com','Admin','YOUR_STRONG_PASSWORD');`

Alternative: create password hash (scrypt) and insert manually:

- `npm run hash:admin -- admin123`
- `insert into public.admin_users (email,name,password_hash) values ('admin@bagdja.com','Admin','<HASH>');`

Endpoints:

- `POST /admin/auth/login`
- `GET /admin/auth/me` (Bearer admin token)
- `GET/POST /admin/courses`, `GET/POST /admin/books`, `GET /admin/bookings`, `PATCH /admin/bookings/:id/status`, `GET /admin/users`
