begin;

create function private.sales_contract_schedule(p_total bigint,p_credit bigint,p_input jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_row jsonb; v_rows jsonb := '[]'; v_index integer := 0; v_sum integer := 0;
  v_bps integer; v_progress integer; v_previous integer := -1; v_gross bigint; v_gross_sum bigint := 0;
  v_remaining bigint := p_credit; v_applied bigint;
begin
  if p_total is null or p_total<=0 or p_credit is null or p_credit<0 or p_credit>p_total then
    raise exception using errcode='22023',message='credit_exceeds_contract'; end if;
  if jsonb_typeof(p_input) is distinct from 'array' or jsonb_array_length(p_input) not between 1 and 100
    or octet_length(p_input::text)>150000 then raise exception using errcode='22023',message='invalid_schedule'; end if;
  for v_row in select value from jsonb_array_elements(p_input) loop
    if jsonb_typeof(v_row) is distinct from 'object'
      or jsonb_typeof(v_row->'label') is distinct from 'string'
      or length(btrim(coalesce(v_row->>'label',''))) not between 1 and 300
      or coalesce(v_row->>'basis_points','') !~ '^[0-9]{1,5}$'
      or jsonb_typeof(v_row->'basis_points') is distinct from 'number'
      or length(coalesce(v_row->>'work_description',''))>3000
      or (v_row ? 'work_description' and jsonb_typeof(v_row->'work_description') is distinct from 'string') then
      raise exception using errcode='22023',message='invalid_schedule'; end if;
    v_bps := (v_row->>'basis_points')::integer;
    if v_bps not between 1 and 10000 then raise exception using errcode='22023',message='invalid_schedule'; end if;
    v_sum := v_sum+v_bps;
    if v_index=0 then v_progress := null;
    else
      if jsonb_typeof(v_row->'progress_percent') is distinct from 'number'
        or coalesce(v_row->>'progress_percent','') !~ '^[0-9]{1,3}$' then
        raise exception using errcode='22023',message='invalid_progress'; end if;
      v_progress := (v_row->>'progress_percent')::integer;
      if v_progress not between 0 and 100 or v_progress<v_previous then
        raise exception using errcode='22023',message='invalid_progress'; end if;
      v_previous := v_progress;
    end if;
    v_gross := floor(p_total::numeric*v_bps/10000)::bigint; v_gross_sum := v_gross_sum+v_gross;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('position',v_index,'label',btrim(v_row->>'label'),
      'basis_points',v_bps,'gross_cents',v_gross::text,'credit_cents','0','net_cents',v_gross::text,
      'progress_percent',v_progress,'needs_acceptance',v_index>0,'work_description',coalesce(v_row->>'work_description','')));
    v_index := v_index+1;
  end loop;
  if v_sum<>10000 then raise exception using errcode='22023',message='schedule_must_total_100_percent'; end if;
  v_index := jsonb_array_length(v_rows)-1;
  v_rows := jsonb_set(v_rows,array[v_index::text,'gross_cents'],to_jsonb(((v_rows->v_index->>'gross_cents')::bigint+p_total-v_gross_sum)::text));
  while v_index>=0 loop
    v_gross := (v_rows->v_index->>'gross_cents')::bigint; v_applied := least(v_remaining,v_gross);
    v_rows := jsonb_set(v_rows,array[v_index::text,'credit_cents'],to_jsonb(v_applied::text));
    v_rows := jsonb_set(v_rows,array[v_index::text,'net_cents'],to_jsonb((v_gross-v_applied)::text));
    v_remaining := v_remaining-v_applied; v_index := v_index-1;
  end loop;
  return v_rows;
end $$;

-- Replace the old signature so PostgREST cannot select an ambiguous overload.
drop function public.sales_issue_quotation(uuid,bigint,text,uuid);
drop function private.sales_issue_quotation(uuid,bigint,text,uuid);
create function private.sales_issue_quotation(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_result jsonb; v_house jsonb := p_input->'house';
  v_total bigint; v_price_set boolean; v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('quotation.issue',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved')
    or exists(select 1 from private.sales_documents where case_id=p_case_id and kind='contract' and state in ('awaiting_signature','signed')) then
    raise exception using errcode='22023',message='quotation_unavailable'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>120000
    or not p_input ?& array['house','total_cents','spec_rows','exclusions']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('house','total_cents','spec_rows','exclusions','description'))
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
  v_price_set := p_input->'total_cents'<>'null'::jsonb;
  if v_price_set then
    if jsonb_typeof(p_input->'total_cents') is distinct from 'string' then raise exception using errcode='22023',message='invalid_money'; end if;
    v_total := private.sales_money(p_input->>'total_cents');
    if v_total is null or v_total<=0 then raise exception using errcode='22023',message='positive_quotation_price_required'; end if;
  end if;
  v_doc := private.sales_new_document(p_case_id,'quotation','offered',jsonb_build_object(
    'description',coalesce(nullif(btrim(p_input->>'description'),''),v_house->>'model'),'house',v_house,
    'details',v_house,'spec_rows',p_input->'spec_rows','exclusions',p_input->'exclusions',
    'price_set',v_price_set,'total_cents',coalesce(v_total,0)::text));
  v_result := private.sales_touch_case(p_case_id,'quotation.issue',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('quotation.issue',p_request_id,v_payload,v_result);
end $$;

create function public.sales_issue_quotation(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_issue_quotation(p_case_id,p_version,p_input,p_request_id) $$;

create or replace function private.sales_accept_quotation(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_doc private.sales_documents; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'evidence',p_evidence_path);
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'financial.prepare');
  v_result := private.sales_replay('quotation.accept',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_doc.kind<>'quotation' or v_doc.state<>'offered' or v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='quotation_not_offered'; end if;
  if coalesce(private.sales_money(v_doc.payload->>'total_cents'),0)<=0 or v_doc.payload->'price_set'='false'::jsonb then
    raise exception using errcode='22023',message='positive_quotation_price_required'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'agreement');
  update private.sales_documents set state='accepted',evidence_path=p_evidence_path,finalized_by=auth.uid(),finalized_at=now(),version=version+1 where id=v_doc.id;
  v_result := private.sales_touch_case(v_case.id,'quotation.accept',jsonb_build_object('document_id',v_doc.id));
  return private.sales_remember('quotation.accept',p_request_id,v_payload,v_result);
end $$;

revoke all on function private.sales_contract_schedule(bigint,bigint,jsonb),private.sales_issue_quotation(uuid,bigint,jsonb,uuid),
  public.sales_issue_quotation(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sales_issue_quotation(uuid,bigint,jsonb,uuid),public.sales_issue_quotation(uuid,bigint,jsonb,uuid) to authenticated;
commit;
