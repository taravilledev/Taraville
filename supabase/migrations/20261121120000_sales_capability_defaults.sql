begin;

-- One source for the role defaults (ADR 0054): sales_allowed and the permissions page both read this.
-- Defaults only ever apply to the user's own work; executives are allowed everything.
create function private.sales_default_actions(p_role text) returns text[]
language sql immutable set search_path='' as $$
  select case when p_role='sale' then array['financial.view','case.view','case.edit','case.create','financial.prepare',
      'billing.issue','acceptance.record','contract.sign','financial.confirm','receipt.issue']
    else array['financial.view'] end
$$;
revoke all on function private.sales_default_actions(text) from public,anon,authenticated;

-- Same signature and result as 20261119120000; the default list now comes from sales_default_actions.
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
  return p_action = any(private.sales_default_actions(v_role)) and coalesce(v_own,false);
end $$;

-- Read-only defaults for the permissions page (executive = every capability, scope all).
-- Not STABLE: PostgREST runs stable functions read-only, and sales_actor() takes a FOR SHARE lock.
create function public.sales_capability_defaults() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.sales_actor();
  return jsonb_build_object('sale',to_jsonb(private.sales_default_actions('sale')),'staff',to_jsonb(private.sales_default_actions('staff')));
end $$;
revoke all on function public.sales_capability_defaults() from public,anon;
grant execute on function public.sales_capability_defaults() to authenticated;

commit;
