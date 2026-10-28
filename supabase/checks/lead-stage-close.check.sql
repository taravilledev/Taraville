-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all eight migrations.
-- No remote execution. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run in the disposable local database as postgres'; end if;
end $$;

create function pg_temp.expect_error(p_sql text, p_state text, p_message text default null)
returns void language plpgsql as $$
declare v_state text; v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> p_state or (p_message is not null and v_message <> p_message) then
      raise exception 'Unexpected failure: [%] %, wanted [%] %', v_state, v_message, p_state, p_message;
    end if;
    return;
  end;
  raise exception 'Expected failure [%] % but operation succeeded', p_state, p_message;
end $$;
create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true)
$$;
create function pg_temp.stage(p_id uuid) returns text language sql as $$
  select stage from public.walkin_leads_staged where id = p_id
$$;
create function pg_temp.version(p_id uuid) returns bigint language sql as $$
  select version from public.leads where id = p_id
$$;
create function pg_temp.events(p_id uuid) returns bigint language sql as $$
  select count(*) from public.lead_status_events where lead_id = p_id
$$;

insert into auth.users(id) values
 ('71000000-0000-4000-a000-000000000001'),
 ('71000000-0000-4000-a000-000000000002'),
 ('71000000-0000-4000-a000-000000000003');
insert into public.staff(id, full_name, role, is_active) values
 ('71000000-0000-4000-a000-000000000001', 'Local stage Sale A', 'sale', true),
 ('71000000-0000-4000-a000-000000000002', 'Local stage Sale B', 'sale', true),
 ('71000000-0000-4000-a000-000000000003', 'Local stage Executive', 'executive', true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

set local role authenticated;
select pg_temp.as_user('71000000-0000-4000-a000-000000000001');
do $$
declare v_brand text; v_lead public.leads;
begin
  foreach v_brand in array array['TARAVILLE', 'BAAN_KUNAPAP'] loop
    select * into v_lead from public.walkin_create_lead_with_privacy(
      case when v_brand = 'TARAVILLE' then '72000000-0000-4000-a000-000000000001'::uuid
        else '72000000-0000-4000-a000-000000000002'::uuid end, v_brand,
      '{"first_name":"Local stage fixture","phone":"0000000000"}', '{}',
      '71000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-22.1', true, true, false);
    perform set_config('walkin.test.' || lower(v_brand), v_lead.id::text, true);
    if pg_temp.stage(v_lead.id) <> 'received' or v_lead.closed_at is not null then
      raise exception 'A new lead must be received and open (%)', v_brand;
    end if;
  end loop;
end $$;

-- contacted: a contact event moves the stage; the initial event does not
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid;
begin
  perform public.walkin_record_privacy_event(v_id, pg_temp.version(v_id),
    '73000000-0000-4000-a000-000000000001', 'contact');
  if pg_temp.stage(v_id) <> 'contacted' then raise exception 'Contact event did not set stage contacted'; end if;
end $$;

-- close: reason list, text rules, brand rule
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid; v_bk uuid := current_setting('walkin.test.baan_kunapap')::uuid;
begin
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'nonsense')$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-000000000001'), '22023', 'invalid_close_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'other')$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-000000000002'), '22023', 'invalid_close_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'other', '   ')$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-000000000002'), '22023', 'invalid_close_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'duplicate', 'extra text')$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-000000000003'), '22023', 'invalid_close_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'bought_with_us')$q$,
    v_bk, pg_temp.version(v_bk), '74000000-0000-4000-a000-000000000004'), '22023', 'invalid_close_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'other', %L)$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-000000000005', repeat('x', 501)), '22023', 'invalid_close_reason');
  if pg_temp.events(v_id) <> 0 or pg_temp.events(v_bk) <> 0 then raise exception 'Rejected closes left events'; end if;
end $$;

-- another Sale cannot see or close it; stale version conflicts
select pg_temp.as_user('71000000-0000-4000-a000-000000000002');
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid;
begin
  if pg_temp.stage(v_id) is not null then raise exception 'Sale B can see Sale A lead'; end if;
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, 2, %L, 'duplicate')$q$,
    v_id, '74000000-0000-4000-a000-000000000006'), '42501', 'access_denied');
  perform pg_temp.expect_error(format($q$select public.walkin_reopen_lead(%L, 2, %L)$q$,
    v_id, '74000000-0000-4000-a000-000000000007'), '42501', 'access_denied');
end $$;

