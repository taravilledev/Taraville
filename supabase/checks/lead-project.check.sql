-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all nine migrations.
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

create function pg_temp.projects_of(p_id uuid) returns bigint language sql as $$
  select count(*) from public.projects where lead_id = p_id
$$;
create function pg_temp.project_of(p_id uuid) returns public.projects language sql as $$
  select p from public.projects p where p.lead_id = p_id and p.status = 'active'
$$;

insert into auth.users(id) values
 ('81000000-0000-4000-a000-000000000001'),
 ('81000000-0000-4000-a000-000000000002'),
 ('81000000-0000-4000-a000-000000000003');
insert into public.staff(id, full_name, role, is_active) values
 ('81000000-0000-4000-a000-000000000001', 'Local project Sale A', 'sale', true),
 ('81000000-0000-4000-a000-000000000002', 'Local project Sale B', 'sale', true),
 ('81000000-0000-4000-a000-000000000003', 'Local project Executive', 'executive', true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

set local role authenticated;
select pg_temp.as_user('81000000-0000-4000-a000-000000000001');
do $$
declare v_lead public.leads; v_n int;
begin
  for v_n in 1..6 loop
    select * into v_lead from public.walkin_create_lead_with_privacy(
      ('82000000-0000-4000-a000-00000000000' || v_n)::uuid,
      case when v_n = 2 then 'TARAVILLE' else 'BAAN_KUNAPAP' end,
      '{"first_name":"Local project fixture","phone":"0000000000"}', '{}',
      '81000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-30.1', true, true, false);
    perform set_config('walkin.test.l' || v_n, v_lead.id::text, true);
  end loop;
end $$;

-- preconditions: BK only, owner/executive only, stale version
do $$ declare v_tv uuid := current_setting('walkin.test.l2')::uuid; v_bk uuid := current_setting('walkin.test.l1')::uuid;
begin
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, %s, %L)$q$,
    v_tv, pg_temp.version(v_tv), '83000000-0000-4000-a000-000000000001'), '22023', 'invalid_lead_state');
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, %s, %L)$q$,
    v_bk, pg_temp.version(v_bk) - 1, '83000000-0000-4000-a000-000000000002'), 'PT409', 'stale_lead');
  if pg_temp.projects_of(v_tv) <> 0 or pg_temp.projects_of(v_bk) <> 0 then raise exception 'Rejected opens created projects'; end if;
end $$;
select pg_temp.as_user('81000000-0000-4000-a000-000000000002');
do $$ declare v_bk uuid := current_setting('walkin.test.l1')::uuid;
begin
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, 1, %L)$q$,
    v_bk, '83000000-0000-4000-a000-000000000003'), '42501', 'access_denied');
end $$;

-- open: code, version bump, stage, replay
select pg_temp.as_user('81000000-0000-4000-a000-000000000001');
do $$
declare v_bk uuid := current_setting('walkin.test.l1')::uuid; v_p public.projects; v_replay public.projects; v_before bigint;
  v_yy text := lpad(((extract(year from (now() at time zone 'Asia/Bangkok'))::int + 543) % 100)::text, 2, '0');
begin
  v_before := pg_temp.version(v_bk);
  select * into v_p from public.walkin_open_project(v_bk, v_before, '83000000-0000-4000-a000-000000000004');
  if v_p.code <> 'BKP-' || v_yy || '-001' or v_p.status <> 'active' or v_p.brand <> 'BAAN_KUNAPAP' or v_p.version <> 1
    or v_p.created_by <> '81000000-0000-4000-a000-000000000001' then raise exception 'Open produced %', v_p.code; end if;
  if pg_temp.version(v_bk) <> v_before + 1 then raise exception 'Open must bump the lead version'; end if;
  if pg_temp.stage(v_bk) <> 'project_opened' then raise exception 'Stage must be project_opened'; end if;
  select * into v_replay from public.walkin_open_project(v_bk, v_before, '83000000-0000-4000-a000-000000000004');
  if v_replay.id <> v_p.id or pg_temp.projects_of(v_bk) <> 1 or pg_temp.version(v_bk) <> v_before + 1 then
    raise exception 'Open replay duplicated';
  end if;
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, 1, %L)$q$,
    current_setting('walkin.test.l3'), '83000000-0000-4000-a000-000000000004'), '22023', 'request_conflict');
  -- one active project per lead; an active project blocks closing
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, %s, %L)$q$,
    v_bk, pg_temp.version(v_bk), '83000000-0000-4000-a000-000000000005'), '22023', 'invalid_lead_state');
  perform pg_temp.expect_error(format($q$select public.walkin_close_lead(%L, %s, %L, 'duplicate')$q$,
    v_bk, pg_temp.version(v_bk), '84000000-0000-4000-a000-000000000001'), '22023', 'invalid_lead_state');
  -- a second lead gets the next number
  select * into v_p from public.walkin_open_project(current_setting('walkin.test.l3')::uuid,
    pg_temp.version(current_setting('walkin.test.l3')::uuid), '83000000-0000-4000-a000-000000000006');
  if v_p.code <> 'BKP-' || v_yy || '-002' then raise exception 'Second code was %', v_p.code; end if;
