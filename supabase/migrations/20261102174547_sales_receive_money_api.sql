begin;

create function private.sales_validate_payment(p_request private.sales_payment_requests) returns void
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
    v_limit := v_case.net_price_cents;
  end if;
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'paid_cents')::numeric
    -(private.sales_payment_totals(coalesce(root_id,id))->>'refunded_cents')::numeric),0) into v_paid
    from private.sales_payments where case_id=p_request.case_id and kind=p_request.kind and voided_at is null;
  if v_limit is null or v_paid+p_request.amount_cents > v_limit then
    raise exception using errcode='22023',message='payment_exceeds_agreed_total'; end if;
end $$;

create function private.sales_prepare_payment(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_row private.sales_payment_requests;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input); v_result jsonb;
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('payment.prepare',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or exists(select 1 from jsonb_object_keys(p_input) k
    where k not in ('kind','invoice_id','amount_cents','method','paid_date','payer_name','description','proof_path'))
    or jsonb_typeof(p_input->'amount_cents') is distinct from 'string' then
    raise exception using errcode='22023',message='invalid_payment'; end if;
  v_row.case_id := p_case_id; v_row.invoice_id := nullif(p_input->>'invoice_id','')::uuid;
  v_row.kind := p_input->>'kind'; v_row.amount_cents := private.sales_money(p_input->>'amount_cents');
  v_row.method := p_input->>'method'; v_row.paid_date := (p_input->>'paid_date')::date;
  v_row.payer_name := btrim(p_input->>'payer_name'); v_row.description := btrim(p_input->>'description');
  v_row.proof_path := nullif(p_input->>'proof_path','');
  perform private.sales_validate_payment(v_row);
  insert into private.sales_payment_requests(case_id,invoice_id,kind,amount_cents,method,paid_date,payer_name,description,proof_path,created_by)
    values(p_case_id,v_row.invoice_id,v_row.kind,v_row.amount_cents,v_row.method,v_row.paid_date,v_row.payer_name,
      v_row.description,v_row.proof_path,auth.uid()) returning * into v_row;
  v_result := private.sales_touch_case(p_case_id,'payment.prepare',jsonb_build_object('payment_request_id',v_row.id))
    || jsonb_build_object('payment_request_id',v_row.id);
  return private.sales_remember('payment.prepare',p_request_id,v_payload,v_result);
end $$;

create function private.sales_confirm_payment(p_payment_request_id uuid,p_version bigint,p_funds_confirmed boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request private.sales_payment_requests; v_payment private.sales_payments; v_doc private.sales_documents;
  v_case private.sales_cases; v_actor public.staff; v_result jsonb;
  v_payload jsonb := jsonb_build_object('payment_request',p_payment_request_id,'version',p_version,'funds_confirmed',p_funds_confirmed);
begin
  select * into v_request from private.sales_payment_requests where id=p_payment_request_id;
  v_case := private.sales_lock_case(v_request.case_id,'financial.confirm');
  v_actor := private.sales_require('receipt.issue',v_case.id);
  v_result := private.sales_replay('payment.confirm',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  select * into v_request from private.sales_payment_requests where id=p_payment_request_id for update;
  if v_request.state <> 'pending' then raise exception using errcode='PT409',message='payment_already_processed'; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if p_funds_confirmed is distinct from true then raise exception using errcode='22023',message='actual_funds_confirmation_required'; end if;
  perform private.sales_validate_payment(v_request);
  insert into private.sales_payments(case_id,request_id,kind,amount_cents,method,paid_date,payer_name,description,proof_path,confirmed_by)
  values(v_case.id,v_request.id,v_request.kind,v_request.amount_cents,v_request.method,v_request.paid_date,
    v_request.payer_name,v_request.description,v_request.proof_path,v_actor.id) returning * into v_payment;
  v_doc := private.sales_new_document(v_case.id,'receipt','issued',jsonb_build_object('payment_id',v_payment.id,
    'root_payment_id',v_payment.id,'kind',v_payment.kind,'amount_cents',v_payment.amount_cents::text,'method',v_payment.method,
    'paid_date',v_payment.paid_date,'payer_name',v_payment.payer_name,'description',v_payment.description,
    'proof_path',v_payment.proof_path,'confirmed_by_name',v_actor.full_name,'invoice_id',v_request.invoice_id));
  insert into private.sales_receipts(case_id,root_payment_id,payment_id,document_id) values(v_case.id,v_payment.id,v_payment.id,v_doc.id);
  if v_request.invoice_id is not null then
    insert into private.sales_allocations(case_id,root_payment_id,invoice_id,amount_cents,source_kind,source_id,actor_id)
    values(v_case.id,v_payment.id,v_request.invoice_id,v_payment.amount_cents,'confirmation',v_payment.id,v_actor.id);
  end if;
  update private.sales_payment_requests set state='confirmed',version=version+1 where id=v_request.id;
  v_result := private.sales_touch_case(v_case.id,'payment.confirm',jsonb_build_object('payment_id',v_payment.id,'document_id',v_doc.id))
    || jsonb_build_object('payment_id',v_payment.id,'document_id',v_doc.id,'number',v_doc.number);
  return private.sales_remember('payment.confirm',p_request_id,v_payload,v_result);
end $$;

create function public.sales_prepare_payment(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.sales_prepare_payment(p_case_id,p_version,p_input,p_request_id) $$;
create function public.sales_confirm_payment(p_payment_request_id uuid,p_version bigint,p_funds_confirmed boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sales_confirm_payment(p_payment_request_id,p_version,p_funds_confirmed,p_request_id) $$;
revoke all on function private.sales_validate_payment(private.sales_payment_requests),private.sales_prepare_payment(uuid,bigint,jsonb,uuid),
  private.sales_confirm_payment(uuid,bigint,boolean,uuid),public.sales_prepare_payment(uuid,bigint,jsonb,uuid),
  public.sales_confirm_payment(uuid,bigint,boolean,uuid) from public,anon,authenticated;
grant execute on function private.sales_prepare_payment(uuid,bigint,jsonb,uuid),private.sales_confirm_payment(uuid,bigint,boolean,uuid),
  public.sales_prepare_payment(uuid,bigint,jsonb,uuid),public.sales_confirm_payment(uuid,bigint,boolean,uuid) to authenticated;
commit;
