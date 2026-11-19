-- Local only. Run inside a transaction after the report migration, then roll back.
do $$
declare
  v_sale uuid := gen_random_uuid();
  v_exec uuid := gen_random_uuid();
  v_bkp uuid := gen_random_uuid();
  v_tv uuid := gen_random_uuid();
  v_closed uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_development uuid := gen_random_uuid();
  v_unit uuid := gen_random_uuid();
  v_bkp_customer uuid := gen_random_uuid();
  v_tv_customer uuid := gen_random_uuid();
  v_month date := '2001-01-01';
  v_rows jsonb;
begin
  insert into auth.users(id) values (v_sale), (v_exec);
  insert into public.staff(id, full_name, role, is_active)
  values (v_sale, 'Fixture sale', 'sale', true), (v_exec, 'Fixture executive', 'executive', true)
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

  insert into public.leads(id, brand, first_name, last_name, phone, owner_id, created_by, create_request_id, create_payload_hash, privacy_mode, created_at)
  values
    (v_bkp, 'BAAN_KUNAPAP', 'Fixture', 'BKP', '0000000000', v_sale, v_sale, gen_random_uuid(), repeat('0',64), 'synthetic', '2001-01-02T00:00:00Z'),
    (v_tv, 'TARAVILLE', 'Fixture', 'TV', '0000000000', v_exec, v_exec, gen_random_uuid(), repeat('0',64), 'synthetic', '2001-01-02T00:00:00Z'),
    (v_closed, 'BAAN_KUNAPAP', 'Fixture', 'Closed Lead', '0000000000', v_sale, v_sale, gen_random_uuid(), repeat('0',64), 'synthetic', '2001-01-02T00:00:00Z');
  update public.leads set closed_at = now(), closed_by = v_sale, closed_reason = 'not_interested' where id = v_closed;

  insert into public.projects(id, code, brand, lead_id, created_by, create_request_id)
  values (gen_random_uuid(), 'REPORT-OPEN-' || v_bkp, 'BAAN_KUNAPAP', v_bkp, v_sale, gen_random_uuid()),
         (v_project, 'REPORT-COMPLETED-' || v_bkp, 'BAAN_KUNAPAP', v_bkp, v_sale, gen_random_uuid());
  insert into public.projects(code, brand, lead_id, created_by, create_request_id, status, cancelled_at, cancelled_by, cancel_request_id, cancel_reason)
  values ('REPORT-CANCELLED-' || v_bkp, 'BAAN_KUNAPAP', v_bkp, v_sale, gen_random_uuid(), 'cancelled', now(), v_sale, gen_random_uuid(), 'Fixture');

  insert into private.sales_customers(id, brand, full_name, created_by)
  values (v_bkp_customer, 'BAAN_KUNAPAP', 'Fixture BKP', v_sale), (v_tv_customer, 'TARAVILLE', 'Fixture TV', v_exec);
  insert into private.sales_developments(id, name, created_by) values (v_development, 'Fixture development', v_exec);
  insert into private.sales_units(id, development_id, code, created_by) values (v_unit, v_development, 'Fixture plot', v_exec);
  insert into private.sales_cases(code, brand, lead_id, project_id, unit_id, customer_id, responsible_id, status, customer_snapshot, created_by)
  values
    ('REPORT-BKP-' || v_bkp, 'BAAN_KUNAPAP', v_bkp, v_project, null, v_bkp_customer, v_sale, 'completed', '{}', v_sale),
    ('REPORT-TV-OPEN-' || v_tv, 'TARAVILLE', v_tv, null, v_unit, v_tv_customer, v_exec, 'draft', '{}', v_exec),
    ('REPORT-TV-CLOSED-' || v_tv, 'TARAVILLE', v_tv, null, v_unit, v_tv_customer, v_exec, 'cancelled', '{}', v_exec);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_sale::text, true);
  v_rows := public.walkin_monthly_report(v_month, null, null)->'leads';
  assert v_rows @> jsonb_build_array(jsonb_build_object('id', v_bkp, 'project_counts', '{"open":1,"closed":2}'::jsonb));
  assert v_rows @> jsonb_build_array(jsonb_build_object('id', v_closed, 'project_counts', '{"open":0,"closed":0}'::jsonb));
  assert not v_rows @> jsonb_build_array(jsonb_build_object('id', v_tv));

  perform set_config('request.jwt.claim.sub', v_exec::text, true);
  v_rows := public.walkin_monthly_report(v_month, 'TARAVILLE', null)->'leads';
  assert v_rows @> jsonb_build_array(jsonb_build_object('id', v_tv, 'project_counts', '{"open":1,"closed":1}'::jsonb));
  assert not v_rows @> jsonb_build_array(jsonb_build_object('id', v_bkp));
  raise notice 'PASS: monthly project counts, brand and owner scope';
end $$;
