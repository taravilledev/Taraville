begin;
create function private.sales_save_development(p_id uuid,p_expected_version bigint,p_name text,p_address text,p_is_active boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.sales_developments; v_result jsonb;
  v_payload jsonb := jsonb_build_object('id',p_id,'version',p_expected_version,'name',p_name,'address',p_address,'active',p_is_active);
begin
  perform private.sales_require('catalog.manage');
  v_result := private.sales_replay('development.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_id is null then
    if p_expected_version is not null then raise exception using errcode='22023',message='invalid_version'; end if;
    insert into private.sales_developments(name,address,is_active,created_by)
      values(btrim(p_name),coalesce(p_address,''),p_is_active,auth.uid()) returning * into v_row;
  else
    select * into v_row from private.sales_developments where id = p_id for update;
    if not found then raise exception using errcode='22023',message='development_unavailable'; end if;
    if p_expected_version is distinct from v_row.version then raise exception using errcode='PT409',message='stale_development'; end if;
    update private.sales_developments set name = btrim(p_name),address = coalesce(p_address,''),is_active = p_is_active,version = version + 1
      where id = p_id returning * into v_row;
  end if;
  insert into private.sales_events(actor_id,action,detail) values(auth.uid(),'development.save',jsonb_build_object('id',v_row.id));
  return private.sales_remember('development.save',p_request_id,v_payload,jsonb_build_object('id',v_row.id,'version',v_row.version));
end $$;

create function private.sales_save_unit(p_id uuid,p_expected_version bigint,p_development_id uuid,p_code text,p_details jsonb,p_list_price_cents text,p_is_active boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.sales_units; v_result jsonb;
  v_payload jsonb := jsonb_build_object('id',p_id,'version',p_expected_version,'development',p_development_id,
    'code',p_code,'details',p_details,'price',p_list_price_cents,'active',p_is_active);
begin
  perform private.sales_require('catalog.manage');
  v_result := private.sales_replay('unit.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_id is null then
    if p_expected_version is not null then raise exception using errcode='22023',message='invalid_version'; end if;
    if not exists(select 1 from private.sales_developments where id = p_development_id and is_active) then
      raise exception using errcode='22023',message='development_unavailable';
    end if;
    insert into private.sales_units(development_id,code,details,list_price_cents,is_active,created_by)
      values(p_development_id,btrim(p_code),p_details,private.sales_money(p_list_price_cents),p_is_active,auth.uid()) returning * into v_row;
  else
    select * into v_row from private.sales_units where id = p_id for update;
    if not found then raise exception using errcode='22023',message='unit_unavailable'; end if;
    if p_expected_version is distinct from v_row.version then raise exception using errcode='PT409',message='stale_unit'; end if;
    if v_row.development_id is distinct from p_development_id then raise exception using errcode='22023',message='unit_development_immutable'; end if;
    update private.sales_units set code = btrim(p_code),details = p_details,list_price_cents = private.sales_money(p_list_price_cents),
      is_active = p_is_active,version = version + 1 where id = p_id returning * into v_row;
  end if;
  insert into private.sales_events(actor_id,action,detail) values(auth.uid(),'unit.save',jsonb_build_object('id',v_row.id));
  return private.sales_remember('unit.save',p_request_id,v_payload,jsonb_build_object('id',v_row.id,'version',v_row.version));
end $$;

create function public.sales_save_development(p_id uuid,p_expected_version bigint,p_name text,p_address text,p_is_active boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_save_development(p_id,p_expected_version,p_name,p_address,p_is_active,p_request_id)
$$;
create function public.sales_save_unit(p_id uuid,p_expected_version bigint,p_development_id uuid,p_code text,p_details jsonb,p_list_price_cents text,p_is_active boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_save_unit(p_id,p_expected_version,p_development_id,p_code,p_details,p_list_price_cents,p_is_active,p_request_id)
$$;
revoke all on function private.sales_save_development(uuid,bigint,text,text,boolean,uuid),public.sales_save_development(uuid,bigint,text,text,boolean,uuid),
  private.sales_save_unit(uuid,bigint,uuid,text,jsonb,text,boolean,uuid),public.sales_save_unit(uuid,bigint,uuid,text,jsonb,text,boolean,uuid) from public,anon,authenticated;
grant execute on function private.sales_save_development(uuid,bigint,text,text,boolean,uuid),public.sales_save_development(uuid,bigint,text,text,boolean,uuid),
  private.sales_save_unit(uuid,bigint,uuid,text,jsonb,text,boolean,uuid),public.sales_save_unit(uuid,bigint,uuid,text,jsonb,text,boolean,uuid) to authenticated;
commit;
