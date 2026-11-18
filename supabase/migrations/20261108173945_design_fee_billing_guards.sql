begin;

-- Keep the original validator identity so all existing payment callers use these guards.
create or replace function private.sales_validate_payment(p_request private.sales_payment_requests) returns void
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_limit numeric; v_paid numeric; v_invoice jsonb; v_bill private.sales_design_invoices;
begin
  select * into v_case from private.sales_cases where id=p_request.case_id;
  if p_request.amount_cents is null or p_request.amount_cents <= 0 or p_request.paid_date is null
    or p_request.paid_date > (now() at time zone 'Asia/Bangkok')::date
    or p_request.kind is null or p_request.kind not in ('design_fee','booking','instalment','unallocated')
    or p_request.method is null or p_request.method not in ('cash','transfer','cheque')
    or length(btrim(coalesce(p_request.payer_name,''))) not between 1 and 300
    or length(btrim(coalesce(p_request.description,''))) not between 1 and 1000
    or (p_request.kind='instalment') is distinct from (p_request.invoice_id is not null) then
    raise exception using errcode='22023',message='invalid_payment';
  end if;
  if p_request.proof_path is not null or p_request.method <> 'cash' then
    perform private.sales_check_evidence(p_request.case_id,p_request.proof_path,'payment');
  end if;
  if p_request.kind='unallocated' then return; end if;
  if v_case.status='cancelled' then raise exception using errcode='22023',message='case_cancelled'; end if;
  if p_request.kind='instalment' then
    if not exists(select 1 from private.sales_invoices where id=p_request.invoice_id and case_id=p_request.case_id) then
      raise exception using errcode='22023',message='invoice_unavailable'; end if;
    v_invoice := private.sales_invoice_totals(p_request.invoice_id);
    if not (v_invoice->>'is_active')::boolean or p_request.amount_cents > (v_invoice->>'outstanding_cents')::numeric then
      raise exception using errcode='22023',message='payment_exceeds_outstanding'; end if;
    return;
  end if;
  if p_request.kind='design_fee' then
    if v_case.brand <> 'BAAN_KUNAPAP' or exists(select 1 from private.sales_documents
      where case_id=p_request.case_id and kind='contract' and state='signed') then
      raise exception using errcode='22023',message='design_payment_unavailable'; end if;
    select total_cents into v_limit from private.sales_design_plans where case_id=p_request.case_id;
  else
    if v_case.brand <> 'TARAVILLE' or not exists(select 1 from private.sales_reservations
      where case_id=p_request.case_id and released_at is null) then
      raise exception using errcode='22023',message='confirmed_reservation_required'; end if;
    select (s.payload->>'booking_cents')::bigint into v_limit
      from private.sales_documents s join private.sales_units u on u.id=v_case.unit_id
      join private.sales_developments d on d.id=u.development_id
      where s.case_id=v_case.id and s.kind='summary' and s.state='issued'
        and s.payload->>'plot'=u.code and s.payload->>'development'=d.name
        and s.payload->>'total_cents'=v_case.net_price_cents::text
        and not exists(select 1 from private.sales_events e where e.case_id=v_case.id
          and e.action='reservation.change' and e.created_at>=s.created_at)
      order by s.revision desc limit 1;
  end if;
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'paid_cents')::numeric
    -(private.sales_payment_totals(coalesce(root_id,id))->>'refunded_cents')::numeric),0) into v_paid
    from private.sales_payments where case_id=p_request.case_id and kind=p_request.kind and voided_at is null;
  if v_limit is null or v_paid+p_request.amount_cents > v_limit then
    raise exception using errcode='22023',message='payment_exceeds_agreed_total'; end if;
  if p_request.kind<>'design_fee' then return; end if;
  if p_request.design_invoice_id is null then
    -- Persisted legacy requests may still finish; new direct preparation has no stored id.
    if p_request.id is not null and exists(select 1 from private.sales_payment_requests
      where id=p_request.id and case_id=p_request.case_id and kind='design_fee' and design_invoice_id is null) then return; end if;
    raise exception using errcode='22023',message='design_invoice_required';
  end if;
  select * into v_bill from private.sales_design_invoices where id=p_request.design_invoice_id and case_id=p_request.case_id;
  if not found or v_bill.cancelled_at is not null or not exists(select 1 from private.sales_documents where id=v_bill.document_id and state='issued') then
    raise exception using errcode='22023',message='design_invoice_unavailable'; end if;
  if p_request.amount_cents is distinct from v_bill.amount_cents then raise exception using errcode='22023',message='design_bill_full_amount_required'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=v_bill.id and state='pending' and id is distinct from p_request.id) then
    raise exception using errcode='PT409',message='design_payment_pending'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=v_bill.id and state='confirmed') then
    raise exception using errcode='PT409',message='design_invoice_already_paid'; end if;
end $$;

