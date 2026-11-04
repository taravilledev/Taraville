begin;

-- Read-only list for /sales: filters in SQL so the 100-row cap applies after the filter, not before it.
create function private.sales_case_list(p_status text,p_brand text,p_query text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_query text := lower(btrim(coalesce(p_query,'')));
begin
  perform private.sales_actor();
  if p_status is not null and p_status not in ('active','all','draft','reserved','contracted','completed','cancelled') then
    raise exception using errcode='22023',message='invalid_status';
  end if;
  if p_brand is not null and p_brand not in ('BAAN_KUNAPAP','TARAVILLE') then
    raise exception using errcode='22023',message='invalid_brand';
  end if;
  select coalesce(jsonb_agg(x.value order by x.created_at desc,x.id),'[]') into v_result from (
    select c.id,c.created_at,jsonb_build_object('id',c.id,'code',c.code,'brand',c.brand,'status',c.status,'version',c.version,
      'customer_name',c.customer_snapshot->>'full_name','lead_id',c.lead_id,'responsible_id',c.responsible_id,
      'can_finance',private.sales_allowed('financial.view',c.id),
      'detail',case when private.sales_allowed('financial.view',c.id) then
        coalesce((select d.name || ' · ' || u.code from private.sales_units u join private.sales_developments d on d.id = u.development_id where u.id = c.unit_id),
                 (select p.code from public.projects p where p.id = c.project_id)) end) as value
    from private.sales_cases c
    where (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id))
      and (p_brand is null or c.brand::text = p_brand)
      and case coalesce(p_status,'active') when 'all' then true when 'active' then c.status::text in ('draft','reserved','contracted')
            else c.status::text = p_status end
      and (v_query = '' or position(v_query in lower(c.code)) > 0 or position(v_query in lower(coalesce(c.customer_snapshot->>'full_name',''))) > 0)
    order by c.created_at desc,c.id limit 100
  ) x;
  return v_result;
end $$;

create function public.sales_case_list(p_status text,p_brand text,p_query text) returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_case_list(p_status,p_brand,p_query) $$;
revoke all on function private.sales_case_list(text,text,text),public.sales_case_list(text,text,text) from public,anon,authenticated;
grant execute on function private.sales_case_list(text,text,text),public.sales_case_list(text,text,text) to authenticated;

commit;
