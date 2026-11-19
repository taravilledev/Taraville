begin;

alter table private.sales_cases add column house_brief jsonb
  check (house_brief is null or (brand = 'BAAN_KUNAPAP' and jsonb_typeof(house_brief) = 'object'));

-- Copy only construction preferences. Uncollected fields are left unset.
create function private.sales_seed_house_brief(p_survey jsonb, p_details jsonb, p_design_area text)
returns jsonb language sql immutable set search_path = '' as $$
  with layout as (
    select value from jsonb_array_elements_text(
      case when jsonb_typeof(p_survey->'layout') = 'array' then p_survey->'layout' else '[]'::jsonb end
    ) as items(value)
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'model', coalesce(nullif(p_details->>'model',''), p_survey->>'house_type'),
    'stories', coalesce(nullif(p_details->>'stories',''), case
      when p_survey->>'house_type' like '%ชั้นเดียว' then '1'
      when p_survey->>'house_type' like '%2 ชั้น' then '2'
      when p_survey->>'house_type' like '%3 ชั้น' then '3' end),
    'bedrooms', coalesce(nullif(p_details->>'bedrooms',''), (select case when count(*)=1 then min(split_part(value,' ',1)) end from layout where value ~ '^[0-9]+ ห้องนอน$')),
    'bathrooms', coalesce(nullif(p_details->>'bathrooms',''), (select case when count(*)=1 then min(split_part(value,' ',1)) end from layout where value ~ '^[0-9]+ ห้องน้ำ$')),
    'layout', coalesce(nullif(p_details->>'layout',''), (select string_agg(value,' · ' order by value) from layout)),
    'usable_area', coalesce(nullif(p_design_area,''),nullif(p_details->>'usable_area','')),
    'budget', p_survey->>'budget_range',
    'payment_method', p_survey->>'payment_method'
  ))
$$;

create function private.sales_init_house_brief() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.house_brief := private.sales_seed_house_brief(
    (select l.survey from public.leads l where l.id = new.lead_id), new.details, null);
  return new;
end $$;

create trigger sales_init_house_brief before insert on private.sales_cases
for each row when (new.brand = 'BAAN_KUNAPAP' and new.house_brief is null)
execute function private.sales_init_house_brief();

update private.sales_cases c set house_brief = private.sales_seed_house_brief(
  l.survey, c.details, (select p.usable_area::text from private.sales_design_plans p where p.case_id = c.id))
from public.leads l
where l.id = c.lead_id and c.brand = 'BAAN_KUNAPAP' and c.house_brief is null;

create function private.sales_save_house_brief(p_case_id uuid, p_version bigint, p_brief jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_case private.sales_cases;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'brief',p_brief);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('house_brief.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then
    raise exception using errcode='PT409',message='stale_case';
  end if;
  if v_case.brand <> 'BAAN_KUNAPAP' or v_case.status = 'cancelled' then
    raise exception using errcode='22023',message='invalid_house_brief_case';
  end if;
  if jsonb_typeof(p_brief) is distinct from 'object' or octet_length(p_brief::text) > 12000 then
    raise exception using errcode='22023',message='invalid_house_brief';
  end if;
  if exists(select 1 from jsonb_each(p_brief) field where
    field.key not in ('model','stories','bedrooms','living_rooms','bathrooms','kitchens','roof','usable_area','budget','payment_method','layout')
    or jsonb_typeof(field.value) <> 'string'
    or length(field.value #>> '{}') > case when field.key = 'layout' then 1000 else 200 end
    or (field.key in ('stories','bedrooms','living_rooms','bathrooms','kitchens') and field.value #>> '{}' !~ '^[0-9]{0,3}$')
    or (field.key = 'usable_area' and field.value #>> '{}' !~ '^([0-9]{1,9}(\.[0-9]{1,3})?)?$')
    or (field.key = 'payment_method' and field.value #>> '{}' not in ('','เงินสด','สินเชื่อธนาคาร'))
  ) then raise exception using errcode='22023',message='invalid_house_brief'; end if;
  update private.sales_cases set house_brief = p_brief where id = p_case_id;
  v_result := private.sales_touch_case(p_case_id,'house_brief.save');
  return private.sales_remember('house_brief.save',p_request_id,v_payload,v_result);
end $$;

create function public.sales_save_house_brief(p_case_id uuid, p_version bigint, p_brief jsonb, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_save_house_brief(p_case_id,p_version,p_brief,p_request_id)
$$;

revoke all on function private.sales_seed_house_brief(jsonb,jsonb,text), private.sales_init_house_brief(),
  private.sales_save_house_brief(uuid,bigint,jsonb,uuid), public.sales_save_house_brief(uuid,bigint,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function private.sales_save_house_brief(uuid,bigint,jsonb,uuid),
  public.sales_save_house_brief(uuid,bigint,jsonb,uuid) to authenticated;

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
    v_result := v_result || jsonb_build_object('customer_snapshot',v_case.customer_snapshot,'details',v_case.details,'house_brief',v_case.house_brief,
      'list_price_cents',v_case.list_price_cents::text,'promotion_price_cents',v_case.promotion_price_cents::text,
      'discount_cents',v_case.discount_cents::text,'net_price_cents',v_case.net_price_cents::text,
      'unit_label',(select d.name || ' · ' || u.code from private.sales_units u join private.sales_developments d on d.id = u.development_id where u.id = v_case.unit_id));
  end if;
  return v_result;
end $$;

commit;
