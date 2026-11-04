begin;

create function private.sales_confirm_reservation(p_case_id uuid,p_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('reservation.confirm',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'TARAVILLE' or v_case.status<>'draft' or v_case.net_price_cents is null
    or not exists(select 1 from public.leads where id=v_case.lead_id and closed_at is null) then
    raise exception using errcode='22023',message='reservation_unavailable';
  end if;
  perform 1 from private.sales_units u join private.sales_developments d on d.id=u.development_id
    where u.id=v_case.unit_id and u.is_active and d.is_active for share of u,d;
  if not found then raise exception using errcode='22023',message='active_unit_required'; end if;
  insert into private.sales_reservations(case_id,unit_id,confirmed_by) values(p_case_id,v_case.unit_id,auth.uid());
  update private.sales_cases set status='reserved' where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'reservation.confirm',jsonb_build_object('unit_id',v_case.unit_id));
  return private.sales_remember('reservation.confirm',p_request_id,v_payload,v_result);
end $$;

create function private.sales_release_reservation(p_case_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'reason',p_reason);
begin
  v_case := private.sales_lock_case(p_case_id,'contract.cancel');
  v_result := private.sales_replay('reservation.release',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'TARAVILLE' or v_case.status<>'cancelled' or length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='cancel_before_release';
  end if;
  update private.sales_reservations set released_at=now(),released_by=auth.uid(),release_reason=p_reason
    where case_id=p_case_id and released_at is null;
  if not found then raise exception using errcode='22023',message='active_reservation_required'; end if;
  v_result := private.sales_touch_case(p_case_id,'reservation.release',v_payload);
  return private.sales_remember('reservation.release',p_request_id,v_payload,v_result);
end $$;

create function public.sales_confirm_reservation(p_case_id uuid,p_version bigint,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_confirm_reservation(p_case_id,p_version,p_request_id) $$;
create function public.sales_release_reservation(p_case_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_release_reservation(p_case_id,p_version,p_reason,p_request_id) $$;
revoke all on function private.sales_confirm_reservation(uuid,bigint,uuid),public.sales_confirm_reservation(uuid,bigint,uuid),
  private.sales_release_reservation(uuid,bigint,text,uuid),public.sales_release_reservation(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_confirm_reservation(uuid,bigint,uuid),public.sales_confirm_reservation(uuid,bigint,uuid),
  private.sales_release_reservation(uuid,bigint,text,uuid),public.sales_release_reservation(uuid,bigint,text,uuid) to authenticated;
commit;
