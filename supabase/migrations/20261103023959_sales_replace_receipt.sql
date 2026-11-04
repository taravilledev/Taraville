begin;
create function private.sales_correct_receipt(p_document_id uuid,p_version bigint,p_reason text,p_description text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_receipt private.sales_receipts;
  v_old private.sales_documents;
  v_new private.sales_documents;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('document',p_document_id,'version',p_version,'reason',p_reason,'description',p_description);
begin
  select * into v_receipt from private.sales_receipts where document_id=p_document_id;
  v_case := private.sales_lock_case(v_receipt.case_id,'receipt.cancel');
  if p_description is not null then perform private.sales_require('receipt.issue',v_case.id); end if;
  v_result := private.sales_replay('receipt.correct',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  select * into v_receipt from private.sales_receipts where document_id=p_document_id for update;
  select * into v_old from private.sales_documents where id=p_document_id for update;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000
    or (p_description is not null and length(btrim(p_description)) not between 1 and 1000) then
    raise exception using errcode='22023',message='invalid_receipt_correction';
  end if;
  if v_receipt.is_active then
    update private.sales_receipts set is_active=false where id=v_receipt.id;
    update private.sales_documents set state='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=p_reason,version=version+1
      where id=p_document_id;
  elsif p_description is null or exists(select 1 from private.sales_receipts where root_payment_id=v_receipt.root_payment_id and is_active)
    or exists(select 1 from private.sales_documents where parent_id=p_document_id and kind='receipt') then
    raise exception using errcode='22023',message='receipt_already_replaced_or_cancelled';
  end if;
  if p_description is not null then
    if not exists(select 1 from private.sales_payments where id=v_receipt.payment_id and voided_at is null) then
      raise exception using errcode='22023',message='payment_no_longer_current';
    end if;
    v_new := private.sales_new_document(v_case.id,'receipt','issued',v_old.payload || jsonb_build_object(
      'description',p_description,'replaces_number',v_old.number,'replacement_reason',p_reason),p_document_id);
    insert into private.sales_receipts(case_id,root_payment_id,payment_id,document_id)
      values(v_case.id,v_receipt.root_payment_id,v_receipt.payment_id,v_new.id);
  end if;
  v_result := private.sales_touch_case(v_case.id,'receipt.correct',v_payload || jsonb_build_object('replacement',v_new.id))
    || jsonb_build_object('document_id',v_new.id);
  return private.sales_remember('receipt.correct',p_request_id,v_payload,v_result);
end $$;
create function public.sales_correct_receipt(p_document_id uuid,p_version bigint,p_reason text,p_description text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.sales_correct_receipt(p_document_id,p_version,p_reason,p_description,p_request_id)
$$;
revoke all on function private.sales_correct_receipt(uuid,bigint,text,text,uuid),public.sales_correct_receipt(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function private.sales_correct_receipt(uuid,bigint,text,text,uuid),public.sales_correct_receipt(uuid,bigint,text,text,uuid) to authenticated;
commit;
