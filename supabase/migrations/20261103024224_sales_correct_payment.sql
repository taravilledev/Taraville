begin;
create or replace function private.sales_booking_before_contract() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='booking' and to_jsonb(new)->>'supersedes_id' is null
    and (to_jsonb(new)->>'state') is distinct from 'confirmed'
    and not exists(select 1 from private.sales_cases where id=new.case_id and status='reserved') then
    raise exception using errcode='22023',message='booking_payment_requires_unsigned_reservation';
  end if;
  return new;
end $$;

create function private.sales_correct_payment(p_document_id uuid,p_version bigint,p_amount_cents text,p_reason text,
  p_evidence_path text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_receipt private.sales_receipts;
  v_case private.sales_cases;
  v_payment private.sales_payments;
  v_new private.sales_payments;
  v_request private.sales_payment_requests;
  v_doc private.sales_documents;
  v_old_doc private.sales_documents;
  v_root uuid;
  v_amount bigint;
  v_totals jsonb;
  v_invoice jsonb;
  v_delta bigint := 0;
  v_floor numeric;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'amount',p_amount_cents,'reason',p_reason,'evidence',p_evidence_path);
begin
  select * into v_receipt from private.sales_receipts where document_id=p_document_id;
  v_case := private.sales_lock_case(v_receipt.case_id,'financial.confirm');
  perform private.sales_require('receipt.cancel',v_case.id);
  perform private.sales_require('receipt.issue',v_case.id);
  v_result := private.sales_replay('payment.correct',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_receipt from private.sales_receipts where document_id=p_document_id for update;
  select * into v_payment from private.sales_payments where id=v_receipt.payment_id for update;
  v_amount := private.sales_money(p_amount_cents);
  if not v_receipt.is_active or v_payment.voided_at is not null or v_amount is null or v_amount<=0 or v_amount=v_payment.amount_cents
    or length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_payment_correction';
  end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'payment');
  v_root := coalesce(v_payment.root_id,v_payment.id);
  v_totals := private.sales_payment_totals(v_root);
  v_floor := (v_totals->>'refunded_cents')::numeric+(v_totals->>'credit_cents')::numeric;
  if v_amount<v_floor or v_amount<(v_totals->>'refunded_cents')::numeric+(v_totals->>'reserved_refund_cents')::numeric then
    raise exception using errcode='22023',message='correction_conflicts_with_credit_or_refund';
  end if;
  select * into strict v_request from private.sales_payment_requests where id=v_payment.request_id;
  if v_request.invoice_id is not null then
    v_invoice := private.sales_invoice_totals(v_request.invoice_id);
    if (v_invoice->>'is_active')::boolean and v_amount>v_payment.amount_cents then
      v_delta := v_amount-v_payment.amount_cents;
      if v_delta>(v_invoice->>'outstanding_cents')::numeric then raise exception using errcode='22023',message='correction_exceeds_outstanding'; end if;
    else
      v_delta := least(0,v_amount-v_floor-(v_totals->>'allocated_cents')::numeric)::bigint;
    end if;
  end if;
  update private.sales_payments set voided_by=auth.uid(),voided_at=now(),void_reason=p_reason where id=v_payment.id;
  v_request.amount_cents := v_amount;
  v_request.proof_path := p_evidence_path;
  if v_payment.kind in ('design_fee','booking') and v_case.status in ('draft','reserved') then
    perform private.sales_validate_payment(v_request);
  end if;
  insert into private.sales_payment_requests(case_id,invoice_id,kind,amount_cents,method,paid_date,payer_name,description,proof_path,state,created_by)
    values(v_case.id,v_request.invoice_id,v_payment.kind,v_amount,v_payment.method,v_payment.paid_date,
      v_payment.payer_name,v_payment.description,p_evidence_path,'confirmed',auth.uid()) returning * into v_request;
  insert into private.sales_payments(case_id,root_id,supersedes_id,request_id,kind,amount_cents,method,paid_date,payer_name,description,proof_path,confirmed_by)
    values(v_case.id,v_root,v_payment.id,v_request.id,v_payment.kind,v_amount,v_payment.method,v_payment.paid_date,
      v_payment.payer_name,v_payment.description,p_evidence_path,auth.uid()) returning * into v_new;
  if v_delta<>0 then
    insert into private.sales_allocations(case_id,root_payment_id,invoice_id,amount_cents,source_kind,source_id,actor_id)
      values(v_case.id,v_root,v_request.invoice_id,v_delta,'correction',v_new.id,auth.uid());
  end if;
  select * into strict v_old_doc from private.sales_documents where id=p_document_id;
  update private.sales_receipts set is_active=false where id=v_receipt.id;
  update private.sales_documents set state='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=p_reason,version=version+1 where id=p_document_id;
  v_doc := private.sales_new_document(v_case.id,'receipt','issued',v_old_doc.payload || jsonb_build_object(
    'payment_id',v_new.id,'amount_cents',v_amount::text,'proof_path',p_evidence_path,'replaces_number',v_old_doc.number,
    'replacement_reason',p_reason,'confirmed_by_name',(select full_name from public.staff where id=auth.uid())),p_document_id);
  insert into private.sales_receipts(case_id,root_payment_id,payment_id,document_id) values(v_case.id,v_root,v_new.id,v_doc.id);
  v_result := private.sales_touch_case(v_case.id,'payment.correct',v_payload || jsonb_build_object('payment_id',v_new.id,'document_id',v_doc.id))
    || jsonb_build_object('payment_id',v_new.id,'document_id',v_doc.id);
  return private.sales_remember('payment.correct',p_request_id,v_payload,v_result);
