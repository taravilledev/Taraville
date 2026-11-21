-- Owner decision 2026-11-22: the survey "พนักงานขาย" is the Lead owner, not the actor.
-- A sale still owns only their own Leads; an executive's pick now lands in sales_staff too.
-- Same signature as before, so CREATE OR REPLACE replaces it in place (no overload).
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
  v_survey := (p_survey - 'sales_staff') || jsonb_build_object('sales_staff', (select s.full_name from public.staff s where s.id = p_owner));
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
$function$
;
