begin;

create function private.sales_lock_case(p_case_id uuid,p_action text,p_financial boolean default true)
returns private.sales_cases language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases;
begin
  perform private.sales_require(p_action,p_case_id);
  if p_financial then perform private.sales_require('financial.view',p_case_id); end if;
  select * into v_case from private.sales_cases where id = p_case_id for update;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  if not private.sales_allowed(p_action,p_case_id) or (p_financial and not private.sales_allowed('financial.view',p_case_id))
    or (not p_financial and not (private.sales_allowed('case.view',p_case_id) or private.sales_allowed('financial.view',p_case_id))) then
    raise exception using errcode='42501',message='sales_permission_denied';
  end if;
  return v_case;
end $$;

create function private.sales_touch_case(p_case_id uuid,p_action text,p_detail jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases;
begin
  update private.sales_cases set version = version + 1,updated_at = now() where id = p_case_id returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action,detail) values(p_case_id,auth.uid(),p_action,p_detail);
  return jsonb_build_object('id',v_case.id,'version',v_case.version);
end $$;

create function private.sales_new_document(p_case_id uuid,p_kind text,p_state text,p_payload jsonb,
  p_parent_id uuid default null,p_evidence_path text default null,p_document_date date default null)
returns private.sales_documents language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_issuer private.sales_issuers; v_doc private.sales_documents;
  v_revision integer; v_prefix text; v_number text; v_synthetic boolean;
begin
  select * into v_case from private.sales_cases where id = p_case_id for update;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  select * into v_issuer from private.sales_issuers where brand = v_case.brand;
  if not found then raise exception using errcode='22023',message='issuer_configuration_required'; end if;
  select privacy_mode = 'synthetic' into v_synthetic from public.leads where id = v_case.lead_id;
  select coalesce(max(revision),0) + 1 into v_revision from private.sales_documents where case_id = p_case_id and kind = p_kind;
  v_prefix := case p_kind when 'quotation' then 'Q' when 'contract' then 'C' when 'invoice' then 'I'
    when 'receipt' then 'R' when 'refund' then 'RF' when 'amendment' then 'A' when 'booking' then 'B'
    when 'summary' then 'SU' when 'closeout' then 'CL' end;
  if p_state <> 'draft' then v_number := private.sales_number(v_case.brand,v_prefix); end if;
  insert into private.sales_documents(case_id,kind,number,revision,state,document_date,parent_id,payload,customer_snapshot,issuer_snapshot,
    evidence_path,finalized_by,finalized_at,created_by)
  values(p_case_id,p_kind,v_number,v_revision,p_state,coalesce(p_document_date,(now() at time zone 'Asia/Bangkok')::date),p_parent_id,
    p_payload || jsonb_build_object('is_synthetic',coalesce(v_synthetic,false) or v_issuer.is_synthetic),v_case.customer_snapshot,
    jsonb_build_object('legal_name',v_issuer.legal_name,'address',v_issuer.address,'tax_id',v_issuer.tax_id,
      'contact',v_issuer.contact,'version',v_issuer.version,'brand',v_case.brand),p_evidence_path,
    case when p_state = 'draft' then null else auth.uid() end,case when p_state = 'draft' then null else now() end,auth.uid())
    returning * into v_doc;
  return v_doc;
end $$;

create function private.sales_guard_document() returns trigger language plpgsql set search_path = '' as $$
declare v_allowed text[] := array['state','cancelled_by','cancelled_at','cancel_reason','version'];
begin
  if tg_op = 'DELETE' then raise exception using errcode='42501',message='document_history_preserved'; end if;
  if old.state <> 'draft' then
    if old.state in ('offered','awaiting_signature') then
      v_allowed := v_allowed || array['evidence_path','finalized_by','finalized_at'];
    end if;
    if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception using errcode='42501',message='issued_document_immutable';
    end if;
  end if;
  if old.state = 'cancelled' and new is distinct from old then raise exception using errcode='42501',message='cancelled_document_immutable'; end if;
  return new;
end $$;
create trigger sales_documents_immutable before update or delete on private.sales_documents
  for each row execute function private.sales_guard_document();

create function private.sales_guard_payment() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception using errcode='42501',message='money_history_preserved'; end if;
  if (to_jsonb(new) - array['voided_by','voided_at','void_reason']) is distinct from
    (to_jsonb(old) - array['voided_by','voided_at','void_reason']) or old.voided_at is not null then
    raise exception using errcode='42501',message='confirmed_payment_immutable';
  end if;
  return new;
