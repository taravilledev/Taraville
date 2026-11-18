begin;

alter table private.sales_instalments add column acceptance_date date;
alter table private.sales_instalments add constraint sales_actual_acceptance_date_check
  check (acceptance_date is null or (isfinite(acceptance_date) and accepted_at is not null
    and acceptance_date<=(accepted_at at time zone 'Asia/Bangkok')::date));

-- Only new paper drafts adopt the rule; later draft edits cannot remove or add it.
create function private.sales_contract_payment_terms() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.kind='contract' and old.state='draft' and new.state='awaiting_signature'
    and exists(select 1 from jsonb_array_elements_text(coalesce(new.payload->'contract_paper'->'extra_clauses','[]'::jsonb)) clause
      where strpos(clause,'รอตรวจต้นฉบับ')>0)
    and (new.payload->'is_synthetic' is distinct from 'true'::jsonb or not exists(
      select 1 from private.sales_cases c join public.leads l on l.id=c.lead_id where c.id=new.case_id and l.privacy_mode='synthetic')) then
    raise exception using errcode='22023',message='approved_contract_text_required'; end if;
  if tg_op='UPDATE' and old.kind='contract' and old.state='draft'
    and old.payload->'contract_paper'->'payment_due_days'='30'::jsonb
    and not (new.payload ? 'contract_paper') then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if new.kind='contract' and new.state='draft' and new.payload ? 'contract_paper'
    and exists(select 1 from private.sales_cases where id=new.case_id and brand='BAAN_KUNAPAP') then
    if tg_op='INSERT' or old.payload->'contract_paper'->'payment_due_days'='30'::jsonb then
      new.payload := jsonb_set(new.payload,'{contract_paper,payment_due_days}','30'::jsonb);
    else
      new.payload := new.payload #- '{contract_paper,payment_due_days}';
    end if;
  end if;
  return new;
end $$;
create trigger sales_contract_payment_terms before insert or update of payload,state on private.sales_documents
  for each row execute function private.sales_contract_payment_terms();

-- Financial work changes already clear accepted_at; clear its actual-date basis too.
create function private.sales_reset_acceptance_date() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.accepted_at is not null and new.accepted_at is null then
    new.acceptance_date := null;
    if new.needs_acceptance and exists(select 1 from private.sales_documents d join private.sales_cases c on c.id=d.case_id
      where d.id=new.contract_id and c.brand='BAAN_KUNAPAP' and d.payload->'contract_paper'->'payment_due_days'='30'::jsonb) then
      new.due_date := null;
    end if;
  end if;
  return new;
end $$;
create trigger sales_reset_acceptance_date before update of accepted_at on private.sales_instalments
  for each row execute function private.sales_reset_acceptance_date();

