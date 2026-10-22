-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all seven migrations.
-- No remote execution. All fixtures and deliberate privilege fault injection roll back.
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

insert into auth.users(id) values
 ('61000000-0000-4000-a000-000000000001'),
 ('61000000-0000-4000-a000-000000000002'),
 ('61000000-0000-4000-a000-000000000003'),
 ('61000000-0000-4000-a000-000000000004');
insert into public.staff(id, full_name, role, is_active) values
 ('61000000-0000-4000-a000-000000000001', 'Local live Sale A', 'sale', true),
 ('61000000-0000-4000-a000-000000000002', 'Local live Sale B', 'sale', true),
 ('61000000-0000-4000-a000-000000000003', 'Local live Executive', 'executive', true),
 ('61000000-0000-4000-a000-000000000004', 'Local inactive Sale', 'sale', false);

-- Seed a genuine historical-mode row through the retired administrator-only path.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-a000-000000000001', true);
do $$ declare v_lead public.leads; begin
  select * into v_lead from private.walkin_create_lead(
    '62000000-0000-4000-a000-000000000001', 'TARAVILLE',
    '{"first_name":"Local historical fixture","phone":"0000000000"}', '{}',
    '61000000-0000-4000-a000-000000000001');
  if v_lead.privacy_mode <> 'synthetic' then raise exception 'Historical mode changed'; end if;
  perform set_config('walkin.test.synthetic_id', v_lead.id::text, true);
end $$;

set local role authenticated;
do $$
declare v_brand text; v_request uuid; v_lead public.leads; v_replay public.leads;
begin
  foreach v_brand in array array['TARAVILLE', 'BAAN_KUNAPAP'] loop
    v_request := case when v_brand = 'TARAVILLE' then '62000000-0000-4000-a000-000000000002'::uuid
      else '62000000-0000-4000-a000-000000000003'::uuid end;
    select * into v_lead from public.walkin_create_lead_with_privacy(v_request, v_brand,
      '{"first_name":"Local live fixture","phone":"0000000000"}', '{"sales_staff":"Spoofed name"}',
      '61000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-22.1', true, true, false);
    if v_lead.privacy_mode <> 'real' or v_lead.version <> 1 or v_lead.last_contact_at is null
      or v_lead.survey <> '{"sales_staff":"Local live Sale A"}'::jsonb then
      raise exception 'Live creation mode, initial contact or trusted staff failed for %', v_brand;
    end if;
    select * into v_replay from public.walkin_create_lead_with_privacy(v_request, v_brand,
      '{"first_name":"Local live fixture","phone":"0000000000"}', '{"sales_staff":"Another spoof"}',
      '61000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-22.1', true, true, false);
    if v_replay.id <> v_lead.id or v_replay.version <> 1
      or (select count(*) from public.lead_privacy_events where lead_id = v_lead.id) <> 1 then
      raise exception 'Create replay duplicated a lead or evidence';
    end if;
    perform set_config('walkin.test.' || lower(v_brand), v_lead.id::text, true);
  end loop;
end $$;

select pg_temp.expect_error($q$select public.walkin_create_lead_with_privacy(
 '62000000-0000-4000-a000-000000000002','TARAVILLE','{"first_name":"Changed payload","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000001','walkin-live-2026-10-22.1',true,true,false)$q$, '22023', 'request_conflict');
select pg_temp.expect_error($q$select public.walkin_create_lead_with_privacy(
 '62000000-0000-4000-a000-000000000004','TARAVILLE','{"first_name":"Declined","phone":"0000000000"}',
 '{"gender":"หญิง"}','61000000-0000-4000-a000-000000000001','walkin-live-2026-10-22.1',true,true,false)$q$,
 '22023', 'survey_consent_required');
select pg_temp.expect_error($q$select public.walkin_create_lead_with_privacy(
 '62000000-0000-4000-a000-000000000005','TARAVILLE','{"first_name":"Wrong notice","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000001','walkin-synthetic-2026-10-21.1',true,true,false)$q$,
 '22023', 'invalid_privacy_choice');
select pg_temp.expect_error($q$select public.walkin_create_lead_with_privacy(
 '62000000-0000-4000-a000-000000000006','TARAVILLE','{"first_name":"Other owner","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000002','walkin-live-2026-10-22.1',true,true,false)$q$, '42501', 'access_denied');
select pg_temp.expect_error($q$select public.walkin_create_lead(
 '62000000-0000-4000-a000-000000000007','TARAVILLE','{"first_name":"Legacy bypass","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000001')$q$, '42501');
select pg_temp.expect_error($q$select private.walkin_create_lead(
 '62000000-0000-4000-a000-000000000007','TARAVILLE','{"first_name":"Legacy bypass","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000001')$q$, '42501');