select pg_temp.as_user('71000000-0000-4000-a000-000000000001');
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid; v_lead public.leads; v_replay public.leads; v_before bigint;
begin
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'duplicate')$q$,
    v_id, pg_temp.version(v_id) - 1, '74000000-0000-4000-a000-000000000008'), 'PT409', 'stale_lead');
  v_before := pg_temp.version(v_id);
  select * into v_lead from public.walkin_close_lead(v_id, v_before, '74000000-0000-4000-a000-000000000009', 'other', '  moved abroad ');
  if v_lead.closed_at is null or v_lead.closed_by <> '71000000-0000-4000-a000-000000000001'
    or v_lead.closed_reason <> 'other' or v_lead.version <> v_before + 1 then
    raise exception 'Close did not set state and bump version';
  end if;
  if pg_temp.stage(v_id) <> 'closed' then raise exception 'Closed lead with a contact event must show closed'; end if;
  if (select reason_text from public.lead_status_events where lead_id = v_id) <> 'moved abroad' then
    raise exception 'Reason text was not trimmed and stored';
  end if;
  -- replay returns the same state without a second event or version bump
  select * into v_replay from public.walkin_close_lead(v_id, v_before, '74000000-0000-4000-a000-000000000009', 'other', 'moved abroad');
  if v_replay.version <> v_before + 1 or pg_temp.events(v_id) <> 1 then raise exception 'Close replay duplicated'; end if;
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'duplicate')$q$,
    v_id, v_before, '74000000-0000-4000-a000-000000000009'), '22023', 'request_conflict');
  -- already closed
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'duplicate')$q$,
    v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-00000000000a'), '22023', 'invalid_lead_state');
  -- closed leads stay usable: a contact is recorded and does not reopen
  perform public.walkin_record_privacy_event(v_id, pg_temp.version(v_id), '73000000-0000-4000-a000-000000000002', 'contact');
  if pg_temp.stage(v_id) <> 'closed' then raise exception 'A new contact must not reopen a lead'; end if;
end $$;

-- reopen: restores the derived stage, once
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid; v_lead public.leads; v_before bigint;
begin
  perform pg_temp.expect_error(format($q$select public.walkin_reopen_lead(%L, %s, %L)$q$,
    v_id, pg_temp.version(v_id) - 1, '75000000-0000-4000-a000-000000000001'), 'PT409', 'stale_lead');
  v_before := pg_temp.version(v_id);
  select * into v_lead from public.walkin_reopen_lead(v_id, v_before, '75000000-0000-4000-a000-000000000002');
  if v_lead.closed_at is not null or v_lead.closed_by is not null or v_lead.closed_reason is not null
    or v_lead.version <> v_before + 1 then raise exception 'Reopen did not clear state and bump version'; end if;
  if pg_temp.stage(v_id) <> 'contacted' then raise exception 'Reopened lead must return to contacted'; end if;
  perform public.walkin_reopen_lead(v_id, v_before, '75000000-0000-4000-a000-000000000002');
  if pg_temp.version(v_id) <> v_before + 1 or pg_temp.events(v_id) <> 2 then raise exception 'Reopen replay duplicated'; end if;
  perform pg_temp.expect_error(format($q$select public.walkin_reopen_lead(%L, %s, %L)$q$,
    v_id, pg_temp.version(v_id), '75000000-0000-4000-a000-000000000003'), '22023', 'invalid_lead_state');
  -- Taraville-only reason is accepted on a Taraville lead
  perform public.walkin_close_lead(v_id, pg_temp.version(v_id), '74000000-0000-4000-a000-00000000000b', 'bought_with_us');
  if pg_temp.stage(v_id) <> 'closed' then raise exception 'bought_with_us close failed'; end if;
end $$;

-- Executive may reopen any lead; application roles cannot write tables directly
select pg_temp.as_user('71000000-0000-4000-a000-000000000003');
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid;
begin
  perform public.walkin_reopen_lead(v_id, pg_temp.version(v_id), '75000000-0000-4000-a000-000000000004');
  if pg_temp.stage(v_id) <> 'contacted' then raise exception 'Executive reopen failed'; end if;
  perform pg_temp.expect_error(format($q$update public.leads set closed_at = now() where id = %L$q$, v_id), '42501');
  perform pg_temp.expect_error(format($q$insert into public.lead_status_events(lead_id, actor_id, request_id, kind)
    values (%L, '71000000-0000-4000-a000-000000000003', gen_random_uuid(), 'reopen')$q$, v_id), '42501');
end $$;

-- Anonymous callers cannot execute the RPCs
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.walkin_close_lead(gen_random_uuid(), 1, gen_random_uuid(), 'duplicate')$q$, '42501');
select pg_temp.expect_error($q$select public.walkin_reopen_lead(gen_random_uuid(), 1, gen_random_uuid())$q$, '42501');
reset role;

-- History is immutable; state columns must stay consistent; scoped removal clears the history
do $$ declare v_id uuid := current_setting('walkin.test.taraville')::uuid;
begin
  perform pg_temp.expect_error(format($q$update public.lead_status_events set reason = 'duplicate' where lead_id = %L$q$, v_id), '42501', 'immutable_privacy_event');
  perform pg_temp.expect_error(format($q$delete from public.lead_status_events where lead_id = %L$q$, v_id), '42501', 'immutable_privacy_event');
  perform pg_temp.expect_error(format($q$update public.leads set closed_at = now() where id = %L$q$, v_id), '23514');
  perform private.walkin_remove_lead(v_id, pg_temp.version(v_id), 'local-stage-removal');
  if exists(select 1 from public.leads where id = v_id) or pg_temp.events(v_id) <> 0
    or exists(select 1 from public.lead_privacy_events where lead_id = v_id) then
    raise exception 'Scoped removal left a lead or its history';
  end if;
  if not exists(select 1 from public.leads where id = current_setting('walkin.test.baan_kunapap')::uuid) then
    raise exception 'Scoped removal touched another lead';
  end if;
end $$;
rollback;
\echo PASS: stage derivation, close/reopen rules, ownership, idempotency, conflicts, immutability, grants and scoped removal
-- SQL only: no HTTP/Auth-server/browser, concurrency, deployed configuration or backup restore proof.
