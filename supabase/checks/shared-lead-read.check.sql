-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all migrations.
-- No remote execution. Fixtures and mutations roll back.
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

insert into auth.users(id) values
 ('91000000-0000-4000-a000-000000000001'),
 ('91000000-0000-4000-a000-000000000002'),
 ('91000000-0000-4000-a000-000000000003'),
 ('91000000-0000-4000-a000-000000000004');
insert into public.staff(id, full_name, role, is_active) values
 ('91000000-0000-4000-a000-000000000001', 'Shared read Sale A', 'sale', true),
 ('91000000-0000-4000-a000-000000000002', 'Shared read Sale B', 'sale', true),
 ('91000000-0000-4000-a000-000000000003', 'Shared read Executive', 'executive', true),
 ('91000000-0000-4000-a000-000000000004', 'Shared read inactive', 'sale', false)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-a000-000000000002');
do $$ declare v_lead public.leads; v_project public.projects; v_n int;
begin
  for v_n in 1..3 loop
    select * into v_lead from public.walkin_create_lead_with_privacy(gen_random_uuid(),
      case when v_n = 2 then 'TARAVILLE' else 'BAAN_KUNAPAP' end,
      '{"first_name":"Shared read fixture","phone":"0000000000"}', '{}',
      '91000000-0000-4000-a000-000000000002', 'walkin-live-2026-10-30.1', true, true, false);
    perform set_config('walkin.shared.l' || v_n, v_lead.id::text, true);
    if v_n = 2 then
      perform public.walkin_close_lead(v_lead.id, v_lead.version, gen_random_uuid(), 'duplicate');
    elsif v_n = 3 then
      select * into v_project from public.walkin_open_project(v_lead.id, v_lead.version, gen_random_uuid());
      perform set_config('walkin.shared.project', v_project.id::text, true);
    end if;
  end loop;
end $$;

-- A different active Sale sees both brands, closed rows, related history and owner identity.
select pg_temp.as_user('91000000-0000-4000-a000-000000000001');
do $$ declare v_bk uuid := current_setting('walkin.shared.l1')::uuid;
  v_tv uuid := current_setting('walkin.shared.l2')::uuid;
  v_project uuid := current_setting('walkin.shared.project')::uuid;
  v_sql text; v_lead public.leads; v_report jsonb;
begin
  if (select count(*) from public.leads where owner_id = '91000000-0000-4000-a000-000000000002') <> 3
    or not exists(select 1 from public.leads where id = v_bk and brand = 'BAAN_KUNAPAP')
    or not exists(select 1 from public.leads where id = v_tv and brand = 'TARAVILLE') then
    raise exception 'Active Sale must read another owner leads in both brands';
  end if;
  if (select count(*) from public.walkin_leads_staged where owner_id = '91000000-0000-4000-a000-000000000002') <> 3
    or not exists(select 1 from public.walkin_leads_staged where id = v_tv and stage = 'closed') then
    raise exception 'Staged view must preserve shared reads including closed leads';
  end if;
  if (select count(*) from public.lead_privacy_events where lead_id in (v_bk, v_tv, current_setting('walkin.shared.l3')::uuid)) <> 3
    or not exists(select 1 from public.lead_status_events where lead_id = v_tv and kind = 'close')
    or not exists(select 1 from public.projects where id = v_project)
    or not exists(select 1 from public.staff where id = '91000000-0000-4000-a000-000000000002' and full_name = 'Shared read Sale B') then
    raise exception 'Shared lead reads must include evidence, status, project and owner identity';
  end if;
  -- Monthly report row/owner scope remains own-only despite shared operational reads.
  v_report := public.walkin_monthly_report((now() at time zone 'Asia/Bangkok')::date);
  if (v_report->'summary'->>'total')::int < 3
    or jsonb_array_length(v_report->'leads') <> 0
    or jsonb_array_length(v_report->'summary'->'by_owner') <> 0
    or v_report->'owners' <> '[{"id":"91000000-0000-4000-a000-000000000001","name":"Shared read Sale A"}]'::jsonb then
    raise exception 'Shared reads widened the Sale monthly report identity scope';
  end if;
  perform pg_temp.expect_error($q$select public.walkin_monthly_report(
    (now() at time zone 'Asia/Bangkok')::date, null, '91000000-0000-4000-a000-000000000002')$q$,
    '22023', 'invalid_report_filter');

  -- Public RPCs retain their owner/executive gates even when SELECT now succeeds.
  foreach v_sql in array array[
    format($q$select public.walkin_update_lead(%L, 1, '{"first_name":"Forbidden","phone":"0000000000"}', '{}')$q$, v_bk),
    format($q$select public.walkin_record_privacy_event(%L, 1, gen_random_uuid(), 'contact')$q$, v_bk),
    format($q$select public.walkin_record_privacy_event(%L, 1, gen_random_uuid(), 'survey_choice', false)$q$, v_bk),
    format($q$select public.walkin_close_lead(%L, 1, gen_random_uuid(), 'duplicate')$q$, v_bk),
    format($q$select public.walkin_reopen_lead(%L, 2, gen_random_uuid())$q$, v_tv),
    format($q$select public.walkin_open_project(%L, 1, gen_random_uuid())$q$, v_bk),
    format($q$select public.walkin_reassign_lead(%L, 1, '91000000-0000-4000-a000-000000000001')$q$, v_bk),
    format($q$select public.walkin_cancel_project(%L, 1, gen_random_uuid(), 'Forbidden')$q$, v_project)
  ] loop
    perform pg_temp.expect_error(v_sql, '42501', 'access_denied');
  end loop;
  perform pg_temp.expect_error(format($q$update public.leads set first_name = 'Forbidden' where id = %L$q$, v_bk), '42501');
  perform pg_temp.expect_error(format($q$update public.projects set cancel_reason = 'Forbidden' where id = %L$q$, v_project), '42501');
  perform pg_temp.expect_error(format($q$update public.lead_privacy_events set survey_consent = true where lead_id = %L$q$, v_bk), '42501');
  perform pg_temp.expect_error(format($q$update public.lead_status_events set reason = 'other' where lead_id = %L$q$, v_tv), '42501');
  perform pg_temp.expect_error($q$update public.staff set role = 'executive' where id = '91000000-0000-4000-a000-000000000001'$q$, '42501');
  if (select version from public.leads where id = v_bk) <> 1
    or (select count(*) from public.lead_privacy_events where lead_id = v_bk) <> 1 then
    raise exception 'Denied nonowner mutations changed the lead or its evidence';
  end if;

  -- An owner still succeeds through the same public mutation endpoints.
  select * into v_lead from public.walkin_create_lead_with_privacy(gen_random_uuid(), 'BAAN_KUNAPAP',
    '{"first_name":"Own fixture","phone":"0000000000"}', '{}',
    '91000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-30.1', true, true, false);
  select * into v_lead from public.walkin_update_lead(v_lead.id, v_lead.version,
    '{"first_name":"Own updated","phone":"0000000000"}', '{}');
  select * into v_lead from public.walkin_record_privacy_event(v_lead.id, v_lead.version, gen_random_uuid(), 'contact');
  select * into v_lead from public.walkin_close_lead(v_lead.id, v_lead.version, gen_random_uuid(), 'duplicate');
  select * into v_lead from public.walkin_reopen_lead(v_lead.id, v_lead.version, gen_random_uuid());
  perform public.walkin_open_project(v_lead.id, v_lead.version, gen_random_uuid());
  if not exists(select 1 from public.walkin_leads_staged where id = v_lead.id and first_name = 'Own updated' and stage = 'project_opened') then
    raise exception 'Own mutations no longer work';
  end if;
