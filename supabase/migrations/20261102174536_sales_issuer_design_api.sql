begin;

create function private.sales_save_issuer(p_brand text,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff := private.sales_actor(); v_row private.sales_issuers;
  v_payload jsonb := jsonb_build_object('brand',p_brand,'version',p_version,'input',p_input); v_result jsonb;
begin
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  v_result := private.sales_replay('issuer.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_brand is null or p_brand not in ('BAAN_KUNAPAP','TARAVILLE') or p_input is null
    or jsonb_typeof(p_input) <> 'object' or exists(select 1 from jsonb_object_keys(p_input) k
      where k not in ('legal_name','address','tax_id','contact','contract_text','is_synthetic'))
    or jsonb_typeof(p_input->'is_synthetic') is distinct from 'boolean' then
    raise exception using errcode='22023',message='invalid_issuer';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sales.issuer.' || p_brand,0));
  select * into v_row from private.sales_issuers where brand=p_brand for update;
  if p_version is distinct from coalesce(v_row.version,0) then raise exception using errcode='PT409',message='stale_issuer'; end if;
  insert into private.sales_issuers(brand,legal_name,address,tax_id,contact,contract_text,is_synthetic,updated_by)
  values(p_brand,btrim(p_input->>'legal_name'),btrim(p_input->>'address'),coalesce(p_input->>'tax_id',''),
    coalesce(p_input->>'contact',''),coalesce(p_input->>'contract_text',''),(p_input->>'is_synthetic')::boolean,v_actor.id)
  on conflict(brand) do update set legal_name=excluded.legal_name,address=excluded.address,tax_id=excluded.tax_id,
    contact=excluded.contact,contract_text=excluded.contract_text,is_synthetic=excluded.is_synthetic,
    version=private.sales_issuers.version+1,updated_by=v_actor.id,updated_at=now() returning * into v_row;
  insert into private.sales_events(actor_id,action,detail) values(v_actor.id,'issuer.save',jsonb_build_object('brand',p_brand,'version',v_row.version));
  return private.sales_remember('issuer.save',p_request_id,v_payload,jsonb_build_object('version',v_row.version));
end $$;

create function private.sales_save_design_plan(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
  v_result jsonb; v_area numeric; v_tier text; v_total bigint; v_rows jsonb; v_sum numeric;
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('design.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand <> 'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved')
    or exists(select 1 from private.sales_documents where case_id=p_case_id and kind='contract' and state='signed')
    or exists(select 1 from private.sales_payments where case_id=p_case_id and kind='design_fee') then
    raise exception using errcode='22023',message='design_amendment_required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or exists(select 1 from jsonb_object_keys(p_input) k
    where k not in ('usable_area','tier','instalments','note')) then raise exception using errcode='22023',message='invalid_design_plan'; end if;
  if nullif(p_input->>'usable_area','') is not null then
    if p_input->>'usable_area' !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' then raise exception using errcode='22023',message='invalid_area'; end if;
    v_area := (p_input->>'usable_area')::numeric;
    if v_area <= 0 then raise exception using errcode='22023',message='invalid_area'; end if;
    v_tier := case when v_area<150 then 'under150' when v_area<200 then 'under200' when v_area<250 then 'under250'
      when v_area<=300 then 'upto300' else 'custom' end;
  else v_tier := p_input->>'tier'; end if;
  v_rows := case v_tier when 'under150' then '["350000","350000","500000"]'::jsonb
    when 'under200' then '["750000","750000","1000000"]'::jsonb
    when 'under250' then '["900000","1000000","1100000"]'::jsonb
    when 'upto300' then '["1200000","1300000","1500000"]'::jsonb else null end;
  if p_input ? 'instalments' then v_rows := p_input->'instalments'; end if;
  if v_tier is null or v_tier not in ('under150','under200','under250','upto300','custom')
    or v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) <> 3 then
    raise exception using errcode='22023',message='invalid_design_plan';
  end if;
  if exists(select 1 from jsonb_array_elements(v_rows) x where jsonb_typeof(x) <> 'string' or x #>> '{}' = '') then
    raise exception using errcode='22023',message='invalid_money'; end if;
  select sum(private.sales_money(x)) into v_sum from jsonb_array_elements_text(v_rows) x;
  if v_sum is null or v_sum > 9223372036854775807 then raise exception using errcode='22023',message='invalid_money'; end if;
  v_total := v_sum::bigint;
  insert into private.sales_design_plans(case_id,tier,usable_area,total_cents,instalments,note,agreed_by)
  values(p_case_id,v_tier,v_area,v_total,v_rows,coalesce(p_input->>'note',''),auth.uid())
  on conflict(case_id) do update set tier=excluded.tier,usable_area=excluded.usable_area,total_cents=excluded.total_cents,
    instalments=excluded.instalments,note=excluded.note,version=private.sales_design_plans.version+1,agreed_by=auth.uid(),agreed_at=now();
  v_result := private.sales_touch_case(p_case_id,'design.save',jsonb_build_object('total_cents',v_total::text,'tier',v_tier));
  return private.sales_remember('design.save',p_request_id,v_payload,v_result);
end $$;

create function public.sales_save_issuer(p_brand text,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_save_issuer(p_brand,p_version,p_input,p_request_id) $$;
create function public.sales_save_design_plan(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_save_design_plan(p_case_id,p_version,p_input,p_request_id) $$;
revoke all on function private.sales_save_issuer(text,bigint,jsonb,uuid),public.sales_save_issuer(text,bigint,jsonb,uuid),
  private.sales_save_design_plan(uuid,bigint,jsonb,uuid),public.sales_save_design_plan(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sales_save_issuer(text,bigint,jsonb,uuid),public.sales_save_issuer(text,bigint,jsonb,uuid),
  private.sales_save_design_plan(uuid,bigint,jsonb,uuid),public.sales_save_design_plan(uuid,bigint,jsonb,uuid) to authenticated;
commit;
