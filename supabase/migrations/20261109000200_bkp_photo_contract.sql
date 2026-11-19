begin;

alter table private.sales_issuers add column contract_text_approved boolean not null default false;

create or replace function private.sales_save_issuer(p_brand text,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff := private.sales_actor(); v_row private.sales_issuers;
  v_payload jsonb := jsonb_build_object('brand',p_brand,'version',p_version,'input',p_input); v_result jsonb;
begin
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  v_result := private.sales_replay('issuer.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_brand is null or p_brand not in ('BAAN_KUNAPAP','TARAVILLE') or p_input is null
    or jsonb_typeof(p_input) <> 'object' or exists(select 1 from jsonb_object_keys(p_input) k
      where k not in ('legal_name','address','tax_id','contact','contract_text','is_synthetic','contract_text_approved'))
    or jsonb_typeof(p_input->'is_synthetic') is distinct from 'boolean'
    or (p_input ? 'contract_text_approved' and jsonb_typeof(p_input->'contract_text_approved') is distinct from 'boolean')
    or (p_input->'contract_text_approved' = 'true'::jsonb and length(btrim(coalesce(p_input->>'contract_text',''))) = 0) then
    raise exception using errcode='22023',message='invalid_issuer';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sales.issuer.' || p_brand,0));
  select * into v_row from private.sales_issuers where brand=p_brand for update;
  if p_version is distinct from coalesce(v_row.version,0) then raise exception using errcode='PT409',message='stale_issuer'; end if;
  insert into private.sales_issuers(brand,legal_name,address,tax_id,contact,contract_text,is_synthetic,contract_text_approved,updated_by)
  values(p_brand,btrim(p_input->>'legal_name'),btrim(p_input->>'address'),coalesce(p_input->>'tax_id',''),
    coalesce(p_input->>'contact',''),coalesce(p_input->>'contract_text',''),(p_input->>'is_synthetic')::boolean,coalesce((p_input->>'contract_text_approved')::boolean,false),v_actor.id)
  on conflict(brand) do update set legal_name=excluded.legal_name,address=excluded.address,tax_id=excluded.tax_id,
    contact=excluded.contact,contract_text=excluded.contract_text,is_synthetic=excluded.is_synthetic,contract_text_approved=excluded.contract_text_approved,
    version=private.sales_issuers.version+1,updated_by=v_actor.id,updated_at=now() returning * into v_row;
  insert into private.sales_events(actor_id,action,detail) values(v_actor.id,'issuer.save',jsonb_build_object('brand',p_brand,'version',v_row.version));
  return private.sales_remember('issuer.save',p_request_id,v_payload,jsonb_build_object('version',v_row.version));
end $$;

create function private.sales_validate_contract_clauses(p_clauses jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(p_clauses) is distinct from 'array' then raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if jsonb_array_length(p_clauses)>50 or exists(select 1 from jsonb_array_elements(p_clauses) x
    where jsonb_typeof(x)<>'string' or length(btrim(x #>> '{}')) not between 1 and 3000) then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
end $$;

create function private.sales_validate_contract_paper(p_paper jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare v_limits jsonb := '{"signing_place":2000,"signing_date":10,"employer_address":2000,"employer_national_id":13,"contractor_name":300,"contractor_address":3000,"contractor_representative":200,"contractor_national_id":13,"witness_1":200,"witness_2":200,"duration_days":4,"conditions":10000,"notes":10000}';
begin
  if jsonb_typeof(p_paper) is distinct from 'object' or p_paper->'schema_version' is distinct from '1'::jsonb then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if exists(select 1 from jsonb_each_text(v_limits) f where jsonb_typeof(p_paper->f.key) is distinct from 'string' or length(p_paper->>f.key)>f.value::int)
    or exists(select 1 from jsonb_object_keys(p_paper) k where not (v_limits ? k) and k not in ('schema_version','extra_clauses'))
    or p_paper->>'employer_national_id' !~ '^(|[0-9]{13})$' or p_paper->>'contractor_national_id' !~ '^(|[0-9]{13})$'
    or p_paper->>'duration_days' !~ '^(|[1-9][0-9]{0,3})$' or p_paper->>'signing_date' !~ '^(|[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  perform nullif(p_paper->>'signing_date','')::date;
  perform private.sales_validate_contract_clauses(p_paper->'extra_clauses');
end $$;

revoke all on function private.sales_validate_contract_paper(jsonb),private.sales_validate_contract_clauses(jsonb) from public,anon,authenticated;


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
  v_total := private.sales_money(v_quote.payload->>'total_cents'); v_credit := private.sales_design_credit(p_case_id);
  v_rows := private.sales_contract_schedule(v_total,v_credit,p_input->'schedule');
  v_data := jsonb_strip_nulls(jsonb_build_object('quotation_id',v_quote.id,'quotation_number',v_quote.number,'description',v_quote.payload->>'description',
    'details',v_quote.payload->'details','house',v_quote.payload->'house','spec_rows',v_quote.payload->'spec_rows',
    'exclusions',v_quote.payload->'exclusions','contract_text',case when v_paper is not null then v_issuer.contract_text else coalesce(nullif(v_doc.payload->>'contract_text',''),v_issuer.contract_text) end,'total_cents',v_total::text,
    'credit_cents',v_credit::text,'additional_terms',v_terms,'contract_paper',v_paper,
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
    or v_doc.payload->>'quotation_id' is distinct from v_quote.id::text then
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
  v_credit := private.sales_design_credit(v_case.id);
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

create or replace function private.sales_contract_template(p_case_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_case private.sales_cases; v_issuer private.sales_issuers;
begin
  perform private.sales_require('financial.prepare',p_case_id);
  perform private.sales_require('financial.view',p_case_id);
  select * into v_case from private.sales_cases where id=p_case_id;
  if not found or v_case.brand<>'BAAN_KUNAPAP' then raise exception using errcode='42501',message='case_unavailable'; end if;
  select * into v_issuer from private.sales_issuers where brand=v_case.brand;
  return jsonb_build_object('contract_text',coalesce(v_issuer.contract_text,''),'contract_text_approved',coalesce(v_issuer.contract_text_approved,false),
    'contractor_name',coalesce(v_issuer.legal_name,''),'contractor_address',coalesce(v_issuer.address,''),
    'is_synthetic',exists(select 1 from public.leads where id=v_case.lead_id and privacy_mode='synthetic'));
end $$;

create function private.sales_add_contract_addendum(p_document_id uuid,p_version bigint,p_input jsonb,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_parent private.sales_documents; v_doc private.sales_documents; v_case private.sales_cases; v_result jsonb; v_date date;
  v_payload jsonb := jsonb_build_object('contract',p_document_id,'version',p_version,'input',p_input,'evidence',p_evidence_path);
begin
  select * into v_parent from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_parent.case_id,'contract.amend');
  v_result := private.sales_replay('contract.addendum',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_parent from private.sales_documents where id=p_document_id for share;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('contracted','completed')
    or v_parent.kind<>'contract' or v_parent.state<>'signed' or v_parent.number is null then
    raise exception using errcode='22023',message='signed_contract_required'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>680000 then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('date','extra_clauses','conditions','notes'))
    or jsonb_typeof(p_input->'date') is distinct from 'string' or p_input->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or jsonb_typeof(p_input->'conditions') is distinct from 'string' or length(p_input->>'conditions')>10000
    or jsonb_typeof(p_input->'notes') is distinct from 'string' or length(p_input->>'notes')>10000 then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  perform private.sales_validate_contract_clauses(p_input->'extra_clauses');
  if jsonb_array_length(p_input->'extra_clauses')=0 and btrim(p_input->>'conditions')='' and btrim(p_input->>'notes')='' then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  v_date := (p_input->>'date')::date;
  if v_date>(now() at time zone 'Asia/Bangkok')::date or v_date<coalesce(nullif(v_parent.payload->'contract_paper'->>'signing_date','')::date,v_parent.document_date) then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'agreement');
  v_doc := private.sales_new_document(v_case.id,'amendment','draft',
    jsonb_build_object('text_addendum',p_input,'contract_number',v_parent.number,'customer',v_parent.payload->'customer',
      'contract_paper',case when v_parent.payload ? 'contract_paper' then
        v_parent.payload->'contract_paper' || '{"employer_national_id":"","contractor_national_id":"","extra_clauses":[],"conditions":"","notes":""}'::jsonb end),v_parent.id,p_evidence_path,v_date);
  update private.sales_documents set number=private.sales_number(v_case.brand,'A'),state='signed',finalized_by=auth.uid(),finalized_at=now(),
    customer_snapshot=v_parent.customer_snapshot,issuer_snapshot=v_parent.issuer_snapshot,
    payload=jsonb_strip_nulls(payload) || jsonb_build_object('is_synthetic',(payload->>'is_synthetic')::boolean or coalesce((v_parent.payload->>'is_synthetic')::boolean,false))
    where id=v_doc.id;
  v_result := private.sales_touch_case(v_case.id,'contract.addendum',jsonb_build_object('document_id',v_doc.id,'contract_id',v_parent.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('contract.addendum',p_request_id,v_payload,v_result);
end $$;
create function public.sales_add_contract_addendum(p_document_id uuid,p_version bigint,p_input jsonb,p_evidence_path text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_add_contract_addendum(p_document_id,p_version,p_input,p_evidence_path,p_request_id) $$;
revoke all on function private.sales_add_contract_addendum(uuid,bigint,jsonb,text,uuid),public.sales_add_contract_addendum(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_add_contract_addendum(uuid,bigint,jsonb,text,uuid),public.sales_add_contract_addendum(uuid,bigint,jsonb,text,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
