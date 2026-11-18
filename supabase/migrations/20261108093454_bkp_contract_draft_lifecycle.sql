begin;

-- Fail on conflicting historical data rather than choose a contract silently.
create unique index sales_documents_one_live_contract on private.sales_documents(case_id)
  where kind='contract' and state in ('draft','awaiting_signature','signed');

create function private.sales_save_contract_draft(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_input jsonb,
  p_document_id uuid,p_document_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_quote private.sales_documents; v_doc private.sales_documents; v_issuer private.sales_issuers;
  v_result jsonb; v_total bigint; v_credit bigint; v_rows jsonb; v_customer jsonb := p_input->'customer'; v_data jsonb;
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
    or not p_input ?& array['customer','start_date','schedule']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('customer','start_date','schedule'))
    or jsonb_typeof(v_customer) is distinct from 'object'
    or jsonb_typeof(p_input->'start_date') is distinct from 'string'
    or coalesce(p_input->>'start_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='22023',message='invalid_contract_draft'; end if;
  perform (p_input->>'start_date')::date;
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
    'credit_cents',v_credit::text,'customer',v_customer,'start_date',p_input->>'start_date','schedule_input',p_input->'schedule','schedule',v_rows));
  if p_document_id is null then
    v_doc := private.sales_new_document(p_case_id,'contract','draft',v_data,v_quote.id);
  else
    update private.sales_documents set payload=v_data || jsonb_build_object('is_synthetic',v_doc.payload->'is_synthetic')
        || case when v_doc.payload ? 'replaces_document_id' then jsonb_build_object('replaces_document_id',v_doc.payload->'replaces_document_id') else '{}'::jsonb end,
      parent_id=v_quote.id,version=version+1 where id=p_document_id returning * into v_doc;
  end if;
  update private.sales_documents set customer_snapshot=v_case.customer_snapshot || jsonb_build_object(
    'full_name',v_customer->>'full_name','phone',v_customer->>'phone') where id=v_doc.id;
  update private.sales_cases set list_price_cents=v_total,promotion_price_cents=null,discount_cents=0 where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'contract.draft.save',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id,'document_version',v_doc.version);
  return private.sales_remember('contract.draft.save',p_request_id,v_payload,v_result);
end $$;

create function private.sales_lock_contract(p_document_id uuid,p_version bigint,p_document_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_quote private.sales_documents; v_result jsonb;
  v_rows jsonb; v_total bigint; v_credit bigint;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'document_version',p_document_version);
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
  v_credit := private.sales_design_credit(v_case.id);
  v_rows := private.sales_contract_schedule(v_total,v_credit,v_doc.payload->'schedule_input');
  update private.sales_documents set payload=payload || jsonb_build_object('credit_cents',v_credit::text,'schedule',v_rows),
    number=private.sales_number(v_case.brand,'C'),state='awaiting_signature',finalized_by=auth.uid(),finalized_at=now(),version=version+1
    where id=p_document_id returning * into v_doc;
  v_result := private.sales_touch_case(v_case.id,'contract.lock',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id,'document_version',v_doc.version,'number',v_doc.number);
  return private.sales_remember('contract.lock',p_request_id,v_payload,v_result);
end $$;

