-- ADR 0009 (F1.7): BK Lead -> minimal Project. Not applied to any remote project.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand text not null check (brand = 'BAAN_KUNAPAP'),
  lead_id uuid not null references public.leads(id),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid not null references public.staff(id),
  create_request_id uuid not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.staff(id),
  cancel_request_id uuid,
  cancel_reason text check (length(btrim(cancel_reason)) between 1 and 500),
  unique (created_by, create_request_id),
  constraint projects_cancel_consistent check ((status = 'cancelled') = (cancelled_at is not null)
    and (cancelled_at is null) = (cancelled_by is null) and (cancelled_at is null) = (cancel_reason is null)
    and (cancelled_at is null) = (cancel_request_id is null))
);
-- At most one active Project per Lead; cancelled ones stay as history.
create unique index projects_active_lead_idx on public.projects(lead_id) where status = 'active';
create index projects_lead_idx on public.projects(lead_id);
alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to authenticated;
-- Same visibility as the Lead (its owner and Executives); the leads policy applies inside this check.
create policy projects_read on public.projects for select to authenticated using (
  exists (select 1 from public.leads l where l.id = lead_id)
  and (select private.walkin_actor_role()) in ('sale', 'executive')
);

-- One running number per prefix per Buddhist-era year; a rolled-back open rolls the counter back too.
create table private.project_code_counters (
  prefix text not null, be_year int not null, last_no int not null check (last_no > 0),
  primary key (prefix, be_year)
);
revoke all on private.project_code_counters from public, anon, authenticated;

