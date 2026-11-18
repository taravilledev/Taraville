begin;

create function private.sales_dashboard_overview(p_brand text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_result jsonb;
begin
  if (private.sales_actor()).role <> 'executive' then
    raise exception using errcode='42501', message='executive_required';
  end if;
  if p_brand is not null and p_brand not in ('BAAN_KUNAPAP','TARAVILLE') then
    raise exception using errcode='22023', message='invalid_brand';
  end if;

  with cases as materialized (
    select c as sale,c.id,c.code,c.status,c.brand,coalesce(c.customer_snapshot->>'full_name','') customer
    from private.sales_cases c where p_brand is null or c.brand=p_brand
  ), leads as materialized (
    select l.id,concat_ws(' ',nullif(l.name_title,''),l.first_name,nullif(l.last_name,'')) customer,
      l.brand,l.created_at,s.full_name owner
    from public.leads l join public.staff s on s.id=l.owner_id
    where p_brand is null or l.brand=p_brand
  ), signed as (
    select distinct on (c.id) (d.payload->>'total_cents')::numeric amount
    from cases c join private.sales_documents d on d.case_id=c.id
    where c.status='contracted' and d.kind='contract' and d.state='signed'
    order by c.id,d.revision desc,d.id
  ), cash as (
    select p.amount_cents from private.sales_payments p join cases c on c.id=p.case_id where p.voided_at is null
    union all
    select -p.amount_cents from private.sales_payouts p join cases c on c.id=p.case_id
  ), stage_dates as (
    select c.id,
      min(d.created_at) filter (where d.kind='quotation' and d.state='offered'
        and d.payload->'price_set' is distinct from 'false'::jsonb
        and (d.payload->>'total_cents')::numeric>0) quotation,
      min(d.finalized_at) filter (where d.kind='contract' and d.state='awaiting_signature') signature
    from cases c join private.sales_documents d on d.case_id=c.id
    where c.status in ('draft','reserved')
      and ((d.kind='quotation' and d.state='offered') or (d.kind='contract' and d.state='awaiting_signature'))
    group by c.id
  ), due as materialized (
    select i.id,c.id case_id,c.code,c.customer,c.brand,s.label,i.due_date,
      (b.balance->>'outstanding_cents')::numeric outstanding,'contract' group_key,i.document_id
    from cases c join private.sales_invoices i on i.case_id=c.id
    join private.sales_instalments s on s.id=i.instalment_id and s.is_active
    cross join lateral (select private.sales_invoice_totals(i.id) balance) b
    where c.status<>'cancelled' and i.cancelled_at is null and i.due_date<=v_today+7
      and (b.balance->>'is_active')::boolean and (b.balance->>'outstanding_cents')::numeric>0
    union all
    select i.id,c.id,c.code,c.customer,c.brand,i.label,i.due_date,i.amount_cents-p.received,'design',i.document_id
    from cases c join private.sales_design_invoices i on i.case_id=c.id
    join private.sales_documents d on d.id=i.document_id and d.state='issued'
    cross join lateral (
      select coalesce(sum(p.amount_cents-(private.sales_payment_totals(coalesce(p.root_id,p.id))->>'refunded_cents')::numeric),0) received
      from private.sales_payment_requests r join private.sales_payments p on p.request_id=r.id
      where r.design_invoice_id=i.id and p.voided_at is null
    ) p
    where i.cancelled_at is null and i.due_date<=v_today+7 and private.sales_can_collect_design(c.sale)
      and i.amount_cents>p.received
  )
  select jsonb_build_object(
    'leadsTotal',(select count(*) from leads),
    'signedTotal',(select coalesce(sum(amount),0)::text from signed),
    'signedCount',(select count(*) from signed),
    'received',(select coalesce(sum(amount_cents),0)::text from cash),
    'pending',(select count(*) from private.sales_payment_requests r join cases c on c.id=r.case_id where r.state='pending'),
    'leads',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc,l.id desc)
      from (select * from leads order by created_at desc,id desc limit 5) l),'[]'::jsonb),
    'due',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'case_id',d.case_id,'code',d.code,'customer',d.customer,'brand',d.brand,
      'label',d.label,'due_date',d.due_date,'outstanding',d.outstanding::text,'group',d.group_key,'document_id',d.document_id)
      order by d.due_date,d.code,d.id)
      from (select * from due order by due_date,code,id limit 6) d),'[]'::jsonb),
    'dueCount',(select count(*) from due),
    -- Work schedules do not record when an instalment actually started waiting for inspection.
    'stageSince',coalesce((select jsonb_object_agg(s.id,jsonb_build_object(
      'quotation',s.quotation,'signature',s.signature,'acceptance',null)) from stage_dates s),'{}'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create function public.sales_dashboard_overview(p_brand text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.sales_dashboard_overview(p_brand) $$;

revoke all on function private.sales_dashboard_overview(text),public.sales_dashboard_overview(text) from public,anon,authenticated;
grant execute on function private.sales_dashboard_overview(text),public.sales_dashboard_overview(text) to authenticated;

notify pgrst,'reload schema';
commit;
