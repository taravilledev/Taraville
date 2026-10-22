-- ADR 0003. Synthetic-data foundation; privacy release remains blocked.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.staff (
  id uuid primary key references auth.users(id),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  role text not null check (role in ('sale', 'executive')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('BAAN_KUNAPAP', 'TARAVILLE')),
  name_title text not null default '',
  first_name text not null check (length(btrim(first_name)) between 1 and 200),
  last_name text not null default '',
  phone text not null check (length(btrim(phone)) between 1 and 80),
  line_id text not null default '',
  survey jsonb not null default '{}' check (jsonb_typeof(survey) = 'object'),
  owner_id uuid not null references public.staff(id),
  created_by uuid not null references public.staff(id),
  create_request_id uuid not null,
  create_payload_hash text not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, create_request_id)
);

create index leads_owner_created_idx on public.leads(owner_id, created_at desc, id);
create index leads_brand_created_idx on public.leads(brand, created_at desc, id);

alter table public.staff enable row level security;
alter table public.leads enable row level security;
revoke all on public.staff, public.leads from public, anon, authenticated;
grant select on public.staff, public.leads to authenticated;

-- Avoid recursive staff RLS; roles come from the database, never JWT metadata.
create function private.walkin_actor_role() returns text
language sql stable security definer set search_path = '' as $$
  select s.role from public.staff s
  where s.id = (select auth.uid()) and s.is_active
$$;
revoke all on function private.walkin_actor_role() from public, anon, authenticated;
grant execute on function private.walkin_actor_role() to authenticated;

create policy staff_read on public.staff for select to authenticated using (
  (select private.walkin_actor_role()) = 'executive'
  or (id = (select auth.uid()) and (select private.walkin_actor_role()) = 'sale')
);
create policy leads_read on public.leads for select to authenticated using (
  (select private.walkin_actor_role()) = 'executive'
  or (owner_id = (select auth.uid()) and (select private.walkin_actor_role()) = 'sale')
);
