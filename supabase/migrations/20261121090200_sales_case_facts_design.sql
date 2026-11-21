begin;

-- Adds the design-fee facts (ADR 0058) and the BKP stage inputs (ADR 0057) to sales_case_facts; signature unchanged.
create or replace function private.sales_case_facts(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_result jsonb;
begin
  with cases as materialized (
    select c.id,c.brand,c.status,c.net_price_cents,p.total_cents design_total,p.instalments design_instalments,
      private.sales_can_collect_design(c) design_collectable,private.sales_agreement_detail(c.id) agreement
    from private.sales_cases c
    left join private.sales_design_plans p on p.case_id=c.id
    where c.id=p_case_id
  ), facts as (
    select c.*,
      contract.d contract,quote.offered,quote.accepted,quote.offered_id,booking.d summary,
      pending.n pending,pending.since pending_since,refunds.n refunds,refunds.since refund_since,
      work.next work_next,work.acceptance,work.overdue,work.overdue_since,
      design.overdue design_overdue,design.overdue_since design_overdue_since,designfacts.design_facts,
      coalesce(c.design_total > design.received
        and not coalesce(contract.d->>'state'='signed' and contract.d->'payload'->'design_fee_separate' is distinct from 'true'::jsonb,false)
        and c.status<>'cancelled',false) design_outstanding
    from cases c
    left join lateral (
      select d from jsonb_array_elements(c.agreement->'documents') d
      where d->>'kind'='contract' and d->>'state' in ('draft','awaiting_signature','signed')
      order by (d->>'revision')::integer desc,d->>'id' limit 1
    ) contract on true
    cross join lateral (
      select count(*) filter (where item->>'state'='offered') offered,
        count(*) filter (where item->>'state'='accepted') accepted,
        (array_agg(item->>'id' order by (item->>'revision')::integer desc, item->>'id')
          filter (where item->>'state'='offered'))[1] offered_id
      from jsonb_array_elements(c.agreement->'documents') doc(item) where item->>'kind'='quotation'
        and item->'payload'->'price_set' is distinct from 'false'::jsonb
        and (item->'payload'->>'total_cents')::numeric > 0
    ) quote
    left join lateral (
      select d.payload d from private.sales_documents d where c.brand='TARAVILLE' and d.case_id=c.id and d.kind='summary'
      order by d.created_at desc,d.id desc limit 1
    ) booking on true
    cross join lateral (
      select count(*) n,min(r.created_at) since from private.sales_payment_requests r where r.case_id=c.id and r.state='pending'
    ) pending
    cross join lateral (
      select count(*) n,min(case when r.state='pending' then r.requested_at else r.decided_at end) since
      from private.sales_refund_requests r where r.case_id=c.id
        and (r.state='approved' or (r.state='pending' and r.requested_by<>auth.uid()))
    ) refunds
    cross join lateral (
      select
        (jsonb_agg(jsonb_build_object('id',i.r->'id','label',i.r->'label','needsAcceptance',i.r->'needs_acceptance',
          'accepted',i.r->>'accepted_at' is not null,'hasInvoice',i.r->>'invoice_id' is not null,
          'outstanding',i.cents>0,'isCreditCovered',i.r->>'net_cents'='0')
          order by (i.r->>'position')::integer,i.r->>'id') filter (where i.cents>0
            or i.r->>'invoice_id' is null or ((i.r->>'needs_acceptance')::boolean and i.r->>'accepted_at' is null)))->0 as next,
        count(*) filter (where c.status='contracted' and (i.r->>'needs_acceptance')::boolean and i.r->>'accepted_at' is null) acceptance,
        count(*) filter (where i.overdue) overdue, min(i.due) filter (where i.overdue) overdue_since
      from (
        select r,due.due,outstanding.cents,
          c.status<>'cancelled' and coalesce((r->'balance'->>'is_active')::boolean,false)
            and outstanding.cents>0 and due.due<v_today overdue
        from jsonb_array_elements(c.agreement->'instalments') r
        left join private.sales_invoices invoice on invoice.id=(r->>'invoice_id')::uuid
        cross join lateral (select coalesce(invoice.due_date,(r->>'due_date')::date) due) due
        cross join lateral (select coalesce((r->'balance'->>'outstanding_cents')::numeric,(r->>'net_cents')::numeric) cents) outstanding
        where (r->>'is_active')::boolean
      ) i
    ) work
    cross join lateral (
      select
        (select coalesce(sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric),0)
          from private.sales_payments p where p.case_id=c.id and p.kind='design_fee' and p.voided_at is null) received,
        count(*) overdue,min(i.due_date) overdue_since
      from private.sales_design_invoices i
      where i.case_id=c.id and i.cancelled_at is null and i.due_date<v_today and c.status<>'cancelled'
        and not coalesce(contract.d->>'state'='signed' and contract.d->'payload'->'design_fee_separate' is distinct from 'true'::jsonb,false)
        and i.amount_cents > coalesce((select sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric)
          from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id
          where r.design_invoice_id=i.id and p.voided_at is null),0)
    ) design
    cross join lateral (
      -- Mirrors designFacts()/canCollectDesign() in src/lib/sales/tasks.ts (ADR 0058).
      select jsonb_build_object(
        'canCollect',c.design_collectable
          and not exists(select 1 from private.sales_payments p join private.sales_payment_requests r on r.id=p.request_id
            where p.case_id=c.id and p.kind='design_fee' and r.design_invoice_id is null)
          and not exists(select 1 from private.sales_payment_requests r where r.case_id=c.id and r.kind='design_fee'
            and r.state='pending' and r.design_invoice_id is null),
        'feesPaid',c.design_total is not null and design.received>=c.design_total,
        'hasQuotation',exists(select 1 from jsonb_array_elements(c.agreement->'documents') q where q->>'kind'='quotation' and q->>'state'<>'cancelled'),
        'instalments',coalesce((select jsonb_agg(jsonb_build_object('amount',amount.v,
            'bill',case when bill.id is null then 'none' when bill.open then 'open' else 'settled' end,'billId',bill.id) order by amount.n)
          from jsonb_array_elements_text(c.design_instalments) with ordinality amount(v,n)
          left join lateral (
            select b.id,not exists(select 1 from private.sales_payment_requests r where r.design_invoice_id=b.id and r.state in ('pending','confirmed'))
              and not exists(select 1 from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id
                where r.design_invoice_id=b.id and p.voided_at is null and p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric<>0) open
            from private.sales_design_invoices b where b.case_id=c.id and b.position=amount.n and b.cancelled_at is null
            order by b.created_at desc,b.id desc limit 1
          ) bill on true),'[]'::jsonb)) design_facts
    ) designfacts
  )
  select jsonb_build_object(
    'waiting_since',least(f.pending_since,f.refund_since,
      f.overdue_since::timestamp at time zone 'Asia/Bangkok',f.design_overdue_since::timestamp at time zone 'Asia/Bangkok'),
    'pending',f.pending,'acceptance',f.acceptance,'refunds',f.refunds,'overdue',f.overdue+f.design_overdue,
    'designOutstanding',f.design_outstanding,
    'input',jsonb_build_object('hasNetPrice',f.net_price_cents is not null,'hasSummary',f.summary is not null,
      'hasBookingReceipt',exists(select 1 from private.sales_payments p where p.case_id=f.id and p.kind='booking' and p.voided_at is null),
      'isBookingDue',coalesce((f.summary->>'booking_cents')::numeric>0,false),'hasDesignPlan',f.design_total is not null,
      'pendingPayments',f.pending,'refundsToAct',f.refunds,
      'plotHeld',exists(select 1 from private.sales_reservations r where r.case_id=f.id and r.released_at is null),
      'isSettled',(f.agreement->>'is_settled')::boolean,
      'quotations',jsonb_build_object('offered',f.offered,'accepted',f.accepted,'offeredId',f.offered_id),
      'contract',case f.contract->>'state' when 'awaiting_signature' then 'awaiting' else coalesce(f.contract->>'state','none') end,
      'contractId',f.contract->>'id','instalment',f.work_next,
      'design',case when f.brand='BAAN_KUNAPAP' then f.design_facts end))
  into v_result
  from facts f;
  return v_result;
end $$;

commit;