end $$;
create trigger sales_payments_immutable before update or delete on private.sales_payments
  for each row execute function private.sales_guard_payment();

create function private.sales_payment_totals(p_root_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select amount_cents from private.sales_payments where coalesce(root_id,id) = p_root_id and voided_at is null),
  r as (select coalesce(sum(o.amount_cents),0) amount from private.sales_payouts o join private.sales_refund_requests r on r.id = o.refund_id where r.root_payment_id = p_root_id),
  h as (select coalesce(sum(amount_cents),0) amount from private.sales_refund_requests where root_payment_id = p_root_id and state in ('pending','approved')),
  c as (select coalesce(sum(amount_cents),0) amount from private.sales_credits where root_payment_id = p_root_id),
  a as (select coalesce(sum(amount_cents),0) amount from private.sales_allocations where root_payment_id = p_root_id)
  select jsonb_build_object('paid_cents',p.amount_cents::text,'refunded_cents',r.amount::text,'reserved_refund_cents',h.amount::text,
    'credit_cents',c.amount::text,'allocated_cents',a.amount::text,'free_cents',(p.amount_cents-r.amount-c.amount-a.amount)::text)
  from p,r,h,c,a
$$;

create function private.sales_invoice_totals(p_invoice_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with i as (select i.*,d.state,c.status case_status from private.sales_invoices i join private.sales_documents d on d.id = i.document_id
    join private.sales_cases c on c.id = i.case_id where i.id = p_invoice_id),
  a as (select coalesce(sum(amount_cents),0) amount from private.sales_allocations where invoice_id = p_invoice_id),
  m as (select coalesce(sum(amount_cents),0) amount from private.sales_invoice_adjustments where invoice_id = p_invoice_id)
  select jsonb_build_object('gross_cents',i.gross_cents::text,'credit_cents',i.credit_cents::text,'adjustment_cents',m.amount::text,
    'net_cents',(i.net_cents+m.amount)::text,'allocated_cents',a.amount::text,
    'outstanding_cents',greatest(0,i.net_cents+m.amount-a.amount)::text,'overpaid_cents',greatest(0,a.amount-i.net_cents-m.amount)::text,
    'is_active',i.cancelled_at is null and i.state = 'issued' and i.case_status <> 'cancelled') from i,a,m
$$;

create function private.sales_evidence_allowed(p_name text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_case uuid; v_category text;
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(payment|agreement|refund|acceptance)/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$' then return false; end if;
  v_case := split_part(p_name,'/',1)::uuid; v_category := split_part(p_name,'/',2);
  if not exists(select 1 from private.sales_cases where id = v_case) then return false; end if;
  if v_category = 'acceptance' then
    return (private.sales_allowed('case.view',v_case) or private.sales_allowed('financial.view',v_case))
      and (not p_write or private.sales_allowed('acceptance.record',v_case));
  end if;
  if not private.sales_allowed('financial.view',v_case) then return false; end if;
  if not p_write then return true; end if;
  return case v_category when 'payment' then private.sales_allowed('financial.prepare',v_case)
    when 'agreement' then private.sales_allowed('financial.prepare',v_case) or private.sales_allowed('contract.sign',v_case)
      or private.sales_allowed('contract.amend',v_case) or private.sales_allowed('contract.cancel',v_case)
    when 'refund' then private.sales_allowed('refund.pay',v_case) else false end;
end $$;

create function private.sales_check_evidence(p_case_id uuid,p_path text,p_category text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_path is null or split_part(p_path,'/',1) <> p_case_id::text or split_part(p_path,'/',2) <> p_category
    or not private.sales_evidence_allowed(p_path,false)
    or not exists(select 1 from storage.objects where bucket_id = 'sales-evidence' and name = p_path) then
    raise exception using errcode='22023',message='evidence_required';
  end if;
end $$;

revoke all on function private.sales_lock_case(uuid,text,boolean),private.sales_touch_case(uuid,text,jsonb),
  private.sales_new_document(uuid,text,text,jsonb,uuid,text,date),private.sales_guard_document(),private.sales_guard_payment(),
  private.sales_payment_totals(uuid),private.sales_invoice_totals(uuid),private.sales_evidence_allowed(text,boolean),
  private.sales_check_evidence(uuid,text,text) from public,anon,authenticated;
grant execute on function private.sales_evidence_allowed(text,boolean) to authenticated;
commit;
