begin;

create function private.sales_design_credit(p_case_id uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare v_total numeric;
begin
  if exists(select 1 from private.sales_refund_requests r join private.sales_payments p on p.id=r.root_payment_id
    where r.case_id=p_case_id and p.kind='design_fee' and r.state in ('pending','approved')) then
    raise exception using errcode='22023',message='resolve_pending_design_refund'; end if;
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'free_cents')::numeric),0) into v_total
    from private.sales_payments where case_id=p_case_id and kind='design_fee' and voided_at is null;
  if v_total<0 or v_total>9223372036854775807 then raise exception using errcode='22023',message='invalid_design_credit'; end if;
  return v_total::bigint;
end $$;

create function private.sales_issue_quotation(p_case_id uuid,p_version bigint,p_description text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_doc private.sales_documents; v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'description',p_description);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('quotation.issue',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') or v_case.net_price_cents is null
    or length(btrim(coalesce(p_description,''))) not between 1 and 10000 then
    raise exception using errcode='22023',message='invalid_quotation'; end if;
  v_doc := private.sales_new_document(p_case_id,'quotation','offered',jsonb_build_object('description',p_description,
    'total_cents',v_case.net_price_cents::text,'details',v_case.details));
  v_result := private.sales_touch_case(p_case_id,'quotation.issue',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('quotation.issue',p_request_id,v_payload,v_result);
end $$;

create function private.sales_accept_quotation(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_doc private.sales_documents; v_case private.sales_cases; v_result jsonb;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'evidence',p_evidence_path);
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  v_case := private.sales_lock_case(v_doc.case_id,'financial.prepare');
  v_result := private.sales_replay('quotation.accept',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_doc from private.sales_documents where id=p_document_id for update;
  if v_doc.kind<>'quotation' or v_doc.state<>'offered' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='quotation_not_offered'; end if;
  perform private.sales_check_evidence(v_case.id,p_evidence_path,'agreement');
  update private.sales_documents set state='accepted',evidence_path=p_evidence_path,finalized_by=auth.uid(),finalized_at=now(),version=version+1 where id=v_doc.id;
  v_result := private.sales_touch_case(v_case.id,'quotation.accept',jsonb_build_object('document_id',v_doc.id));
  return private.sales_remember('quotation.accept',p_request_id,v_payload,v_result);
end $$;

create function private.sales_prepare_contract(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_schedule jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_case private.sales_cases; v_quote private.sales_documents; v_doc private.sales_documents; v_issuer private.sales_issuers;
  v_result jsonb; v_row jsonb; v_rows jsonb := '[]'; v_index integer := 0; v_bps integer; v_sum integer := 0;
  v_gross bigint; v_gross_sum bigint := 0; v_total bigint; v_credit bigint; v_remaining bigint; v_applied bigint; v_progress integer;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'quotation',p_quotation_id,'schedule',p_schedule);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('contract.prepare',p_request_id,v_payload); if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'BAAN_KUNAPAP' or v_case.status not in ('draft','reserved') then
    raise exception using errcode='22023',message='contract_unavailable'; end if;
  select * into v_quote from private.sales_documents where id=p_quotation_id and case_id=p_case_id and kind='quotation' and state='accepted';
  if not found then raise exception using errcode='22023',message='accepted_quotation_required'; end if;
  select * into v_issuer from private.sales_issuers where brand=v_case.brand for share;
  if not found or btrim(v_issuer.contract_text)='' then raise exception using errcode='22023',message='approved_contract_text_required'; end if;
  v_total := private.sales_money(v_quote.payload->>'total_cents'); v_credit := private.sales_design_credit(p_case_id);
  if v_total is null or v_credit>v_total then raise exception using errcode='22023',message='credit_exceeds_contract'; end if;
  if p_schedule is null or jsonb_typeof(p_schedule)<>'array' or jsonb_array_length(p_schedule) not between 1 and 100 then
    raise exception using errcode='22023',message='invalid_schedule'; end if;
  for v_row in select value from jsonb_array_elements(p_schedule) loop
    if jsonb_typeof(v_row)<>'object' or (v_row->>'basis_points') !~ '^[0-9]{1,5}$'
      or length(btrim(coalesce(v_row->>'label',''))) not between 1 and 300 then
      raise exception using errcode='22023',message='invalid_schedule'; end if;
    v_bps := (v_row->>'basis_points')::integer;
    if v_bps is null or v_bps not between 1 and 10000 then raise exception using errcode='22023',message='invalid_schedule'; end if;
    v_sum := v_sum+v_bps;
    v_gross := floor(v_total::numeric*v_bps/10000)::bigint; v_gross_sum := v_gross_sum+v_gross;
    v_progress := case when v_index=0 then null else (v_row->>'progress_percent')::integer end;
    if v_index>0 and (v_progress is null or v_progress not between 0 and 100) then
      raise exception using errcode='22023',message='invalid_progress'; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('position',v_index,'label',v_row->>'label','gross_cents',v_gross::text,
      'credit_cents','0','net_cents',v_gross::text,'progress_percent',v_progress,'needs_acceptance',v_index>0));
    v_index := v_index+1;
  end loop;
  if v_sum<>10000 then raise exception using errcode='22023',message='schedule_must_total_100_percent'; end if;
  v_index := jsonb_array_length(v_rows)-1;
  v_rows := jsonb_set(v_rows,array[v_index::text,'gross_cents'],to_jsonb(((v_rows->v_index->>'gross_cents')::bigint+v_total-v_gross_sum)::text));
  v_remaining := v_credit;
  while v_index>=0 loop
    v_gross := (v_rows->v_index->>'gross_cents')::bigint; v_applied := least(v_remaining,v_gross);
    v_rows := jsonb_set(v_rows,array[v_index::text,'credit_cents'],to_jsonb(v_applied::text));
    v_rows := jsonb_set(v_rows,array[v_index::text,'net_cents'],to_jsonb((v_gross-v_applied)::text));
    v_remaining := v_remaining-v_applied; v_index := v_index-1;
  end loop;
  v_doc := private.sales_new_document(p_case_id,'contract','awaiting_signature',jsonb_build_object('quotation_id',v_quote.id,
    'quotation_number',v_quote.number,'description',v_quote.payload->>'description','details',v_quote.payload->'details',
    'contract_text',v_issuer.contract_text,'total_cents',v_total::text,'credit_cents',v_credit::text,'schedule',v_rows),v_quote.id);
  v_result := private.sales_touch_case(p_case_id,'contract.prepare',jsonb_build_object('document_id',v_doc.id)) || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('contract.prepare',p_request_id,v_payload,v_result);
end $$;

create function private.sales_sign_contract(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
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

create function public.sales_issue_quotation(p_case_id uuid,p_version bigint,p_description text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_issue_quotation(p_case_id,p_version,p_description,p_request_id) $$;
create function public.sales_accept_quotation(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_accept_quotation(p_document_id,p_version,p_evidence_path,p_request_id) $$;
create function public.sales_prepare_contract(p_case_id uuid,p_version bigint,p_quotation_id uuid,p_schedule jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_prepare_contract(p_case_id,p_version,p_quotation_id,p_schedule,p_request_id) $$;
create function public.sales_sign_contract(p_document_id uuid,p_version bigint,p_evidence_path text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.sales_sign_contract(p_document_id,p_version,p_evidence_path,p_request_id) $$;
revoke all on function private.sales_design_credit(uuid),private.sales_issue_quotation(uuid,bigint,text,uuid),public.sales_issue_quotation(uuid,bigint,text,uuid),
  private.sales_accept_quotation(uuid,bigint,text,uuid),public.sales_accept_quotation(uuid,bigint,text,uuid),
  private.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid),public.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid),
  private.sales_sign_contract(uuid,bigint,text,uuid),public.sales_sign_contract(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_issue_quotation(uuid,bigint,text,uuid),public.sales_issue_quotation(uuid,bigint,text,uuid),
  private.sales_accept_quotation(uuid,bigint,text,uuid),public.sales_accept_quotation(uuid,bigint,text,uuid),
  private.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid),public.sales_prepare_contract(uuid,bigint,uuid,jsonb,uuid),
  private.sales_sign_contract(uuid,bigint,text,uuid),public.sales_sign_contract(uuid,bigint,text,uuid) to authenticated;
commit;