create function private.sales_unlock_contract(p_document_id uuid,p_version bigint,p_document_version bigint,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_new private.sales_documents; v_result jsonb;
  v_data jsonb; v_schedule jsonb; v_row jsonb; v_bps integer; v_sum integer := 0; v_index integer := 0; v_total bigint;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'document_version',p_document_version,'reason',p_reason);
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'financial.prepare');
  v_result := private.sales_replay('contract.unlock',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') or v_doc.kind<>'contract' or v_doc.state<>'awaiting_signature'
    or length(btrim(coalesce(p_reason,''))) not between 1 and 3000 then
    raise exception using errcode='22023',message='contract_not_awaiting_signature'; end if;
  if v_doc.version is distinct from p_document_version then raise exception using errcode='PT409',message='stale_document'; end if;
  v_data := v_doc.payload || jsonb_build_object('replaces_document_id',v_doc.id);
  if not v_data ? 'schedule_input' then
    v_total := private.sales_money(v_data->>'total_cents'); v_schedule := '[]';
    if v_total is null or v_total<=0 then raise exception using errcode='22023',message='positive_quotation_price_required'; end if;
    for v_row in select value from jsonb_array_elements(v_data->'schedule') loop
      v_bps := case when v_index=jsonb_array_length(v_data->'schedule')-1 then 10000-v_sum
        else floor((v_row->>'gross_cents')::numeric*10000/v_total)::integer end;
      v_schedule := v_schedule || jsonb_build_array(jsonb_build_object('label',v_row->>'label','basis_points',v_bps,
        'progress_percent',v_row->'progress_percent','work_description',coalesce(v_row->>'work_description','')));
      v_sum := v_sum+v_bps; v_index := v_index+1;
    end loop;
    v_data := v_data || jsonb_build_object('schedule_input',v_schedule);
  end if;
  v_data := v_data || jsonb_build_object('customer',coalesce(v_data->'customer',jsonb_build_object(
    'full_name',v_doc.customer_snapshot->>'full_name','phone',coalesce(v_doc.customer_snapshot->>'phone',''),
    'site_address','')),'start_date',coalesce(v_data->>'start_date',v_doc.document_date::text));
  update private.sales_documents set state='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=btrim(p_reason),version=version+1 where id=p_document_id;
  v_new := private.sales_new_document(v_case.id,'contract','draft',v_data,v_doc.parent_id);
  update private.sales_documents set customer_snapshot=v_doc.customer_snapshot,issuer_snapshot=v_doc.issuer_snapshot where id=v_new.id;
  v_result := private.sales_touch_case(v_case.id,'contract.unlock',jsonb_build_object('document_id',v_new.id,'replaces_document_id',v_doc.id))
    || jsonb_build_object('document_id',v_new.id,'document_version',v_new.version);
  return private.sales_remember('contract.unlock',p_request_id,v_payload,v_result);
end $$;

create function public.sales_save_contract_draft(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_input jsonb,
  p_document_id uuid,p_document_version bigint,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_save_contract_draft(p_case_id,p_version,p_quotation_id,p_input,p_document_id,p_document_version,p_request_id) $$;
create function public.sales_lock_contract(p_document_id uuid,p_version bigint,p_document_version bigint,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_lock_contract(p_document_id,p_version,p_document_version,p_request_id) $$;
create function public.sales_unlock_contract(p_document_id uuid,p_version bigint,p_document_version bigint,p_reason text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_unlock_contract(p_document_id,p_version,p_document_version,p_reason,p_request_id) $$;
revoke all on function private.sales_save_contract_draft(uuid,bigint,uuid,jsonb,uuid,bigint,uuid),public.sales_save_contract_draft(uuid,bigint,uuid,jsonb,uuid,bigint,uuid),
  private.sales_lock_contract(uuid,bigint,bigint,uuid),public.sales_lock_contract(uuid,bigint,bigint,uuid),
  private.sales_unlock_contract(uuid,bigint,bigint,text,uuid),public.sales_unlock_contract(uuid,bigint,bigint,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_save_contract_draft(uuid,bigint,uuid,jsonb,uuid,bigint,uuid),public.sales_save_contract_draft(uuid,bigint,uuid,jsonb,uuid,bigint,uuid),
  private.sales_lock_contract(uuid,bigint,bigint,uuid),public.sales_lock_contract(uuid,bigint,bigint,uuid),
  private.sales_unlock_contract(uuid,bigint,bigint,text,uuid),public.sales_unlock_contract(uuid,bigint,bigint,text,uuid) to authenticated;
commit;
