begin;
create or replace function private.sales_save_booking_summary(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_doc private.sales_documents;
  v_plot record;
  v_booking bigint;
  v_contract bigint;
  v_down bigint;
  v_result jsonb;
  v_mortgage bigint;
  v_dates jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('summary.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'TARAVILLE' or v_case.status not in ('draft','reserved') or v_case.net_price_cents is null
    or jsonb_typeof(p_input) is distinct from 'object'
    or length(btrim(coalesce(v_case.customer_snapshot->>'full_name','')))=0 then
    raise exception using errcode='22023',message='summary_unavailable';
  end if;
  v_mortgage := private.sales_money(nullif(p_input->>'mortgage_cents',''));
  v_dates := jsonb_build_object(
    'booking_date',nullif(p_input->>'booking_date','')::date,
    'contract_date',nullif(p_input->>'contract_date','')::date,
    'down_date',nullif(p_input->>'down_date','')::date);
  v_booking := coalesce(private.sales_money(p_input->>'booking_cents'),0);
  v_contract := coalesce(private.sales_money(p_input->>'contract_cents'),0);
  v_down := coalesce(private.sales_money(p_input->>'down_cents'),0);
  if v_booking::numeric+v_contract+v_down>v_case.net_price_cents
    or length(coalesce(p_input->>'conditions',''))>5000 or length(coalesce(p_input->>'freebies',''))>5000 then
    raise exception using errcode='22023',message='invalid_summary_terms';
  end if;
  select u.code,d.name into strict v_plot from private.sales_units u
    join private.sales_developments d on d.id=u.development_id where u.id=v_case.unit_id;
  v_doc := private.sales_new_document(p_case_id,'summary','issued',jsonb_build_object(
    'development',v_plot.name,'plot',v_plot.code,'details',v_case.details,
    'list_cents',v_case.list_price_cents::text,'promotion_cents',v_case.promotion_price_cents::text,
    'discount_cents',v_case.discount_cents::text,'total_cents',v_case.net_price_cents::text,
    'booking_cents',v_booking::text,'contract_cents',v_contract::text,'down_cents',v_down::text,
    'balance_cents',(v_case.net_price_cents-v_booking-v_contract-v_down)::text,
    'conditions',coalesce(p_input->>'conditions',''),'freebies',coalesce(p_input->>'freebies',''),'mortgage_cents',v_mortgage::text) || v_dates);
  v_result := private.sales_touch_case(p_case_id,'summary.save',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('summary.save',p_request_id,v_payload,v_result);
end $$;
commit;
