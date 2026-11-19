begin;
create or replace function private.sales_document_detail(p_document_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_doc private.sales_documents; v_adjustments jsonb := '[]';
begin
  select * into v_doc from private.sales_documents where id=p_document_id;
  if not found then raise exception using errcode='42501',message='document_unavailable'; end if;
  perform private.sales_require('financial.view',v_doc.case_id);
  if v_doc.kind='invoice' then
    select coalesce(jsonb_agg(jsonb_build_object('document_id',d.id,'number',d.number,
      'amount_cents',a.amount_cents::text) order by d.revision,a.id),'[]') into v_adjustments
      from private.sales_invoices i join private.sales_invoice_adjustments a on a.invoice_id=i.id
      join private.sales_documents d on d.id=a.agreement_id where i.document_id=v_doc.id;
  end if;
  return jsonb_build_object('id',v_doc.id,'case_id',v_doc.case_id,'kind',v_doc.kind,'number',v_doc.number,
    'revision',v_doc.revision,'state',v_doc.state,'document_date',v_doc.document_date,'payload',v_doc.payload,
    'customer_snapshot',v_doc.customer_snapshot,'issuer_snapshot',v_doc.issuer_snapshot,'evidence_path',v_doc.evidence_path,
    'cancelled_at',v_doc.cancelled_at,'cancel_reason',v_doc.cancel_reason,'adjustments',v_adjustments);
end $$;
commit;