end $$;

-- a closed lead cannot open a project
do $$ declare v_id uuid := current_setting('walkin.test.l4')::uuid;
begin
  perform public.walkin_close_lead(v_id, pg_temp.version(v_id), '84000000-0000-4000-a000-000000000002', 'duplicate');
  perform pg_temp.expect_error(format($q$select public.walkin_open_project(%L, %s, %L)$q$,
    v_id, pg_temp.version(v_id), '83000000-0000-4000-a000-000000000007'), '22023', 'invalid_lead_state');
end $$;

-- visibility follows the lead; application roles cannot write
select pg_temp.as_user('81000000-0000-4000-a000-000000000002');
do $$ begin
  if (select count(*) from public.projects) <> 2 then raise exception 'Sale B must see shared lead projects'; end if;
  perform pg_temp.expect_error($q$select public.walkin_cancel_project(gen_random_uuid(), 1, gen_random_uuid(), 'x')$q$, '42501', 'access_denied');
end $$;
select pg_temp.as_user('81000000-0000-4000-a000-000000000001');
do $$ declare v_pid uuid := (pg_temp.project_of(current_setting('walkin.test.l1')::uuid)).id;
begin
  if (select count(*) from public.projects) <> 2 then raise exception 'Sale A must see own projects'; end if;
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, 1, %L, 'mistake')$q$, v_pid,
    '85000000-0000-4000-a000-000000000001'), '42501', 'access_denied');
  perform pg_temp.expect_error(format($q$update public.projects set status = 'cancelled' where id = %L$q$, v_pid), '42501');
  perform pg_temp.expect_error($q$insert into public.projects(code, brand, lead_id, created_by, create_request_id)
    values ('BKP-00-999', 'BAAN_KUNAPAP', gen_random_uuid(), '81000000-0000-4000-a000-000000000001', gen_random_uuid())$q$, '42501');
end $$;

-- cancel: Executive only, reason required, one-way, then the lead can open a new project
select pg_temp.as_user('81000000-0000-4000-a000-000000000003');
do $$
declare v_bk uuid := current_setting('walkin.test.l1')::uuid; v_old public.projects := pg_temp.project_of(v_bk);
  v_p public.projects; v_lead_before bigint := pg_temp.version(v_bk);
  v_yy text := lpad(((extract(year from (now() at time zone 'Asia/Bangkok'))::int + 543) % 100)::text, 2, '0');
