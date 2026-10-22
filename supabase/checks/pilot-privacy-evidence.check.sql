-- Disposable local PostgreSQL ONLY. Parent runs after pilot-privacy-http.check.mts.
-- Uses existing synthetic Sale/Executive fixtures; no DELETEs or remote calls.
begin;
do $$
declare
  v_lead public.leads;
begin
  if not exists (select 1 from public.lead_privacy_events) then
    raise exception 'Run local HTTP privacy checks before checking persisted evidence';
  end if;
  if exists (select 1 from public.lead_privacy_events e where e.notice_hash <>
    encode(sha256(convert_to(e.notice_snapshot::text, 'UTF8')), 'hex')) then
    raise exception 'Stored evidence hash does not match its exact PostgreSQL JSONB snapshot';
  end if;
  if exists (select 1 from public.lead_privacy_events where kind = 'initial'
    and (notice_presented is distinct from true or followup_requested is distinct from true)) then
    raise exception 'Initial evidence must preserve explicit notice presentation and follow-up request';
  end if;
  if exists (select 1 from public.lead_privacy_events where kind = 'contact'
    and (notice_presented is not null or followup_requested is not null)) then
    raise exception 'Contact evidence must not invent new notice/follow-up choices';
  end if;
  begin
    update public.lead_privacy_events set notice_hash = repeat('0', 64)
      where id = (select min(id) from public.lead_privacy_events);
    raise exception 'Privileged UPDATE unexpectedly rewrote immutable privacy history';
  exception when insufficient_privilege then
    if sqlerrm <> 'immutable_privacy_event' then raise; end if;
  end;
  if not (select relrowsecurity from pg_class where oid = 'public.lead_privacy_events'::regclass) then
    raise exception 'Privacy event RLS is disabled';
  end if;
  if not (select coalesce(reloptions @> array['security_invoker=true'], false)
    from pg_class where oid = 'public.walkin_retention_due'::regclass) then
    raise exception 'Retention view must preserve invoker authorization';
  end if;
  if has_table_privilege('authenticated', 'public.lead_privacy_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.lead_privacy_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.lead_privacy_events', 'DELETE') then
    raise exception 'Direct privacy event writes are granted';
  end if;
  perform set_config('request.jwt.claim.sub', '40000000-0000-4000-a000-000000000001', true);
  perform set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
  select * into v_lead from public.walkin_create_lead(
    gen_random_uuid(), 'TARAVILLE', '{"first_name":"SyntheticRetention","phone":"0000000000"}',
    '{}', '40000000-0000-4000-a000-000000000001');
  perform set_config('walkin.test.retention_id', v_lead.id::text, true);
  -- 29 February in Bangkok plus 12 calendar months is 28 February next year.
  update public.leads set last_contact_at = '2024-02-28 17:30:00+00' where id = v_lead.id;
end
$$;

-- Deliberate local fault injection: an evidence insert failure must roll back its Lead.
-- The trigger/function exist only inside this transaction and disappear at ROLLBACK.
create function pg_temp.walkin_check_reject_evidence() returns trigger
language plpgsql as $$
begin
  raise exception 'synthetic_evidence_insert_failure' using errcode = '23514';
end
$$;
create trigger walkin_check_reject_evidence before insert on public.lead_privacy_events
  for each row execute function pg_temp.walkin_check_reject_evidence();
do $$
declare
  v_request uuid := gen_random_uuid();
begin
  begin
    perform public.walkin_create_lead_with_privacy(v_request, 'TARAVILLE',
      '{"first_name":"SyntheticRollback","phone":"0000000000"}', '{}',
      '40000000-0000-4000-a000-000000000001', 'walkin-synthetic-2026-10-21.1', true, true, false);
    raise exception 'Privacy create unexpectedly succeeded despite forced evidence failure';
  exception when check_violation then
    if sqlerrm <> 'synthetic_evidence_insert_failure' then raise; end if;
  end;
  if exists (select 1 from public.leads where create_request_id = v_request)
    or exists (select 1 from public.lead_privacy_events where request_id = v_request) then
    raise exception 'Evidence failure left a partial Lead or privacy event';
  end if;
end
$$;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.walkin_retention_due) then
    raise exception 'Sale must not see the Executive due-review list';
  end if;
  perform set_config('request.jwt.claim.sub', '40000000-0000-4000-a000-000000000002', true);
  perform set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
  if not exists (select 1 from public.walkin_retention_due
    where id = current_setting('walkin.test.retention_id')::uuid
    and review_due_at = '2025-02-27 17:30:00+00'::timestamptz) then
    raise exception 'Executive due-review list must use 12 Bangkok calendar months including leap-day clamping';
  end if;
end
$$;
rollback;
-- SQL checks do not prove production grant/configuration state or real-data release.
