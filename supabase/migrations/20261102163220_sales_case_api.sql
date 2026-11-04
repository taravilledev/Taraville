begin;

create function private.sales_create_case(p_lead_id uuid,p_project_id uuid,p_unit_id uuid,p_customer_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.sales_actor(); v_lead public.leads; v_project public.projects;
  v_customer private.sales_customers; v_unit private.sales_units; v_case private.sales_cases;
  v_payload jsonb := jsonb_build_object('lead',p_lead_id,'project',p_project_id,'unit',p_unit_id,'customer',p_customer_id);
  v_result jsonb; v_code text; v_salesperson text;
begin
  perform private.sales_require('case.create',null,p_lead_id);
  v_result := private.sales_replay('case.create',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  select * into v_lead from public.leads where id = p_lead_id for share;
  if not found or v_lead.closed_at is not null then raise exception using errcode='22023',message='lead_unavailable'; end if;
  if v_lead.brand = 'BAAN_KUNAPAP' then
    if p_unit_id is not null then raise exception using errcode='22023',message='invalid_case_reference'; end if;
    select * into v_project from public.projects where id = p_project_id and lead_id = p_lead_id and status = 'active' for share;
    if not found then raise exception using errcode='22023',message='active_project_required'; end if;
    v_code := v_project.code;
  else
    if p_project_id is not null then raise exception using errcode='22023',message='invalid_case_reference'; end if;
    select u.* into v_unit from private.sales_units u join private.sales_developments d on d.id = u.development_id
      where u.id = p_unit_id and u.is_active and d.is_active for share of u,d;
    if not found then raise exception using errcode='22023',message='active_unit_required'; end if;
    v_code := private.sales_number(v_lead.brand,'S');
  end if;
  if p_customer_id is not null then
    select cu.* into v_customer from private.sales_customers cu where cu.id = p_customer_id and cu.brand = v_lead.brand
      and (v_actor.role = 'executive' or cu.created_by = v_actor.id or exists (
        select 1 from private.sales_cases c where c.customer_id = cu.id
        and (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id))
      ));
    if not found then raise exception using errcode='42501',message='customer_unavailable'; end if;
  else
    insert into private.sales_customers(brand,full_name,phone,address,created_by)
    values(v_lead.brand,btrim(concat_ws(' ',nullif(v_lead.name_title,''),v_lead.first_name,nullif(v_lead.last_name,''))),
      v_lead.phone,coalesce(v_lead.survey->>'address',''),v_actor.id) returning * into v_customer;
  end if;
  select full_name into v_salesperson from public.staff where id = v_lead.owner_id;
  insert into private.sales_cases(code,brand,lead_id,project_id,unit_id,customer_id,responsible_id,customer_snapshot,details,list_price_cents,created_by)
  values(v_code,v_lead.brand,p_lead_id,p_project_id,p_unit_id,v_customer.id,v_lead.owner_id,
    jsonb_build_object('full_name',v_customer.full_name,'phone',v_customer.phone,'address',v_customer.address,
      'nickname',v_customer.nickname,'salesperson',v_salesperson),coalesce(v_unit.details,'{}'),v_unit.list_price_cents,v_actor.id)
    returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action) values(v_case.id,v_actor.id,'case.create');
  return private.sales_remember('case.create',p_request_id,v_payload,
    jsonb_build_object('id',v_case.id,'code',v_case.code,'version',v_case.version));
end $$;

create function private.sales_case_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_result jsonb; v_finance boolean;
begin
  perform private.sales_actor();
  v_finance := private.sales_allowed('financial.view',p_case_id);
  if not (v_finance or private.sales_allowed('case.view',p_case_id)) then
    raise exception using errcode='42501',message='sales_permission_denied';
  end if;
  select * into v_case from private.sales_cases where id = p_case_id;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  v_result := jsonb_build_object('id',v_case.id,'code',v_case.code,'brand',v_case.brand,'lead_id',v_case.lead_id,
    'project_id',v_case.project_id,'unit_id',v_case.unit_id,'customer_id',v_case.customer_id,
    'responsible_id',v_case.responsible_id,'status',v_case.status,'version',v_case.version,
    'customer_name',v_case.customer_snapshot->>'full_name','can_finance',v_finance,
    'can_edit',private.sales_allowed('case.edit',p_case_id));
  if v_finance then
    v_result := v_result || jsonb_build_object('customer_snapshot',v_case.customer_snapshot,'details',v_case.details,
      'list_price_cents',v_case.list_price_cents::text,'promotion_price_cents',v_case.promotion_price_cents::text,
      'discount_cents',v_case.discount_cents::text,'net_price_cents',v_case.net_price_cents::text);
  end if;
  return v_result;
end $$;

create function private.sales_bootstrap() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff := private.sales_actor(); v_cases jsonb; v_leads jsonb; v_customers jsonb;
  v_staff jsonb := '[]'; v_catalog jsonb := '[]'; v_can_create boolean;