alter function private.sales_save_design_plan(uuid,bigint,jsonb,uuid) rename to sales_save_design_plan_before_billing;
create function private.sales_save_design_plan(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('design.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if exists(select 1 from private.sales_design_invoices where case_id=p_case_id and cancelled_at is null)
    or exists(select 1 from private.sales_payment_requests where case_id=p_case_id and kind='design_fee' and state='pending') then
    raise exception using errcode='22023',message='design_billing_locked'; end if;
  return private.sales_save_design_plan_before_billing(p_case_id,p_version,p_input,p_request_id);
end $$;
revoke all on function private.sales_save_design_plan_before_billing(uuid,bigint,jsonb,uuid),private.sales_save_design_plan(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sales_save_design_plan(uuid,bigint,jsonb,uuid) to authenticated;

alter function private.sales_correct_payment(uuid,bigint,text,text,text,uuid) rename to sales_correct_payment_before_design_billing;
create function private.sales_correct_payment(p_document_id uuid,p_version bigint,p_amount_cents text,p_reason text,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt private.sales_receipts; v_result jsonb;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'amount',p_amount_cents,'reason',p_reason,'evidence',p_evidence_path);
begin
  select * into v_receipt from private.sales_receipts where document_id=p_document_id;
  perform private.sales_lock_case(v_receipt.case_id,'financial.confirm');
  perform private.sales_require('receipt.cancel',v_receipt.case_id);
  perform private.sales_require('receipt.issue',v_receipt.case_id);
  v_result := private.sales_replay('payment.correct',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if exists(select 1 from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
    where p.id=v_receipt.payment_id and r.design_invoice_id is not null) then
    raise exception using errcode='22023',message='design_bill_amount_locked'; end if;
  return private.sales_correct_payment_before_design_billing(p_document_id,p_version,p_amount_cents,p_reason,p_evidence_path,p_request_id);
end $$;
revoke all on function private.sales_correct_payment_before_design_billing(uuid,bigint,text,text,text,uuid),private.sales_correct_payment(uuid,bigint,text,text,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_correct_payment(uuid,bigint,text,text,text,uuid) to authenticated;

alter function private.sales_financial_detail(uuid) rename to sales_financial_detail_before_design_billing;
create function private.sales_financial_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_bills jsonb; v_legacy numeric; v_has_legacy boolean;
begin
  v_result := private.sales_financial_detail_before_design_billing(p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'position',b.position,'label',b.label,'amount_cents',b.amount_cents::text,
    'due_date',b.due_date,'document_id',b.document_id,'state',case when b.cancelled_at is null then 'issued' else 'cancelled' end,
    'pending_id',(select r.id from private.sales_payment_requests r where r.design_invoice_id=b.id and r.state='pending'),
    'pending_cents',coalesce((select r.amount_cents::text from private.sales_payment_requests r where r.design_invoice_id=b.id and r.state='pending'),'0'),
    'has_confirmed_payment',exists(select 1 from private.sales_payment_requests r where r.design_invoice_id=b.id and r.state='confirmed'),
    'receipt_document_id',(select rec.document_id from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id
      join private.sales_receipts rec on rec.root_payment_id=coalesce(p.root_id,p.id) where r.design_invoice_id=b.id and rec.is_active
      order by rec.id desc limit 1),
    'received_cents',coalesce((select sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric)::text
      from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id where r.design_invoice_id=b.id and p.voided_at is null),'0'))
    order by b.created_at,b.id),'[]'::jsonb) into v_bills from private.sales_design_invoices b where b.case_id=p_case_id;
  select coalesce(sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric),0)
    into v_legacy from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
    where p.case_id=p_case_id and p.kind='design_fee' and r.design_invoice_id is null and p.voided_at is null;
  select exists(select 1 from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
    where p.case_id=p_case_id and p.kind='design_fee' and r.design_invoice_id is null) into v_has_legacy;
  return v_result || jsonb_build_object('design_bills',v_bills,'design_legacy_received_cents',v_legacy::text,'design_legacy_has_payments',v_has_legacy,
    'can_change_design',(v_result->>'can_change_design')::boolean
      and not exists(select 1 from private.sales_design_invoices where case_id=p_case_id and cancelled_at is null)
      and not exists(select 1 from private.sales_payment_requests where case_id=p_case_id and kind='design_fee' and state='pending'));
end $$;
revoke all on function private.sales_financial_detail_before_design_billing(uuid),private.sales_financial_detail(uuid) from public,anon,authenticated;
grant execute on function private.sales_financial_detail(uuid) to authenticated;

create or replace function public.sales_save_design_plan(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_save_design_plan(p_case_id,p_version,p_input,p_request_id) $$;
create or replace function public.sales_correct_payment(p_document_id uuid,p_version bigint,p_amount_cents text,p_reason text,p_evidence_path text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_correct_payment(p_document_id,p_version,p_amount_cents,p_reason,p_evidence_path,p_request_id) $$;
create or replace function public.sales_financial_detail(p_case_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_financial_detail(p_case_id) $$;

notify pgrst,'reload schema';
commit;