do $$ declare v_lead public.leads; v_id uuid := current_setting('walkin.test.taraville')::uuid; begin
  select * into v_lead from public.walkin_record_privacy_event(v_id, 1,
    '63000000-0000-4000-a000-000000000001', 'survey_choice', true, 'walkin-live-2026-10-22.1', true);
  select * into v_lead from public.walkin_update_lead(v_id, v_lead.version,
    '{"first_name":"Local edited fixture","phone":"0000000000"}', '{"gender":"หญิง"}');
  select * into v_lead from public.walkin_record_privacy_event(v_id, v_lead.version,
    '63000000-0000-4000-a000-000000000002', 'survey_choice', false);
  if v_lead.version <> 4 or (v_lead.survey - 'sales_staff') <> '{}'::jsonb then
    raise exception 'Withdrawal did not clear survey and advance version';
  end if;
  select * into v_lead from public.walkin_record_privacy_event(v_id, 1,
    '63000000-0000-4000-a000-000000000002', 'survey_choice', false);
  if v_lead.version <> 4 or (select count(*) from public.lead_privacy_events where lead_id = v_id) <> 3 then
    raise exception 'Privacy replay duplicated evidence or changed version';
  end if;
end $$;
select pg_temp.expect_error($q$select public.walkin_record_privacy_event(
 current_setting('walkin.test.taraville')::uuid,1,'63000000-0000-4000-a000-000000000003','contact')$q$, 'PT409', 'stale_lead');
select pg_temp.expect_error($q$select public.walkin_update_lead(
 current_setting('walkin.test.taraville')::uuid,1,'{"first_name":"Stale","phone":"0000000000"}','{}')$q$, 'PT409', 'stale_lead');
select pg_temp.expect_error($q$select public.walkin_record_privacy_event(
 current_setting('walkin.test.taraville')::uuid,4,'63000000-0000-4000-a000-000000000002','contact')$q$, '22023', 'request_conflict');
select pg_temp.expect_error($q$select public.walkin_update_lead(
 current_setting('walkin.test.taraville')::uuid,4,'{"first_name":"Declined edit","phone":"0000000000"}',
 '{"gender":"หญิง"}')$q$, '22023', 'survey_consent_required');

-- Historical operations must reject the live notice, retain mode, and write old snapshots.
select pg_temp.expect_error($q$select public.walkin_record_privacy_event(
 current_setting('walkin.test.synthetic_id')::uuid,1,'63000000-0000-4000-a000-000000000004',
 'survey_choice',true,'walkin-live-2026-10-22.1',true)$q$, '22023', 'invalid_privacy_choice');
select public.walkin_record_privacy_event(current_setting('walkin.test.synthetic_id')::uuid,1,
 '63000000-0000-4000-a000-000000000004','survey_choice',true,'walkin-synthetic-2026-10-21.1',true);
select public.walkin_record_privacy_event(current_setting('walkin.test.synthetic_id')::uuid,2,
 '63000000-0000-4000-a000-000000000005','contact');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-a000-000000000002', true);
do $$ begin
  if exists (select 1 from public.leads where id = current_setting('walkin.test.taraville')::uuid)
    or exists (select 1 from public.lead_privacy_events where lead_id = current_setting('walkin.test.taraville')::uuid) then
    raise exception 'Sale B can read Sale A lead or evidence';
  end if;
end $$;
select pg_temp.expect_error($q$select public.walkin_record_privacy_event(
 current_setting('walkin.test.taraville')::uuid,4,'63000000-0000-4000-a000-000000000006','contact')$q$, '42501', 'access_denied');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-a000-000000000004', true);
select pg_temp.expect_error($q$select public.walkin_create_lead_with_privacy(
 '62000000-0000-4000-a000-000000000008','TARAVILLE','{"first_name":"Inactive","phone":"0000000000"}',
 '{}','61000000-0000-4000-a000-000000000004','walkin-live-2026-10-22.1',true,true,false)$q$, '42501', 'access_denied');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.walkin_record_privacy_event(
 current_setting('walkin.test.taraville')::uuid,4,'63000000-0000-4000-a000-000000000007','contact')$q$, '42501', 'access_denied');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-a000-000000000003', true);
do $$ begin
  if (select count(*) from public.leads where created_by = '61000000-0000-4000-a000-000000000001') <> 3 then
    raise exception 'Executive cannot read both brands and historical row, or rejected create leaked a row';
  end if;
end $$;
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,4,'LOCAL-CASE-001')$q$, '42501');
select set_config('walkin.approved_removal', current_setting('walkin.test.taraville'), true);
select pg_temp.expect_error($q$delete from public.lead_privacy_events
 where lead_id=current_setting('walkin.test.taraville')::uuid$q$, '42501');
reset role;

