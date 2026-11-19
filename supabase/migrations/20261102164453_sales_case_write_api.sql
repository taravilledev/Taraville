begin;
create function private.sales_money(p_value text) returns bigint
language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null then return null; end if;
  if p_value !~ '^[0-9]{1,19}$' then raise exception using errcode='22023',message='invalid_money'; end if;
  return p_value::bigint;
end $$;

create function private.sales_save_case(p_case_id uuid,p_expected_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_expected_version,'input',p_input);
  v_snapshot jsonb := p_input->'customer_snapshot'; v_list bigint; v_promotion bigint; v_discount bigint;
begin
  perform private.sales_require('financial.view',p_case_id);
  perform private.sales_require('financial.prepare',p_case_id);
  select * into v_case from private.sales_cases where id = p_case_id for update;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  v_result := private.sales_replay('case.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_expected_version is distinct from v_case.version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.status not in ('draft','reserved') then raise exception using errcode='22023',message='signed_amendment_required'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 200000
    or not p_input ?& array['list_price_cents','promotion_price_cents','discount_cents','details','customer_snapshot']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in
      ('list_price_cents','promotion_price_cents','discount_cents','details','customer_snapshot'))
    or jsonb_typeof(p_input->'details') is distinct from 'object'
    or jsonb_typeof(v_snapshot) is distinct from 'object' then
    raise exception using errcode='22023',message='invalid_case_input';
  end if;
  if exists(select 1 from jsonb_each(v_snapshot) x where x.key not in ('full_name','phone','address','nickname','salesperson')
      or jsonb_typeof(x.value) <> 'string')
    or length(btrim(coalesce(v_snapshot->>'full_name',''))) not between 1 and 200
    or length(coalesce(v_snapshot->>'phone','')) > 80 or length(coalesce(v_snapshot->>'address','')) > 2000
    or length(coalesce(v_snapshot->>'nickname','')) > 200 or length(coalesce(v_snapshot->>'salesperson','')) > 200 then
    raise exception using errcode='22023',message='invalid_customer_snapshot';
  end if;
  v_list := private.sales_money(p_input->>'list_price_cents');
  v_promotion := private.sales_money(p_input->>'promotion_price_cents');
  v_discount := coalesce(private.sales_money(p_input->>'discount_cents'),0);
  if v_discount > coalesce(v_promotion,v_list) then raise exception using errcode='22023',message='discount_exceeds_price'; end if;
  update private.sales_cases set customer_snapshot = v_snapshot,details = p_input->'details',
    list_price_cents = v_list,promotion_price_cents = v_promotion,discount_cents = v_discount,
    version = version + 1,updated_at = now() where id = p_case_id returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action,detail) values(p_case_id,auth.uid(),'case.save',jsonb_build_object('version',v_case.version));
  return private.sales_remember('case.save',p_request_id,v_payload,jsonb_build_object('id',v_case.id,'version',v_case.version));
end $$;

create function private.sales_assign_case(p_case_id uuid,p_expected_version bigint,p_responsible_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff := private.sales_actor(); v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_expected_version,'responsible',p_responsible_id);
begin
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  select * into v_case from private.sales_cases where id = p_case_id for update;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  v_result := private.sales_replay('case.assign',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_expected_version is distinct from v_case.version then raise exception using errcode='PT409',message='stale_case'; end if;
  if not exists(select 1 from public.staff where id = p_responsible_id and is_active) then
    raise exception using errcode='22023',message='active_responsible_required';
  end if;
  update private.sales_cases set responsible_id = p_responsible_id,version = version + 1,updated_at = now()
    where id = p_case_id returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action,detail)
    values(p_case_id,v_actor.id,'case.assign',jsonb_build_object('responsible_id',p_responsible_id));
  return private.sales_remember('case.assign',p_request_id,v_payload,jsonb_build_object('id',p_case_id,'version',v_case.version));
end $$;

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
      'discount_cents',v_case.discount_cents::text,'net_price_cents',v_case.net_price_cents::text);
  end if;
  return v_result;
end $$;

create function public.sales_save_case(p_case_id uuid,p_expected_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_save_case(p_case_id,p_expected_version,p_input,p_request_id) $$;
create function public.sales_assign_case(p_case_id uuid,p_expected_version bigint,p_responsible_id uuid,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_assign_case(p_case_id,p_expected_version,p_responsible_id,p_request_id) $$;
revoke all on function private.sales_money(text) from public,anon,authenticated;
revoke all on function private.sales_save_case(uuid,bigint,jsonb,uuid),private.sales_assign_case(uuid,bigint,uuid,uuid),
  public.sales_save_case(uuid,bigint,jsonb,uuid),public.sales_assign_case(uuid,bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function private.sales_save_case(uuid,bigint,jsonb,uuid),private.sales_assign_case(uuid,bigint,uuid,uuid),
  public.sales_save_case(uuid,bigint,jsonb,uuid),public.sales_assign_case(uuid,bigint,uuid,uuid) to authenticated;
commit;
