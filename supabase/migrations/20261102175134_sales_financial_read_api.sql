begin;
create function private.sales_financial_detail(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_plan jsonb; v_pending jsonb; v_payments jsonb; v_docs jsonb;
begin
  perform private.sales_require('financial.view',p_case_id);
  select jsonb_build_object('tier',tier,'usable_area',usable_area::text,'total_cents',total_cents::text,
    'instalments',instalments,'note',note) into v_plan from private.sales_design_plans where case_id=p_case_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount_cents',amount_cents::text,
    'method',method,'paid_date',paid_date,'payer_name',payer_name,'description',description,'proof_path',proof_path)
    order by created_at,id),'[]') into v_pending from private.sales_payment_requests where case_id=p_case_id and state='pending';
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount_cents',amount_cents::text,
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

create function private.sales_document_detail(p_document_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_doc private.sales_documents;
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  if not found then raise exception using errcode='42501',message='document_unavailable'; end if;
  perform private.sales_require('financial.view',v_doc.case_id);
  return jsonb_build_object('id',v_doc.id,'case_id',v_doc.case_id,'kind',v_doc.kind,'number',v_doc.number,
    'revision',v_doc.revision,'state',v_doc.state,'document_date',v_doc.document_date,'payload',v_doc.payload,
    'customer_snapshot',v_doc.customer_snapshot,'issuer_snapshot',v_doc.issuer_snapshot,'evidence_path',v_doc.evidence_path,
    'cancelled_at',v_doc.cancelled_at,'cancel_reason',v_doc.cancel_reason);
end $$;

create function private.sales_issuer_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff := private.sales_actor(); v_result jsonb;
begin
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  select coalesce(jsonb_agg(to_jsonb(i) order by brand),'[]') into v_result from private.sales_issuers i;
  return v_result;
end $$;

create function public.sales_financial_detail(p_case_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.sales_financial_detail(p_case_id) $$;
create function public.sales_document_detail(p_document_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.sales_document_detail(p_document_id) $$;
create function public.sales_issuer_settings() returns jsonb
language sql security invoker set search_path = '' as $$ select private.sales_issuer_settings() $$;
revoke all on function private.sales_financial_detail(uuid),public.sales_financial_detail(uuid),
  private.sales_document_detail(uuid),public.sales_document_detail(uuid),private.sales_issuer_settings(),public.sales_issuer_settings()
  from public,anon,authenticated;
grant execute on function private.sales_financial_detail(uuid),public.sales_financial_detail(uuid),
  private.sales_document_detail(uuid),public.sales_document_detail(uuid),private.sales_issuer_settings(),public.sales_issuer_settings() to authenticated;
commit;
