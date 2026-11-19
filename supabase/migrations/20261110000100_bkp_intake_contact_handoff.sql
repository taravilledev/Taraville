-- Keep the construction site distinct from the customer address for new BKP cases.
create or replace function private.sales_create_case(p_lead_id uuid,p_project_id uuid,p_unit_id uuid,p_customer_id uuid,p_request_id uuid)
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
      v_lead.phone,case when v_lead.brand = 'BAAN_KUNAPAP' then '' else coalesce(v_lead.survey->>'address','') end,v_actor.id) returning * into v_customer;
  end if;
  select full_name into v_salesperson from public.staff where id = v_lead.owner_id;
  insert into private.sales_cases(code,brand,lead_id,project_id,unit_id,customer_id,responsible_id,customer_snapshot,details,list_price_cents,created_by)
  values(v_code,v_lead.brand,p_lead_id,p_project_id,p_unit_id,v_customer.id,v_lead.owner_id,
    jsonb_build_object('full_name',v_customer.full_name,'phone',v_customer.phone,'address',v_customer.address,
      'nickname',v_customer.nickname,'salesperson',v_salesperson),
    case when v_lead.brand = 'BAAN_KUNAPAP' then
      jsonb_strip_nulls(jsonb_build_object('site_address',nullif(btrim(v_lead.survey->>'address'),'')))
    else coalesce(v_unit.details,'{}') end,v_unit.list_price_cents,v_actor.id)
    returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action) values(v_case.id,v_actor.id,'case.create');
  return private.sales_remember('case.create',p_request_id,v_payload,
    jsonb_build_object('id',v_case.id,'code',v_case.code,'version',v_case.version));
end $$;

-- Validate new or changed BKP phone values without blocking unrelated updates to legacy rows.
create function private.walkin_check_bkp_phone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.phone is not distinct from new.phone and old.brand = new.brand then
    return new;
  end if;
  if new.brand = 'BAAN_KUNAPAP' and btrim(new.phone) !~ '^[+]?(?:[0-9][ .-]*){6,14}[0-9]$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  return new;
end $$;

revoke all on function private.walkin_check_bkp_phone() from public, anon, authenticated;
create trigger walkin_check_bkp_phone before insert or update of phone, brand on public.leads
for each row execute function private.walkin_check_bkp_phone();
