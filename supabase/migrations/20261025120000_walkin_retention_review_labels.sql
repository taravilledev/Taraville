-- ADR 0010. Leads with an active Project or closed as bought_with_us stay in the 12-month review;
-- the Executive sees why a hold may be justified. Columns are appended; the filter and grants are unchanged.
create or replace view public.walkin_retention_due with (security_invoker = true) as
  select id, brand, owner_id, last_contact_at,
    ((last_contact_at at time zone 'Asia/Bangkok') + interval '12 months') at time zone 'Asia/Bangkok' as review_due_at,
    exists (select 1 from public.projects p where p.lead_id = leads.id and p.status = 'active') as has_active_project,
    closed_reason
  from public.leads where last_contact_at is not null
    and (select private.walkin_actor_role()) = 'executive'
    and (((last_contact_at at time zone 'Asia/Bangkok') + interval '12 months') at time zone 'Asia/Bangkok') <= now();
revoke all on public.walkin_retention_due from public, anon, authenticated;
grant select on public.walkin_retention_due to authenticated;
