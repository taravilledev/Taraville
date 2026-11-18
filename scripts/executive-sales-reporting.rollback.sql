-- Apply the executive summary tracking migration without its COMMIT, run this file, then ROLLBACK.
do $$
declare
  v_executive uuid;
  v_non_executive uuid;
  v_case private.sales_cases;
  v_work jsonb;
  v_summary jsonb;
  v_period jsonb;
  v_expected numeric;
  v_refund uuid;
  v_refund_doc uuid;
  v_refund_date date := date '2001-01-02';
  v_date date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select id into strict v_executive from public.staff where is_active and role='executive' order by id limit 1;
  select id into strict v_non_executive from public.staff where is_active and role<>'executive' order by id limit 1;
  assert not has_function_privilege('anon','public.sales_executive_work(text,text,text)','execute');
  assert not has_function_privilege('anon','public.sales_executive_summary(date,date)','execute');

  perform set_config('request.jwt.claim.sub',v_non_executive::text,true);
  begin
    perform public.sales_executive_work(null,'all',null);
    raise exception 'Work report was visible to non-executive';
  exception when insufficient_privilege then assert sqlerrm='executive_required'; end;
  begin
    perform public.sales_executive_summary(null,null);
    raise exception 'Financial report was visible to non-executive';
  exception when insufficient_privilege then assert sqlerrm='executive_required'; end;

  perform set_config('request.jwt.claim.sub',v_executive::text,true);
  begin
    perform public.sales_executive_summary(v_date,v_date-1);
    raise exception 'Reversed reporting range accepted';
  exception when invalid_parameter_value then assert sqlerrm='invalid_date_range'; end;

  select * into strict v_case from private.sales_cases where code='BKP-69-141';
  v_work := public.sales_executive_work(null,'all',null);
  assert jsonb_array_length(v_work)=(select count(*) from private.sales_cases);
  assert exists(select 1 from jsonb_array_elements(v_work) x where x->>'brand'='TARAVILLE');
  v_work := public.sales_executive_work('BAAN_KUNAPAP','active',' bkp-69-141 ');
  assert jsonb_array_length(v_work)=1 and v_work->0->>'code'=v_case.code;
  assert v_work->0->'input'->>'contract'='signed';
  assert (v_work->0->>'designOutstanding')::boolean;

  v_summary := public.sales_executive_summary(null,null);
  assert jsonb_array_length(v_summary)=(select count(*) from private.sales_cases where brand='BAAN_KUNAPAP');
  select x into strict v_summary from jsonb_array_elements(v_summary) x where x->>'id'=v_case.id::text;
  select x into strict v_period from jsonb_array_elements(public.sales_executive_summary(v_date,v_date)) x where x->>'id'=v_case.id::text;
  assert v_summary->>'value'='201200000';
  assert (v_summary->>'received')::numeric=private.sales_case_money(v_case.id);
  assert v_summary->>'received_total'=v_summary->>'received';
  assert v_period->>'received_total'=v_summary->>'received_total';
  assert v_summary->'agreement'=v_period->'agreement' and v_summary->'finance'=v_period->'finance';
  select coalesce(sum(amount),0) into v_expected from (
    select p.amount_cents amount from private.sales_payments p where p.case_id=v_case.id and p.voided_at is null and p.paid_date=v_date
    union all
    select -p.amount_cents from private.sales_payouts p where p.case_id=v_case.id and p.paid_date=v_date
  ) x;
  assert (v_period->>'received')::numeric=v_expected;
  assert not exists(select 1 from jsonb_array_elements(v_summary->'agreement'->'documents') d
    where d->>'evidence_path' is not null or d->'payload' ? 'contract_text');
  assert exists(select 1 from jsonb_array_elements(v_summary->'agreement'->'documents') d where d->>'kind'='quotation');
  assert not exists(select 1 from jsonb_array_elements(v_summary->'agreement'->'documents') d
    where d->>'kind'='quotation' and (d ? 'customer_snapshot' or (d->'payload') - array['price_set','total_cents'] <> '{}'::jsonb));
  insert into private.sales_refund_requests(case_id,root_payment_id,amount_cents,reason,state,requested_by,decided_by,decided_at)
    select v_case.id,coalesce(p.root_id,p.id),321,'Synthetic reporting refund','paid',v_non_executive,v_executive,now()
    from private.sales_payments p where p.case_id=v_case.id and p.voided_at is null order by p.id limit 1 returning id into strict v_refund;
  select d.id into strict v_refund_doc from private.sales_new_document(v_case.id,'refund','issued','{}') d;
  insert into private.sales_payouts(case_id,refund_id,amount_cents,method,paid_date,proof_path,document_id,paid_by)
    values(v_case.id,v_refund,321,'cash',v_refund_date,'synthetic-reporting-proof',v_refund_doc,v_executive);
  select x into strict v_period from jsonb_array_elements(public.sales_executive_summary(v_refund_date,v_refund_date)) x where x->>'id'=v_case.id::text;
  assert v_period->>'received'='-321';
  assert (v_period->>'received_total')::numeric=(v_summary->>'received_total')::numeric-321;

  update private.sales_cases set status='completed' where id=v_case.id;
  v_work := public.sales_executive_work('BAAN_KUNAPAP','active',v_case.code);
  assert jsonb_array_length(v_work)=1 and (v_work->0->>'designOutstanding')::boolean;

  insert into private.sales_payment_requests(case_id,kind,amount_cents,method,paid_date,payer_name,description,created_by)
    values(v_case.id,'unallocated',1,'cash',v_date,'Synthetic payer','Reporting scope check',v_executive);
  update private.sales_cases set status='cancelled' where id=v_case.id;
  v_work := public.sales_executive_work('BAAN_KUNAPAP','active',v_case.code);
  assert jsonb_array_length(v_work)=1 and (v_work->0->>'pending')::integer>0;
  assert (v_work->0->>'overdue')::integer=0 and not (v_work->0->>'designOutstanding')::boolean;
  raise notice 'PASS: executive role, untruncated scope, design separation, cash period, evidence boundaries, and exceptional active work';
end $$;
