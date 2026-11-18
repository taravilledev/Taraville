begin;

-- Work Queue: cross-case work that needs the caller now, one row per case and kind, filtered by the
-- capability each kind needs on that case. Counts and ages only: no amounts, documents or Plot codes.
create function private.sales_work_queue() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  perform private.sales_actor();
  select coalesce(jsonb_agg(jsonb_build_object('case_id',q.case_id,'code',c.code,'brand',c.brand,
      'customer_name',c.customer_snapshot->>'full_name','kind',q.kind,'count',q.n,'since',q.since) order by q.since,c.id,q.kind),'[]')
    into v_rows
    from (select w.case_id,w.kind,count(*) as n,min(w.since) as since from (
        select case_id,'payment_pending' as kind,created_at as since from private.sales_payment_requests where state='pending'
        union all select case_id,'refund_pending',requested_at from private.sales_refund_requests where state='pending' and requested_by<>auth.uid()
        union all select case_id,'refund_approved',decided_at from private.sales_refund_requests where state='approved'
        union all select i.case_id,'acceptance',cc.updated_at from private.sales_instalments i join private.sales_cases cc on cc.id=i.case_id
          where i.is_active and i.needs_acceptance and i.accepted_at is null and cc.status='contracted'
      ) w group by w.case_id,w.kind) q
    join private.sales_cases c on c.id=q.case_id
    where case q.kind
      when 'payment_pending' then private.sales_allowed('financial.confirm',c.id) and private.sales_allowed('receipt.issue',c.id) and private.sales_allowed('financial.view',c.id)
      when 'refund_pending' then private.sales_allowed('refund.approve',c.id) and private.sales_allowed('financial.view',c.id)
      when 'refund_approved' then private.sales_allowed('refund.pay',c.id) and private.sales_allowed('financial.view',c.id)
      else private.sales_allowed('acceptance.record',c.id) and (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id)) end;
  return v_rows;
end $$;

create function public.sales_work_queue() returns jsonb
language sql security invoker set search_path='' as $$ select private.sales_work_queue() $$;

revoke all on function private.sales_work_queue(),public.sales_work_queue() from public,anon,authenticated;
grant execute on function private.sales_work_queue(),public.sales_work_queue() to authenticated;

commit;
