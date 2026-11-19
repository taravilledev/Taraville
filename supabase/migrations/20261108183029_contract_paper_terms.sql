begin;

create or replace function private.sales_save_contract_draft(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_input jsonb,
  p_document_id uuid,p_document_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_quote private.sales_documents; v_doc private.sales_documents; v_issuer private.sales_issuers;
  v_result jsonb; v_total bigint; v_credit bigint; v_rows jsonb; v_customer jsonb; v_data jsonb; v_terms text;
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
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>170000
    or not p_input ?& array['start_date','schedule']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('customer','start_date','schedule','additional_terms'))
    or jsonb_typeof(p_input->'start_date') is distinct from 'string'
    or coalesce(p_input->>'start_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='22023',message='invalid_contract_draft'; end if;
  perform (p_input->>'start_date')::date;
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
  v_total := private.sales_money(v_quote.payload->>'total_cents'); v_credit := private.sales_design_credit(p_case_id);
  v_rows := private.sales_contract_schedule(v_total,v_credit,p_input->'schedule');
  v_data := jsonb_strip_nulls(jsonb_build_object('quotation_id',v_quote.id,'quotation_number',v_quote.number,'description',v_quote.payload->>'description',
    'details',v_quote.payload->'details','house',v_quote.payload->'house','spec_rows',v_quote.payload->'spec_rows',
    'exclusions',v_quote.payload->'exclusions','contract_text',coalesce(nullif(v_doc.payload->>'contract_text',''),v_issuer.contract_text),'total_cents',v_total::text,
    'credit_cents',v_credit::text,'additional_terms',v_terms,'customer',v_customer,'start_date',p_input->>'start_date','schedule_input',p_input->'schedule','schedule',v_rows));
  if p_document_id is null then
    v_doc := private.sales_new_document(p_case_id,'contract','draft',v_data,v_quote.id);
  else
    update private.sales_documents set payload=v_data || jsonb_build_object('is_synthetic',v_doc.payload->'is_synthetic')
        || case when v_doc.payload ? 'replaces_document_id' then jsonb_build_object('replaces_document_id',v_doc.payload->'replaces_document_id') else '{}'::jsonb end,
      parent_id=v_quote.id,version=version+1 where id=p_document_id returning * into v_doc;
  end if;
  update private.sales_documents set customer_snapshot=coalesce(v_doc.customer_snapshot,v_case.customer_snapshot) || jsonb_build_object(
    'full_name',v_customer->>'full_name','phone',v_customer->>'phone',
    'address',coalesce(case when p_document_id is not null then v_doc.customer_snapshot->>'address' end,
      v_quote.payload->'paper'->>'customer_address',v_case.customer_snapshot->>'address','')) where id=v_doc.id;
  update private.sales_cases set list_price_cents=v_total,promotion_price_cents=null,discount_cents=0 where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'contract.draft.save',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id,'document_version',v_doc.version);
  return private.sales_remember('contract.draft.save',p_request_id,v_payload,v_result);
end $$;

create function private.sales_contract_template(p_case_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_case private.sales_cases; v_text text;
begin
  perform private.sales_require('financial.prepare',p_case_id);
  perform private.sales_require('financial.view',p_case_id);
  select * into v_case from private.sales_cases where id=p_case_id;
  if not found or v_case.brand<>'BAAN_KUNAPAP' then raise exception using errcode='42501',message='case_unavailable'; end if;
  select contract_text into v_text from private.sales_issuers where brand=v_case.brand;
  return jsonb_build_object('contract_text',coalesce(v_text,''));
end $$;
create function public.sales_contract_template(p_case_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.sales_contract_template(p_case_id) $$;
revoke all on function private.sales_contract_template(uuid),public.sales_contract_template(uuid) from public,anon,authenticated;
grant execute on function private.sales_contract_template(uuid),public.sales_contract_template(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