begin
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, 1, %L, '  ')$q$, v_old.id,
    '85000000-0000-4000-a000-000000000002'), '22023', 'invalid_cancel_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, 1, %L, %L)$q$, v_old.id,
    '85000000-0000-4000-a000-000000000003', repeat('x', 501)), '22023', 'invalid_cancel_reason');
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, 99, %L, 'opened by mistake')$q$, v_old.id,
    '85000000-0000-4000-a000-000000000004'), 'PT409', 'stale_project');
  select * into v_p from public.walkin_cancel_project(v_old.id, v_old.version, '85000000-0000-4000-a000-000000000005', '  opened by mistake ');
  if v_p.status <> 'cancelled' or v_p.cancel_reason <> 'opened by mistake' or v_p.version <> 2
    or v_p.cancelled_by <> '81000000-0000-4000-a000-000000000003' then raise exception 'Cancel did not record state'; end if;
  if pg_temp.version(v_bk) <> v_lead_before + 1 then raise exception 'Cancel must bump the lead version'; end if;
  if pg_temp.stage(v_bk) <> 'received' then raise exception 'Stage after cancel must derive again, got %', pg_temp.stage(v_bk); end if;
  -- replay is a no-op; cancelling again fails; the code is kept
  perform public.walkin_cancel_project(v_old.id, v_old.version, '85000000-0000-4000-a000-000000000005', 'opened by mistake');
  if pg_temp.version(v_bk) <> v_lead_before + 1 then raise exception 'Cancel replay bumped the lead'; end if;
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, %s, %L, 'different reason')$q$, v_old.id,
    v_old.version, '85000000-0000-4000-a000-000000000005'), '22023', 'request_conflict');
  perform pg_temp.expect_error(format($q$select public.walkin_cancel_project(%L, 2, %L, 'again')$q$, v_old.id,
    '85000000-0000-4000-a000-000000000006'), '22023', 'invalid_project_state');
  -- opening again issues a new number; the cancelled code is never reused
  select * into v_p from public.walkin_open_project(v_bk, pg_temp.version(v_bk), '83000000-0000-4000-a000-000000000008');
  if v_p.code <> 'BKP-' || v_yy || '-003' or pg_temp.projects_of(v_bk) <> 2 then raise exception 'Reopen code was %', v_p.code; end if;
  if pg_temp.stage(v_bk) <> 'project_opened' then raise exception 'New project must set project_opened'; end if;
end $$;

-- the number grows a digit past 999 instead of failing
reset role;
update private.project_code_counters set last_no = 998;
set local role authenticated;
select pg_temp.as_user('81000000-0000-4000-a000-000000000001');
do $$
declare v_a public.projects; v_b public.projects;
  v_yy text := lpad(((extract(year from (now() at time zone 'Asia/Bangkok'))::int + 543) % 100)::text, 2, '0');
begin
  select * into v_a from public.walkin_open_project(current_setting('walkin.test.l5')::uuid,
    pg_temp.version(current_setting('walkin.test.l5')::uuid), '83000000-0000-4000-a000-000000000009');
  select * into v_b from public.walkin_open_project(current_setting('walkin.test.l6')::uuid,
    pg_temp.version(current_setting('walkin.test.l6')::uuid), '83000000-0000-4000-a000-00000000000a');
  if v_a.code <> 'BKP-' || v_yy || '-999' or v_b.code <> 'BKP-' || v_yy || '-1000' then
    raise exception 'Overflow codes were % and %', v_a.code, v_b.code;
  end if;
end $$;

-- Anonymous callers cannot execute; table state must stay consistent; removal refuses a lead with a project
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.walkin_open_project(gen_random_uuid(), 1, gen_random_uuid())$q$, '42501');
select pg_temp.expect_error($q$select public.walkin_cancel_project(gen_random_uuid(), 1, gen_random_uuid(), 'x')$q$, '42501');
reset role;
do $$ declare v_bk uuid := current_setting('walkin.test.l1')::uuid;
begin
  perform pg_temp.expect_error(format($q$update public.projects set cancelled_at = now() where id = %L$q$,
    (pg_temp.project_of(v_bk)).id), '23514');
  perform pg_temp.expect_error(format($q$select private.walkin_remove_lead(%L, %s, 'local-project-removal')$q$,
    v_bk, pg_temp.version(v_bk)), '22023', 'lead_has_project');
  perform private.walkin_remove_lead(current_setting('walkin.test.l2')::uuid, pg_temp.version(current_setting('walkin.test.l2')::uuid), 'local-project-removal');
  if exists (select 1 from public.leads where id = current_setting('walkin.test.l2')::uuid) then raise exception 'Project-free lead was not removed'; end if;
end $$;
rollback;
\echo PASS: project open/cancel rules, codes, stage, ownership, idempotency, conflicts, grants and removal guard
-- SQL only: no HTTP/Auth-server/browser, concurrency, deployed configuration or backup restore proof.
