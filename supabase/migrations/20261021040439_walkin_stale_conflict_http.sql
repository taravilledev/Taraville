-- Return a business conflict, not SQLSTATE 40001 which PostgREST may retry.
drop function if exists private.walkin_update_lead(uuid, bigint, jsonb, jsonb);
create function private.walkin_update_lead(
  p_lead_id uuid, p_expected_version bigint, p_contact jsonb, p_survey jsonb
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  perform private.walkin_validate_input(v_lead.brand, p_contact, p_survey);
  update public.leads set
    name_title = coalesce(p_contact->>'name_title', ''),
    first_name = p_contact->>'first_name',
    last_name = coalesce(p_contact->>'last_name', ''),
    phone = p_contact->>'phone', line_id = coalesce(p_contact->>'line_id', ''),
    survey = p_survey, version = version + 1, updated_at = clock_timestamp()
  where id = v_lead.id returning * into v_lead;
  return v_lead;
end
$$;
revoke all on function private.walkin_update_lead(uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.walkin_update_lead(uuid, bigint, jsonb, jsonb) to authenticated;

drop function if exists private.walkin_reassign_lead(uuid, bigint, uuid);
create function private.walkin_reassign_lead(
  p_lead_id uuid, p_expected_version bigint, p_owner uuid
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor(p_owner);
  v_lead public.leads;
begin
  if v_actor.role <> 'executive' then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_owner is null or not exists (
    select 1 from public.staff where id = p_owner and is_active and role = 'sale'
  ) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  update public.leads set owner_id = p_owner,
    version = version + 1, updated_at = clock_timestamp()
  where id = v_lead.id returning * into v_lead;
  return v_lead;
end
$$;
revoke all on function private.walkin_reassign_lead(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function private.walkin_reassign_lead(uuid, bigint, uuid) to authenticated;
