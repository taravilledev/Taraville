begin;

create or replace function private.sales_save_design_plan(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('design.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if jsonb_typeof(p_input->'usable_area') is distinct from 'string'
    or coalesce(p_input->>'usable_area','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' then
    raise exception using errcode='22023',message='invalid_area'; end if;
  if (p_input->>'usable_area')::numeric <= 0 then
    raise exception using errcode='22023',message='invalid_area'; end if;
  if exists(select 1 from private.sales_design_invoices where case_id=p_case_id and cancelled_at is null)
    or exists(select 1 from private.sales_payment_requests where case_id=p_case_id and kind='design_fee' and state='pending') then
    raise exception using errcode='22023',message='design_billing_locked'; end if;
  return private.sales_save_design_plan_before_billing(p_case_id,p_version,p_input,p_request_id);
end $$;

notify pgrst,'reload schema';
commit;
