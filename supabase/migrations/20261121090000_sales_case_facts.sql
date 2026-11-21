begin;

-- One source for the per-case facts that projectProgress()/nextStep() read (ADR 0064).
-- Moved verbatim from sales_executive_work; gated by financial.view through sales_agreement_detail.
create function private.sales_case_facts(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_result jsonb;
begin
  with cases as materialized (
    select c.id,c.brand,c.status,c.net_price_cents,p.total_cents design_total,private.sales_agreement_detail(c.id) agreement
    from private.sales_cases c
    left join private.sales_design_plans p on p.case_id=c.id
    where c.id=p_case_id
  ), facts as (
    select c.*,
      contract.d contract,quote.offered,quote.accepted,quote.offered_id,booking.d summary,
      pending.n pending,pending.since pending_since,refunds.n refunds,refunds.since refund_since,
      work.next work_next,work.acceptance,work.overdue,work.overdue_since,
      design.overdue design_overdue,design.overdue_since design_overdue_since,
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
      'contractId',f.contract->>'id','instalment',f.work_next))
  into v_result
  from facts f;
  return v_result;
end $$;

revoke all on function private.sales_case_facts(uuid) from public,anon,authenticated;

-- Same signature and output as 20261116182225; the facts now come from sales_case_facts.
create or replace function private.sales_executive_work(p_brand text, p_status text, p_query text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_result jsonb;
begin
  if (private.sales_actor()).role <> 'executive' then
    raise exception using errcode='42501', message='executive_required';
  end if;
  if p_brand is not null and p_brand not in ('BAAN_KUNAPAP','TARAVILLE') then
    raise exception using errcode='22023', message='invalid_brand';
  end if;
  if p_status is not null and p_status not in ('active','all','draft','reserved','contracted','completed','cancelled') then
    raise exception using errcode='22023', message='invalid_status';
  end if;

  with cases as materialized (
    select c.id,c.code,c.brand,c.status,c.updated_at,
      coalesce(c.customer_snapshot->>'full_name','') customer,s.full_name owner,private.sales_case_facts(c.id) f
    from private.sales_cases c
    join public.staff s on s.id=c.responsible_id
    left join private.sales_design_plans p on p.case_id=c.id
    where (p_brand is null or c.brand=p_brand)
      and case coalesce(p_status,'active') when 'all' then true
        when 'active' then c.status in ('draft','reserved','contracted')
          or (c.status='completed' and p.total_cents>0)
          or exists(select 1 from private.sales_payment_requests r where r.case_id=c.id and r.state='pending')
          or exists(select 1 from private.sales_refund_requests r where r.case_id=c.id
            and (r.state='approved' or (r.state='pending' and r.requested_by<>auth.uid())))
        else c.status=p_status end
      and (v_query='' or position(v_query in lower(c.code))>0
        or position(v_query in lower(coalesce(c.customer_snapshot->>'full_name','')))>0)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'brand',c.brand,'status',c.status,'customer',c.customer,'owner',c.owner,'updated_at',c.updated_at
    ) || c.f order by c.updated_at desc,c.id),'[]'::jsonb)
  into v_result
  from cases c
  where coalesce(p_status,'active')<>'active' or c.status in ('draft','reserved','contracted')
    or (c.f->>'pending')::integer>0 or (c.f->>'refunds')::integer>0
    or (c.status='completed' and (c.f->>'designOutstanding')::boolean);
  return v_result;
end $$;

-- Same signature; adds owner, updated_at, the per-case permissions nextStep() needs, and the facts (financial.view only).
create or replace function private.sales_case_list(p_status text,p_brand text,p_query text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_query text := lower(btrim(coalesce(p_query,'')));
begin
  perform private.sales_actor();
  if p_status is not null and p_status not in ('active','all','draft','reserved','contracted','completed','cancelled') then
    raise exception using errcode='22023',message='invalid_status';
  end if;
  if p_brand is not null and p_brand not in ('BAAN_KUNAPAP','TARAVILLE') then
    raise exception using errcode='22023',message='invalid_brand';
  end if;
  select coalesce(jsonb_agg(x.value order by x.created_at desc,x.id),'[]') into v_result from (
    select c.id,c.created_at,jsonb_build_object('id',c.id,'code',c.code,'brand',c.brand,'status',c.status,'version',c.version,
      'customer_name',c.customer_snapshot->>'full_name','lead_id',c.lead_id,'responsible_id',c.responsible_id,
      'owner',(select s.full_name from public.staff s where s.id = c.responsible_id),'updated_at',c.updated_at,
      'can_finance',a.finance,
      'detail',case when a.finance then
        coalesce((select d.name || ' · ' || u.code from private.sales_units u join private.sales_developments d on d.id = u.development_id where u.id = c.unit_id),
                 (select p.code from public.projects p where p.id = c.project_id)) end,
      'permissions',case when a.finance then (select jsonb_object_agg(k,private.sales_allowed(k,c.id)) from unnest(array[
        'financial.prepare','financial.confirm','receipt.issue','refund.request','refund.approve','refund.pay',
        'contract.sign','contract.cancel','billing.issue','acceptance.record']) k) end,
      'facts',case when a.finance then private.sales_case_facts(c.id) end) as value
    from private.sales_cases c
    cross join lateral (select private.sales_allowed('financial.view',c.id) finance) a
    where (private.sales_allowed('case.view',c.id) or a.finance)
      and (p_brand is null or c.brand::text = p_brand)
      and case coalesce(p_status,'active') when 'all' then true when 'active' then c.status::text in ('draft','reserved','contracted')
            else c.status::text = p_status end
      and (v_query = '' or position(v_query in lower(c.code)) > 0 or position(v_query in lower(coalesce(c.customer_snapshot->>'full_name',''))) > 0)
    order by c.created_at desc,c.id limit 100
  ) x;
  return v_result;
end $$;

commit;
