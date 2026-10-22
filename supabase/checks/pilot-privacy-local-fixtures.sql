-- Disposable local PostgreSQL fixture only; never apply to Supabase/production.
-- Parent applies this snippet, not the test author. No real staff or customer data.
insert into auth.users(id) values ('40000000-0000-4000-a000-000000000003')
  on conflict (id) do nothing;
insert into public.staff(id, full_name, role) values
  ('40000000-0000-4000-a000-000000000003', 'Synthetic Privacy Sale Two', 'sale')
  on conflict (id) do nothing;