end $$;

create function public.sales_correct_payment(p_document_id uuid,p_version bigint,p_amount_cents text,p_reason text,p_evidence_path text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_correct_payment(p_document_id,p_version,p_amount_cents,p_reason,p_evidence_path,p_request_id)
$$;
revoke all on function private.sales_correct_payment(uuid,bigint,text,text,text,uuid),public.sales_correct_payment(uuid,bigint,text,text,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_correct_payment(uuid,bigint,text,text,text,uuid),public.sales_correct_payment(uuid,bigint,text,text,text,uuid) to authenticated;
create or replace function private.sales_financial_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_plan jsonb; v_pending jsonb; v_payments jsonb; v_docs jsonb;
begin
  perform private.sales_require('financial.view',p_case_id);
  select jsonb_build_object('tier',tier,'usable_area',usable_area::text,'total_cents',total_cents::text,
    'instalments',instalments,'note',note) into v_plan from private.sales_design_plans where case_id=p_case_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount_cents',amount_cents::text,
    'method',method,'paid_date',paid_date,'payer_name',payer_name,'description',description,'proof_path',proof_path)
    order by created_at,id),'[]') into v_pending from private.sales_payment_requests where case_id=p_case_id and state='pending';
  select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(root_id,id),'kind',kind,'amount_cents',amount_cents::text,
    'method',method,'paid_date',paid_date,'payer_name',payer_name,'totals',private.sales_payment_totals(coalesce(root_id,id)))
    order by confirmed_at,id),'[]') into v_payments from private.sales_payments where case_id=p_case_id and voided_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'number',number,'state',state,'document_date',document_date,
    'amount_cents',payload->>'amount_cents') order by created_at,id),'[]') into v_docs from private.sales_documents where case_id=p_case_id;
  select jsonb_build_object('case_id',c.id,'version',c.version,'issuer_ready',exists(select 1 from private.sales_issuers where brand=c.brand),
    'design_plan',v_plan,'pending',v_pending,'payments',v_payments,'documents',v_docs,
    'can_change_design',c.brand='BAAN_KUNAPAP' and c.status in ('draft','reserved')
      and not exists(select 1 from private.sales_payments where case_id=c.id and kind='design_fee')
      and not exists(select 1 from private.sales_documents where case_id=c.id and kind='contract' and state='signed'))
    into v_result from private.sales_cases c where c.id=p_case_id;
  if v_result is null then raise exception using errcode='42501',message='case_unavailable'; end if;
  return v_result;
end $$;
commit;
