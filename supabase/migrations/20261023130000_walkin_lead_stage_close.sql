-- ADR 0008: lead stage derived from facts, explicit close/reopen. Not applied to any remote project.
alter table public.leads
  add column closed_at timestamptz,
  add column closed_by uuid references public.staff(id),
  add column closed_reason text check (closed_reason in (
    'not_interested', 'bought_elsewhere', 'not_ready', 'unreachable', 'duplicate', 'other', 'bought_with_us')),
  add constraint leads_closed_consistent check (
    (closed_at is null) = (closed_by is null) and (closed_at is null) = (closed_reason is null));
create index leads_closed_idx on public.leads(closed_at) where closed_at is not null;

create table public.lead_status_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id),
  actor_id uuid not null references public.staff(id),
  request_id uuid not null,
  kind text not null check (kind in ('close', 'reopen')),
  reason text check (reason in (
    'not_interested', 'bought_elsewhere', 'not_ready', 'unreachable', 'duplicate', 'other', 'bought_with_us')),
  reason_text text check (length(btrim(reason_text)) between 1 and 500),
  recorded_at timestamptz not null default clock_timestamp(),
  check ((kind = 'close') = (reason is not null)),
  check ((reason = 'other') = (reason_text is not null)),
  unique (lead_id, actor_id, request_id)
);
create index lead_status_latest_idx on public.lead_status_events(lead_id, id desc);
alter table public.lead_status_events enable row level security;
revoke all on public.lead_status_events from public, anon, authenticated;
revoke all on sequence public.lead_status_events_id_seq from public, anon, authenticated;
grant select on public.lead_status_events to authenticated;
create policy lead_status_read on public.lead_status_events for select to authenticated using (
  exists (select 1 from public.leads l where l.id = lead_id)
  and (select private.walkin_actor_role()) in ('sale', 'executive')
);

-- Append-only; reuses the privacy-history guard, which only lets the approved-removal procedure delete.
create trigger status_history_immutable before update or delete on public.lead_status_events
  for each row execute function private.walkin_guard_privacy_history();

-- The one definition of stage. Precedence per ADR 0008; `project_opened` joins when F1.7 adds Projects.
create function private.walkin_lead_stage(l public.leads) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when l.closed_at is not null then 'closed'
    when exists (select 1 from public.lead_privacy_events e where e.lead_id = l.id and e.kind = 'contact') then 'contacted'
    else 'received'
  end
$$;
revoke all on function private.walkin_lead_stage(public.leads) from public, anon, authenticated;
grant execute on function private.walkin_lead_stage(public.leads) to authenticated;

create view public.walkin_leads_staged with (security_invoker = true) as
  select l.*, private.walkin_lead_stage(l) as stage from public.leads l;
revoke all on public.walkin_leads_staged from public, anon, authenticated;
grant select on public.walkin_leads_staged to authenticated;

create function private.walkin_close_lead(
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
  if v_lead.closed_at is not null then
    raise exception 'invalid_lead_state' using errcode = '22023';
  end if;
  insert into public.lead_status_events (lead_id, actor_id, request_id, kind, reason, reason_text, recorded_at)
  values (p_lead_id, v_actor.id, p_request_id, 'close', p_reason, v_text, v_now);
  update public.leads set closed_at = v_now, closed_by = v_actor.id, closed_reason = p_reason,
    version = version + 1, updated_at = v_now where id = p_lead_id returning * into v_lead;
  return v_lead;
end
$$;
revoke all on function private.walkin_close_lead(uuid, bigint, uuid, text, text) from public, anon, authenticated;
grant execute on function private.walkin_close_lead(uuid, bigint, uuid, text, text) to authenticated;

create function private.walkin_reopen_lead(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
  v_existing public.lead_status_events;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  select * into v_existing from public.lead_status_events where lead_id = p_lead_id
    and actor_id = v_actor.id and request_id = p_request_id;
  if v_existing.id is not null then
    if v_existing.kind <> 'reopen' then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    return v_lead;
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  if v_lead.closed_at is null then
    raise exception 'invalid_lead_state' using errcode = '22023';
  end if;
  insert into public.lead_status_events (lead_id, actor_id, request_id, kind, recorded_at)
  values (p_lead_id, v_actor.id, p_request_id, 'reopen', v_now);
  update public.leads set closed_at = null, closed_by = null, closed_reason = null,
    version = version + 1, updated_at = v_now where id = p_lead_id returning * into v_lead;
  return v_lead;
end
$$;
revoke all on function private.walkin_reopen_lead(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function private.walkin_reopen_lead(uuid, bigint, uuid) to authenticated;

create function public.walkin_close_lead(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid, p_reason text, p_reason_text text default null
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_close_lead(p_lead_id, p_expected_version, p_request_id, p_reason, p_reason_text)
$$;
revoke all on function public.walkin_close_lead(uuid, bigint, uuid, text, text) from public, anon, authenticated;
grant execute on function public.walkin_close_lead(uuid, bigint, uuid, text, text) to authenticated;

create function public.walkin_reopen_lead(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_reopen_lead(p_lead_id, p_expected_version, p_request_id)
$$;
revoke all on function public.walkin_reopen_lead(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.walkin_reopen_lead(uuid, bigint, uuid) to authenticated;

-- Controlled removal must also clear the new history (same approved-removal flag as privacy events).
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
  -- Approval/hold review and case register are maintained outside the removed data.
  perform set_config('walkin.approved_removal', p_lead_id::text, true);
  delete from public.lead_privacy_events where lead_id = p_lead_id;
  delete from public.lead_status_events where lead_id = p_lead_id;
  delete from public.leads where id = p_lead_id;
  perform set_config('walkin.approved_removal', '', true);
end
$$;
