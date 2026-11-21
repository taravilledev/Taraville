begin;

-- Same signature as 20261105000200; adds kind 'design_fee' (BKP design invoices still unpaid, "ค่าแบบค้าง").
-- Gated like sales_prepare_design_payment (financial.prepare) plus financial.view; 'overdue' counts items past due (design_fee only).
create or replace function private.sales_work_queue() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  perform private.sales_actor();
  select coalesce(jsonb_agg(jsonb_build_object('case_id',q.case_id,'code',c.code,'brand',c.brand,
      'customer_name',c.customer_snapshot->>'full_name','kind',q.kind,'count',q.n,'since',q.since,'overdue',q.overdue) order by q.since,c.id,q.kind),'[]')
    into v_rows
    from (select w.case_id,w.kind,count(*) as n,min(w.since) as since,count(*) filter (where w.is_overdue) as overdue from (
        select case_id,'payment_pending' as kind,created_at as since,false as is_overdue from private.sales_payment_requests where state='pending'
        union all select case_id,'refund_pending',requested_at,false from private.sales_refund_requests where state='pending' and requested_by<>auth.uid()
        union all select case_id,'refund_approved',decided_at,false from private.sales_refund_requests where state='approved'
        union all select i.case_id,'acceptance',cc.updated_at,false from private.sales_instalments i join private.sales_cases cc on cc.id=i.case_id
          where i.is_active and i.needs_acceptance and i.accepted_at is null and cc.status='contracted'
        union all select i.case_id,'design_fee',i.due_date::timestamp at time zone 'Asia/Bangkok',i.due_date<v_today
          from private.sales_design_invoices i join private.sales_cases cc on cc.id=i.case_id
          where i.cancelled_at is null and private.sales_can_collect_design(cc)
            and i.amount_cents > coalesce((select sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric)
              from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id
              where r.design_invoice_id=i.id and p.voided_at is null),0)
      ) w group by w.case_id,w.kind) q
    join private.sales_cases c on c.id=q.case_id
    where case q.kind
      when 'payment_pending' then private.sales_allowed('financial.confirm',c.id) and private.sales_allowed('receipt.issue',c.id) and private.sales_allowed('financial.view',c.id)
      when 'refund_pending' then private.sales_allowed('refund.approve',c.id) and private.sales_allowed('financial.view',c.id)
      when 'refund_approved' then private.sales_allowed('refund.pay',c.id) and private.sales_allowed('financial.view',c.id)
      when 'design_fee' then private.sales_allowed('financial.prepare',c.id) and private.sales_allowed('financial.view',c.id)
      else private.sales_allowed('acceptance.record',c.id) and (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id)) end;
  return v_rows;
end $$;

commit;