end $$;

-- Executive still edits, reassigns and cancels another owner's records.
select pg_temp.as_user('91000000-0000-4000-a000-000000000003');
do $$ declare v_lead public.leads; v_project public.projects;
begin
  if (select count(*) from public.leads where owner_id in ('91000000-0000-4000-a000-000000000001', '91000000-0000-4000-a000-000000000002')) <> 4 then
    raise exception 'Executive shared reads regressed';
  end if;
  select * into v_lead from public.walkin_update_lead(current_setting('walkin.shared.l1')::uuid, 1,
    '{"first_name":"Executive updated","phone":"0000000000"}', '{}');
  select * into v_lead from public.walkin_reassign_lead(v_lead.id, v_lead.version, '91000000-0000-4000-a000-000000000001');
  select * into v_project from public.walkin_cancel_project(current_setting('walkin.shared.project')::uuid, 1,
    gen_random_uuid(), 'Local check');
  if v_lead.owner_id <> '91000000-0000-4000-a000-000000000001' or v_lead.first_name <> 'Executive updated'
    or v_project.status <> 'cancelled' then raise exception 'Executive mutations regressed'; end if;
end $$;

-- Inactive membership and a JWT without any staff membership cannot read protected rows.
do $$ declare v_user text; v_table text; v_count bigint;
begin
  foreach v_user in array array['91000000-0000-4000-a000-000000000004', '91000000-0000-4000-a000-000000000099'] loop
    perform pg_temp.as_user(v_user);
    foreach v_table in array array['leads', 'walkin_leads_staged', 'lead_privacy_events', 'lead_status_events', 'projects', 'staff'] loop
      execute format('select count(*) from public.%I', v_table) into v_count;
      if v_count <> 0 then raise exception 'Unauthorized membership % read % rows from %', v_user, v_count, v_table; end if;
    end loop;
  end loop;
end $$;

reset role;
set local role anon;
do $$ declare v_table text;
begin
  foreach v_table in array array['leads', 'walkin_leads_staged', 'lead_privacy_events', 'lead_status_events', 'projects', 'staff'] loop
    perform pg_temp.expect_error(format('select * from public.%I', v_table), '42501');
  end loop;
end $$;
rollback;
\echo PASS: shared active-staff reads, related records, owner identity, unchanged mutation boundaries and denied anonymous/inactive/missing staff
-- SQL only; no HTTP, browser, deployed grants or physical-device proof.
