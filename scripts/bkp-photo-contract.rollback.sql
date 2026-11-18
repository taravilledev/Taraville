-- Run after the photo migration in the same uncommitted local test transaction.
do $$
declare v_actor uuid; v_case private.sales_cases; v_draft private.sales_documents; v_signed private.sales_documents;
  v_result jsonb; v_new private.sales_documents; v_input jsonb; v_paper jsonb; v_version bigint;
  v_rows jsonb; v_money jsonb; v_before jsonb; v_after jsonb;
  v_addendum jsonb := '{"date":"2026-11-09","extra_clauses":["Synthetic separate clause"],"conditions":"Synthetic condition","notes":"Synthetic note"}';
begin
  select id into strict v_actor from auth.users where email='admin@staff.taraville.invalid';
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  select * into strict v_case from private.sales_cases where id='c2b7d6fe-44a3-414f-9556-39cd778e192e';
  select * into strict v_draft from private.sales_documents where case_id=v_case.id and kind='contract' and state='draft';
  assert v_draft.payload->'is_synthetic'='true'::jsonb;
  assert (public.sales_contract_template(v_case.id) ? 'contract_text_approved');
  v_paper := '{"schema_version":1,"signing_place":"","signing_date":"2026-11-09","employer_address":"Synthetic employer address","employer_national_id":"","contractor_name":"Synthetic contractor","contractor_address":"Synthetic contractor address","contractor_representative":"Synthetic representative","contractor_national_id":"","witness_1":"","witness_2":"","duration_days":"120","extra_clauses":["Synthetic additional clause"],"conditions":"","notes":""}';
  v_input := jsonb_build_object('customer',v_draft.payload->'customer','start_date','','schedule',v_draft.payload->'schedule_input','contract_paper',v_paper);
  v_result := public.sales_save_contract_draft(v_case.id,v_case.version,v_draft.parent_id,v_input,v_draft.id,v_draft.version,gen_random_uuid());
  select * into strict v_draft from private.sales_documents where id=v_draft.id;
  assert v_draft.payload->'contract_paper'=v_paper and v_draft.payload->>'start_date'='';
  assert v_draft.number is null;
  begin
    perform public.sales_lock_contract(v_draft.id,(v_result->>'version')::bigint,v_draft.version,gen_random_uuid());
    raise exception 'Missing start date unexpectedly accepted';
  exception when sqlstate '22023' then assert sqlerrm='complete_contract_draft_required'; end;
  v_result := public.sales_save_contract_draft(v_case.id,(v_result->>'version')::bigint,v_draft.parent_id,
    v_input || '{"start_date":"2026-11-09"}',v_draft.id,v_draft.version,gen_random_uuid());
  select * into strict v_draft from private.sales_documents where id=v_draft.id;
  begin
    perform public.sales_lock_contract(v_draft.id,(v_result->>'version')::bigint,v_draft.version,gen_random_uuid());
    raise exception 'Missing paper fields unexpectedly accepted';
  exception when sqlstate '22023' then assert sqlerrm='complete_contract_paper_required'; end;
  update private.sales_documents set payload=payload || '{"is_synthetic":false}' where id=v_draft.id;
  begin
    perform public.sales_lock_contract(v_draft.id,(v_result->>'version')::bigint,v_draft.version,gen_random_uuid());
    raise exception 'Unapproved real wording unexpectedly accepted';
  exception when sqlstate '22023' then assert sqlerrm='approved_contract_text_required'; end;
  update private.sales_documents set payload=payload || '{"is_synthetic":true}' where id=v_draft.id;
  v_result := public.sales_save_contract_draft(v_case.id,(v_result->>'version')::bigint,v_draft.parent_id,
    v_input || jsonb_build_object('start_date','2026-11-09','contract_paper',v_paper || '{"signing_place":"Synthetic office"}'),
    v_draft.id,v_draft.version,gen_random_uuid());
  v_result := public.sales_lock_contract(v_draft.id,(v_result->>'version')::bigint,(v_result->>'document_version')::bigint,gen_random_uuid());
  assert v_result->>'number' is not null;

  select * into strict v_case from private.sales_cases where id='7759899b-6171-4f26-b4ea-6b0409906833';
  select * into strict v_signed from private.sales_documents where case_id=v_case.id and kind='contract' and state='signed';
  assert v_signed.payload->'is_synthetic'='true'::jsonb;
  v_version := v_case.version;
  v_before := public.sales_agreement_detail(v_case.id);
  v_money := public.sales_financial_detail(v_case.id);
  v_rows := v_before->'instalments';
  declare v_request uuid := gen_random_uuid(); begin
    v_result := public.sales_add_contract_addendum(v_signed.id,v_version,v_addendum,v_signed.evidence_path,v_request);
    assert public.sales_add_contract_addendum(v_signed.id,v_version,v_addendum,v_signed.evidence_path,v_request)=v_result;
  end;
  select * into strict v_new from private.sales_documents where id=(v_result->>'document_id')::uuid;
  assert v_new.kind='amendment' and v_new.state='signed' and v_new.number is not null and v_new.parent_id=v_signed.id;
  assert v_new.payload->'text_addendum'=v_addendum and v_new.payload->>'contract_number'=v_signed.number;
  assert v_new.issuer_snapshot=v_signed.issuer_snapshot and v_new.customer_snapshot=v_signed.customer_snapshot;
  assert (select to_jsonb(d) from private.sales_documents d where id=v_signed.id)=to_jsonb(v_signed);
  v_after := public.sales_agreement_detail(v_case.id);
  assert v_after->'instalments'=v_rows and v_after->'is_settled'=v_before->'is_settled';
  assert (public.sales_financial_detail(v_case.id) - array['version','documents'])=(v_money - array['version','documents']);
  raise notice 'PASS: draft, lock guards, synthetic lock, linked addendum replay, immutable parent and unchanged finance';
end $$;