create function private.walkin_next_project_code(p_prefix text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int + 543;
  v_no int;
begin
  insert into private.project_code_counters as c (prefix, be_year, last_no) values (p_prefix, v_year, 1)
    on conflict (prefix, be_year) do update set last_no = c.last_no + 1
    returning c.last_no into v_no;
  -- lpad truncates, so past 999 the number is written as is and the code grows a digit.
  return p_prefix || '-' || lpad((v_year % 100)::text, 2, '0') || '-' ||
    case when v_no < 1000 then lpad(v_no::text, 3, '0') else v_no::text end;
end
$$;
revoke all on function private.walkin_next_project_code(text) from public, anon, authenticated;

-- Stage: an active Project outranks everything (ADR 0008 precedence).
create or replace function private.walkin_lead_stage(l public.leads) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when exists (select 1 from public.projects p where p.lead_id = l.id and p.status = 'active') then 'project_opened'
    when l.closed_at is not null then 'closed'
    when exists (select 1 from public.lead_privacy_events e where e.lead_id = l.id and e.kind = 'contact') then 'contacted'
    else 'received'
  end
$$;

create function private.walkin_open_project(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid
) returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
  v_project public.projects;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  select * into v_project from public.projects where created_by = v_actor.id and create_request_id = p_request_id;
  if v_project.id is not null then
    if v_project.lead_id <> p_lead_id then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    return v_project;
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  if v_lead.brand <> 'BAAN_KUNAPAP' or v_lead.closed_at is not null
    or exists (select 1 from public.projects where lead_id = p_lead_id and status = 'active') then
    raise exception 'invalid_lead_state' using errcode = '22023';
  end if;
  insert into public.projects (code, brand, lead_id, created_by, create_request_id, created_at)
  values (private.walkin_next_project_code('BKP'), v_lead.brand, p_lead_id, v_actor.id, p_request_id, v_now)
  returning * into v_project;
  update public.leads set version = version + 1, updated_at = v_now where id = p_lead_id;
  return v_project;
end
$$;
revoke all on function private.walkin_open_project(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function private.walkin_open_project(uuid, bigint, uuid) to authenticated;

-- Executive only, one-way. The Lead is locked first (as in open) so the two never deadlock.
create function private.walkin_cancel_project(
  p_project_id uuid, p_expected_version bigint, p_request_id uuid, p_reason text
) returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead_id uuid;
  v_project public.projects;
  v_reason text := nullif(btrim(p_reason), '');
  v_now timestamptz := clock_timestamp();
begin
  if v_actor.role <> 'executive' then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_request_id is null or v_reason is null or length(v_reason) > 500 then
    raise exception 'invalid_cancel_reason' using errcode = '22023';
  end if;
  select lead_id into v_lead_id from public.projects where id = p_project_id;
  if v_lead_id is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.status = 'cancelled' and v_project.cancel_request_id = p_request_id
    and v_project.cancelled_by = v_actor.id and v_project.cancel_reason = v_reason then
    return v_project;
  end if;
  if p_expected_version is null or v_project.version <> p_expected_version then
    raise exception 'stale_project' using errcode = 'PT409';
  end if;
  if v_project.status <> 'active' then
    raise exception 'invalid_project_state' using errcode = '22023';
  end if;
  update public.projects set status = 'cancelled', cancelled_at = v_now, cancelled_by = v_actor.id,
    cancel_request_id = p_request_id, cancel_reason = v_reason, version = version + 1
  where id = p_project_id returning * into v_project;
  update public.leads set version = version + 1, updated_at = v_now where id = v_lead_id;
  return v_project;
end
$$;
revoke all on function private.walkin_cancel_project(uuid, bigint, uuid, text) from public, anon, authenticated;
grant execute on function private.walkin_cancel_project(uuid, bigint, uuid, text) to authenticated;

create function public.walkin_open_project(p_lead_id uuid, p_expected_version bigint, p_request_id uuid)
returns public.projects language sql security invoker set search_path = '' as $$
  select private.walkin_open_project(p_lead_id, p_expected_version, p_request_id)
$$;
revoke all on function public.walkin_open_project(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.walkin_open_project(uuid, bigint, uuid) to authenticated;

create function public.walkin_cancel_project(p_project_id uuid, p_expected_version bigint, p_request_id uuid, p_reason text)
returns public.projects language sql security invoker set search_path = '' as $$
  select private.walkin_cancel_project(p_project_id, p_expected_version, p_request_id, p_reason)
$$;
revoke all on function public.walkin_cancel_project(uuid, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.walkin_cancel_project(uuid, bigint, uuid, text) to authenticated;

-- A Lead with an active Project cannot be closed (ADR 0008).
create or replace function private.walkin_close_lead(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid, p_reason text, p_reason_text text default null
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
  v_existing public.lead_status_events;
  v_text text := nullif(btrim(p_reason_text), '');
  v_now timestamptz := clock_timestamp();
begin
  if p_request_id is null or p_reason is null
    or p_reason not in ('not_interested', 'bought_elsewhere', 'not_ready', 'unreachable', 'duplicate', 'other', 'bought_with_us')
    or (p_reason = 'other') is distinct from (v_text is not null)
    or length(v_text) > 500 then
    raise exception 'invalid_close_reason' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_reason = 'bought_with_us' and v_lead.brand <> 'TARAVILLE' then
    raise exception 'invalid_close_reason' using errcode = '22023';
  end if;
  select * into v_existing from public.lead_status_events where lead_id = p_lead_id
    and actor_id = v_actor.id and request_id = p_request_id;
  if v_existing.id is not null then
    if v_existing.kind <> 'close' or v_existing.reason <> p_reason or v_existing.reason_text is distinct from v_text then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    return v_lead;
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  if v_lead.closed_at is not null
    or exists (select 1 from public.projects where lead_id = p_lead_id and status = 'active') then
    raise exception 'invalid_lead_state' using errcode = '22023';
  end if;
  insert into public.lead_status_events (lead_id, actor_id, request_id, kind, reason, reason_text, recorded_at)
  values (p_lead_id, v_actor.id, p_request_id, 'close', p_reason, v_text, v_now);
  update public.leads set closed_at = v_now, closed_by = v_actor.id, closed_reason = p_reason,
    version = version + 1, updated_at = v_now where id = p_lead_id returning * into v_lead;
  return v_lead;
end
$$;

-- A Lead that has (or had) a Project keeps it as history; removing it needs its own approved procedure.
create or replace function private.walkin_remove_lead(p_lead_id uuid, p_expected_version bigint, p_case_reference text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_lead public.leads;
begin
  if current_user <> 'postgres' then raise exception 'access_denied' using errcode = '42501'; end if;
  if p_case_reference is null or length(trim(p_case_reference)) < 3 or length(p_case_reference) > 200 then
    raise exception 'approved_case_required' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then raise exception 'lead_not_found' using errcode = '22023'; end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  if exists (select 1 from public.projects where lead_id = p_lead_id) then
    raise exception 'lead_has_project' using errcode = '22023';
  end if;
  -- Approval/hold review and case register are maintained outside the removed data.
  perform set_config('walkin.approved_removal', p_lead_id::text, true);
  delete from public.lead_privacy_events where lead_id = p_lead_id;
  delete from public.lead_status_events where lead_id = p_lead_id;
  delete from public.leads where id = p_lead_id;
  perform set_config('walkin.approved_removal', '', true);
end
$$;
