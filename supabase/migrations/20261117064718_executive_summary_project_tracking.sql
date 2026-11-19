begin;

create or replace function private.sales_executive_summary(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if (private.sales_actor()).role <> 'executive' then
    raise exception using errcode='42501', message='executive_required';
  end if;
  if p_from > p_to then
    raise exception using errcode='22023', message='invalid_date_range';
  end if;

  with cases as materialized (
    select c.id,c.code,c.status,c.net_price_cents,c.updated_at,
      coalesce(c.customer_snapshot->>'full_name','') customer,s.full_name owner,
      private.sales_financial_detail(c.id) finance,private.sales_agreement_detail(c.id) agreement
    from private.sales_cases c join public.staff s on s.id=c.responsible_id where c.brand='BAAN_KUNAPAP'
  ), movements as (
    select p.case_id,p.amount_cents,p.paid_date from private.sales_payments p join cases c on c.id=p.case_id
    where p.voided_at is null
    union all
    select p.case_id,-p.amount_cents,p.paid_date from private.sales_payouts p join cases c on c.id=p.case_id
  ), totals as (
    select case_id,sum(amount_cents) received_total,
      sum(amount_cents) filter (where (p_from is null or paid_date>=p_from) and (p_to is null or paid_date<=p_to)) received
    from movements group by case_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'status',c.status,'customer',c.customer,'owner',c.owner,
    'value',case when contract.d is not null then
      (c.net_price_cents::numeric + case when contract.d->'payload'->'design_fee_separate'='true'::jsonb
        then coalesce((c.finance->'design_plan'->>'total_cents')::numeric,0) else 0 end)::text end,
    'received',coalesce(t.received,0)::text,
    'received_total',coalesce(t.received_total,0)::text,
    'closeout',case when c.status='cancelled' then coalesce(private.sales_closeout_detail(c.id)->>'remaining_cents','0') else '0' end,
    -- Reuse detail balances and expose only fields required by the shared collection renderer.
    'finance',c.finance - array['pending','payments','documents','design_plan'] || jsonb_build_object(
      'pending',coalesce((select jsonb_agg((p - 'proof_path') || jsonb_build_object('proof_path',null,'payer_name','','description',''))
        from jsonb_array_elements(c.finance->'pending') p),'[]'::jsonb),
      'payments',coalesce((select jsonb_agg(p || jsonb_build_object('payer_name',''))
        from jsonb_array_elements(c.finance->'payments') p),'[]'::jsonb),
      'documents','[]'::jsonb,'design_plan',case when jsonb_typeof(c.finance->'design_plan')='object'
        then c.finance->'design_plan' || '{"note":""}'::jsonb end),
    'agreement',c.agreement - array['documents','instalments'] || jsonb_build_object(
      'documents',coalesce((select jsonb_agg((item - array['payload','evidence_path','customer_snapshot','parent_id']) ||
          jsonb_build_object('payload',jsonb_strip_nulls(case item->>'kind'
            when 'contract' then jsonb_build_object('design_fee_separate',item->'payload'->'design_fee_separate')
            else jsonb_build_object('price_set',item->'payload'->'price_set','total_cents',item->'payload'->'total_cents') end),
            'evidence_path',null) order by position)
        from jsonb_array_elements(c.agreement->'documents') with ordinality doc(item,position)
        where item->>'kind' in ('contract','quotation')),'[]'::jsonb),
      'instalments',coalesce((select jsonb_agg(r || jsonb_build_object('due_date',coalesce(i.due_date,(r->>'due_date')::date),'acceptance_path',null)
        order by (r->>'position')::integer,r->>'id')
        from jsonb_array_elements(c.agreement->'instalments') r
        left join private.sales_invoices i on i.id=(r->>'invoice_id')::uuid where (r->>'is_active')::boolean),'[]'::jsonb))
    ) order by c.updated_at desc,c.id),'[]'::jsonb)
  into v_result
  from cases c left join totals t on t.case_id=c.id
  left join lateral (
    select d from jsonb_array_elements(c.agreement->'documents') d
    where d->>'kind'='contract' and d->>'state' in ('draft','awaiting_signature','signed')
    order by (d->>'revision')::integer desc,d->>'id' limit 1
  ) contract on true;

  return v_result;
end $$;

commit;
