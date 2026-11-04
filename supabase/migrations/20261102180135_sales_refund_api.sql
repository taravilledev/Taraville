begin;

create function private.sales_request_refund(p_root_payment_id uuid,p_version bigint,p_amount_cents text,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payment private.sales_payments; v_case private.sales_cases; v_refund private.sales_refund_requests;
  v_amount bigint; v_totals jsonb; v_result jsonb;
  v_payload jsonb := jsonb_build_object('payment',p_root_payment_id,'version',p_version,'amount',p_amount_cents,'reason',p_reason);
begin
  select * into v_payment from private.sales_payments where coalesce(root_id,id)=p_root_payment_id and voided_at is null;
  v_case := private.sales_lock_case(v_payment.case_id,'refund.request');
  v_result := private.sales_replay('refund.request',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  v_amount := private.sales_money(p_amount_cents); v_totals := private.sales_payment_totals(p_root_payment_id);
  if v_amount is null or v_amount<=0 or length(btrim(coalesce(p_reason,''))) not between 1 and 3000
    or v_amount>(v_totals->>'paid_cents')::numeric-(v_totals->>'refunded_cents')::numeric-(v_totals->>'reserved_refund_cents')::numeric then
    raise exception using errcode='22023',message='refund_exceeds_available_money'; end if;
  insert into private.sales_refund_requests(case_id,root_payment_id,amount_cents,reason,requested_by)
    values(v_case.id,p_root_payment_id,v_amount,p_reason,auth.uid()) returning * into v_refund;
  v_result := private.sales_touch_case(v_case.id,'refund.request',jsonb_build_object('refund_id',v_refund.id)) || jsonb_build_object('refund_id',v_refund.id);
  return private.sales_remember('refund.request',p_request_id,v_payload,v_result);
end $$;

create function private.sales_decide_refund(p_refund_id uuid,p_version bigint,p_decision text,p_note text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_refund private.sales_refund_requests; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('refund',p_refund_id,'version',p_version,'decision',p_decision,'note',p_note);
begin
  select * into v_refund from private.sales_refund_requests where id=p_refund_id;
  v_case := private.sales_lock_case(v_refund.case_id,case when p_decision='withdrawn' then 'refund.request' else 'refund.approve' end);
  v_result := private.sales_replay('refund.decide',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_refund from private.sales_refund_requests where id=p_refund_id for update;
  if v_refund.state<>'pending' or p_decision is null or p_decision not in ('approved','rejected','withdrawn')
    or length(btrim(coalesce(p_note,''))) not between 1 and 3000 then raise exception using errcode='22023',message='invalid_refund_decision'; end if;
  if (p_decision='withdrawn' and v_refund.requested_by<>auth.uid())
    or (p_decision<>'withdrawn' and v_refund.requested_by=auth.uid()) then
    raise exception using errcode='42501',message='independent_refund_approval_required'; end if;
  update private.sales_refund_requests set state=p_decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note,version=version+1 where id=v_refund.id;
  v_result := private.sales_touch_case(v_case.id,'refund.decide',v_payload);
  return private.sales_remember('refund.decide',p_request_id,v_payload,v_result);
end $$;

create function private.sales_pay_refund(p_refund_id uuid,p_version bigint,p_method text,p_paid_date date,p_proof_path text,
  p_funds_confirmed boolean,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_refund private.sales_refund_requests; v_case private.sales_cases; v_totals jsonb; v_doc private.sales_documents;
  v_payout private.sales_payouts; v_alloc record; v_remaining bigint; v_release bigint; v_result jsonb;
  v_payload jsonb := jsonb_build_object('refund',p_refund_id,'version',p_version,'method',p_method,'date',p_paid_date,
    'proof',p_proof_path,'funds_confirmed',p_funds_confirmed);
begin
  select * into v_refund from private.sales_refund_requests where id=p_refund_id;
  v_case := private.sales_lock_case(v_refund.case_id,'refund.pay');
  v_result := private.sales_replay('refund.pay',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_refund from private.sales_refund_requests where id=p_refund_id for update;
  if v_refund.state<>'approved' or v_refund.decided_by=v_refund.requested_by
    or p_funds_confirmed is distinct from true or p_method is null or p_method not in ('cash','transfer','cheque')
    or p_paid_date is null or p_paid_date>(now() at time zone 'Asia/Bangkok')::date then
    raise exception using errcode='22023',message='approved_actual_refund_required'; end if;
  perform private.sales_check_evidence(v_case.id,p_proof_path,'refund');
  v_totals := private.sales_payment_totals(v_refund.root_payment_id);
  if v_refund.amount_cents>(v_totals->>'paid_cents')::numeric-(v_totals->>'refunded_cents')::numeric-(v_totals->>'credit_cents')::numeric then
    raise exception using errcode='22023',message='credit_amendment_required_before_refund'; end if;
  if (v_totals->>'reserved_refund_cents')::numeric>(v_totals->>'paid_cents')::numeric-(v_totals->>'refunded_cents')::numeric then
    raise exception using errcode='22023',message='refund_exceeds_available_money'; end if;
  v_doc := private.sales_new_document(v_case.id,'refund','issued',jsonb_build_object('refund_id',v_refund.id,
    'root_payment_id',v_refund.root_payment_id,'amount_cents',v_refund.amount_cents::text,'reason',v_refund.reason,
    'method',p_method,'paid_date',p_paid_date,'proof_path',p_proof_path,'requested_by',v_refund.requested_by,
    'approved_by',v_refund.decided_by,'approved_at',v_refund.decided_at),null,p_proof_path);
  insert into private.sales_payouts(case_id,refund_id,amount_cents,method,paid_date,proof_path,document_id,paid_by)
    values(v_case.id,v_refund.id,v_refund.amount_cents,p_method,p_paid_date,p_proof_path,v_doc.id,auth.uid()) returning * into v_payout;
  v_remaining := greatest(0,v_refund.amount_cents-(v_totals->>'free_cents')::bigint);
  for v_alloc in select invoice_id,sum(amount_cents)::bigint amount from private.sales_allocations
    where root_payment_id=v_refund.root_payment_id group by invoice_id having sum(amount_cents)>0 order by invoice_id loop
    exit when v_remaining=0; v_release := least(v_remaining,v_alloc.amount);
    insert into private.sales_allocations(case_id,root_payment_id,invoice_id,amount_cents,source_kind,source_id,actor_id)
      values(v_case.id,v_refund.root_payment_id,v_alloc.invoice_id,-v_release,'refund',v_payout.id,auth.uid());
    v_remaining := v_remaining-v_release;
  end loop;
  if v_remaining<>0 then raise exception using errcode='22023',message='refund_allocation_failed'; end if;
  update private.sales_refund_requests set state='paid',version=version+1 where id=v_refund.id;
  v_result := private.sales_touch_case(v_case.id,'refund.pay',jsonb_build_object('refund_id',v_refund.id,'document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('refund.pay',p_request_id,v_payload,v_result);
end $$;

create function private.sales_refund_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.sales_require('financial.view',p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'root_payment_id',r.root_payment_id,'amount_cents',r.amount_cents::text,
    'reason',r.reason,'state',r.state,'requested_by',r.requested_by,'requested_by_name',s.full_name,'requested_at',r.requested_at,
    'decided_by',r.decided_by,'decision_note',r.decision_note,'document_id',p.document_id)
    order by r.requested_at,r.id),'[]') into v_result from private.sales_refund_requests r join public.staff s on s.id=r.requested_by
    left join private.sales_payouts p on p.refund_id=r.id where r.case_id=p_case_id;
  return v_result;
end $$;

create function public.sales_request_refund(p_root_payment_id uuid,p_version bigint,p_amount_cents text,p_reason text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_request_refund(p_root_payment_id,p_version,p_amount_cents,p_reason,p_request_id) $$;
create function public.sales_decide_refund(p_refund_id uuid,p_version bigint,p_decision text,p_note text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_decide_refund(p_refund_id,p_version,p_decision,p_note,p_request_id) $$;
create function public.sales_pay_refund(p_refund_id uuid,p_version bigint,p_method text,p_paid_date date,p_proof_path text,p_funds_confirmed boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_pay_refund(p_refund_id,p_version,p_method,p_paid_date,p_proof_path,p_funds_confirmed,p_request_id) $$;
create function public.sales_refund_detail(p_case_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.sales_refund_detail(p_case_id) $$;
revoke all on function private.sales_request_refund(uuid,bigint,text,text,uuid),public.sales_request_refund(uuid,bigint,text,text,uuid),
  private.sales_decide_refund(uuid,bigint,text,text,uuid),public.sales_decide_refund(uuid,bigint,text,text,uuid),
  private.sales_pay_refund(uuid,bigint,text,date,text,boolean,uuid),public.sales_pay_refund(uuid,bigint,text,date,text,boolean,uuid),
  private.sales_refund_detail(uuid),public.sales_refund_detail(uuid) from public,anon,authenticated;
grant execute on function private.sales_request_refund(uuid,bigint,text,text,uuid),public.sales_request_refund(uuid,bigint,text,text,uuid),
  private.sales_decide_refund(uuid,bigint,text,text,uuid),public.sales_decide_refund(uuid,bigint,text,text,uuid),
  private.sales_pay_refund(uuid,bigint,text,date,text,boolean,uuid),public.sales_pay_refund(uuid,bigint,text,date,text,boolean,uuid),
  private.sales_refund_detail(uuid),public.sales_refund_detail(uuid) to authenticated;
commit;
