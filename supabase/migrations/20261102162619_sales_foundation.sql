begin;

-- Financial state is not exposed through the shared Lead/Project read policies.
create table private.sales_capabilities (
  staff_id uuid not null references public.staff(id),
  action text not null check (action in (
    'case.view','case.create','case.edit','financial.view','financial.prepare',
    'financial.confirm','receipt.issue','receipt.cancel','refund.request',
    'refund.approve','refund.pay','contract.sign','contract.amend','contract.cancel',
    'billing.issue','acceptance.record','catalog.manage'
  )),
  enabled boolean not null,
  scope text not null check (scope in ('own','all')),
  changed_by uuid not null references public.staff(id),
  changed_at timestamptz not null default now(),
  primary key (staff_id, action)
);

create table private.sales_customers (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('BAAN_KUNAPAP','TARAVILLE')),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  phone text not null default '' check (length(phone) <= 80),
  address text not null default '' check (length(address) <= 2000),
  nickname text not null default '' check (length(nickname) <= 200),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  unique (id, brand)
);

create table private.sales_developments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  address text not null default '' check (length(address) <= 2000),
  is_active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);

create table private.sales_units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null references private.sales_developments(id),
  code text not null check (length(btrim(code)) between 1 and 80),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 50000),
  list_price_cents bigint check (list_price_cents >= 0),
  is_active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  unique (development_id, code)
);

create table private.sales_cases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand text not null check (brand in ('BAAN_KUNAPAP','TARAVILLE')),
  lead_id uuid not null references public.leads(id),
  project_id uuid unique references public.projects(id),
  unit_id uuid references private.sales_units(id),
  customer_id uuid not null,
  responsible_id uuid not null references public.staff(id),
  status text not null default 'draft' check (status in ('draft','reserved','contracted','completed','cancelled')),
  customer_snapshot jsonb not null check (jsonb_typeof(customer_snapshot) = 'object'),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 100000),
  list_price_cents bigint check (list_price_cents >= 0),
  promotion_price_cents bigint check (promotion_price_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  net_price_cents bigint generated always as (coalesce(promotion_price_cents,list_price_cents) - discount_cents) stored,
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id,brand) references private.sales_customers(id,brand),
  check (net_price_cents is null or net_price_cents >= 0),
  check ((brand = 'BAAN_KUNAPAP' and project_id is not null and unit_id is null)
    or (brand = 'TARAVILLE' and project_id is null and unit_id is not null))
);
create index sales_cases_lead_idx on private.sales_cases(lead_id);
create index sales_cases_responsible_idx on private.sales_cases(responsible_id);

create table private.sales_reservations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  unit_id uuid not null references private.sales_units(id),
  confirmed_by uuid not null references public.staff(id),
  confirmed_at timestamptz not null default now(),
  released_by uuid references public.staff(id),
  released_at timestamptz,
  release_reason text check (length(btrim(release_reason)) between 1 and 1000),
  check ((released_at is null) = (released_by is null) and (released_at is null) = (release_reason is null))
);
create unique index sales_reservations_active_unit on private.sales_reservations(unit_id) where released_at is null;
create unique index sales_reservations_active_case on private.sales_reservations(case_id) where released_at is null;

create table private.sales_events (
  id bigint generated always as identity primary key,
  case_id uuid references private.sales_cases(id),
  actor_id uuid not null references public.staff(id),
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index sales_events_case_idx on private.sales_events(case_id,id);

create table private.sales_requests (
  actor_id uuid not null references public.staff(id),
  request_id uuid not null,
  operation text not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
create table private.sales_counters (
  brand text not null check (brand in ('BAAN_KUNAPAP','TARAVILLE')),
  kind text not null check (kind ~ '^[A-Z]{1,4}$'),
  be_year integer not null,
  last_number bigint not null check (last_number > 0),
  primary key(brand,kind,be_year)
);

create function private.sales_actor() returns public.staff
language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff;
begin
  select * into v_actor from public.staff where id = auth.uid() and is_active for share;
  if not found then raise exception using errcode = '42501', message = 'active_staff_required'; end if;
  return v_actor;
end $$;

create function private.sales_allowed(p_action text, p_case_id uuid default null, p_lead_id uuid default null)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role text; v_own boolean := false; v_cap private.sales_capabilities;
begin
  select role into v_role from public.staff where id = auth.uid() and is_active;
  if not found then return false; end if;
  if p_case_id is not null then
    select case when p_action in ('case.view','case.edit') then c.responsible_id = auth.uid()
      else l.owner_id = auth.uid() end into v_own
    from private.sales_cases c join public.leads l on l.id = c.lead_id where c.id = p_case_id;
  elsif p_lead_id is not null then
    select owner_id = auth.uid() into v_own from public.leads where id = p_lead_id;
  end if;
  select * into v_cap from private.sales_capabilities where staff_id = auth.uid() and action = p_action;
  if found then return v_cap.enabled and (v_cap.scope = 'all' or coalesce(v_own,false)); end if;
  if v_role = 'executive' then return true; end if;
  return (p_action = 'financial.view' or (v_role = 'sale' and p_action in ('case.view','case.edit','case.create')))
    and coalesce(v_own,false);
end $$;

create function private.sales_require(p_action text,p_case_id uuid default null,p_lead_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.sales_actor();
  if p_case_id is not null then
    perform 1 from public.leads l join private.sales_cases c on c.lead_id = l.id where c.id = p_case_id for share of l;
  elsif p_lead_id is not null then
    perform 1 from public.leads where id = p_lead_id for share;
  end if;
  if not private.sales_allowed(p_action,p_case_id,p_lead_id) then
    raise exception using errcode = '42501', message = 'sales_permission_denied';
  end if;
end $$;

create function private.sales_replay(p_operation text,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request private.sales_requests; v_hash text;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request_id::text,0));
  v_hash := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  select * into v_request from private.sales_requests where actor_id = auth.uid() and request_id = p_request_id;
  if found then
    if v_request.operation <> p_operation or v_request.payload_hash <> v_hash then
      raise exception using errcode='22023',message='request_conflict';
    end if;
    return v_request.result;
  end if;
  return null;
end $$;

create function private.sales_remember(p_operation text,p_request_id uuid,p_payload jsonb,p_result jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into private.sales_requests(actor_id,request_id,operation,payload_hash,result)
  values(auth.uid(),p_request_id,p_operation,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_result);
  return p_result;
end $$;

create function private.sales_number(p_brand text,p_kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_year integer := extract(year from now() at time zone 'Asia/Bangkok')::integer + 543; v_number bigint;
begin
  insert into private.sales_counters(brand,kind,be_year,last_number) values(p_brand,p_kind,v_year,1)
  on conflict(brand,kind,be_year) do update set last_number = private.sales_counters.last_number + 1
  returning last_number into v_number;
  return case when p_brand = 'BAAN_KUNAPAP' then 'BKP' else 'TRV' end || '-' || p_kind
    || right(v_year::text,2) || '-' || lpad(v_number::text,greatest(4,length(v_number::text)), '0');
end $$;

do $$ declare t text; begin
  foreach t in array array['sales_capabilities','sales_customers','sales_developments','sales_units',
    'sales_cases','sales_reservations','sales_events','sales_requests','sales_counters'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on table private.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on sequence private.sales_events_id_seq from public,anon,authenticated;
revoke all on function private.sales_actor(),private.sales_allowed(text,uuid,uuid),
  private.sales_require(text,uuid,uuid),private.sales_replay(text,uuid,jsonb),
  private.sales_remember(text,uuid,jsonb,jsonb),private.sales_number(text,text) from public,anon,authenticated;
commit;
