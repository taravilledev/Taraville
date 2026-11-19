begin;

-- Same signature as before, so CREATE OR REPLACE is safe (no overload).
-- Rows are visible to anyone who can read the Lead. A reader who cannot open the case gets
-- status and code only: id is null (no link), and no amount or Plot is ever returned here.
create or replace function private.sales_cases_for_lead(p_lead_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_cases jsonb; v_can_create boolean; v_lead public.leads;
begin
  perform private.sales_actor();
  select * into v_lead from public.leads where id=p_lead_id;
  if not found then return jsonb_build_object('cases','[]'::jsonb,'can_create',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',case when s.can_open then s.id end,'code',s.code,'status',s.status,'brand',s.brand,'project_id',s.project_id,
      'can_open',s.can_open,'can_finance',s.can_finance) order by s.created_at desc,s.id),'[]')
    into v_cases
    from (select c.*, private.sales_allowed('financial.view',c.id) as can_finance,
            private.sales_allowed('financial.view',c.id) or private.sales_allowed('case.view',c.id) as can_open
          from private.sales_cases c where c.lead_id=p_lead_id) s;
  -- sales_cases.project_id is unique and cancelled cases keep it, so a Project with any case cannot start another.
  v_can_create := v_lead.closed_at is null and private.sales_allowed('case.create',null,p_lead_id)
    and (v_lead.brand='TARAVILLE' or exists(select 1 from public.projects p where p.lead_id=p_lead_id and p.status='active'
      and not exists(select 1 from private.sales_cases c where c.project_id=p.id)));
  return jsonb_build_object('cases',v_cases,'can_create',v_can_create);
end $$;

-- The private function reads past RLS; the invoker wrapper limits it to Leads the caller can read.
create or replace function public.sales_cases_for_lead(p_lead_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select case when exists(select 1 from public.leads where id=p_lead_id) then private.sales_cases_for_lead(p_lead_id)
    else jsonb_build_object('cases','[]'::jsonb,'can_create',false) end $$;

-- One call per Lead list page. Per Lead with open work: count, latest status, and the Plot code
-- only when there is exactly one case and the caller has financial access to it. No amounts.
create function private.sales_lead_tags(p_lead_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.sales_actor();
  return coalesce((select jsonb_object_agg(t.lead_id,t.tag) from (
    select s.lead_id, jsonb_build_object('count',count(*),'status',(array_agg(s.status order by s.created_at desc,s.id))[1],
        'plot_code',case when count(*)=1 then max(case when s.can_finance then u.code end) end) as tag
      from (select c.*, private.sales_allowed('financial.view',c.id) as can_finance from private.sales_cases c
            where c.lead_id=any(p_lead_ids) and c.status<>'cancelled') s
      left join private.sales_units u on u.id=s.unit_id
      group by s.lead_id) t),'{}'::jsonb);
end $$;

create function public.sales_lead_tags(p_lead_ids uuid[]) returns jsonb
language sql security invoker set search_path='' as $$
  select private.sales_lead_tags(array(select id from public.leads where id=any(p_lead_ids) limit 200)) $$;

revoke all on function private.sales_lead_tags(uuid[]),public.sales_lead_tags(uuid[]) from public,anon,authenticated;
grant execute on function private.sales_lead_tags(uuid[]),public.sales_lead_tags(uuid[]) to authenticated;

commit;
