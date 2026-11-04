begin;
create function private.sales_change_reserved_unit(p_case_id uuid,p_version bigint,p_unit_id uuid,p_price_cents text,
  p_reason text,p_evidence_path text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_unit private.sales_units;
  v_price bigint;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'unit',p_unit_id,
    'price_cents',p_price_cents,'reason',p_reason,'evidence',p_evidence_path);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('reservation.change',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  v_price := private.sales_money(p_price_cents);
  if v_case.brand<>'TARAVILLE' or v_case.status<>'reserved' or p_unit_id is not distinct from v_case.unit_id
    or v_price is null or v_price<private.sales_case_money(p_case_id)
    or length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_unit_change';
  end if;
  perform private.sales_check_evidence(p_case_id,p_evidence_path,'agreement');
  select u.* into v_unit from private.sales_units u join private.sales_developments d on d.id=u.development_id
    where u.id=p_unit_id and u.is_active and d.is_active for share of u,d;
  if not found then raise exception using errcode='22023',message='active_unit_required'; end if;
  update private.sales_reservations set released_at=now(),released_by=auth.uid(),release_reason=p_reason
    where case_id=p_case_id and unit_id=v_case.unit_id and released_at is null;
  if not found then raise exception using errcode='22023',message='active_reservation_required'; end if;
  insert into private.sales_reservations(case_id,unit_id,confirmed_by) values(p_case_id,p_unit_id,auth.uid());
  update private.sales_cases set unit_id=p_unit_id,details=v_unit.details,list_price_cents=v_price,
    promotion_price_cents=null,discount_cents=0 where id=p_case_id;
  update private.sales_payment_requests set state='rejected',version=version+1
    where case_id=p_case_id and kind='booking' and state='pending';
  v_result := private.sales_touch_case(p_case_id,'reservation.change',v_payload ||
    jsonb_build_object('previous_unit',v_case.unit_id,'previous_price_cents',v_case.net_price_cents::text));
  return private.sales_remember('reservation.change',p_request_id,v_payload,v_result);
end $$;

create function private.sales_reservation_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_options jsonb := '[]';
begin
  perform private.sales_require('financial.view',p_case_id);
  select * into v_case from private.sales_cases where id=p_case_id and brand='TARAVILLE';
  if not found then return null; end if;
  if v_case.status='reserved' and private.sales_allowed('financial.prepare',p_case_id) then
    select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'label',d.name || ' · ' || u.code) order by d.name,u.code,u.id),'[]')
      into v_options from private.sales_units u join private.sales_developments d on d.id=u.development_id
      where u.is_active and d.is_active and not exists(select 1 from private.sales_reservations r where r.unit_id=u.id and r.released_at is null);
  end if;
  return jsonb_build_object('active',exists(select 1 from private.sales_reservations where case_id=p_case_id and released_at is null),
    'options',v_options);
end $$;
create function public.sales_change_reserved_unit(p_case_id uuid,p_version bigint,p_unit_id uuid,p_price_cents text,
  p_reason text,p_evidence_path text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_change_reserved_unit(p_case_id,p_version,p_unit_id,p_price_cents,p_reason,p_evidence_path,p_request_id)
$$;
create function public.sales_reservation_detail(p_case_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_reservation_detail(p_case_id)
$$;
revoke all on function private.sales_change_reserved_unit(uuid,bigint,uuid,text,text,text,uuid),public.sales_change_reserved_unit(uuid,bigint,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function private.sales_reservation_detail(uuid),public.sales_reservation_detail(uuid) from public,anon,authenticated;
grant execute on function private.sales_change_reserved_unit(uuid,bigint,uuid,text,text,text,uuid),public.sales_change_reserved_unit(uuid,bigint,uuid,text,text,text,uuid),
  private.sales_reservation_detail(uuid),public.sales_reservation_detail(uuid) to authenticated;
commit;
