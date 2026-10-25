-- ADR 0014: Monthly Lead Report readable by every active staff member, one audit row per call.
-- Applied to gquytrggcghnhlrpzcli on 2026-10-25 via `supabase db push`.
create table public.walkin_report_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.staff(id),
  month date not null,
  brand text check (brand in ('TARAVILLE', 'BAAN_KUNAPAP')),
  owner_filter uuid references public.staff(id),
  recorded_at timestamptz not null default clock_timestamp()
);
create index walkin_report_audit_actor_idx on public.walkin_report_audit(actor_id, id desc);
alter table public.walkin_report_audit enable row level security;
revoke all on public.walkin_report_audit from public, anon, authenticated;
revoke all on sequence public.walkin_report_audit_id_seq from public, anon, authenticated;
-- No policy and no grant: staff cannot read or write it; only the definer function below inserts.

create function private.walkin_monthly_report(p_month date, p_brand text default null, p_owner uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if p_month is null or (p_brand is not null and p_brand not in ('TARAVILLE', 'BAAN_KUNAPAP')) then
    raise exception 'invalid_report_filter' using errcode = '22023';
  end if;
  v_start := date_trunc('month', p_month)::timestamp at time zone 'Asia/Bangkok';
  v_end := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Asia/Bangkok';
  insert into public.walkin_report_audit (actor_id, month, brand, owner_filter)
  values (v_actor.id, date_trunc('month', p_month)::date, p_brand, p_owner);

  with picked as (
    select l.id, l.brand, l.name_title, l.first_name, l.last_name, l.phone, l.owner_id, l.privacy_mode, l.created_at,
      l.closed_at is not null as is_closed,
      exists (select 1 from public.lead_privacy_events e where e.lead_id = l.id and e.kind = 'contact') as is_contacted,
      exists (select 1 from public.projects p where p.lead_id = l.id and p.status = 'active') as has_project,
      private.walkin_lead_stage(l) as stage
    from public.leads l
    where l.created_at >= v_start and l.created_at < v_end
      and (p_brand is null or l.brand = p_brand)
      and (p_owner is null or l.owner_id = p_owner)
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total', (select count(*) from picked where privacy_mode = 'real'),
      'synthetic', (select count(*) from picked where privacy_mode = 'synthetic'),
      'contacted', (select count(*) from picked where privacy_mode = 'real' and is_contacted),
      'closed', (select count(*) from picked where privacy_mode = 'real' and is_closed),
      'project_opened', (select count(*) from picked where privacy_mode = 'real' and has_project),
      'by_brand', coalesce((select jsonb_object_agg(brand, n) from (select brand, count(*) n from picked where privacy_mode = 'real' group by brand) b), '{}'::jsonb),
      'by_stage', coalesce((select jsonb_object_agg(stage, n) from (select stage, count(*) n from picked where privacy_mode = 'real' group by stage) s), '{}'::jsonb),
      'by_owner', coalesce((select jsonb_agg(jsonb_build_object('owner_id', owner_id, 'name', name, 'count', n) order by n desc, name)
        from (select p.owner_id, coalesce(s.full_name, 'ผู้ดูแลเดิม') as name, count(*) n
          from picked p left join public.staff s on s.id = p.owner_id where p.privacy_mode = 'real' group by p.owner_id, s.full_name) o), '[]'::jsonb)
    ),
    'leads', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'brand', p.brand, 'name', btrim(concat_ws(' ', nullif(p.name_title, ''), p.first_name, p.last_name)),
        'phone', p.phone, 'stage', p.stage, 'owner', coalesce(s.full_name, 'ผู้ดูแลเดิม'),
        'is_synthetic', p.privacy_mode = 'synthetic', 'created_at', p.created_at) order by p.created_at, p.id)
      from picked p left join public.staff s on s.id = p.owner_id), '[]'::jsonb),
    'owners', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name) order by s.full_name)
      from public.staff s where s.role = 'sale' and s.is_active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;
revoke all on function private.walkin_monthly_report(date, text, uuid) from public, anon, authenticated;
grant execute on function private.walkin_monthly_report(date, text, uuid) to authenticated;

create function public.walkin_monthly_report(p_month date, p_brand text default null, p_owner uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.walkin_monthly_report(p_month, p_brand, p_owner)
$$;
revoke all on function public.walkin_monthly_report(date, text, uuid) from public, anon, authenticated;
grant execute on function public.walkin_monthly_report(date, text, uuid) to authenticated;
