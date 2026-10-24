-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all ten migrations.
-- No remote execution. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run in the disposable local database as postgres'; end if;
end $$;

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true)
$$;

insert into auth.users(id) values
 ('84000000-0000-4000-a000-000000000001'),
 ('84000000-0000-4000-a000-000000000002');
insert into public.staff(id, full_name, role, is_active) values
 ('84000000-0000-4000-a000-000000000001', 'Local retention Sale', 'sale', true),
 ('84000000-0000-4000-a000-000000000002', 'Local retention Executive', 'executive', true);

set local role authenticated;
select pg_temp.as_user('84000000-0000-4000-a000-000000000001');
do $$
declare v_lead public.leads; v_n int;
begin
  -- 1 BK with an active Project, 2 Taraville closed bought_with_us, 3 BK plain, 4 Taraville closed not_interested
  for v_n in 1..4 loop
    select * into v_lead from public.walkin_create_lead_with_privacy(
      ('85000000-0000-4000-a000-00000000000' || v_n)::uuid,
      case when v_n in (2, 4) then 'TARAVILLE' else 'BAAN_KUNAPAP' end,
      '{"first_name":"Local retention fixture","phone":"0000000000"}', '{}',
      '84000000-0000-4000-a000-000000000001', 'walkin-live-2026-10-22.1', true, true, false);
    perform set_config('walkin.test.l' || v_n, v_lead.id::text, true);
  end loop;
  perform public.walkin_open_project(current_setting('walkin.test.l1')::uuid, 1, '86000000-0000-4000-a000-000000000001');
  perform public.walkin_close_lead(current_setting('walkin.test.l2')::uuid, 1, '86000000-0000-4000-a000-000000000002', 'bought_with_us');
  perform public.walkin_close_lead(current_setting('walkin.test.l4')::uuid, 1, '86000000-0000-4000-a000-000000000004', 'not_interested');
end $$;

reset role;
update public.leads set last_contact_at = '2024-01-10 03:00:00+00'
  where id in (select current_setting('walkin.test.l' || n)::uuid from generate_series(1, 4) n);

set local role authenticated;
select pg_temp.as_user('84000000-0000-4000-a000-000000000001');
do $$ begin
  if exists (select 1 from public.walkin_retention_due) then raise exception 'Sale must not see the due-review list'; end if;
end $$;

select pg_temp.as_user('84000000-0000-4000-a000-000000000002');
do $$
declare v_row public.walkin_retention_due;
begin
  if (select count(*) from public.walkin_retention_due) <> 4 then
    raise exception 'All four leads stay in the review, got %', (select count(*) from public.walkin_retention_due);
  end if;
  select * into v_row from public.walkin_retention_due where id = current_setting('walkin.test.l1')::uuid;
  if not v_row.has_active_project or v_row.closed_reason is not null then raise exception 'Lead with an active Project must be labelled'; end if;
  select * into v_row from public.walkin_retention_due where id = current_setting('walkin.test.l2')::uuid;
  if v_row.has_active_project or v_row.closed_reason <> 'bought_with_us' then raise exception 'bought_with_us lead must carry its reason'; end if;
  select * into v_row from public.walkin_retention_due where id = current_setting('walkin.test.l3')::uuid;
  if v_row.has_active_project or v_row.closed_reason is not null then raise exception 'Plain lead must have no label'; end if;
  select * into v_row from public.walkin_retention_due where id = current_setting('walkin.test.l4')::uuid;
  if v_row.has_active_project or v_row.closed_reason <> 'not_interested' then raise exception 'Other close reasons are exposed but get no UI label'; end if;
end $$;
select 'PASS: retention review keeps Project and bought_with_us leads, exposes labels, Executive only' as result;
rollback;
-- SQL checks do not prove production grant/configuration state.
