-- Rollback for the six UX-redesign migrations (20261121090000 … 20261122090000) on prod.
-- Function bodies are the PROD definitions dumped read-only on 2026-11-22 (supabase db query --linked),
-- so running this restores prod exactly as it was before the push. Run the whole file in one transaction.
-- Data is not touched: only the functions and one column default change back.

begin;

-- private.sales_allowed(text,uuid,uuid)
CREATE OR REPLACE FUNCTION private.sales_allowed(p_action text, p_case_id uuid DEFAULT NULL::uuid, p_lead_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_own boolean := false; v_cap private.sales_capabilities;
begin
  select role into v_role from public.staff where id=auth.uid() and is_active;
  if not found then return false; end if;
  if p_case_id is not null then
    select case when p_action in ('case.view','case.edit','acceptance.record') then c.responsible_id=auth.uid()
      else l.owner_id=auth.uid() end into v_own from private.sales_cases c join public.leads l on l.id=c.lead_id where c.id=p_case_id;
  elsif p_lead_id is not null then select owner_id=auth.uid() into v_own from public.leads where id=p_lead_id; end if;
  select * into v_cap from private.sales_capabilities where staff_id=auth.uid() and action=p_action;
  if found then return v_cap.enabled and (v_cap.scope='all' or coalesce(v_own,false)); end if;
  if v_role='executive' then return true; end if;
  return (p_action='financial.view' or (v_role='sale' and p_action in ('case.view','case.edit','case.create',
    'financial.prepare','billing.issue','acceptance.record','contract.sign','financial.confirm','receipt.issue')))
    and coalesce(v_own,false);
end $function$;

-- private.sales_case_list(text,text,text)
CREATE OR REPLACE FUNCTION private.sales_case_list(p_status text, p_brand text, p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'can_finance',private.sales_allowed('financial.view',c.id),
      'detail',case when private.sales_allowed('financial.view',c.id) then
        coalesce((select d.name || ' · ' || u.code from private.sales_units u join private.sales_developments d on d.id = u.development_id where u.id = c.unit_id),
                 (select p.code from public.projects p where p.id = c.project_id)) end) as value
    from private.sales_cases c
    where (private.sales_allowed('case.view',c.id) or private.sales_allowed('financial.view',c.id))
      and (p_brand is null or c.brand::text = p_brand)
      and case coalesce(p_status,'active') when 'all' then true when 'active' then c.status::text in ('draft','reserved','contracted')
            else c.status::text = p_status end
      and (v_query = '' or position(v_query in lower(c.code)) > 0 or position(v_query in lower(coalesce(c.customer_snapshot->>'full_name',''))) > 0)
    order by c.created_at desc,c.id limit 100
  ) x;
  return v_result;
end $function$;

-- private.sales_executive_work(text,text,text)
CREATE OR REPLACE FUNCTION private.sales_executive_work(p_brand text, p_status text, p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
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
    select c.id,c.code,c.brand,c.status,c.net_price_cents,c.updated_at,
      coalesce(c.customer_snapshot->>'full_name','') customer,s.full_name owner,
      p.total_cents design_total,private.sales_agreement_detail(c.id) agreement
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
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',f.id,'code',f.code,'brand',f.brand,'status',f.status,'customer',f.customer,'owner',f.owner,'updated_at',f.updated_at,
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
      'contractId',f.contract->>'id','instalment',f.work_next)
    ) order by f.updated_at desc,f.id),'[]'::jsonb)
  into v_result
  from facts f
  where coalesce(p_status,'active')<>'active' or f.status in ('draft','reserved','contracted')
    or f.pending>0 or f.refunds>0 or (f.status='completed' and f.design_outstanding);
  return v_result;
end $function$;

-- private.sales_work_queue()
CREATE OR REPLACE FUNCTION private.sales_work_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