create or replace function private.sales_validate_contract_paper(p_paper jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare v_limits jsonb := '{"signing_place":2000,"signing_date":10,"employer_address":2000,"employer_national_id":13,"contractor_name":300,"contractor_address":3000,"contractor_representative":200,"contractor_national_id":13,"witness_1":200,"witness_2":200,"duration_days":4,"conditions":10000,"notes":10000}';
begin
  if jsonb_typeof(p_paper) is distinct from 'object' or p_paper->'schema_version' is distinct from '1'::jsonb then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if exists(select 1 from jsonb_each_text(v_limits) f where jsonb_typeof(p_paper->f.key) is distinct from 'string' or length(p_paper->>f.key)>f.value::int)
    or exists(select 1 from jsonb_object_keys(p_paper) k where not (v_limits ? k) and k not in ('schema_version','extra_clauses','payment_due_days'))
    or p_paper->>'employer_national_id' !~ '^(|[0-9]{13})$' or p_paper->>'contractor_national_id' !~ '^(|[0-9]{13})$'
    or p_paper->>'duration_days' !~ '^(|[1-9][0-9]{0,3})$' or p_paper->>'signing_date' !~ '^(|[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  if p_paper ? 'payment_due_days' and p_paper->'payment_due_days' is distinct from '30'::jsonb then
    raise exception using errcode='22023',message='invalid_contract_paper'; end if;
  perform nullif(p_paper->>'signing_date','')::date;
  perform private.sales_validate_contract_clauses(p_paper->'extra_clauses');
end $$;

create function private.sales_record_acceptance_dated(p_instalment_id uuid,p_version bigint,p_inspected boolean,p_customer_accepted boolean,
  p_evidence_path text,p_note text,p_request_id uuid,p_acceptance_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_inst private.sales_instalments; v_case private.sales_cases; v_result jsonb; v_due_days integer;
  v_payload jsonb := jsonb_build_object('instalment',p_instalment_id,'version',p_version,'inspected',p_inspected,
    'customer_accepted',p_customer_accepted,'evidence',p_evidence_path,'note',p_note)
    || case when p_acceptance_date is not null then jsonb_build_object('acceptance_date',p_acceptance_date) else '{}'::jsonb end;
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
  select case when v_case.brand='BAAN_KUNAPAP' and d.payload->'contract_paper'->'payment_due_days'='30'::jsonb then 30 end
    into v_due_days from private.sales_documents d where d.id=v_inst.contract_id and d.state='signed';
  if (v_due_days=30 and p_acceptance_date is null) or (p_acceptance_date is not null and
    (not isfinite(p_acceptance_date) or p_acceptance_date>(now() at time zone 'Asia/Bangkok')::date)) then
    raise exception using errcode='22023',message='invalid_acceptance_date'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'acceptance');
  update private.sales_instalments set acceptance_path=p_evidence_path,accepted_by=auth.uid(),accepted_at=now(),
    acceptance_date=p_acceptance_date, due_date=case when v_due_days=30 then p_acceptance_date+30 else due_date end where id=v_inst.id;
  v_result := private.sales_touch_case(v_case.id,'acceptance.record',v_payload);
  return private.sales_remember('acceptance.record',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_record_acceptance(p_instalment_id uuid,p_version bigint,p_inspected boolean,p_customer_accepted boolean,
  p_evidence_path text,p_note text,p_request_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select private.sales_record_acceptance_dated(p_instalment_id,p_version,p_inspected,p_customer_accepted,p_evidence_path,p_note,p_request_id,null)
$$;
create function public.sales_record_acceptance_dated(p_instalment_id uuid,p_version bigint,p_inspected boolean,p_customer_accepted boolean,
  p_evidence_path text,p_note text,p_request_id uuid,p_acceptance_date date) returns jsonb
language sql security invoker set search_path='' as $$
  select private.sales_record_acceptance_dated(p_instalment_id,p_version,p_inspected,p_customer_accepted,p_evidence_path,p_note,p_request_id,p_acceptance_date)
$$;

create or replace function private.sales_issue_invoice(p_instalment_id uuid,p_version bigint,p_due_date date,p_request_id uuid)
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
  if v_case.brand='BAAN_KUNAPAP' and v_inst.needs_acceptance and exists(select 1 from private.sales_documents d
    where d.id=v_inst.contract_id and d.payload->'contract_paper'->'payment_due_days'='30'::jsonb) then
    if v_inst.acceptance_date is null or v_inst.due_date is distinct from v_inst.acceptance_date+30
      or p_due_date is distinct from v_inst.acceptance_date+30 then
      raise exception using errcode='22023',message='acceptance_due_date_required'; end if;
  end if;
  v_doc := private.sales_new_document(v_case.id,'invoice','issued',jsonb_build_object('instalment_id',v_inst.id,'label',v_inst.label,
    'gross_cents',v_inst.gross_cents::text,'credit_cents',v_inst.credit_cents::text,'net_cents',(v_inst.gross_cents-v_inst.credit_cents)::text,
    'due_date',p_due_date,'credit_settled',v_inst.gross_cents=v_inst.credit_cents)
    || case when v_case.brand='BAAN_KUNAPAP' and v_inst.needs_acceptance and exists(select 1 from private.sales_documents d
      where d.id=v_inst.contract_id and d.payload->'contract_paper'->'payment_due_days'='30'::jsonb)
      then jsonb_build_object('acceptance_date',v_inst.acceptance_date,'payment_due_days',30) else '{}'::jsonb end,v_inst.contract_id);
  insert into private.sales_invoices(case_id,document_id,instalment_id,gross_cents,credit_cents,due_date)
    values(v_case.id,v_doc.id,v_inst.id,v_inst.gross_cents,v_inst.credit_cents,p_due_date) returning * into v_invoice;
  v_result := private.sales_touch_case(v_case.id,'invoice.issue',jsonb_build_object('invoice_id',v_invoice.id,'credit_settled',v_invoice.net_cents=0))
    || jsonb_build_object('invoice_id',v_invoice.id,'document_id',v_doc.id,'credit_settled',v_invoice.net_cents=0);
  return private.sales_remember('invoice.issue',p_request_id,v_payload,v_result);
end $$;

create or replace function private.sales_agreement_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_docs jsonb; v_rows jsonb;
begin
  perform private.sales_require('financial.view',p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'number',number,'revision',revision,
    'payload',payload,'evidence_path',evidence_path,'version',version,'parent_id',parent_id,'customer_snapshot',customer_snapshot) order by created_at,id),'[]') into v_docs
    from private.sales_documents where case_id=p_case_id and kind in ('quotation','contract','amendment','closeout');
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'contract_id',s.contract_id,'position',s.position,'label',s.label,
    'gross_cents',s.gross_cents::text,'credit_cents',s.credit_cents::text,'net_cents',(s.gross_cents-s.credit_cents)::text,
    'progress_percent',s.progress_percent,'needs_acceptance',s.needs_acceptance,'accepted_at',s.accepted_at,
    'acceptance_date',s.acceptance_date,'due_date',s.due_date,'acceptance_path',s.acceptance_path,'is_active',s.is_active,'invoice_id',i.id,'invoice_document_id',i.document_id,
    'balance',private.sales_invoice_totals(i.id)) order by s.position,s.id),'[]') into v_rows
    from private.sales_instalments s left join private.sales_invoices i on i.instalment_id=s.id and i.cancelled_at is null
    where s.case_id=p_case_id;
  return jsonb_build_object('documents',v_docs,'instalments',v_rows,'is_settled',
    exists(select 1 from jsonb_array_elements(v_rows) r where (r->>'is_active')::boolean)
    and not exists(select 1 from jsonb_array_elements(v_rows) r where (r->>'is_active')::boolean
      and ((r->'balance'->>'is_active')::boolean is distinct from true
        or (r->'balance'->>'outstanding_cents') is distinct from '0'
        or ((r->>'needs_acceptance')::boolean and r->>'accepted_at' is null)))
    and not exists(select 1 from private.sales_refund_requests where case_id=p_case_id and state in ('pending','approved')));
