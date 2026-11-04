begin;

create or replace function private.sales_case_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_result jsonb; v_finance boolean; v_permissions jsonb; v_actor public.staff := private.sales_actor();
begin
  v_finance := private.sales_allowed('financial.view',p_case_id);
  if not (v_finance or private.sales_allowed('case.view',p_case_id)) then raise exception using errcode='42501',message='sales_permission_denied'; end if;
  select * into v_case from private.sales_cases where id = p_case_id;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  select jsonb_object_agg(x,private.sales_allowed(x,p_case_id)) into v_permissions from unnest(array[
    'case.edit','financial.prepare','financial.confirm','receipt.issue','receipt.cancel','refund.request','refund.approve',
    'refund.pay','contract.sign','contract.amend','contract.cancel','billing.issue','acceptance.record']) x;
  v_result := jsonb_build_object('id',v_case.id,'code',v_case.code,'brand',v_case.brand,'lead_id',v_case.lead_id,
    'project_id',v_case.project_id,'unit_id',v_case.unit_id,'customer_id',v_case.customer_id,'responsible_id',v_case.responsible_id,
    'responsible_name',(select full_name from public.staff where id = v_case.responsible_id),
    'lead_owner_name',(select s.full_name from public.leads l join public.staff s on s.id = l.owner_id where l.id = v_case.lead_id),
    'status',v_case.status,'version',v_case.version,'customer_name',v_case.customer_snapshot->>'full_name',
    'can_finance',v_finance,'can_edit',private.sales_allowed('case.edit',p_case_id),'can_assign',v_actor.role = 'executive','permissions',v_permissions);
  if v_finance then
    v_result := v_result || jsonb_build_object('customer_snapshot',v_case.customer_snapshot,'details',v_case.details,
      'list_price_cents',v_case.list_price_cents::text,'promotion_price_cents',v_case.promotion_price_cents::text,
      'discount_cents',v_case.discount_cents::text,'net_price_cents',v_case.net_price_cents::text,
      'unit_label',(select d.name || ' · ' || u.code from private.sales_units u join private.sales_developments d on d.id = u.development_id where u.id = v_case.unit_id));
  end if;
  return v_result;
end $$;

commit;