begin
  select coalesce(jsonb_agg(x.value order by x.created_at desc),'[]') into v_cases from (
    select jsonb_build_object('id',c.id,'code',c.code,'brand',c.brand,'status',c.status,'version',c.version,
      'customer_name',c.customer_snapshot->>'full_name','lead_id',c.lead_id,
      'responsible_id',c.responsible_id,'can_finance',private.sales_allowed('financial.view',c.id)) as value,c.created_at
    from private.sales_cases c where private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id)
    order by c.created_at desc,c.id limit 100
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'brand',l.brand,'full_name',concat_ws(' ',l.first_name,l.last_name),
    'owner_id',l.owner_id,'project_id',p.id,'project_code',p.code) order by l.created_at desc),'[]') into v_leads
    from public.leads l left join public.projects p on p.lead_id = l.id and p.status = 'active'
    where l.closed_at is null and private.sales_allowed('case.create',null,l.id);
  v_can_create := jsonb_array_length(v_leads) > 0;
  select coalesce(jsonb_agg(jsonb_build_object('id',cu.id,'brand',cu.brand,'full_name',cu.full_name,'phone',cu.phone) order by cu.full_name),'[]')
    into v_customers from private.sales_customers cu where v_actor.role = 'executive' or cu.created_by = v_actor.id or exists (
      select 1 from private.sales_cases c where c.customer_id = cu.id
      and (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id))
    );
  if v_can_create or private.sales_allowed('catalog.manage') then
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'address',d.address,'is_active',d.is_active,'version',d.version,
      'units',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'code',u.code,'details',u.details,
        'list_price_cents',u.list_price_cents::text,'is_active',u.is_active,'version',u.version,
        'is_available',not exists(select 1 from private.sales_reservations r where r.unit_id = u.id and r.released_at is null)) order by u.code)
        from private.sales_units u where u.development_id = d.id),'[]')) order by d.name),'[]') into v_catalog from private.sales_developments d;
  end if;
  if v_actor.role = 'executive' then
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'full_name',s.full_name,'role',s.role,'is_active',s.is_active,
      'capabilities',coalesce((select jsonb_agg(jsonb_build_object('action',g.action,'enabled',g.enabled,'scope',g.scope) order by g.action)
      from private.sales_capabilities g where g.staff_id = s.id),'[]')) order by s.full_name),'[]') into v_staff from public.staff s;
  end if;
  return jsonb_build_object('actor',jsonb_build_object('id',v_actor.id,'full_name',v_actor.full_name,'role',v_actor.role),
    'cases',v_cases,'leads',v_leads,'customers',v_customers,'developments',v_catalog,'staff',v_staff,
    'can_catalog',private.sales_allowed('catalog.manage'),'can_admin',v_actor.role = 'executive');
end $$;

create function private.sales_set_capability(p_staff_id uuid,p_action text,p_scope text,p_enabled boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff; v_payload jsonb := jsonb_build_object('staff',p_staff_id,'action',p_action,'scope',p_scope,'enabled',p_enabled);
  v_result jsonb;
begin
  perform 1 from public.staff where id in (auth.uid(),p_staff_id) order by id for update;
  v_actor := private.sales_actor();
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  if not exists(select 1 from public.staff where id = p_staff_id and is_active) then
    raise exception using errcode='22023',message='active_staff_required';
  end if;
  v_result := private.sales_replay('capability.set',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  insert into private.sales_capabilities(staff_id,action,enabled,scope,changed_by)
    values(p_staff_id,p_action,p_enabled,p_scope,v_actor.id)
    on conflict(staff_id,action) do update set enabled = excluded.enabled,scope = excluded.scope,changed_by = excluded.changed_by,changed_at = now();
  insert into private.sales_events(actor_id,action,detail) values(v_actor.id,'capability.set',v_payload);
  return private.sales_remember('capability.set',p_request_id,v_payload,jsonb_build_object('ok',true));
end $$;

create function public.sales_create_case(p_lead_id uuid,p_project_id uuid,p_unit_id uuid,p_customer_id uuid,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_create_case(p_lead_id,p_project_id,p_unit_id,p_customer_id,p_request_id)
$$;
create function public.sales_case_detail(p_case_id uuid) returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_case_detail(p_case_id)
$$;
create function public.sales_bootstrap() returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_bootstrap() $$;
create function public.sales_set_capability(p_staff_id uuid,p_action text,p_scope text,p_enabled boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_set_capability(p_staff_id,p_action,p_scope,p_enabled,p_request_id)
$$;
revoke all on function private.sales_create_case(uuid,uuid,uuid,uuid,uuid),private.sales_case_detail(uuid),private.sales_bootstrap(),
  private.sales_set_capability(uuid,text,text,boolean,uuid),public.sales_create_case(uuid,uuid,uuid,uuid,uuid),
  public.sales_case_detail(uuid),public.sales_bootstrap(),public.sales_set_capability(uuid,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function private.sales_create_case(uuid,uuid,uuid,uuid,uuid),private.sales_case_detail(uuid),private.sales_bootstrap(),
  private.sales_set_capability(uuid,text,text,boolean,uuid),public.sales_create_case(uuid,uuid,uuid,uuid,uuid),
  public.sales_case_detail(uuid),public.sales_bootstrap(),public.sales_set_capability(uuid,text,text,boolean,uuid) to authenticated;
commit;
