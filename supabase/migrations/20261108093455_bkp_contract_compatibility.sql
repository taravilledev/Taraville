begin;
create or replace function private.sales_sign_contract(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_doc private.sales_documents; v_case private.sales_cases; v_result jsonb; v_row jsonb; v_inst private.sales_instalments;
  v_payment record; v_available bigint; v_needed bigint; v_applied bigint;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'evidence',p_evidence_path);
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'contract.sign');
  v_result := private.sales_replay('contract.sign',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_doc.kind<>'contract' or v_doc.state<>'awaiting_signature' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='contract_not_awaiting_signature'; end if;
  if not exists(select 1 from private.sales_documents q where q.id=v_doc.parent_id and q.case_id=v_case.id
    and q.kind='quotation' and q.state='accepted'
    and coalesce(private.sales_money(q.payload->>'total_cents'),0)>0
    and q.payload->>'total_cents'=v_doc.payload->>'total_cents'
    and (q.payload->>'total_cents')::bigint=v_case.net_price_cents) then
    raise exception using errcode='PT409',message='contract_quotation_changed'; end if;
  if v_doc.payload ? 'schedule_input' and private.sales_contract_schedule(
    (v_doc.payload->>'total_cents')::bigint,(v_doc.payload->>'credit_cents')::bigint,v_doc.payload->'schedule_input')
    is distinct from v_doc.payload->'schedule' then
    raise exception using errcode='PT409',message='contract_schedule_changed'; end if;
  if private.sales_design_credit(v_case.id) is distinct from (v_doc.payload->>'credit_cents')::bigint then
    raise exception using errcode='PT409',message='credit_changed_prepare_new_contract'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'agreement');
  update private.sales_documents set state='signed',evidence_path=p_evidence_path,finalized_by=auth.uid(),finalized_at=now(),version=version+1 where id=v_doc.id;
  for v_row in select value from jsonb_array_elements(v_doc.payload->'schedule') loop
    insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,progress_percent,needs_acceptance)
    values(v_case.id,v_doc.id,(v_row->>'position')::integer,v_row->>'label',(v_row->>'gross_cents')::bigint,
      (v_row->>'credit_cents')::bigint,(v_row->>'progress_percent')::integer,(v_row->>'needs_acceptance')::boolean) returning * into v_inst;
    v_needed := v_inst.credit_cents;
    for v_payment in select coalesce(root_id,id) root_id from private.sales_payments
      where case_id=v_case.id and kind='design_fee' and voided_at is null order by confirmed_at,id loop
      exit when v_needed=0;
      v_available := (private.sales_payment_totals(v_payment.root_id)->>'free_cents')::bigint;
      v_applied := least(v_needed,v_available);
      if v_applied>0 then
        insert into private.sales_credits(case_id,root_payment_id,instalment_id,agreement_id,amount_cents,created_by)
          values(v_case.id,v_payment.root_id,v_inst.id,v_doc.id,v_applied,auth.uid());
        v_needed := v_needed-v_applied;
      end if;
    end loop;
    if v_needed<>0 then raise exception using errcode='22023',message='credit_allocation_failed'; end if;
  end loop;
  update private.sales_cases set status='contracted' where id=v_case.id;
  v_result := private.sales_touch_case(v_case.id,'contract.sign',jsonb_build_object('document_id',v_doc.id));
  return private.sales_remember('contract.sign',p_request_id,v_payload,v_result);
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
    'acceptance_path',s.acceptance_path,'is_active',s.is_active,'invoice_id',i.id,'invoice_document_id',i.document_id,
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
create or replace function private.sales_save_case(p_case_id uuid,p_expected_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_expected_version,'input',p_input);
  v_snapshot jsonb := p_input->'customer_snapshot'; v_list bigint; v_promotion bigint; v_discount bigint;
begin
  perform private.sales_require('financial.view',p_case_id);
  perform private.sales_require('financial.prepare',p_case_id);
  select * into v_case from private.sales_cases where id = p_case_id for update;
  if not found then raise exception using errcode='42501',message='case_unavailable'; end if;
  v_result := private.sales_replay('case.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_expected_version is distinct from v_case.version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.status not in ('draft','reserved') then raise exception using errcode='22023',message='signed_amendment_required'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 200000
    or not p_input ?& array['list_price_cents','promotion_price_cents','discount_cents','details','customer_snapshot']
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in
      ('list_price_cents','promotion_price_cents','discount_cents','details','customer_snapshot'))
    or jsonb_typeof(p_input->'details') is distinct from 'object'
    or jsonb_typeof(v_snapshot) is distinct from 'object' then
    raise exception using errcode='22023',message='invalid_case_input';
  end if;
  if exists(select 1 from jsonb_each(v_snapshot) x where x.key not in ('full_name','phone','address','nickname','salesperson')
      or jsonb_typeof(x.value) <> 'string')
    or length(btrim(coalesce(v_snapshot->>'full_name',''))) not between 1 and 200
    or length(coalesce(v_snapshot->>'phone','')) > 80 or length(coalesce(v_snapshot->>'address','')) > 2000
    or length(coalesce(v_snapshot->>'nickname','')) > 200 or length(coalesce(v_snapshot->>'salesperson','')) > 200 then
    raise exception using errcode='22023',message='invalid_customer_snapshot';
  end if;
  v_list := private.sales_money(p_input->>'list_price_cents');
  v_promotion := private.sales_money(p_input->>'promotion_price_cents');
  v_discount := coalesce(private.sales_money(p_input->>'discount_cents'),0);
  if v_discount > coalesce(v_promotion,v_list) then raise exception using errcode='22023',message='discount_exceeds_price'; end if;
  if v_case.brand='BAAN_KUNAPAP' and exists(select 1 from private.sales_documents
    where case_id=p_case_id and kind='contract' and state in ('draft','awaiting_signature','signed'))
    and (v_list is distinct from v_case.list_price_cents or v_promotion is distinct from v_case.promotion_price_cents
      or v_discount is distinct from v_case.discount_cents) then
    raise exception using errcode='22023',message='contract_price_bound_to_quotation'; end if;
  update private.sales_cases set customer_snapshot = v_snapshot,details = p_input->'details',
    list_price_cents = v_list,promotion_price_cents = v_promotion,discount_cents = v_discount,
    version = version + 1,updated_at = now() where id = p_case_id returning * into v_case;
  insert into private.sales_events(case_id,actor_id,action,detail) values(p_case_id,auth.uid(),'case.save',jsonb_build_object('version',v_case.version));
  return private.sales_remember('case.save',p_request_id,v_payload,jsonb_build_object('id',v_case.id,'version',v_case.version));
end $$;


-- The old prepare endpoint must not bypass the new draft/review/lock lifecycle.
revoke all on function public.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid),
  private.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid) from public,anon,authenticated;
commit;
