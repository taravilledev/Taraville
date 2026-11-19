-- Run after the new migration in the same Docker-local transaction, ending with ROLLBACK.
do $$
declare v_actor uuid; v_case private.sales_cases; v_legacy_case private.sales_cases; v_legacy private.sales_documents; v_draft private.sales_documents;
  v_work private.sales_instalments; v_old private.sales_instalments; v_deposit private.sales_instalments;
  v_paper jsonb; v_path text; v_result jsonb; v_request uuid; v_invoice private.sales_documents; v_rows jsonb;
  v_quote private.sales_documents; v_input jsonb;
  v_day date := date '2024-02-29'; v_before jsonb;
begin
  select id into strict v_actor from auth.users where email='admin@staff.taraville.invalid';
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  select c.* into strict v_legacy_case from private.sales_cases c join private.sales_documents d on d.case_id=c.id
    where c.id='bacb7ca1-b5a7-4d0d-94a9-e5cfe8be267f' and d.kind='contract' and d.state='signed' and d.payload->>'is_synthetic'='true';
  select * into strict v_legacy from private.sales_documents where case_id=v_legacy_case.id and kind='contract' and state='signed';
  select c.* into strict v_case from private.sales_cases c join public.leads l on l.id=c.lead_id
    where c.brand='BAAN_KUNAPAP' and c.status='draft' and l.privacy_mode='synthetic'
      and c.id<>'64e4cd23-5019-447c-8614-b11fb8e755b2'
      and not exists(select 1 from private.sales_documents d where d.case_id=c.id and d.kind='contract' and d.state<>'cancelled')
    order by c.created_at limit 1;
  v_before := to_jsonb(v_legacy);
  assert not coalesce(v_legacy.payload->'contract_paper' ? 'payment_due_days',false);
  v_paper := '{"schema_version":1,"signing_place":"Synthetic","signing_date":"2026-11-01","employer_address":"Synthetic","employer_national_id":"","contractor_name":"Synthetic","contractor_address":"Synthetic","contractor_representative":"Synthetic","contractor_national_id":"","witness_1":"","witness_2":"","duration_days":"120","extra_clauses":[],"conditions":"","notes":""}';
  perform private.sales_validate_contract_paper(v_paper || '{"payment_due_days":30}');
  begin
    perform private.sales_validate_contract_paper(v_paper || '{"payment_due_days":15}');
    raise exception 'Unexpected custom due days';
  exception when sqlstate '22023' then assert sqlerrm='invalid_contract_paper'; end;
  v_quote := private.sales_new_document(v_case.id,'quotation','accepted','{"total_cents":"100000000","price_set":true}');
  v_input := jsonb_build_object('customer',jsonb_build_object('full_name','Synthetic signer','phone','0000000000','site_address','Synthetic site'),
    'start_date','2026-11-01','schedule','[{"label":"Deposit","basis_points":1000,"progress_percent":null,"work_description":""},{"label":"Work","basis_points":9000,"progress_percent":100,"work_description":"Synthetic work"}]'::jsonb,
    'contract_paper',v_paper);
  v_request := gen_random_uuid();
  v_result := public.sales_save_contract_draft(v_case.id,v_case.version,v_quote.id,v_input,null,null,v_request);
  assert public.sales_save_contract_draft(v_case.id,v_case.version,v_quote.id,v_input,null,null,v_request)=v_result;
  v_case.version := (v_result->>'version')::bigint;
  select * into strict v_draft from private.sales_documents where id=(v_result->>'document_id')::uuid;
  assert v_draft.payload->'contract_paper'->'payment_due_days'='30'::jsonb;
  v_result := public.sales_save_contract_draft(v_case.id,v_case.version,v_quote.id,v_input,v_draft.id,v_draft.version,gen_random_uuid());
  v_case.version := (v_result->>'version')::bigint;
  select * into strict v_draft from private.sales_documents where id=v_draft.id;
  assert v_draft.payload->'contract_paper'->'payment_due_days'='30'::jsonb;
  begin
    update private.sales_documents set payload=payload-'contract_paper' where id=v_draft.id;
    raise exception 'Unexpected removal of new contract paper';
  exception when sqlstate '22023' then assert sqlerrm='invalid_contract_paper'; end;
  update private.sales_documents set payload=jsonb_set(payload,'{contract_paper,extra_clauses}','["Synthetic pending — รอตรวจต้นฉบับ"]'),
    state='draft' where id=v_draft.id;
  update private.sales_documents set payload=jsonb_set(payload,'{is_synthetic}','false') where id=v_draft.id;
  begin
    update private.sales_documents set state='awaiting_signature' where id=v_draft.id;
    raise exception 'Real numbering allowed pending source text';
  exception when sqlstate '22023' then assert sqlerrm='approved_contract_text_required'; end;
  update private.sales_documents set payload=jsonb_set(payload,'{is_synthetic}','true') where id=v_draft.id;
  update private.sales_documents set state='awaiting_signature' where id=v_draft.id;
  update private.sales_documents set state='signed' where id=v_draft.id returning * into v_draft;
  update private.sales_cases set status='contracted' where id=v_case.id;
  insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,needs_acceptance)
    values(v_case.id,v_draft.id,98,'Synthetic work',10000,0,true) returning * into v_work;
  insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,needs_acceptance)
    values(v_case.id,v_draft.id,99,'Synthetic deposit',10000,0,false) returning * into v_deposit;
  insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,needs_acceptance)
    values(v_legacy_case.id,v_legacy.id,97,'Synthetic legacy work',10000,0,true) returning * into v_old;
  v_path := v_case.id::text || '/acceptance/' || gen_random_uuid()::text || '.pdf';
  insert into storage.objects(bucket_id,name) values('sales-evidence',v_path);
  begin
    perform public.sales_record_acceptance(v_work.id,v_case.version,true,true,v_path,'Synthetic checked',gen_random_uuid());
    raise exception 'Old RPC bypassed required actual acceptance date';
  exception when sqlstate '22023' then assert sqlerrm='invalid_acceptance_date'; end;
  begin
    perform public.sales_record_acceptance_dated(v_work.id,v_case.version,true,true,v_path,'Synthetic checked',gen_random_uuid(),(now() at time zone 'Asia/Bangkok')::date+1);
    raise exception 'Future actual acceptance date accepted';
  exception when sqlstate '22023' then assert sqlerrm='invalid_acceptance_date'; end;
  v_request := gen_random_uuid();
  v_result := public.sales_record_acceptance_dated(v_work.id,v_case.version,true,true,v_path,'Synthetic checked',v_request,v_day);
  assert public.sales_record_acceptance_dated(v_work.id,v_case.version,true,true,v_path,'Synthetic checked',v_request,v_day)=v_result;
  select * into strict v_work from private.sales_instalments where id=v_work.id;
  assert v_work.acceptance_date=v_day and v_work.due_date=date '2024-03-30';
  assert v_work.accepted_at::date<>v_work.acceptance_date;
  v_case.version := (v_result->>'version')::bigint;
  begin
    perform public.sales_issue_invoice(v_work.id,v_case.version,v_day+29,gen_random_uuid());
    raise exception 'Arbitrary invoice due date accepted';
  exception when sqlstate '22023' then assert sqlerrm='acceptance_due_date_required'; end;
  v_request := gen_random_uuid();
  v_result := public.sales_issue_invoice(v_work.id,v_case.version,v_day+30,v_request);
  assert public.sales_issue_invoice(v_work.id,v_case.version,v_day+30,v_request)=v_result;
  select * into strict v_invoice from private.sales_documents where id=(v_result->>'document_id')::uuid;
  assert v_invoice.payload->>'due_date'='2024-03-30' and v_invoice.payload->>'acceptance_date'='2024-02-29' and v_invoice.payload->'payment_due_days'='30'::jsonb;
  v_case.version := (v_result->>'version')::bigint;
  v_result := public.sales_issue_invoice(v_deposit.id,v_case.version,date '2026-11-30',gen_random_uuid());
  assert (select due_date=date '2026-11-30' from private.sales_invoices where id=(v_result->>'invoice_id')::uuid);
  v_path := v_legacy_case.id::text || '/acceptance/' || gen_random_uuid()::text || '.pdf';
  insert into storage.objects(bucket_id,name) values('sales-evidence',v_path);
  v_result := public.sales_record_acceptance(v_old.id,v_legacy_case.version,true,true,v_path,'Synthetic legacy checked',gen_random_uuid());
  assert (select acceptance_date is null and due_date is null from private.sales_instalments where id=v_old.id);
  v_legacy_case.version := (v_result->>'version')::bigint;
  v_result := public.sales_issue_invoice(v_old.id,v_legacy_case.version,date '2026-12-15',gen_random_uuid());
  assert (select due_date=date '2026-12-15' from private.sales_invoices where id=(v_result->>'invoice_id')::uuid);
  v_rows := public.sales_agreement_detail(v_case.id)->'instalments';
  assert exists(select 1 from jsonb_array_elements(v_rows) r where r->>'id'=v_work.id::text and r->>'acceptance_date'='2024-02-29' and r->>'due_date'='2024-03-30');
  assert exists(select 1 from jsonb_array_elements(public.sales_acceptance_detail(v_case.id)) r where r->>'id'=v_work.id::text and r->'requires_acceptance_date'='true'::jsonb);
  v_path := v_case.id::text || '/agreement/' || gen_random_uuid()::text || '.pdf';
  insert into storage.objects(bucket_id,name) values('sales-evidence',v_path);
  select jsonb_agg(jsonb_build_object('id',id,'gross_cents',gross_cents::text,'credit_cents',credit_cents::text) order by position,id)
    into v_rows from private.sales_instalments where case_id=v_case.id and is_active;
  select version into v_case.version from private.sales_cases where id=v_case.id;
  v_result := public.sales_amend_contract(v_case.id,v_case.version,v_rows,'Synthetic amount review','Synthetic unchanged work',false,v_path,gen_random_uuid());
  assert (select acceptance_date=v_day and due_date=v_day+30 from private.sales_instalments where id=v_work.id);
  v_result := public.sales_amend_contract(v_case.id,(v_result->>'version')::bigint,v_rows,'Synthetic changed work','Synthetic revised work',true,v_path,gen_random_uuid());
  assert (select acceptance_date is null and due_date is null from private.sales_instalments where id=v_work.id);
  assert (select to_jsonb(d)=v_before from private.sales_documents d where id=v_legacy.id);
  assert not has_function_privilege('anon','public.sales_record_acceptance_dated(uuid,bigint,boolean,boolean,text,text,uuid,date)','execute');
  raise notice 'PASS: new snapshot rule, date required/future guards, leap-month30day due, invoice replay/snapshot, deposit/legacy compatibility, reads and reset';
end $$;