end $$;

create or replace function private.sales_acceptance_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  perform private.sales_require('case.view',p_case_id);
  perform private.sales_require('acceptance.record',p_case_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,
    'progress_percent',i.progress_percent,'accepted',i.accepted_at is not null,
    'acceptance_date',i.acceptance_date,'due_date',i.due_date,
    'requires_acceptance_date',d.payload->'contract_paper'->'payment_due_days'='30'::jsonb) order by i.position,i.id),'[]')
  into v_rows from private.sales_instalments i join private.sales_cases c on c.id=i.case_id
    join private.sales_documents d on d.id=i.contract_id
    where i.case_id=p_case_id and c.brand='BAAN_KUNAPAP' and c.status='contracted'
      and i.is_active and i.needs_acceptance;
  return v_rows;
end $$;

revoke all on function private.sales_contract_payment_terms(),private.sales_reset_acceptance_date(),
  private.sales_record_acceptance_dated(uuid,bigint,boolean,boolean,text,text,uuid,date),
  public.sales_record_acceptance_dated(uuid,bigint,boolean,boolean,text,text,uuid,date) from public,anon,authenticated;
grant execute on function private.sales_record_acceptance_dated(uuid,bigint,boolean,boolean,text,text,uuid,date),
  public.sales_record_acceptance_dated(uuid,bigint,boolean,boolean,text,text,uuid,date) to authenticated;

commit;
