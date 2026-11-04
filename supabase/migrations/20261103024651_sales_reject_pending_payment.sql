begin;
create function private.sales_reject_pending_payment(p_payment_request_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_payment private.sales_payment_requests;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('payment_request_id',p_payment_request_id,'version',p_version,'reason',p_reason);
begin
  select * into v_payment from private.sales_payment_requests where id=p_payment_request_id;
  v_case := private.sales_lock_case(v_payment.case_id,'financial.prepare');
  v_result := private.sales_replay('payment.reject',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='payment_withdrawal_reason_required';
  end if;
  update private.sales_payment_requests set state='rejected',version=version+1 where id=p_payment_request_id and state='pending';
  if not found then raise exception using errcode='PT409',message='payment_not_pending'; end if;
  v_result := private.sales_touch_case(v_case.id,'payment.reject',v_payload);
  return private.sales_remember('payment.reject',p_request_id,v_payload,v_result);
end $$;
create function public.sales_reject_pending_payment(p_payment_request_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_reject_pending_payment(p_payment_request_id,p_version,p_reason,p_request_id)
$$;
revoke all on function private.sales_reject_pending_payment(uuid,bigint,text,uuid),public.sales_reject_pending_payment(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_reject_pending_payment(uuid,bigint,text,uuid),public.sales_reject_pending_payment(uuid,bigint,text,uuid) to authenticated;
commit;
