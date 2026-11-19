-- ADR 0054: the sale role runs the whole BKP loop on its own work by default,
-- through confirming payment and issuing the receipt. Corrections, refunds,
-- amendments, close-out and the catalog stay with executives or per-person grants.
begin;

create or replace function private.sales_allowed(p_action text,p_case_id uuid default null,p_lead_id uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
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
end $$;

commit;
