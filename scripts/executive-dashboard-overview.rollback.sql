-- Load the overview migration without COMMIT, run these assertions, then ROLLBACK.
do $$
declare
  v_executive uuid;
  v_non_executive uuid;
  v_case private.sales_cases;
  v_latest jsonb;
  v_all jsonb;
  v_bkp jsonb;
  v_trv jsonb;
  v_count bigint;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_doc uuid;
  v_bill uuid;
  v_signed_amount numeric;
  v_contract_invoice uuid;
  v_contract_balance text;
begin
  select id into strict v_executive from public.staff where is_active and role='executive' order by id limit 1;
  select id into strict v_non_executive from public.staff where is_active and role<>'executive' order by id limit 1;
  assert not has_function_privilege('anon','public.sales_dashboard_overview(text)','execute');
  assert not has_function_privilege('anon','private.sales_dashboard_overview(text)','execute');
  perform set_config('request.jwt.claim.sub',v_non_executive::text,true);
  begin
    perform public.sales_dashboard_overview(null);
    raise exception 'Dashboard was visible to non-executive';
  exception when insufficient_privilege then assert sqlerrm='executive_required'; end;
  perform set_config('request.jwt.claim.sub',v_executive::text,true);
  begin
    perform public.sales_dashboard_overview('unknown');
    raise exception 'Dashboard accepted invalid brand';
  exception when invalid_parameter_value then assert sqlerrm='invalid_brand'; end;

  v_all := public.sales_dashboard_overview(null);
  v_bkp := public.sales_dashboard_overview('BAAN_KUNAPAP');
  v_trv := public.sales_dashboard_overview('TARAVILLE');
  assert (v_all->>'leadsTotal')::bigint=(select count(*) from public.leads);
  assert jsonb_array_length(v_all->'leads')=least((select count(*) from public.leads),5);
  assert not exists(select 1 from jsonb_array_elements(v_bkp->'leads') item where item->>'brand'<>'BAAN_KUNAPAP' or item ? 'phone');
  assert not exists(select 1 from jsonb_array_elements(v_trv->'due') item where item->>'brand'<>'TARAVILLE');
  assert (v_all->>'signedTotal')::numeric=(v_bkp->>'signedTotal')::numeric+(v_trv->>'signedTotal')::numeric;
  assert (v_all->>'signedCount')::bigint=(v_bkp->>'signedCount')::bigint+(v_trv->>'signedCount')::bigint;
  assert (v_all->>'received')::numeric=(select coalesce(sum(private.sales_case_money(c.id)),0) from private.sales_cases c);
  assert (v_all->>'pending')::bigint=(select count(*) from private.sales_payment_requests where state='pending');
  assert (v_all->>'dueCount')::bigint=(v_bkp->>'dueCount')::bigint+(v_trv->>'dueCount')::bigint;
  assert jsonb_array_length(v_all->'due')=least((v_all->>'dueCount')::bigint,6);
  assert jsonb_typeof(v_all->'stageSince')='object';

  select * into strict v_case from private.sales_cases where code='BKP-69-141';
  select (d.payload->>'total_cents')::numeric into strict v_signed_amount
    from private.sales_documents d where d.case_id=v_case.id and d.kind='contract' and d.state='signed';
  update private.sales_cases set status='completed' where id=v_case.id;
  v_latest := public.sales_dashboard_overview('BAAN_KUNAPAP');
  assert (v_latest->>'signedTotal')::numeric=(v_bkp->>'signedTotal')::numeric-v_signed_amount;
  assert (v_latest->>'signedCount')::bigint=(v_bkp->>'signedCount')::bigint-1;
  assert v_latest->>'received'=v_bkp->>'received';
  update private.sales_cases set status='contracted' where id=v_case.id;

  update private.sales_design_invoices set cancelled_at=now() where case_id=v_case.id and position=3 and cancelled_at is null;
  v_bkp := public.sales_dashboard_overview('BAAN_KUNAPAP');
  v_count := (v_bkp->>'dueCount')::bigint;
  select id into strict v_doc from private.sales_new_document(v_case.id,'invoice','issued','{}');
  insert into private.sales_design_invoices(case_id,position,label,amount_cents,due_date,document_id)
    values(v_case.id,3,'Synthetic seven day boundary',500000,v_today+7,v_doc) returning id into v_bill;
  v_latest := public.sales_dashboard_overview('BAAN_KUNAPAP');
  assert (v_latest->>'dueCount')::bigint=v_count+1;
  update private.sales_design_invoices set due_date=v_today+8 where id=v_bill;
  assert (public.sales_dashboard_overview('BAAN_KUNAPAP')->>'dueCount')::bigint=v_count;
  update private.sales_design_invoices set due_date=date '2000-01-01' where id=v_bill;
  v_latest := public.sales_dashboard_overview('BAAN_KUNAPAP');
  assert v_latest->'due'->0->>'id'=v_bill::text and v_latest->'due'->0->>'group'='design';
  assert v_latest->'due'->0->>'outstanding'='500000';
  update private.sales_design_invoices set cancelled_at=now() where id=v_bill;
  assert (public.sales_dashboard_overview('BAAN_KUNAPAP')->>'dueCount')::bigint=v_count;

  select i.id,private.sales_invoice_totals(i.id)->>'outstanding_cents' into strict v_contract_invoice,v_contract_balance
    from private.sales_cases c join private.sales_invoices i on i.case_id=c.id and i.cancelled_at is null
    where c.code='BKP-69-140';
  assert v_contract_balance::numeric>0;
  update private.sales_invoices set due_date=date '2000-01-01' where id=v_contract_invoice;
  v_latest := public.sales_dashboard_overview('BAAN_KUNAPAP');
  assert v_latest->'due'->0->>'id'=v_contract_invoice::text and v_latest->'due'->0->>'group'='contract';
  assert v_latest->'due'->0->>'outstanding'=v_contract_balance;
  raise notice 'PASS: executive access, brand scope, signed snapshots, cash, due windows and cancelled bill exclusion';
end $$;
