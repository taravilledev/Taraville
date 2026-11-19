begin;

create function private.sales_reverse_credits(p_case_id uuid,p_agreement_id uuid) returns void
language sql security definer set search_path='' as $$
  insert into private.sales_credits(case_id,root_payment_id,instalment_id,agreement_id,amount_cents,created_by)
  select p_case_id,root_payment_id,instalment_id,p_agreement_id,-sum(amount_cents)::bigint,auth.uid()
  from private.sales_credits where case_id=p_case_id group by root_payment_id,instalment_id having sum(amount_cents)<>0
$$;

create function private.sales_apply_credits(p_case_id uuid,p_agreement_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_inst record; v_payment record; v_needed bigint; v_available bigint; v_applied bigint; v_kind text;
begin
  select case brand when 'BAAN_KUNAPAP' then 'design_fee' else 'booking' end into v_kind from private.sales_cases where id=p_case_id;
  for v_inst in select id,credit_cents from private.sales_instalments where case_id=p_case_id and is_active order by position desc,id loop
    v_needed := v_inst.credit_cents;
    for v_payment in select coalesce(root_id,id) root_id from private.sales_payments
      where case_id=p_case_id and kind=v_kind and voided_at is null order by confirmed_at,id loop
      exit when v_needed=0;
      v_available := greatest(0,(private.sales_payment_totals(v_payment.root_id)->>'free_cents')::bigint
        -(private.sales_payment_totals(v_payment.root_id)->>'reserved_refund_cents')::bigint);
      v_applied := least(v_needed,v_available);
      if v_applied>0 then
        insert into private.sales_credits(case_id,root_payment_id,instalment_id,agreement_id,amount_cents,created_by)
          values(p_case_id,v_payment.root_id,v_inst.id,p_agreement_id,v_applied,auth.uid());
        v_needed := v_needed-v_applied;
      end if;
    end loop;
    if v_needed<>0 then raise exception using errcode='22023',message='credit_exceeds_available_money'; end if;
  end loop;
end $$;

create function private.sales_amend_contract(p_case_id uuid,p_version bigint,p_rows jsonb,p_reason text,p_agreement_text text,
  p_work_changed boolean,p_evidence_path text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_inst private.sales_instalments; v_invoice private.sales_invoices;
  v_old jsonb; v_row jsonb; v_gross bigint; v_credit bigint; v_total numeric := 0; v_net bigint; v_delta bigint;
  v_result jsonb; v_count integer; v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'rows',p_rows,
    'reason',p_reason,'agreement_text',p_agreement_text,'work_changed',p_work_changed,'evidence',p_evidence_path);
begin
  v_case := private.sales_lock_case(p_case_id,'contract.amend');
  v_result := private.sales_replay('contract.amend',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.status<>'contracted' or length(btrim(coalesce(p_reason,''))) not between 1 and 1000
    or length(btrim(coalesce(p_agreement_text,''))) not between 1 and 100000 or p_work_changed is null
    or p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception using errcode='22023',message='invalid_amendment'; end if;
  perform private.sales_check_evidence(p_case_id,p_evidence_path,'agreement');
  select count(*),jsonb_agg(jsonb_build_object('id',id,'label',label,'gross_cents',gross_cents::text,'credit_cents',credit_cents::text,
    'progress_percent',progress_percent,'accepted_at',accepted_at) order by position,id) into v_count,v_old
    from private.sales_instalments where case_id=p_case_id and is_active;
  if jsonb_array_length(p_rows)<>v_count or (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>v_count then
    raise exception using errcode='22023',message='all_active_instalments_required'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row)<>'object' or jsonb_typeof(v_row->'gross_cents') is distinct from 'string'
      or jsonb_typeof(v_row->'credit_cents') is distinct from 'string' then raise exception using errcode='22023',message='invalid_amendment_row'; end if;
    select * into v_inst from private.sales_instalments where id=(v_row->>'id')::uuid and case_id=p_case_id and is_active;
    if not found then raise exception using errcode='22023',message='instalment_unavailable'; end if;
    v_gross := private.sales_money(v_row->>'gross_cents'); v_credit := private.sales_money(v_row->>'credit_cents');
    if v_gross is null or v_credit is null or v_credit>v_gross then raise exception using errcode='22023',message='invalid_money'; end if;
    v_total := v_total+v_gross;
  end loop;
  if v_total>9223372036854775807 then raise exception using errcode='22023',message='invalid_money'; end if;
  v_doc := private.sales_new_document(p_case_id,'amendment','signed',jsonb_build_object('reason',p_reason,'agreement_text',p_agreement_text,
    'work_changed',p_work_changed,'previous_schedule',v_old,'revised_amounts',p_rows,'total_cents',v_total::text),null,p_evidence_path);
  perform private.sales_reverse_credits(p_case_id,v_doc.id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    select * into v_inst from private.sales_instalments where id=(v_row->>'id')::uuid for update;
    v_gross := private.sales_money(v_row->>'gross_cents'); v_credit := private.sales_money(v_row->>'credit_cents'); v_net := v_gross-v_credit;
    update private.sales_instalments set gross_cents=v_gross,credit_cents=v_credit,
      accepted_at=case when p_work_changed and needs_acceptance then null else accepted_at end,
      accepted_by=case when p_work_changed and needs_acceptance then null else accepted_by end,
      acceptance_path=case when p_work_changed and needs_acceptance then null else acceptance_path end where id=v_inst.id;
    select * into v_invoice from private.sales_invoices where instalment_id=v_inst.id and cancelled_at is null for update;
    if found then
      if p_work_changed and v_inst.needs_acceptance then
        update private.sales_invoices set cancelled_at=now() where id=v_invoice.id;
        update private.sales_documents set state='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=left(p_reason,1000),version=version+1
          where id=v_invoice.document_id;
        insert into private.sales_allocations(case_id,root_payment_id,invoice_id,amount_cents,source_kind,source_id,actor_id)
          select p_case_id,root_payment_id,v_invoice.id,-sum(amount_cents)::bigint,'reallocation',v_doc.id,auth.uid()
          from private.sales_allocations where invoice_id=v_invoice.id group by root_payment_id having sum(amount_cents)>0;
      else
        v_delta := v_net-(private.sales_invoice_totals(v_invoice.id)->>'net_cents')::bigint;
        if v_delta<>0 then insert into private.sales_invoice_adjustments(case_id,invoice_id,agreement_id,amount_cents,reason,created_by)
          values(p_case_id,v_invoice.id,v_doc.id,v_delta,p_reason,auth.uid()); end if;
      end if;
    end if;
  end loop;
  perform private.sales_apply_credits(p_case_id,v_doc.id);
  update private.sales_cases set list_price_cents=v_total::bigint,promotion_price_cents=null,discount_cents=0 where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'contract.amend',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('contract.amend',p_request_id,v_payload,v_result);
end $$;

create function private.sales_case_money(p_case_id uuid) returns numeric
language sql stable security definer set search_path='' as $$
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'paid_cents')::numeric
    -(private.sales_payment_totals(coalesce(root_id,id))->>'refunded_cents')::numeric),0)
  from private.sales_payments where case_id=p_case_id and voided_at is null
