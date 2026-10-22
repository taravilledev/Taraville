-- Dedicated synthetic create; no historical evidence is inferred from legacy replays.
create function private.walkin_create_lead_with_privacy(
  p_request_id uuid, p_brand text, p_contact jsonb, p_survey jsonb, p_owner uuid,
  p_notice_version text, p_notice_presented boolean, p_followup_requested boolean, p_survey_consent boolean
) returns public.leads language plpgsql security definer set search_path = '' as $$
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
      survey, owner_id, created_by, create_request_id, create_payload_hash, last_contact_at)
    values (p_brand, coalesce(p_contact->>'name_title', ''), p_contact->>'first_name',
      coalesce(p_contact->>'last_name', ''), p_contact->>'phone', coalesce(p_contact->>'line_id', ''),
      v_survey, p_owner, v_actor.id, p_request_id, v_hash, v_now)
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
$$;
revoke all on function private.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function private.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) to authenticated;

create function public.walkin_create_lead_with_privacy(
  p_request_id uuid, p_brand text, p_contact jsonb, p_survey jsonb, p_owner uuid,
  p_notice_version text, p_notice_presented boolean, p_followup_requested boolean, p_survey_consent boolean
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_create_lead_with_privacy(p_request_id, p_brand, p_contact, p_survey,
    p_owner, p_notice_version, p_notice_presented, p_followup_requested, p_survey_consent)
$$;
revoke all on function public.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) to authenticated;

create function private.walkin_record_privacy_event(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid, p_kind text,
  p_survey_consent boolean default null, p_notice_version text default null, p_notice_presented boolean default false
) returns public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_lead public.leads;
  v_existing public.lead_privacy_events;
  v_notice jsonb;
  v_consent boolean;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_id is null or p_kind is null or p_kind not in ('survey_choice', 'contact')
    or (p_kind = 'survey_choice' and p_survey_consent is null)
    or (p_kind = 'contact' and p_survey_consent is not null) then
    raise exception 'invalid_privacy_choice' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or (v_actor.role = 'sale' and v_lead.owner_id <> v_actor.id) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  v_notice := private.walkin_privacy_notice(v_lead.brand);
  if p_kind = 'survey_choice' and p_survey_consent and
    (p_notice_version is distinct from v_notice->>'version' or p_notice_presented is distinct from true) then
    raise exception 'invalid_privacy_choice' using errcode = '22023';
  end if;
  select * into v_existing from public.lead_privacy_events where lead_id = p_lead_id
    and actor_id = v_actor.id and request_id = p_request_id;
  if v_existing.id is not null then
    if v_existing.kind <> p_kind or (p_kind = 'survey_choice' and v_existing.survey_consent is distinct from p_survey_consent) then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    return v_lead;
  end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  select e.survey_consent into v_consent from public.lead_privacy_events e
    where e.lead_id = p_lead_id and e.survey_consent is not null order by e.id desc limit 1;
  if p_kind = 'survey_choice' then v_consent := p_survey_consent; end if;
  insert into public.lead_privacy_events (lead_id, actor_id, request_id, kind, survey_consent, notice_presented,
    notice_version, notice_snapshot, notice_hash, recorded_at)
  values (p_lead_id, v_actor.id, p_request_id, p_kind, v_consent,
    case when p_kind = 'survey_choice' and p_survey_consent then true else null end,
    v_notice->>'version', v_notice, encode(sha256(convert_to(v_notice::text, 'UTF8')), 'hex'), v_now);
  if p_kind = 'survey_choice' and not p_survey_consent then
    update public.leads set survey = jsonb_build_object('sales_staff', coalesce(survey->>'sales_staff', '')),
      version = version + 1, updated_at = v_now where id = p_lead_id returning * into v_lead;
  else
    update public.leads set last_contact_at = case when p_kind = 'contact' then v_now else last_contact_at end,
      version = version + 1, updated_at = v_now where id = p_lead_id returning * into v_lead;
  end if;
  return v_lead;
end
$$;
revoke all on function private.walkin_record_privacy_event(uuid, bigint, uuid, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function private.walkin_record_privacy_event(uuid, bigint, uuid, text, boolean, text, boolean) to authenticated;

create function public.walkin_record_privacy_event(
  p_lead_id uuid, p_expected_version bigint, p_request_id uuid, p_kind text,
  p_survey_consent boolean default null, p_notice_version text default null, p_notice_presented boolean default false
) returns public.leads language sql security invoker set search_path = '' as $$
  select private.walkin_record_privacy_event(p_lead_id, p_expected_version, p_request_id,
    p_kind, p_survey_consent, p_notice_version, p_notice_presented)
$$;
revoke all on function public.walkin_record_privacy_event(uuid, bigint, uuid, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.walkin_record_privacy_event(uuid, bigint, uuid, text, boolean, text, boolean) to authenticated;

create view public.walkin_retention_due with (security_invoker = true) as
  select id, brand, owner_id, last_contact_at,
    ((last_contact_at at time zone 'Asia/Bangkok') + interval '12 months') at time zone 'Asia/Bangkok' as review_due_at
  from public.leads where last_contact_at is not null
    and (select private.walkin_actor_role()) = 'executive'
    and (((last_contact_at at time zone 'Asia/Bangkok') + interval '12 months') at time zone 'Asia/Bangkok') <= now();
revoke all on public.walkin_retention_due from public, anon, authenticated;
grant select on public.walkin_retention_due to authenticated;