-- private.walkin_create_lead_with_privacy(uuid,text,jsonb,jsonb,uuid,text,boolean,boolean,boolean)
CREATE OR REPLACE FUNCTION private.walkin_create_lead_with_privacy(p_request_id uuid, p_brand text, p_contact jsonb, p_survey jsonb, p_owner uuid, p_notice_version text, p_notice_presented boolean, p_followup_requested boolean, p_survey_consent boolean)
 RETURNS leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor public.staff := private.walkin_lock_actor(p_owner);
  v_notice jsonb := private.walkin_privacy_notice(p_brand);
  v_survey jsonb;
  v_lead public.leads;
  v_hash text;
  v_now timestamptz := clock_timestamp();
  v_new boolean := false;
begin
  if p_request_id is null or p_owner is null or p_notice_presented is distinct from true
    or p_followup_requested is distinct from true or p_survey_consent is null
    or p_notice_version is distinct from v_notice->>'version' then
    raise exception 'invalid_privacy_choice' using errcode = '22023';
  end if;
  if v_actor.role = 'sale' and p_owner <> v_actor.id then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  perform private.walkin_validate_input(p_brand, p_contact, p_survey);
  if not p_survey_consent and (p_survey - 'sales_staff') <> '{}'::jsonb then
    raise exception 'survey_consent_required' using errcode = '22023';
  end if;
  v_survey := (p_survey - 'sales_staff') || jsonb_build_object('sales_staff', v_actor.full_name);
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'brand', p_brand, 'contact', p_contact, 'survey', v_survey, 'owner', p_owner,
    'notice', p_notice_version, 'survey_consent', p_survey_consent
  )::text, 'UTF8')), 'hex');
  select * into v_lead from public.leads where created_by = v_actor.id
    and create_request_id = p_request_id for update;
  if v_lead.id is null then
    if not exists (select 1 from public.staff where id = p_owner and is_active and role = 'sale') then
      raise exception 'invalid_owner' using errcode = '22023';
    end if;
    insert into public.leads (brand, name_title, first_name, last_name, phone, line_id,
      survey, owner_id, created_by, create_request_id, create_payload_hash, last_contact_at, privacy_mode)
    values (p_brand, coalesce(p_contact->>'name_title', ''), p_contact->>'first_name',
      coalesce(p_contact->>'last_name', ''), p_contact->>'phone', coalesce(p_contact->>'line_id', ''),
      v_survey, p_owner, v_actor.id, p_request_id, v_hash, v_now, 'real')
    on conflict (created_by, create_request_id) do nothing returning * into v_lead;
    v_new := v_lead.id is not null;
    if not v_new then
      select * into v_lead from public.leads where created_by = v_actor.id
        and create_request_id = p_request_id for update;
    end if;
  end if;
  if v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if v_new then
    insert into public.lead_privacy_events (lead_id, actor_id, request_id, kind, survey_consent, notice_presented, followup_requested,
      notice_version, notice_snapshot, notice_hash, recorded_at)
    values (v_lead.id, v_actor.id, p_request_id, 'initial', p_survey_consent, true, true,
      p_notice_version, v_notice, encode(sha256(convert_to(v_notice::text, 'UTF8')), 'hex'), v_now);
  elsif not exists (select 1 from public.lead_privacy_events where lead_id = v_lead.id and kind = 'initial') then
    raise exception 'legacy_request_no_evidence' using errcode = '22023';
  end if;
  if v_lead.create_payload_hash <> v_hash then
    raise exception 'request_conflict' using errcode = '22023';
  end if;
  return v_lead;
end
$function$;

-- Objects the migrations created (none exist on prod before the push).
drop function if exists public.sales_capability_defaults();
drop function if exists private.sales_default_actions(text);
drop function if exists private.sales_case_facts(uuid);

-- 20261121120100 changed only the default; prod had true.
alter table private.sales_issuers alter column is_synthetic set default true;

delete from supabase_migrations.schema_migrations where version in
  ('20261121090000','20261121090100','20261121090200','20261121120000','20261121120100','20261122090000');

commit;