$$;

create function private.sales_close_case(p_case_id uuid,p_version bigint,p_retained_cents text,p_reason text,p_agreement_text text,
  p_evidence_path text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_retained bigint; v_received numeric; v_reserved numeric; v_affected jsonb; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'retained',p_retained_cents,'reason',p_reason,
    'agreement_text',p_agreement_text,'evidence',p_evidence_path);
begin
  v_case := private.sales_lock_case(p_case_id,'contract.cancel');
  v_result := private.sales_replay('case.closeout',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  v_retained := private.sales_money(p_retained_cents); v_received := private.sales_case_money(p_case_id);
  if v_case.status='cancelled' or v_retained is null or v_received>9223372036854775807
    or length(btrim(coalesce(p_reason,''))) not between 1 and 1000
    or length(btrim(coalesce(p_agreement_text,''))) not between 1 and 100000 then raise exception using errcode='22023',message='invalid_closeout'; end if;
  perform private.sales_check_evidence(p_case_id,p_evidence_path,'agreement');
  select coalesce(sum(amount_cents),0) into v_reserved from private.sales_refund_requests where case_id=p_case_id and state in ('pending','approved');
  if v_reserved>greatest(0,v_received-v_retained) then raise exception using errcode='22023',message='closeout_conflicts_with_pending_refunds'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'document_id',i.document_id,'balance',private.sales_invoice_totals(i.id)) order by i.id),'[]')
    into v_affected from private.sales_invoices i where i.case_id=p_case_id and i.cancelled_at is null;
  v_doc := private.sales_new_document(p_case_id,'closeout','signed',jsonb_build_object('reason',p_reason,'agreement_text',p_agreement_text,
    'retained_cents',v_retained::text,'received_cents',v_received::text,'remaining_cents',greatest(0,v_retained-v_received)::text,
    'refund_due_cents',greatest(0,v_received-v_retained)::text,'replaces_invoices',v_affected),null,p_evidence_path);
  perform private.sales_reverse_credits(p_case_id,v_doc.id);
  update private.sales_documents set state='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=left(p_reason,1000),version=version+1
    where id in (select document_id from private.sales_invoices where case_id=p_case_id and cancelled_at is null);
  update private.sales_invoices set cancelled_at=now() where case_id=p_case_id and cancelled_at is null;
  update private.sales_instalments set is_active=false where case_id=p_case_id;
  update private.sales_payment_requests set state='rejected',version=version+1 where case_id=p_case_id and state='pending';
  update private.sales_cases set status='cancelled' where id=p_case_id;
  v_result := private.sales_touch_case(p_case_id,'case.closeout',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('case.closeout',p_request_id,v_payload,v_result);
end $$;

create function private.sales_closeout_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_doc private.sales_documents; v_received numeric; v_retained bigint;
begin
  perform private.sales_require('financial.view',p_case_id);
  select * into v_doc from private.sales_documents where case_id=p_case_id and kind='closeout' and state='signed' order by revision desc limit 1;
  if not found then return null; end if;
  v_received := private.sales_case_money(p_case_id); v_retained := (v_doc.payload->>'retained_cents')::bigint;
  return jsonb_build_object('document_id',v_doc.id,'retained_cents',v_retained::text,'received_cents',v_received::text,
    'remaining_cents',greatest(0,v_retained-v_received)::text,'refund_due_cents',greatest(0,v_received-v_retained)::text);
end $$;

create function private.sales_project_closeout_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status='active' and new.status='cancelled' and exists(select 1 from private.sales_cases where project_id=old.id and status<>'cancelled') then
    raise exception using errcode='22023',message='sales_closeout_required'; end if;
  return new;
end $$;
create trigger sales_project_closeout_guard before update of status on public.projects for each row execute function private.sales_project_closeout_guard();

create function public.sales_amend_contract(p_case_id uuid,p_version bigint,p_rows jsonb,p_reason text,p_agreement_text text,
  p_work_changed boolean,p_evidence_path text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_amend_contract(p_case_id,p_version,p_rows,p_reason,p_agreement_text,p_work_changed,p_evidence_path,p_request_id) $$;
create function public.sales_close_case(p_case_id uuid,p_version bigint,p_retained_cents text,p_reason text,p_agreement_text text,
  p_evidence_path text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_close_case(p_case_id,p_version,p_retained_cents,p_reason,p_agreement_text,p_evidence_path,p_request_id) $$;
create function public.sales_closeout_detail(p_case_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.sales_closeout_detail(p_case_id) $$;
revoke all on function private.sales_reverse_credits(uuid,uuid),private.sales_apply_credits(uuid,uuid),private.sales_case_money(uuid),private.sales_project_closeout_guard(),
  private.sales_amend_contract(uuid,bigint,jsonb,text,text,boolean,text,uuid),public.sales_amend_contract(uuid,bigint,jsonb,text,text,boolean,text,uuid),
  private.sales_close_case(uuid,bigint,text,text,text,text,uuid),public.sales_close_case(uuid,bigint,text,text,text,text,uuid),
  private.sales_closeout_detail(uuid),public.sales_closeout_detail(uuid) from public,anon,authenticated;
grant execute on function private.sales_amend_contract(uuid,bigint,jsonb,text,text,boolean,text,uuid),public.sales_amend_contract(uuid,bigint,jsonb,text,text,boolean,text,uuid),
  private.sales_close_case(uuid,bigint,text,text,text,text,uuid),public.sales_close_case(uuid,bigint,text,text,text,text,uuid),
  private.sales_closeout_detail(uuid),public.sales_closeout_detail(uuid) to authenticated;
commit;
