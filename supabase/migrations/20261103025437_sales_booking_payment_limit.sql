begin;
create or replace function private.sales_validate_payment(p_request private.sales_payment_requests) returns void
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_limit numeric; v_paid numeric; v_invoice jsonb;
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
end $$;
commit;
