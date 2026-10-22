-- Privileged implementations stay outside the Data API's exposed schemas.
create function private.walkin_create_lead(
  p_request_id uuid, p_brand text, p_contact jsonb, p_survey jsonb, p_owner uuid
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor(p_owner);
  v_lead public.leads;
  v_hash text;
begin
  if p_request_id is null or p_owner is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_actor.role = 'sale' and p_owner <> v_actor.id then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  perform private.walkin_validate_input(p_brand, p_contact, p_survey);
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'brand', p_brand, 'contact', p_contact, 'survey', p_survey, 'owner', p_owner
  )::text, 'UTF8')), 'hex');
  -- Check replay before target eligibility: later role changes cannot duplicate a request.
  select * into v_lead from public.leads
    where created_by = v_actor.id and create_request_id = p_request_id for update;
  if v_lead.id is null then
    if not exists (select 1 from public.staff where id = p_owner and is_active and role = 'sale') then
      raise exception 'invalid_owner' using errcode = '22023';
    end if;
    insert into public.leads (
      brand, name_title, first_name, last_name, phone, line_id, survey,
      owner_id, created_by, create_request_id, create_payload_hash
    ) values (
      p_brand, coalesce(p_contact->>'name_title', ''), p_contact->>'first_name',
      coalesce(p_contact->>'last_name', ''), p_contact->>'phone',
      coalesce(p_contact->>'line_id', ''), p_survey, p_owner, v_actor.id, p_request_id, v_hash
    ) on conflict (created_by, create_request_id) do nothing returning * into v_lead;
    if v_lead.id is not null then return v_lead; end if;
    select * into v_lead from public.leads
      where created_by = v_actor.id and create_request_id = p_request_id for update;
  end if;
  if v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if v_lead.create_payload_hash <> v_hash then
    raise exception 'request_conflict' using errcode = '22023';
  end if;
  return v_lead;
end
$$;
revoke all on function private.walkin_create_lead(uuid, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;

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
    raise exception 'stale_lead' using errcode = '40001';
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
revoke all on function private.walkin_update_lead(uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;

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
    raise exception 'stale_lead' using errcode = '40001';
  end if;
  update public.leads set owner_id = p_owner,
    version = version + 1, updated_at = clock_timestamp()
  where id = v_lead.id returning * into v_lead;
  return v_lead;
end
$$;
revoke all on function private.walkin_reassign_lead(uuid, bigint, uuid)
  from public, anon, authenticated;

create function public.walkin_create_lead(
  p_request_id uuid, p_brand text, p_contact jsonb, p_survey jsonb, p_owner uuid
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_create_lead(p_request_id, p_brand, p_contact, p_survey, p_owner)
$$;
create function public.walkin_update_lead(
  p_lead_id uuid, p_expected_version bigint, p_contact jsonb, p_survey jsonb
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_update_lead(p_lead_id, p_expected_version, p_contact, p_survey)
$$;
create function public.walkin_reassign_lead(
  p_lead_id uuid, p_expected_version bigint, p_owner uuid
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_reassign_lead(p_lead_id, p_expected_version, p_owner)
$$;

revoke all on function public.walkin_create_lead(uuid, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.walkin_update_lead(uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.walkin_reassign_lead(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.walkin_create_lead(uuid, text, jsonb, jsonb, uuid),
  private.walkin_create_lead(uuid, text, jsonb, jsonb, uuid),
  public.walkin_update_lead(uuid, bigint, jsonb, jsonb),
  private.walkin_update_lead(uuid, bigint, jsonb, jsonb),
  public.walkin_reassign_lead(uuid, bigint, uuid),
  private.walkin_reassign_lead(uuid, bigint, uuid)
  to authenticated;