do $$ declare v_event record; v_expected jsonb; begin
  for v_event in select e.*, l.brand, l.privacy_mode from public.lead_privacy_events e
    join public.leads l on l.id=e.lead_id where l.created_by='61000000-0000-4000-a000-000000000001' loop
    v_expected := case when v_event.privacy_mode='synthetic' then private.walkin_synthetic_privacy_notice(v_event.brand)
      else private.walkin_privacy_notice(v_event.brand) end;
    if v_event.notice_snapshot <> v_expected or v_event.notice_version <> v_expected->>'version'
      or v_event.notice_hash <> encode(sha256(convert_to(v_expected::text,'UTF8')),'hex')
      or v_event.notice_snapshot->>'mode' <> v_event.privacy_mode
      or v_event.notice_snapshot->>'brand' <> v_event.brand then
      raise exception 'Wrong complete notice snapshot/version/hash/mode/brand';
    end if;
  end loop;
  if (select count(*) from public.lead_privacy_events where lead_id=current_setting('walkin.test.synthetic_id')::uuid) <> 2
    or (select privacy_mode from public.leads where id=current_setting('walkin.test.synthetic_id')::uuid) <> 'synthetic' then
    raise exception 'Historical operations relabelled mode or added initial evidence';
  end if;
  if has_function_privilege('authenticated','private.walkin_remove_lead(uuid,bigint,text)','EXECUTE')
    or has_function_privilege('anon','private.walkin_remove_lead(uuid,bigint,text)','EXECUTE') then
    raise exception 'Removal exposed to application roles';
  end if;
end $$;

-- Fault injection only: even accidental direct DELETE grants + permissive RLS must not
-- allow an application role to spoof the approved-removal flag and erase evidence.
grant delete, update on public.lead_privacy_events to authenticated;
grant execute on function private.walkin_remove_lead(uuid,bigint,text) to authenticated;
create policy live_check_delete on public.lead_privacy_events for delete to authenticated using (true);
create policy live_check_update on public.lead_privacy_events for update to authenticated using (true) with check (true);
set local role authenticated;
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,4,'LOCAL-CASE-001')$q$, '42501', 'access_denied');
select pg_temp.expect_error($q$delete from public.lead_privacy_events
 where lead_id=current_setting('walkin.test.taraville')::uuid$q$, '42501', 'immutable_privacy_event');
select pg_temp.expect_error($q$update public.lead_privacy_events set notice_hash=repeat('0',64)
 where lead_id=current_setting('walkin.test.taraville')::uuid$q$, '42501', 'immutable_privacy_event');
reset role;
select pg_temp.expect_error($q$update public.lead_privacy_events set notice_hash=repeat('0',64)
 where lead_id=current_setting('walkin.test.taraville')::uuid$q$, '42501', 'immutable_privacy_event');
select set_config('walkin.approved_removal','',true);
select pg_temp.expect_error($q$delete from public.lead_privacy_events
 where lead_id=current_setting('walkin.test.taraville')::uuid$q$, '42501', 'immutable_privacy_event');
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,4,null)$q$, '22023', 'approved_case_required');
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,4,'  ')$q$, '22023', 'approved_case_required');
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,4,repeat('x',201))$q$, '22023', 'approved_case_required');
select pg_temp.expect_error($q$select private.walkin_remove_lead(
 current_setting('walkin.test.taraville')::uuid,1,'LOCAL-CASE-001')$q$, 'PT409', 'stale_lead');
do $$ begin
  if not exists(select 1 from public.leads where id=current_setting('walkin.test.taraville')::uuid and version=4)
    or (select count(*) from public.lead_privacy_events where lead_id=current_setting('walkin.test.taraville')::uuid) <> 3 then
    raise exception 'Rejected removal changed lead or evidence';
  end if;
end $$;
select private.walkin_remove_lead(current_setting('walkin.test.taraville')::uuid,4,'LOCAL-CASE-001');
do $$ begin
  if exists(select 1 from public.leads where id=current_setting('walkin.test.taraville')::uuid)
    or exists(select 1 from public.lead_privacy_events where lead_id=current_setting('walkin.test.taraville')::uuid) then
    raise exception 'Approved scoped removal left target lead or evidence';
  end if;
  if not exists(select 1 from public.leads where id=current_setting('walkin.test.baan_kunapap')::uuid)
    or (select count(*) from public.lead_privacy_events where lead_id=current_setting('walkin.test.baan_kunapap')::uuid) <> 1
    or not exists(select 1 from public.leads where id=current_setting('walkin.test.synthetic_id')::uuid)
    or (select count(*) from public.lead_privacy_events where lead_id=current_setting('walkin.test.synthetic_id')::uuid) <> 2 then
    raise exception 'Scoped removal changed another lead or its evidence';
  end if;
  if current_setting('walkin.approved_removal',true) <> '' then raise exception 'Removal flag not cleared'; end if;
end $$;
rollback;
\echo PASS: live intake, replay/conflict, ownership, historical notice, immutability and scoped administrator removal
-- SQL only: no HTTP/Auth-server/browser, concurrency, deployed configuration or backup restore proof.
