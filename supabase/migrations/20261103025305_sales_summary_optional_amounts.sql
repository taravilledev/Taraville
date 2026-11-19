begin;
create or replace function private.sales_save_booking_summary(p_case_id uuid,p_version bigint,p_input jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_doc private.sales_documents;
  v_plot record;
  v_booking bigint;
  v_contract bigint;
  v_down bigint;
  v_result jsonb;
  v_mortgage bigint;
  v_dates jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'input',p_input);
begin
  v_case := private.sales_lock_case(p_case_id,'financial.prepare');
  v_result := private.sales_replay('summary.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'TARAVILLE' or v_case.status not in ('draft','reserved') or v_case.net_price_cents is null
    or jsonb_typeof(p_input) is distinct from 'object'
    or length(btrim(coalesce(v_case.customer_snapshot->>'full_name','')))=0 then
    raise exception using errcode='22023',message='summary_unavailable';
  end if;
  v_mortgage := private.sales_money(nullif(p_input->>'mortgage_cents',''));
  v_dates := jsonb_build_object(
    'booking_date',nullif(p_input->>'booking_date','')::date,
    'contract_date',nullif(p_input->>'contract_date','')::date,
    'down_date',nullif(p_input->>'down_date','')::date);
  v_booking := private.sales_money(nullif(p_input->>'booking_cents',''));
  v_contract := private.sales_money(nullif(p_input->>'contract_cents',''));
  v_down := private.sales_money(nullif(p_input->>'down_cents',''));
  if coalesce(v_booking,0)::numeric+coalesce(v_contract,0)+coalesce(v_down,0)>v_case.net_price_cents
    or length(coalesce(p_input->>'conditions',''))>5000 or length(coalesce(p_input->>'freebies',''))>5000 then
    raise exception using errcode='22023',message='invalid_summary_terms';
  end if;
  select u.code,d.name into strict v_plot from private.sales_units u
    join private.sales_developments d on d.id=u.development_id where u.id=v_case.unit_id;
  v_doc := private.sales_new_document(p_case_id,'summary','issued',jsonb_build_object(
    'development',v_plot.name,'plot',v_plot.code,'details',v_case.details,
    'list_cents',v_case.list_price_cents::text,'promotion_cents',v_case.promotion_price_cents::text,
    'discount_cents',v_case.discount_cents::text,'total_cents',v_case.net_price_cents::text,
    'booking_cents',v_booking::text,'contract_cents',v_contract::text,'down_cents',v_down::text,
    'balance_cents',(v_case.net_price_cents-coalesce(v_booking,0)-coalesce(v_contract,0)-coalesce(v_down,0))::text,
    'conditions',coalesce(p_input->>'conditions',''),'freebies',coalesce(p_input->>'freebies',''),'mortgage_cents',v_mortgage::text) || v_dates);
  v_result := private.sales_touch_case(p_case_id,'summary.save',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('summary.save',p_request_id,v_payload,v_result);
end $$;
create or replace function private.sales_sign_property_contract(p_case_id uuid,p_version bigint,p_summary_id uuid,p_down_count integer,
  p_evidence_path text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_case private.sales_cases;
  v_summary private.sales_documents;
  v_doc private.sales_documents;
  v_template text;
  v_booked bigint;
  v_received numeric;
  v_down bigint;
  v_each bigint;
  v_rows jsonb;
  v_result jsonb;
  v_payload jsonb := jsonb_build_object('case',p_case_id,'version',p_version,'summary',p_summary_id,'count',p_down_count,'evidence',p_evidence_path);
begin
  v_case := private.sales_lock_case(p_case_id,'contract.sign');
  v_result := private.sales_replay('property.sign',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if v_case.version is distinct from p_version then raise exception using errcode='PT409',message='stale_case'; end if;
  if v_case.brand<>'TARAVILLE' or v_case.status<>'reserved' or p_down_count is null or p_down_count not between 0 and 98
    or not exists(select 1 from private.sales_reservations where case_id=p_case_id and unit_id=v_case.unit_id and released_at is null) then
    raise exception using errcode='22023',message='property_contract_unavailable';
  end if;
  select s.* into v_summary from private.sales_documents s join private.sales_units u on u.id=v_case.unit_id
    join private.sales_developments d on d.id=u.development_id
    where s.id=p_summary_id and s.case_id=p_case_id and s.kind='summary' and s.state='issued'
      and s.payload->>'plot'=u.code and s.payload->>'development'=d.name
      and s.payload->>'total_cents'=v_case.net_price_cents::text
      and not exists(select 1 from private.sales_events e where e.case_id=p_case_id and e.action='reservation.change'
        and e.created_at>=s.created_at);
  if not found then raise exception using errcode='22023',message='current_summary_required'; end if;
  select contract_text into v_template from private.sales_issuers where brand='TARAVILLE' for share;
  if length(btrim(coalesce(v_template,'')))=0 then raise exception using errcode='22023',message='approved_contract_text_required'; end if;
  perform private.sales_check_evidence(p_case_id,p_evidence_path,'agreement');
  v_booked := coalesce((v_summary.payload->>'booking_cents')::bigint,0);
  v_down := coalesce((v_summary.payload->>'down_cents')::bigint,0);
  if (v_down=0) is distinct from (p_down_count=0) or (p_down_count>0 and v_down<p_down_count) then
    raise exception using errcode='22023',message='invalid_downpayment_count';
  end if;
  if exists(select 1 from private.sales_refund_requests r join private.sales_payments p on p.id=r.root_payment_id
    where r.case_id=p_case_id and p.kind='booking' and r.state in ('pending','approved')) then
    raise exception using errcode='22023',message='resolve_pending_booking_refund';
  end if;
  select coalesce(sum((private.sales_payment_totals(coalesce(root_id,id))->>'free_cents')::numeric),0)
    into v_received from private.sales_payments where case_id=p_case_id and kind='booking' and voided_at is null;
  if v_received<0 or v_received>v_booked then raise exception using errcode='22023',message='booking_credit_exceeds_agreement'; end if;
  v_each := case when p_down_count>0 then v_down/p_down_count else 0 end;
  select jsonb_agg(jsonb_build_object('position',position,'label',label,'gross_cents',gross::text,'credit_cents',credit::text,
    'net_cents',(gross-credit)::text,'progress_percent',null,'needs_acceptance',false) order by position)
    into v_rows from (
      select 0 position,'เงินจอง' label,v_booked gross,v_received::bigint credit
      union all select 1,'วันทำสัญญา',coalesce((v_summary.payload->>'contract_cents')::bigint,0),0
      union all select n+1,'เงินดาวน์งวด '||n,v_each+case when n=p_down_count then v_down-v_each*p_down_count else 0 end,0
        from generate_series(1,p_down_count) n
      union all select p_down_count+2,'ยอดคงเหลือ',(v_summary.payload->>'balance_cents')::bigint,0
    ) schedule;
  v_doc := private.sales_new_document(p_case_id,'contract','signed',jsonb_build_object(
    'description','โครงการ '||(v_summary.payload->>'development')||' · แปลง '||(v_summary.payload->>'plot'),
    'contract_text',v_template,'total_cents',v_case.net_price_cents::text,'credit_cents',v_received::text,
    'schedule',v_rows,'unit_id',v_case.unit_id,'summary',v_summary.payload),p_summary_id,p_evidence_path);
  insert into private.sales_instalments(case_id,contract_id,position,label,gross_cents,credit_cents,needs_acceptance)
    select p_case_id,v_doc.id,(row->>'position')::integer,row->>'label',(row->>'gross_cents')::bigint,(row->>'credit_cents')::bigint,false
    from jsonb_array_elements(v_rows) row;
  perform private.sales_apply_credits(p_case_id,v_doc.id);
  update private.sales_cases set status='contracted' where id=p_case_id;
  update private.sales_payment_requests set state='rejected',version=version+1 where case_id=p_case_id and kind='booking' and state='pending';
  v_result := private.sales_touch_case(p_case_id,'property.sign',jsonb_build_object('document_id',v_doc.id))
    || jsonb_build_object('document_id',v_doc.id);
  return private.sales_remember('property.sign',p_request_id,v_payload,v_result);
end $$;
commit;
