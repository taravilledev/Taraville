begin;

create or replace function private.sales_allowed(p_action text,p_case_id uuid default null,p_lead_id uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_own boolean := false; v_cap private.sales_capabilities;
begin
  select role into v_role from public.staff where id=auth.uid() and is_active;
  if not found then return false; end if;
  if p_case_id is not null then
    select case when p_action in ('case.view','case.edit','acceptance.record') then c.responsible_id=auth.uid()
      else l.owner_id=auth.uid() end into v_own from private.sales_cases c join public.leads l on l.id=c.lead_id where c.id=p_case_id;
  elsif p_lead_id is not null then select owner_id=auth.uid() into v_own from public.leads where id=p_lead_id; end if;
  select * into v_cap from private.sales_capabilities where staff_id=auth.uid() and action=p_action;
  if found then return v_cap.enabled and (v_cap.scope='all' or coalesce(v_own,false)); end if;
  if v_role='executive' then return true; end if;
  return (p_action='financial.view' or (v_role='sale' and p_action in ('case.view','case.edit','case.create'))) and coalesce(v_own,false);
end $$;

create function private.sales_record_acceptance(p_instalment_id uuid,p_version bigint,p_inspected boolean,p_customer_accepted boolean,
  p_evidence_path text,p_note text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_inst private.sales_instalments; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('instalment',p_instalment_id,'version',p_version,'inspected',p_inspected,
    'customer_accepted',p_customer_accepted,'evidence',p_evidence_path,'note',p_note);
begin
  select * into v_inst from private.sales_instalments where id=p_instalment_id;
  v_case := private.sales_lock_case(v_inst.case_id,'acceptance.record',false);
  v_result := private.sales_replay('acceptance.record',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_inst from private.sales_instalments where id=p_instalment_id for update;
  if v_case.status<>'contracted' or not v_inst.is_active or not v_inst.needs_acceptance or v_inst.accepted_at is not null
    or p_inspected is distinct from true or p_customer_accepted is distinct from true
    or length(btrim(coalesce(p_note,''))) not between 1 and 3000 then
    raise exception using errcode='22023',message='inspection_and_acceptance_required'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'acceptance');
  update private.sales_instalments set acceptance_path=p_evidence_path,accepted_by=auth.uid(),accepted_at=now() where id=v_inst.id;
  v_result := private.sales_touch_case(v_case.id,'acceptance.record',v_payload);
  return private.sales_remember('acceptance.record',p_request_id,v_payload,v_result);
end $$;

create function private.sales_issue_invoice(p_instalment_id uuid,p_version bigint,p_due_date date,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inst private.sales_instalments; v_case private.sales_cases; v_doc private.sales_documents; v_invoice private.sales_invoices;
  v_result jsonb; v_payload jsonb := jsonb_build_object('instalment',p_instalment_id,'version',p_version,'due_date',p_due_date);
begin
  select * into v_inst from private.sales_instalments where id=p_instalment_id;
  v_case := private.sales_lock_case(v_inst.case_id,'billing.issue');
  v_result := private.sales_replay('invoice.issue',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_inst from private.sales_instalments where id=p_instalment_id for update;
  if v_case.status<>'contracted' or not v_inst.is_active or p_due_date is null
    or not exists(select 1 from private.sales_documents where id=v_inst.contract_id and state='signed') then
    raise exception using errcode='22023',message='signed_contract_required'; end if;
  if v_inst.needs_acceptance and v_inst.accepted_at is null then raise exception using errcode='22023',message='customer_acceptance_required'; end if;
  v_doc := private.sales_new_document(v_case.id,'invoice','issued',jsonb_build_object('instalment_id',v_inst.id,'label',v_inst.label,
    'gross_cents',v_inst.gross_cents::text,'credit_cents',v_inst.credit_cents::text,'net_cents',(v_inst.gross_cents-v_inst.credit_cents)::text,
    'due_date',p_due_date,'credit_settled',v_inst.gross_cents=v_inst.credit_cents),v_inst.contract_id);
  insert into private.sales_invoices(case_id,document_id,instalment_id,gross_cents,credit_cents,due_date)
    values(v_case.id,v_doc.id,v_inst.id,v_inst.gross_cents,v_inst.credit_cents,p_due_date) returning * into v_invoice;
  v_result := private.sales_touch_case(v_case.id,'invoice.issue',jsonb_build_object('invoice_id',v_invoice.id,'credit_settled',v_invoice.net_cents=0))
    || jsonb_build_object('invoice_id',v_invoice.id,'document_id',v_doc.id,'credit_settled',v_invoice.net_cents=0);
  return private.sales_remember('invoice.issue',p_request_id,v_payload,v_result);
end $$;

create function private.sales_agreement_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_docs jsonb; v_rows jsonb;
begin
  perform private.sales_require('financial.view',p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'number',number,'revision',revision,
    'payload',payload,'evidence_path',evidence_path) order by created_at,id),'[]') into v_docs
    from private.sales_documents where case_id=p_case_id and kind in ('quotation','contract','amendment','closeout');
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'contract_id',s.contract_id,'position',s.position,'label',s.label,
    'gross_cents',s.gross_cents::text,'credit_cents',s.credit_cents::text,'net_cents',(s.gross_cents-s.credit_cents)::text,
    'progress_percent',s.progress_percent,'needs_acceptance',s.needs_acceptance,'accepted_at',s.accepted_at,
    'acceptance_path',s.acceptance_path,'is_active',s.is_active,'invoice_id',i.id,'invoice_document_id',i.document_id,
    'balance',private.sales_invoice_totals(i.id)) order by s.position,s.id),'[]') into v_rows
    from private.sales_instalments s left join private.sales_invoices i on i.instalment_id=s.id and i.cancelled_at is null
    where s.case_id=p_case_id;
  return jsonb_build_object('documents',v_docs,'instalments',v_rows);
end $$;

create function public.sales_record_acceptance(p_instalment_id uuid,p_version bigint,p_inspected boolean,p_customer_accepted boolean,
  p_evidence_path text,p_note text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_record_acceptance(p_instalment_id,p_version,p_inspected,p_customer_accepted,p_evidence_path,p_note,p_request_id) $$;
create function public.sales_issue_invoice(p_instalment_id uuid,p_version bigint,p_due_date date,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_issue_invoice(p_instalment_id,p_version,p_due_date,p_request_id) $$;
create function public.sales_agreement_detail(p_case_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.sales_agreement_detail(p_case_id) $$;
revoke all on function private.sales_record_acceptance(uuid,bigint,boolean,boolean,text,text,uuid),public.sales_record_acceptance(uuid,bigint,boolean,boolean,text,text,uuid),
  private.sales_issue_invoice(uuid,bigint,date,uuid),public.sales_issue_invoice(uuid,bigint,date,uuid),private.sales_agreement_detail(uuid),public.sales_agreement_detail(uuid)
  from public,anon,authenticated;
grant execute on function private.sales_record_acceptance(uuid,bigint,boolean,boolean,text,text,uuid),public.sales_record_acceptance(uuid,bigint,boolean,boolean,text,text,uuid),
  private.sales_issue_invoice(uuid,bigint,date,uuid),public.sales_issue_invoice(uuid,bigint,date,uuid),private.sales_agreement_detail(uuid),public.sales_agreement_detail(uuid) to authenticated;
commit;
