begin;
create function private.sales_cases_for_lead(p_lead_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_cases jsonb; v_can_create boolean;
begin
  perform private.sales_actor();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'status',status) order by created_at desc,id),'[]')
    into v_cases from private.sales_cases where lead_id=p_lead_id
      and (private.sales_allowed('case.view',id) or private.sales_allowed('financial.view',id));
  v_can_create := exists(select 1 from public.leads where id=p_lead_id and brand='TARAVILLE' and closed_at is null)
    and private.sales_allowed('case.create',null,p_lead_id);
  return jsonb_build_object('cases',v_cases,'can_create',v_can_create);
end $$;
create function public.sales_cases_for_lead(p_lead_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.sales_cases_for_lead(p_lead_id) $$;
revoke all on function private.sales_cases_for_lead(uuid),public.sales_cases_for_lead(uuid) from public,anon,authenticated;
grant execute on function private.sales_cases_for_lead(uuid),public.sales_cases_for_lead(uuid) to authenticated;
commit;
