-- Run after the migration in the same transaction, then ROLLBACK.
do $$
declare
  v_actor uuid;
  v_lead uuid := gen_random_uuid();
  v_case private.sales_cases;
  v_legacy private.sales_cases;
  v_quote private.sales_documents;
  v_contract private.sales_documents;
  v_project jsonb;
  v_result jsonb;
  v_bill uuid;
  v_path text;
  v_payment jsonb := jsonb_build_object('method','cash','paid_date',(now() at time zone 'Asia/Bangkok')::date::text,
    'payer_name','Synthetic payer','description','Synthetic design fee');
  v_due date := (now() at time zone 'Asia/Bangkok')::date+7;
begin
  select id into strict v_actor from auth.users where email='admin@staff.taraville.invalid';
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  select * into strict v_legacy from private.sales_cases where id='64e4cd23-5019-447c-8614-b11fb8e755b2';
  assert not private.sales_can_collect_design(v_legacy);
  begin
    perform public.sales_issue_design_invoice(v_legacy.id,1,v_legacy.version,v_due,gen_random_uuid());
    raise exception 'Legacy signed contract allowed separate invoice';
  exception when sqlstate '22023' then assert sqlerrm='design_payment_unavailable'; end;

  insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
    values(v_lead,'BAAN_KUNAPAP','Synthetic','Separate fees','0000000000',v_actor,v_actor,gen_random_uuid(),repeat('0',64),'synthetic');
  select to_jsonb(project) into strict v_project from public.walkin_open_project(v_lead,1,gen_random_uuid()) project;
  v_result := public.sales_create_case(v_lead,(v_project->>'id')::uuid,null,null,gen_random_uuid());
  select * into strict v_case from private.sales_cases where id=(v_result->>'id')::uuid;
  v_result := public.sales_save_design_plan(v_case.id,v_case.version,'{"usable_area":"100","tier":"under150"}',gen_random_uuid());
  v_result := public.sales_issue_design_invoice(v_case.id,1,(v_result->>'version')::bigint,v_due,gen_random_uuid());
  v_result := public.sales_prepare_design_payment((v_result->>'invoice_id')::uuid,(v_result->>'version')::bigint,v_payment,gen_random_uuid());
  v_result := public.sales_confirm_payment((v_result->>'payment_request_id')::uuid,(v_result->>'version')::bigint,true,gen_random_uuid());
  assert private.sales_design_credit(v_case.id)=350000;

  v_result := public.sales_issue_quotation(v_case.id,(v_result->>'version')::bigint,
    '{"house":{"model":"Synthetic house","stories":"1","bedrooms":"2","kitchens":"1","bathrooms":"1","usable_area":"100"},"total_cents":"200000000","spec_rows":[],"exclusions":[]}'::jsonb,
    gen_random_uuid());
  select * into strict v_quote from private.sales_documents where id=(v_result->>'document_id')::uuid;
  assert v_quote.payload->'design_fee_separate'='true'::jsonb;
  v_path := v_case.id::text || '/agreement/' || gen_random_uuid()::text || '.pdf';
  insert into storage.objects(bucket_id,name) values('sales-evidence',v_path);
  v_result := public.sales_accept_quotation(v_quote.id,(v_result->>'version')::bigint,v_path,gen_random_uuid());
  v_result := public.sales_save_contract_draft(v_case.id,(v_result->>'version')::bigint,v_quote.id,
    '{"customer":{"full_name":"Synthetic signer","phone":"0000000000","site_address":"Synthetic site"},"start_date":"2026-11-16","schedule":[{"label":"Deposit","basis_points":1000,"progress_percent":null,"work_description":""},{"label":"Work","basis_points":9000,"progress_percent":100,"work_description":"Synthetic work"}]}'::jsonb,
    null,null,gen_random_uuid());
  select * into strict v_contract from private.sales_documents where id=(v_result->>'document_id')::uuid;
  assert v_contract.payload->'design_fee_separate'='true'::jsonb and v_contract.payload->>'credit_cents'='0';
  v_result := public.sales_lock_contract(v_contract.id,(v_result->>'version')::bigint,v_contract.version,gen_random_uuid());
  v_result := public.sales_sign_contract(v_contract.id,(v_result->>'version')::bigint,v_path,gen_random_uuid());
  assert (select sum(gross_cents-credit_cents)=200000000 from private.sales_instalments where case_id=v_case.id and is_active);
  assert not exists(select 1 from private.sales_credits where case_id=v_case.id);

  v_result := public.sales_issue_design_invoice(v_case.id,2,(v_result->>'version')::bigint,v_due,gen_random_uuid());
  v_bill := (v_result->>'invoice_id')::uuid;
  v_result := public.sales_cancel_design_invoice(v_bill,(v_result->>'version')::bigint,'Synthetic cancellation',gen_random_uuid());
  v_result := public.sales_issue_design_invoice(v_case.id,2,(v_result->>'version')::bigint,v_due,gen_random_uuid());
  v_bill := (v_result->>'invoice_id')::uuid;
  v_result := public.sales_prepare_design_payment(v_bill,(v_result->>'version')::bigint,v_payment,gen_random_uuid());
  v_result := public.sales_confirm_payment((v_result->>'payment_request_id')::uuid,(v_result->>'version')::bigint,true,gen_random_uuid());
  assert (select kind='receipt' and payload->>'amount_cents'='350000' from private.sales_documents where id=(v_result->>'document_id')::uuid);
  assert (select sum(gross_cents-credit_cents)=200000000 from private.sales_instalments where case_id=v_case.id and is_active);
  assert not exists(select 1 from private.sales_allocations where case_id=v_case.id);
  assert not has_function_privilege('anon','public.sales_issue_design_invoice(uuid,integer,bigint,date,uuid)','execute');
  raise notice 'PASS: legacy block, new quote snapshot, zero construction credit, post-sign issue/cancel/prepare/confirm and isolated balances';
end $$;
