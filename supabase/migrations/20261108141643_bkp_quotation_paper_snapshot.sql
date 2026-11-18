-- Preserve paper quotation header fields per revision without rewriting historical documents.
begin;
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
    'price_set',v_price_set,'total_cents',coalesce(v_total,0)::text)
    || case when v_paper is null then '{}'::jsonb else jsonb_build_object('paper',v_paper) end,
    p_document_date => v_date);
  v_result := private.sales_touch_case(p_case_id,'quotation.issue',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('quotation.issue',p_request_id,v_payload,v_result);
end $$;

notify pgrst, 'reload schema';
commit;
