begin;
create function private.sales_acceptance_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  perform private.sales_require('case.view',p_case_id);
  perform private.sales_require('acceptance.record',p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,
    'progress_percent',i.progress_percent,'accepted',i.accepted_at is not null) order by i.position,i.id),'[]')
  into v_rows from private.sales_instalments i join private.sales_cases c on c.id=i.case_id
    where i.case_id=p_case_id and c.brand='BAAN_KUNAPAP' and c.status='contracted'
      and i.is_active and i.needs_acceptance;
  return v_rows;
end $$;
create function public.sales_acceptance_detail(p_case_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.sales_acceptance_detail(p_case_id) $$;
revoke all on function private.sales_acceptance_detail(uuid),public.sales_acceptance_detail(uuid) from public,anon,authenticated;
grant execute on function private.sales_acceptance_detail(uuid),public.sales_acceptance_detail(uuid) to authenticated;
commit;
