begin;

create table private.sales_design_invoices (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  position integer not null check (position between 1 and 3),
  label text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  document_id uuid not null unique references private.sales_documents(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index sales_design_invoice_active_position on private.sales_design_invoices(case_id,position) where cancelled_at is null;
alter table private.sales_design_invoices enable row level security;
revoke all on private.sales_design_invoices from public,anon,authenticated;
alter table private.sales_payment_requests add column design_invoice_id uuid references private.sales_design_invoices(id);
alter table private.sales_payment_requests add constraint sales_design_request_kind check (design_invoice_id is null or kind='design_fee');
create unique index sales_design_bill_one_pending on private.sales_payment_requests(design_invoice_id) where state='pending';

create function private.sales_issue_design_invoice(p_case_id uuid,p_position integer,p_version bigint,p_due_date date,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_plan private.sales_design_plans; v_doc private.sales_documents;
  v_bill private.sales_design_invoices; v_amount bigint; v_label text; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'position',p_position,'version',p_version,'due_date',p_due_date);
begin
  v_case := private.sales_lock_case(p_case_id,'billing.issue');
  v_result := private.sales_replay('design.invoice.issue',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved')
    or exists(select 1 from private.sales_documents where case_id=p_case_id and kind='contract' and state='signed') then
    raise exception using errcode='22023',message='design_payment_unavailable'; end if;
  if p_position is null or p_position not between 1 and 3 or p_due_date is null or not isfinite(p_due_date) then
    raise exception using errcode='22023',message='invalid_design_invoice'; end if;
  select * into v_plan from private.sales_design_plans where case_id=p_case_id;
  if not found then raise exception using errcode='22023',message='design_plan_required'; end if;
  if exists(select 1 from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
    where p.case_id=p_case_id and p.kind='design_fee' and r.design_invoice_id is null) then
    raise exception using errcode='22023',message='legacy_design_review_required'; end if;
  if exists(select 1 from private.sales_payment_requests where case_id=p_case_id and kind='design_fee' and design_invoice_id is null and state='pending') then
    raise exception using errcode='22023',message='design_payment_pending'; end if;
  if exists(select 1 from private.sales_design_invoices where case_id=p_case_id and position=p_position and cancelled_at is null) then
    raise exception using errcode='PT409',message='design_invoice_already_issued'; end if;
  v_amount := (v_plan.instalments->>(p_position-1))::bigint;
  if v_amount is null or v_amount<=0 then raise exception using errcode='22023',message='design_invoice_zero_amount'; end if;
  v_label := 'ค่าออกแบบ งวดที่ ' || p_position || ' · ' || case p_position when 1 then 'ส่งมอบแบบแปลน' when 2 then 'ส่งมอบ 3D' else 'ส่งมอบครบ' end;
  v_doc := private.sales_new_document(p_case_id,'invoice','issued',jsonb_build_object('label',v_label,
    'gross_cents',v_amount::text,'credit_cents','0','net_cents',v_amount::text,'due_date',p_due_date,'credit_settled',false,
    'design_position',p_position,'design_plan_version',v_plan.version));
  insert into private.sales_design_invoices(case_id,position,label,amount_cents,due_date,document_id)
    values(p_case_id,p_position,v_label,v_amount,p_due_date,v_doc.id) returning * into v_bill;
  v_result := private.sales_touch_case(p_case_id,'design.invoice.issue',jsonb_build_object('invoice_id',v_bill.id,'document_id',v_doc.id))
    || jsonb_build_object('invoice_id',v_bill.id,'document_id',v_doc.id,'number',v_doc.number);
  return private.sales_remember('design.invoice.issue',p_request_id,v_payload,v_result);
end $$;

create function private.sales_cancel_design_invoice(p_invoice_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_bill private.sales_design_invoices; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('invoice',p_invoice_id,'version',p_version,'reason',p_reason);
begin
  select * into v_bill from private.sales_design_invoices where id=p_invoice_id;
  v_case := private.sales_lock_case(v_bill.case_id,'billing.issue');
  v_result := private.sales_replay('design.invoice.cancel',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='design_payment_unavailable'; end if;
  if v_bill.cancelled_at is not null or length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_design_invoice'; end if;
  if exists(select 1 from private.sales_payment_requests where design_invoice_id=p_invoice_id and state in ('pending','confirmed')) then
    raise exception using errcode='22023',message='design_invoice_has_payment'; end if;
  update private.sales_design_invoices set cancelled_at=now() where id=p_invoice_id;
  update private.sales_documents set state='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=btrim(p_reason),version=version+1 where id=v_bill.document_id;
  v_result := private.sales_touch_case(v_case.id,'design.invoice.cancel',v_payload);
  return private.sales_remember('design.invoice.cancel',p_request_id,v_payload,v_result);
end $$;

create function private.sales_prepare_design_payment(p_invoice_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_bill private.sales_design_invoices; v_case private.sales_cases; v_row private.sales_payment_requests; v_result jsonb;
  v_payload jsonb := jsonb_build_object('invoice',p_invoice_id,'version',p_version,'input',p_input);
begin
  select * into v_bill from private.sales_design_invoices where id=p_invoice_id;
  v_case := private.sales_lock_case(v_bill.case_id,'financial.prepare');
  v_result := private.sales_replay('design.payment.prepare',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k
    where k not in ('method','paid_date','payer_name','description','proof_path')) then
    raise exception using errcode='22023',message='invalid_payment'; end if;
  if exists(select 1 from jsonb_each(p_input) e where jsonb_typeof(e.value)<>'string') then
    raise exception using errcode='22023',message='invalid_payment'; end if;
  v_row.case_id := v_case.id; v_row.design_invoice_id := p_invoice_id;
  v_row.kind := 'design_fee'; v_row.amount_cents := v_bill.amount_cents; v_row.method := p_input->>'method';
  v_row.paid_date := (p_input->>'paid_date')::date; v_row.payer_name := btrim(p_input->>'payer_name');
  v_row.description := btrim(p_input->>'description'); v_row.proof_path := nullif(p_input->>'proof_path','');
  perform private.sales_validate_payment(v_row);
  insert into private.sales_payment_requests(case_id,design_invoice_id,kind,amount_cents,method,paid_date,payer_name,description,proof_path,created_by)
    values(v_row.case_id,p_invoice_id,v_row.kind,v_row.amount_cents,v_row.method,v_row.paid_date,v_row.payer_name,v_row.description,v_row.proof_path,auth.uid()) returning * into v_row;
  v_result := private.sales_touch_case(v_case.id,'design.payment.prepare',jsonb_build_object('invoice_id',p_invoice_id,'payment_request_id',v_row.id))
    || jsonb_build_object('payment_request_id',v_row.id);
  return private.sales_remember('design.payment.prepare',p_request_id,v_payload,v_result);
end $$;

create function public.sales_issue_design_invoice(p_case_id uuid,p_position integer,p_version bigint,p_due_date date,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_issue_design_invoice(p_case_id,p_position,p_version,p_due_date,p_request_id) $$;
create function public.sales_cancel_design_invoice(p_invoice_id uuid,p_version bigint,p_reason text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_cancel_design_invoice(p_invoice_id,p_version,p_reason,p_request_id) $$;
create function public.sales_prepare_design_payment(p_invoice_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_prepare_design_payment(p_invoice_id,p_version,p_input,p_request_id) $$;
revoke all on function private.sales_issue_design_invoice(uuid,integer,bigint,date,uuid),public.sales_issue_design_invoice(uuid,integer,bigint,date,uuid),
  private.sales_cancel_design_invoice(uuid,bigint,text,uuid),public.sales_cancel_design_invoice(uuid,bigint,text,uuid),
  private.sales_prepare_design_payment(uuid,bigint,jsonb,uuid),public.sales_prepare_design_payment(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sales_issue_design_invoice(uuid,integer,bigint,date,uuid),public.sales_issue_design_invoice(uuid,integer,bigint,date,uuid),
  private.sales_cancel_design_invoice(uuid,bigint,text,uuid),public.sales_cancel_design_invoice(uuid,bigint,text,uuid),
  private.sales_prepare_design_payment(uuid,bigint,jsonb,uuid),public.sales_prepare_design_payment(uuid,bigint,jsonb,uuid) to authenticated;
commit;
