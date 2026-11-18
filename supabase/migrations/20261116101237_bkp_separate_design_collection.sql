begin;

create function private.sales_contract_design_credit(p_case_id uuid,p_payload jsonb) returns bigint
language sql stable set search_path='' as $$
  select case when p_payload->'design_fee_separate'='true'::jsonb then 0 else private.sales_design_credit(p_case_id) end
$$;

create function private.sales_can_collect_design(p_case private.sales_cases) returns boolean
language sql stable set search_path='' as $$
  select coalesce(p_case.brand='BAAN_KUNAPAP' and p_case.status in ('draft','reserved','contracted','completed')
    and not exists(select 1 from private.sales_documents d where d.case_id=p_case.id
      and d.kind='contract' and d.state='signed' and d.payload->'design_fee_separate' is distinct from 'true'::jsonb)
    and (p_case.status in ('draft','reserved') or exists(select 1 from private.sales_documents d where d.case_id=p_case.id
      and d.kind='contract' and d.state='signed' and d.payload->'design_fee_separate'='true'::jsonb)),false)
$$;

revoke all on function private.sales_contract_design_credit(uuid,jsonb),
  private.sales_can_collect_design(private.sales_cases) from public,anon,authenticated;

create or replace function private.sales_issue_quotation(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_result jsonb; v_house jsonb := p_input->'house';
  v_paper jsonb; v_date date; v_total bigint; v_price_set boolean; v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('quotation.issue',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved')
    or exists(select 1 from private.sales_documents where case_id=p_case_id and kind='contract' and state in ('awaiting_signature','signed')) then
    raise exception using errcode='22023',message='quotation_unavailable'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>120000
    or not p_input ?& array['house','total_cents','spec_rows','exclusions']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('house','total_cents','spec_rows','exclusions','description','paper'))
    or jsonb_typeof(v_house) is distinct from 'object'
    or jsonb_typeof(p_input->'spec_rows') is distinct from 'array'
    or jsonb_typeof(p_input->'exclusions') is distinct from 'array' then
    raise exception using errcode='22023',message='invalid_quotation'; end if;
  if not v_house ?& array['model','stories','bedrooms','kitchens','bathrooms','usable_area']
    or exists(select 1 from jsonb_each(v_house) f where f.key not in ('model','stories','bedrooms','kitchens','bathrooms','usable_area') or jsonb_typeof(f.value)<>'string')
    or length(btrim(coalesce(v_house->>'model',''))) not between 1 and 200
    or coalesce(v_house->>'stories','') !~ '^[1-9][0-9]{0,2}$'
    or coalesce(v_house->>'bedrooms','') !~ '^[0-9]{1,3}$'
    or coalesce(v_house->>'kitchens','') !~ '^[0-9]{1,3}$'
    or coalesce(v_house->>'bathrooms','') !~ '^[0-9]{1,3}$'
    or coalesce(v_house->>'usable_area','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' then
    raise exception using errcode='22023',message='invalid_quotation_house'; end if;
  if (v_house->>'usable_area')::numeric<=0 then raise exception using errcode='22023',message='invalid_quotation_house'; end if;
  if jsonb_array_length(p_input->'spec_rows')>50 or jsonb_array_length(p_input->'exclusions')>50
    or exists(select 1 from jsonb_array_elements(p_input->'spec_rows') r where jsonb_typeof(r) is distinct from 'object'
      or not r ?& array['item','detail','note'] or exists(select 1 from jsonb_each(r) f where f.key not in ('item','detail','note') or jsonb_typeof(f.value)<>'string')
      or length(btrim(coalesce(r->>'item',''))) not between 1 and 200 or length(coalesce(r->>'detail',''))>3000 or length(coalesce(r->>'note',''))>1000)
    or exists(select 1 from jsonb_array_elements(p_input->'exclusions') x where jsonb_typeof(x)<>'string' or length(btrim(x #>> '{}')) not between 1 and 2000)
    or (p_input ? 'description' and (jsonb_typeof(p_input->'description') is distinct from 'string' or length(p_input->>'description')>10000)) then
    raise exception using errcode='22023',message='invalid_quotation_scope'; end if;
  if p_input ? 'paper' then
    v_paper := p_input->'paper';
    if jsonb_typeof(v_paper) is distinct from 'object' then
      raise exception using errcode='22023',message='invalid_quotation_paper'; end if;
    if not v_paper ?& array['schema_version','customer_name','customer_phone','customer_address','site_address',
      'salesperson','manager','work_type','document_date','footnote']
      or exists(select 1 from jsonb_each(v_paper) f where
        f.key not in ('schema_version','customer_name','customer_phone','customer_address','site_address',
          'salesperson','manager','work_type','document_date','footnote')
        or (f.key<>'schema_version' and jsonb_typeof(f.value) is distinct from 'string'))
      or v_paper->'schema_version' is distinct from '1'::jsonb then
      raise exception using errcode='22023',message='invalid_quotation_paper'; end if;
    select jsonb_object_agg(f.key,case when f.key='schema_version' then f.value
      else to_jsonb(btrim(f.value #>> '{}',E' \t\n\r')) end) into v_paper from jsonb_each(v_paper) f;
    if length(v_paper->>'customer_name') not between 1 and 200
      or length(v_paper->>'customer_phone')>80 or length(v_paper->>'customer_address')>2000
      or length(v_paper->>'site_address')>2000 or length(v_paper->>'salesperson')>200
      or length(v_paper->>'manager')>200 or length(v_paper->>'footnote')>3000
      or v_paper->>'work_type' not in ('','รับสร้างบ้าน','ต่อเติม','ปรับปรุง','อื่นๆ')
      or v_paper->>'document_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode='22023',message='invalid_quotation_paper'; end if;
    begin
      v_date := (v_paper->>'document_date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode='22023',message='invalid_quotation_paper';
    end;
  end if;
  v_price_set := p_input->'total_cents'<>'null'::jsonb;
  if v_price_set then
    if jsonb_typeof(p_input->'total_cents') is distinct from 'string' then raise exception using errcode='22023',message='invalid_money'; end if;
    v_total := private.sales_money(p_input->>'total_cents');
    if v_total is null or v_total<=0 then raise exception using errcode='22023',message='positive_quotation_price_required'; end if;
  end if;
  v_doc := private.sales_new_document(p_case_id,'quotation','offered',jsonb_build_object(
    'description',coalesce(nullif(btrim(p_input->>'description'),''),v_house->>'model'),'house',v_house,
    'details',v_house,'spec_rows',p_input->'spec_rows','exclusions',p_input->'exclusions',
    'price_set',v_price_set,'design_fee_separate',true,'total_cents',coalesce(v_total,0)::text)
    || case when v_paper is null then '{}'::jsonb else jsonb_build_object('paper',v_paper) end,
    p_document_date => v_date);
  v_result := private.sales_touch_case(p_case_id,'quotation.issue',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('quotation.issue',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_save_contract_draft(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_input jsonb,
  p_document_id uuid,p_document_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_quote private.sales_documents; v_doc private.sales_documents; v_issuer private.sales_issuers;
  v_result jsonb; v_total bigint; v_credit bigint; v_rows jsonb; v_customer jsonb; v_data jsonb; v_terms text; v_paper jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'quotation',p_quotation_id,'input',p_input,
    'document',p_document_id,'document_version',p_document_version);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('contract.draft.save',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='contract_unavailable'; end if;
  if p_document_id is null then
    if p_document_version is not null or exists(select 1 from private.sales_documents where case_id=p_case_id and kind='contract'
      and state in ('draft','awaiting_signature','signed')) then raise exception using errcode='22023',message='live_contract_exists'; end if;
  else
    select * into v_doc from private.sales_documents where id=p_document_id and case_id=p_case_id and kind='contract' for update;
    if not found or v_doc.state<>'draft' then raise exception using errcode='22023',message='contract_not_draft'; end if;
    if v_doc.version is distinct from p_document_version then raise exception using errcode='PT409',message='stale_document'; end if;
  end if;
  select * into v_quote from private.sales_documents where id=p_quotation_id and case_id=p_case_id and kind='quotation' and state='accepted';
  if not found or coalesce(private.sales_money(v_quote.payload->>'total_cents'),0)<=0 or v_quote.payload->'price_set'='false'::jsonb then
    raise exception using errcode='22023',message='accepted_quotation_required'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>780000
    or not p_input ?& array['start_date','schedule']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('customer','start_date','schedule','additional_terms','contract_paper'))
    or jsonb_typeof(p_input->'start_date') is distinct from 'string'
    or (p_input->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and not (p_input->>'start_date'='' and (p_input ? 'contract_paper' or v_doc.payload ? 'contract_paper'))) then
    raise exception using errcode='22023',message='invalid_contract_draft'; end if;
  perform nullif(p_input->>'start_date','')::date;
  if p_input ? 'additional_terms' and (jsonb_typeof(p_input->'additional_terms') is distinct from 'string'
    or length(p_input->>'additional_terms')>10000) then
    raise exception using errcode='22023',message='invalid_contract_additional_terms'; end if;
  v_terms := case when p_input ? 'additional_terms' then btrim(p_input->>'additional_terms',E' \t\n\r')
    else coalesce(v_doc.payload->>'additional_terms','') end;
  v_customer := case when p_input ? 'customer' then p_input->'customer'
    when v_doc.payload ? 'customer' then v_doc.payload->'customer'
    else jsonb_build_object('full_name',coalesce(nullif(v_quote.payload->'paper'->>'customer_name',''),v_case.customer_snapshot->>'full_name',''),
      'phone',coalesce(nullif(v_quote.payload->'paper'->>'customer_phone',''),v_case.customer_snapshot->>'phone',''),
      'site_address',coalesce(nullif(v_quote.payload->'paper'->>'site_address',''),v_case.details->>'site_address','')) end;
  if jsonb_typeof(v_customer) is distinct from 'object' then raise exception using errcode='22023',message='invalid_contract_customer'; end if;
  if not v_customer ?& array['full_name','phone','site_address']
    or exists(select 1 from jsonb_each(v_customer) f where f.key not in ('full_name','phone','site_address') or jsonb_typeof(f.value)<>'string')
    or length(btrim(coalesce(v_customer->>'full_name',''))) not between 1 and 200
    or length(btrim(coalesce(v_customer->>'phone',''))) not between 1 and 80
    or length(btrim(coalesce(v_customer->>'site_address',''))) not between 1 and 2000 then
    raise exception using errcode='22023',message='invalid_contract_customer'; end if;
  select * into v_issuer from private.sales_issuers where brand=v_case.brand for share;
  if not found then raise exception using errcode='22023',message='issuer_configuration_required'; end if;
  v_paper := case when p_input ? 'contract_paper' then p_input->'contract_paper' else v_doc.payload->'contract_paper' end;
  if (p_input ? 'contract_paper' or v_paper is not null) then
    perform private.sales_validate_contract_paper(v_paper);
  end if;
  v_total := private.sales_money(v_quote.payload->>'total_cents'); v_credit := private.sales_contract_design_credit(p_case_id,v_quote.payload);
  v_rows := private.sales_contract_schedule(v_total,v_credit,p_input->'schedule');
  v_data := jsonb_strip_nulls(jsonb_build_object('quotation_id',v_quote.id,'quotation_number',v_quote.number,'description',v_quote.payload->>'description',
    'details',v_quote.payload->'details','house',v_quote.payload->'house','spec_rows',v_quote.payload->'spec_rows',
    'exclusions',v_quote.payload->'exclusions','contract_text',case when v_paper is not null then v_issuer.contract_text else coalesce(nullif(v_doc.payload->>'contract_text',''),v_issuer.contract_text) end,'total_cents',v_total::text,
    'credit_cents',v_credit::text,'design_fee_separate',v_quote.payload->'design_fee_separate','additional_terms',v_terms,'contract_paper',v_paper,
    'contract_text_approved',case when v_paper is not null then v_issuer.contract_text_approved else null end,'customer',v_customer,'start_date',p_input->>'start_date','schedule_input',p_input->'schedule','schedule',v_rows));
  if p_document_id is null then
    v_doc := private.sales_new_document(p_case_id,'contract','draft',v_data,v_quote.id);
  else
    update private.sales_documents set payload=v_data || jsonb_build_object('is_synthetic',v_doc.payload->'is_synthetic')
        || case when v_doc.payload ? 'replaces_document_id' then jsonb_build_object('replaces_document_id',v_doc.payload->'replaces_document_id') else '{}'::jsonb end,
      parent_id=v_quote.id,version=version+1 where id=p_document_id returning * into v_doc;
  end if;
  update private.sales_documents set customer_snapshot=coalesce(v_doc.customer_snapshot,v_case.customer_snapshot) || jsonb_build_object(
    'full_name',v_customer->>'full_name','phone',v_customer->>'phone',
    'address',coalesce(v_paper->>'employer_address',case when p_document_id is not null then v_doc.customer_snapshot->>'address' end,
      v_quote.payload->'paper'->>'customer_address',v_case.customer_snapshot->>'address','')) where id=v_doc.id;
  update private.sales_cases set list_price_cents=v_total,promotion_price_cents=null,discount_cents=0 where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'contract.draft.save',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id,'document_version',v_doc.version);
  return private.sales_remember('contract.draft.save',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_lock_contract(p_document_id uuid,p_version bigint,p_document_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_quote private.sales_documents; v_result jsonb;
  v_rows jsonb; v_total bigint; v_credit bigint;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'document_version',p_document_version);
  v_issuer private.sales_issuers; v_paper jsonb;
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'financial.prepare');
  v_result := private.sales_replay('contract.lock',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') or v_doc.kind<>'contract' or v_doc.state<>'draft' then
    raise exception using errcode='22023',message='contract_not_draft'; end if;
  if v_doc.version is distinct from p_document_version then raise exception using errcode='PT409',message='stale_document'; end if;
  select * into v_quote from private.sales_documents where id=v_doc.parent_id and case_id=v_case.id and kind='quotation' and state='accepted';
  if not found or coalesce(private.sales_money(v_quote.payload->>'total_cents'),0)<=0 then
    raise exception using errcode='22023',message='accepted_quotation_required'; end if;
  v_total := private.sales_money(v_quote.payload->>'total_cents');
  if v_case.net_price_cents is distinct from v_total or v_doc.payload->>'total_cents' is distinct from v_total::text
    or v_doc.payload->>'quotation_id' is distinct from v_quote.id::text
    or v_doc.payload->'design_fee_separate' is distinct from v_quote.payload->'design_fee_separate' then
    raise exception using errcode='PT409',message='contract_quotation_changed'; end if;
  if length(btrim(coalesce(v_doc.payload->>'contract_text','')))=0 then
    raise exception using errcode='22023',message='approved_contract_text_required'; end if;
  if length(btrim(coalesce(v_doc.payload->'customer'->>'full_name','')))=0
    or length(btrim(coalesce(v_doc.payload->'customer'->>'phone','')))=0
    or length(btrim(coalesce(v_doc.payload->'customer'->>'site_address','')))=0
    or coalesce(v_doc.payload->>'start_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='22023',message='complete_contract_draft_required'; end if;
  select * into v_issuer from private.sales_issuers where brand=v_case.brand for share;
  v_paper := v_doc.payload->'contract_paper';
  if not coalesce((v_doc.payload->>'is_synthetic')::boolean,false)
    or not exists(select 1 from public.leads where id=v_case.lead_id and privacy_mode='synthetic') then
    if not coalesce(v_issuer.contract_text_approved,false)
      or v_doc.payload->>'contract_text' is distinct from v_issuer.contract_text then
      raise exception using errcode='22023',message='approved_contract_text_required'; end if;
    if v_paper is null then raise exception using errcode='22023',message='complete_contract_paper_required'; end if;
  end if;
  if v_paper is not null and exists(select 1 from unnest(array[
    'signing_place','signing_date','employer_address','contractor_name','contractor_address','contractor_representative','duration_days'
  ]) k where length(btrim(coalesce(v_paper->>k,'')))=0) then
    raise exception using errcode='22023',message='complete_contract_paper_required'; end if;
  v_credit := private.sales_contract_design_credit(v_case.id,v_doc.payload);
  v_rows := private.sales_contract_schedule(v_total,v_credit,v_doc.payload->'schedule_input');
  update private.sales_documents set payload=payload || jsonb_build_object('credit_cents',v_credit::text,'schedule',v_rows)
    || case when v_paper is not null then jsonb_build_object('contract_text_approved',
      v_issuer.contract_text_approved and v_doc.payload->>'contract_text'=v_issuer.contract_text) else '{}'::jsonb end,
    number=private.sales_number(v_case.brand,'C'),state='awaiting_signature',finalized_by=auth.uid(),finalized_at=now(),version=version+1
    where id=p_document_id returning * into v_doc;
  v_result := private.sales_touch_case(v_case.id,'contract.lock',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id,'document_version',v_doc.version,'number',v_doc.number);
  return private.sales_remember('contract.lock',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_sign_contract(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_doc private.sales_documents; v_case private.sales_cases; v_result jsonb; v_row jsonb; v_inst private.sales_instalments;
  v_payment record; v_available bigint; v_needed bigint; v_applied bigint;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'evidence',p_evidence_path);
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'contract.sign');
  v_result := private.sales_replay('contract.sign',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_doc.kind<>'contract' or v_doc.state<>'awaiting_signature' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='contract_not_awaiting_signature'; end if;
  if not exists(select 1 from private.sales_documents q where q.id=v_doc.parent_id and q.case_id=v_case.id
    and q.kind='quotation' and q.state='accepted'
    and coalesce(private.sales_money(q.payload->>'total_cents'),0)>0
    and q.payload->>'total_cents'=v_doc.payload->>'total_cents'
    and q.payload->'design_fee_separate' is not distinct from v_doc.payload->'design_fee_separate'
    and (q.payload->>'total_cents')::bigint=v_case.net_price_cents) then
    raise exception using errcode='PT409',message='contract_quotation_changed'; end if;
  if v_doc.payload ? 'schedule_input' and private.sales_contract_schedule(
    (v_doc.payload->>'total_cents')::bigint,(v_doc.payload->>'credit_cents')::bigint,v_doc.payload->'schedule_input')
    is distinct from v_doc.payload->'schedule' then
    raise exception using errcode='PT409',message='contract_schedule_changed'; end if;
  if private.sales_contract_design_credit(v_case.id,v_doc.payload) is distinct from (v_doc.payload->>'credit_cents')::bigint then
    raise exception using errcode='PT409',message='credit_changed_prepare_new_contract'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'agreement');
  update private.sales_documents set state='signed',evidence_path=p_evidence_path,finalized_by=auth.uid(),finalized_at=now(),version=version+1 where id=v_doc.id;
  for v_row in select value from jsonb_array_elements(v_doc.payload->'schedule') loop
    insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,progress_percent,needs_acceptance)
    values(v_case.id,v_doc.id,(v_row->>'position')::integer,v_row->>'label',(v_row->>'gross_cents')::bigint,
      (v_row->>'credit_cents')::bigint,(v_row->>'progress_percent')::integer,(v_row->>'needs_acceptance')::boolean) returning * into v_inst;
    v_needed := v_inst.credit_cents;
    for v_payment in select coalesce(root_id,id) root_id from private.sales_payments
      where case_id=v_case.id and kind='design_fee' and voided_at is null order by confirmed_at,id loop
      exit when v_needed=0;
      v_available := (private.sales_payment_totals(v_payment.root_id)->>'free_cents')::bigint;
      v_applied := least(v_needed,v_available);
      if v_applied>0 then
        insert into private.sales_credits(case_id,root_payment_id,instalment_id,agreement_id,amount_cents,created_by)
          values(v_case.id,v_payment.root_id,v_inst.id,v_doc.id,v_applied,auth.uid());
        v_needed := v_needed-v_applied;
      end if;
    end loop;
    if v_needed<>0 then raise exception using errcode='22023',message='credit_allocation_failed'; end if;
  end loop;
  update private.sales_cases set status='contracted' where id=v_case.id;
  v_result := private.sales_touch_case(v_case.id,'contract.sign',jsonb_build_object('document_id',v_doc.id));
  return private.sales_remember('contract.sign',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_issue_design_invoice(p_case_id uuid,p_position integer,p_version bigint,p_due_date date,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_plan private.sales_design_plans; v_doc private.sales_documents;
  v_bill private.sales_design_invoices; v_amount bigint; v_label text; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'position',p_position,'version',p_version,'due_date',p_due_date);
begin
  v_case := private.sales_lock_case(p_case_id,'billing.issue');
  v_result := private.sales_replay('design.invoice.issue',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if not private.sales_can_collect_design(v_case) then
    raise exception using errcode='22023',message='design_payment_unavailable'; end if;
  if p_position is null or p_position not between 1 and 3 or p_due_date is null or not isfinite(p_due_date) then
    raise exception using errcode='22023',message='invalid_design_invoice'; end if;
  select * into v_plan from private.sales_design_plans where case_id=p_case_id;
  if not found then raise exception using errcode='22023',message='design_plan_required'; end if;
  if exists(select 1 from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
    where p.case_id=p_case_id and p.kind='design_fee' and r.design_invoice_id is null) then
    raise exception using errcode='22023',message='legacy_design_review_required'; end if;
  if exists(select 1 from private.sales_payment_requests where case_id=p_case_id and kind='design_fee' and design_invoice_id is null and state='pending') then
    raise exception using errcode='22023',message='design_payment_pending'; end if;
  if exists(select 1 from private.sales_design_invoices where case_id=p_case_id and position=p_position and cancelled_at is null) then
    raise exception using errcode='PT409',message='design_invoice_already_issued'; end if;
  v_amount := (v_plan.instalments->>(p_position-1))::bigint;
  if v_amount is null or v_amount<=0 then raise exception using errcode='22023',message='design_invoice_zero_amount'; end if;
  v_label := 'ค่าออกแบบ งวดที่ ' || p_position || ' · ' || case p_position when 1 then 'ส่งมอบแบบแปลน' when 2 then 'ส่งมอบ 3D' else 'ส่งมอบครบ' end;
  v_doc := private.sales_new_document(p_case_id,'invoice','issued',jsonb_build_object('label',v_label,
    'gross_cents',v_amount::text,'credit_cents','0','net_cents',v_amount::text,'due_date',p_due_date,'credit_settled',false,
    'design_position',p_position,'design_plan_version',v_plan.version));
  insert into private.sales_design_invoices(case_id,position,label,amount_cents,due_date,document_id)
    values(p_case_id,p_position,v_label,v_amount,p_due_date,v_doc.id) returning * into v_bill;
  v_result := private.sales_touch_case(p_case_id,'design.invoice.issue',jsonb_build_object('invoice_id',v_bill.id,'document_id',v_doc.id))
    || jsonb_build_object('invoice_id',v_bill.id,'document_id',v_doc.id,'number',v_doc.number);
  return private.sales_remember('design.invoice.issue',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_cancel_design_invoice(p_invoice_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_bill private.sales_design_invoices; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('invoice',p_invoice_id,'version',p_version,'reason',p_reason);
begin
  select * into v_bill from private.sales_design_invoices where id=p_invoice_id;
  v_case := private.sales_lock_case(v_bill.case_id,'billing.issue');
  v_result := private.sales_replay('design.invoice.cancel',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if not private.sales_can_collect_design(v_case) then
    raise exception using errcode='22023',message='design_payment_unavailable'; end if;
  if v_bill.cancelled_at is not null or length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_design_invoice'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=p_invoice_id and state in ('pending','confirmed')) then
    raise exception using errcode='22023',message='design_invoice_has_payment'; end if;
  update private.sales_design_invoices set cancelled_at=now() where id=p_invoice_id;
  update private.sales_documents set state='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=btrim(p_reason),version=version+1 where id=v_bill.document_id;
  v_result := private.sales_touch_case(v_case.id,'design.invoice.cancel',v_payload);
  return private.sales_remember('design.invoice.cancel',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_validate_payment(p_request private.sales_payment_requests) returns void
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_limit numeric; v_paid numeric; v_invoice jsonb; v_bill private.sales_design_invoices;
begin
  select * into v_case from private.sales_cases where id=p_request.case_id;
  if p_request.amount_cents is null or p_request.amount_cents <= 0 or p_request.paid_date is null
    or p_request.paid_date > (now() at time zone 'Asia/Bangkok')::date
    or p_request.kind is null or p_request.kind not in ('design_fee','booking','instalment','unallocated')
    or p_request.method is null or p_request.method not in ('cash','transfer','cheque')
    or length(btrim(coalesce(p_request.payer_name,''))) not between 1 and 300
    or length(btrim(coalesce(p_request.description,''))) not between 1 and 1000
    or (p_request.kind='instalment') is distinct from (p_request.invoice_id is not null) then
    raise exception using errcode='22023',message='invalid_payment';
  end if;
  if p_request.proof_path is not null or p_request.method <> 'cash' then
    perform private.sales_check_evidence(p_request.case_id,p_request.proof_path,'payment');
  end if;
  if p_request.kind='unallocated' then return; end if;
  if v_case.status='cancelled' then raise exception using errcode='22023',message='case_cancelled'; end if;
  if p_request.kind='instalment' then
    if not exists(select 1 from private.sales_invoices where id=p_request.invoice_id and case_id=p_request.case_id) then
      raise exception using errcode='22023',message='invoice_unavailable'; end if;
    v_invoice := private.sales_invoice_totals(p_request.invoice_id);
    if not (v_invoice->>'is_active')::boolean or p_request.amount_cents > (v_invoice->>'outstanding_cents')::numeric then
      raise exception using errcode='22023',message='payment_exceeds_outstanding'; end if;
    return;
  end if;
  if p_request.kind='design_fee' then
    if not private.sales_can_collect_design(v_case) then
      raise exception using errcode='22023',message='design_payment_unavailable'; end if;
    select total_cents into v_limit from private.sales_design_plans where case_id=p_request.case_id;
  else
    if v_case.brand <> 'TARAVILLE' or not exists(select 1 from private.sales_reservations
      where case_id=p_request.case_id and released_at is null) then
      raise exception using errcode='22023',message='confirmed_reservation_required'; end if;
    select (s.payload->>'booking_cents')::bigint into v_limit
      from private.sales_documents s join private.sales_units u on u.id=v_case.unit_id
      join private.sales_developments d on d.id=u.development_id
      where s.case_id=v_case.id and s.kind='summary' and s.state='issued'
        and s.payload->>'plot'=u.code and s.payload->>'development'=d.name
        and s.payload->>'total_cents'=v_case.net_price_cents::text
        and not exists(select 1 from private.sales_events e where e.case_id=v_case.id
          and e.action='reservation.change' and e.created_at>=s.created_at)
      order by s.revision desc limit 1;
  end if;
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'paid_cents')::numeric
    -(private.sales_payment_totals(coalesce(root_id,id))->>'refunded_cents')::numeric),0) into v_paid
    from private.sales_payments where case_id=p_request.case_id and kind=p_request.kind and voided_at is null;
  if v_limit is null or v_paid+p_request.amount_cents > v_limit then
    raise exception using errcode='22023',message='payment_exceeds_agreed_total'; end if;
  if p_request.kind<>'design_fee' then return; end if;
  if p_request.design_invoice_id is null then
    -- Persisted legacy requests may still finish; new direct preparation has no stored id.
    if p_request.id is not null and exists(select 1 from private.sales_payment_requests
      where id=p_request.id and case_id=p_request.case_id and kind='design_fee' and design_invoice_id is null) then return; end if;
    raise exception using errcode='22023',message='design_invoice_required';
  end if;
  select * into v_bill from private.sales_design_invoices where id=p_request.design_invoice_id and case_id=p_request.case_id;
  if not found or v_bill.cancelled_at is not null or not exists(select 1 from private.sales_documents where id=v_bill.document_id and state='issued') then
    raise exception using errcode='22023',message='design_invoice_unavailable'; end if;
  if p_request.amount_cents is distinct from v_bill.amount_cents then raise exception using errcode='22023',message='design_bill_full_amount_required'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=v_bill.id and state='pending' and id is distinct from p_request.id) then
    raise exception using errcode='PT409',message='design_payment_pending'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=v_bill.id and state='confirmed') then
    raise exception using errcode='PT409',message='design_invoice_already_paid'; end if;
end $$;

notify pgrst, 'reload schema';

commit;
