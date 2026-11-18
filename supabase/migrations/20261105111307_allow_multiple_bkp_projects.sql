begin;

-- A Lead may have several active BKP Projects. The existing lead index still covers lookup.
drop index public.projects_active_lead_idx;

-- Same signature; preserve authorization, Lead locking, version checks and request replay.
create or replace function private.walkin_open_project(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid
) returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
  v_project public.projects;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  select * into v_project from public.projects where created_by = v_actor.id and create_request_id = p_request_id;
  if v_project.id is not null then
    if v_project.lead_id <> p_lead_id then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    return v_project;
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  if v_lead.brand <> 'BAAN_KUNAPAP' or v_lead.closed_at is not null then
    raise exception 'invalid_lead_state' using errcode = '22023';
  end if;
  insert into public.projects (code, brand, lead_id, created_by, create_request_id, created_at)
  values (private.walkin_next_project_code('BKP'), v_lead.brand, p_lead_id, v_actor.id, p_request_id, v_now)
  returning * into v_project;
  update public.leads set version = version + 1, updated_at = v_now where id = p_lead_id;
  return v_project;
end
$$;

commit;
