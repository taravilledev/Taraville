begin;
create or replace function private.sales_agreement_detail(p_case_id uuid) returns jsonb
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
  return jsonb_build_object('documents',v_docs,'instalments',v_rows,'is_settled',
    exists(select 1 from jsonb_array_elements(v_rows) r where (r->>'is_active')::boolean)
    and not exists(select 1 from jsonb_array_elements(v_rows) r where (r->>'is_active')::boolean
      and ((r->'balance'->>'is_active')::boolean is distinct from true
        or (r->'balance'->>'outstanding_cents') is distinct from '0'
        or ((r->>'needs_acceptance')::boolean and r->>'accepted_at' is null)))
    and not exists(select 1 from private.sales_refund_requests where case_id=p_case_id and state in ('pending','approved')));
end $$;
commit;
