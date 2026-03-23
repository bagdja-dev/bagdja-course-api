-- Optional seed data for local/dev.

insert into public.locations (id, city, address, notes)
values
  ('jakarta', 'Jakarta', 'Sudirman Park, Tower B, Level 7', 'Near MRT / parking available'),
  ('bandung', 'Bandung', 'Dago Creative Hub, Floor 3', 'Cozy classroom, limited seats'),
  ('surabaya', 'Surabaya', 'Tunjungan Office Space, Room 2A', 'Monthly weekend schedule')
on conflict (id) do nothing;

insert into public.courses (slug, title, tagline, mode, level, duration_hours, lessons, price, rating, highlights)
values
  (
    'nextjs-production-frontend',
    'Next.js Production Frontend',
    'Ship fast with Pages Router, Tailwind, and real-world patterns.',
    'online',
    'intermediate',
    12,
    28,
    1490000,
    4.8,
    '["Pages Router & data fetching","Design system with Tailwind","SEO, performance, deployment"]'::jsonb
  ),
  (
    'nodejs-api-masterclass',
    'Node.js API Masterclass',
    'Build secure REST APIs with validation, auth, and observability.',
    'online',
    'beginner',
    10,
    24,
    1290000,
    4.7,
    '["Auth & RBAC basics","Testing + error handling","Logging + metrics"]'::jsonb
  ),
  (
    'ui-engineering-offline-bootcamp',
    'UI Engineering Offline Bootcamp',
    'Hands-on workshop: layout, typography, components, and accessibility.',
    'offline',
    'beginner',
    16,
    10,
    2490000,
    4.9,
    '["Design tokens & component patterns","Responsive layout drills","A11y & UX reviews"]'::jsonb
  )
on conflict (slug) do nothing;

-- Sessions: link via slug lookup
insert into public.course_sessions (course_id, label, start_date, time)
select c.id, s.label, s.start_date, s.time
from public.courses c
join (
  values
    ('nextjs-production-frontend','Weekend Cohort','2026-04-04'::date,'09:00–12:00 WIB'),
    ('nextjs-production-frontend','Weeknight Cohort','2026-04-07'::date,'19:30–21:30 WIB'),
    ('nodejs-api-masterclass','Self-paced','2026-03-20'::date,'Anytime'),
    ('ui-engineering-offline-bootcamp','Jakarta (2 days)','2026-04-18'::date,'10:00–18:00 WIB'),
    ('ui-engineering-offline-bootcamp','Bandung (2 days)','2026-05-02'::date,'10:00–18:00 WIB')
) as s(slug,label,start_date,time)
on s.slug = c.slug
on conflict do nothing;

insert into public.books (slug, title, subtitle, author, pages, price, rating, topics, description)
values
  (
    'tailwind-ui-systems',
    'Tailwind UI Systems',
    'A practical guide to tokens, components, and scalable UI.',
    'Bagdja Editorial',
    184,
    159000,
    4.8,
    '["Design Tokens","Tailwind","Components"]'::jsonb,
    'Build consistent interfaces with a token-first approach.'
  ),
  (
    'backend-for-frontend',
    'Backend for Frontend',
    'Patterns for APIs that make UIs faster to build.',
    'Bagdja Editorial',
    156,
    149000,
    4.7,
    '["API Design","Caching","Security"]'::jsonb,
    'Learn how to shape APIs for UI needs: aggregation, caching, auth boundaries.'
  ),
  (
    'shipping-nextjs',
    'Shipping Next.js',
    'From prototype to production with confidence.',
    'Bagdja Editorial',
    212,
    189000,
    4.9,
    '["Next.js","SEO","Performance"]'::jsonb,
    'A field guide to shipping with routing, rendering, SEO, and deployment checklists.'
  )
on conflict (slug) do nothing;

-- Optional admin user (change the password + hash before using in real env).
-- Password: admin123
-- Generate new hash: `npm run hash:admin -- <password>`
-- Then insert/update manually in Supabase SQL editor.
