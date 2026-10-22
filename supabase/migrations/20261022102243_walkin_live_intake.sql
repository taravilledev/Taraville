-- New privacy-aware intake is real; never relabel existing synthetic records.
-- This file does not activate hosting or approve any record deletion.
alter table public.leads drop constraint leads_privacy_mode_check;
alter table public.leads add constraint leads_privacy_mode_check check (privacy_mode in ('synthetic', 'real'));
-- Preserve the original trusted notice for later operations on synthetic records.
alter function private.walkin_privacy_notice(text) rename to walkin_synthetic_privacy_notice;
create function private.walkin_privacy_notice(p_brand text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_notice jsonb := $notice${"version":"walkin-live-2026-10-22.1","mode":"real","basis":"precontract_request","companies":{"BAAN_KUNAPAP":"บริษัท บ้านคุณภาพ เพชรบูรณ์ จำกัด","TARAVILLE":"บริษัท ธารทอง พรอพเพอร์ตี้ แอนด์ คอนสตรัคชั่น จำกัด"},"address":"555/24 หมู่ 2 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์","contact":"taraville.dev@gmail.com","sections":[{"heading":"ผู้รับผิดชอบและการติดต่อ","text":"บริษัทตามแบรนด์ที่ท่านเลือกเป็นผู้ควบคุมข้อมูลสำหรับเรื่องที่ท่านสอบถาม ติดต่อได้ตามที่อยู่และอีเมลข้างต้น โดยมี Piyapat Hongron เป็นผู้ประสานงาน การอ่านประกาศเพียงอย่างเดียวไม่ถือเป็นการให้ความยินยอม"},{"heading":"ข้อมูลและวัตถุประสงค์","text":"เมื่อท่านขอให้ติดต่อกลับ บริษัทใช้ชื่อ เบอร์โทร และข้อมูลติดต่อที่ท่านเลือกให้ เพื่อรับเรื่อง ตอบคำถาม ประเมินความต้องการและดำเนินการก่อนเข้าทำสัญญาตามที่ท่านร้องขอ โดยใช้เฉพาะข้อมูลที่จำเป็นต่อคำขอนั้น หากไม่ให้ช่องทางติดต่อ บริษัทอาจติดต่อกลับไม่ได้ แต่ยังสอบถามข้อมูลทั่วไปโดยไม่สร้างรายการผู้สนใจได้ ไม่รวมการส่งโปรโมชั่น การตลาดของพันธมิตร หรือการตัดสินสิทธิ์สินเชื่ออัตโนมัติ"},{"heading":"แบบสอบถามสมัครใจ","text":"คำตอบเพิ่มเติม เช่น อาชีพ รายได้ ที่อยู่ และความต้องการเกี่ยวกับบ้าน ใช้เพื่อประเมินความต้องการเมื่อท่านเลือกให้ความยินยอมแยกต่างหาก เลือกไม่ตอบหรือถอนความยินยอมได้โดยยังขอให้ติดต่อกลับได้ เมื่อถอน บริษัทหยุดใช้และล้างคำตอบแบบสอบถามเพิ่มเติม การถอนจะไม่กระทบการดำเนินการที่ชอบด้วยกฎหมายก่อนถอน"},{"heading":"ผู้รับข้อมูลและผู้ให้บริการ","text":"พนักงานและผู้ดูแลระบบที่ได้รับอนุญาตเข้าถึงตามหน้าที่ ฝ่ายขายดูรายการที่ตนรับผิดชอบ ผู้บริหารที่ได้รับอนุญาตจากทั้งสองบริษัทดูแลทั้งสองแบรนด์ได้ ไม่มีการส่งรายการไปทำการตลาดของอีกบริษัทโดยอัตโนมัติ ระบบใช้ Vercel สำหรับเว็บไซต์และ Supabase สำหรับบัญชีพนักงานและฐานข้อมูล การให้บริการอาจเกี่ยวข้องกับการประมวลผลในต่างประเทศ ผู้ดูแลเข้าถึงเท่าที่จำเป็นต่อการให้บริการและจัดการคำขอ"},{"heading":"ระยะเวลาและการลบข้อมูล","text":"ผู้สนใจที่ยังไม่ซื้อหรือทำสัญญาจะได้รับการทบทวนข้อมูลเมื่อครบ 12 เดือนหลังการติดต่อจริงครั้งล่าสุด เพื่อลบหรือทำให้ไม่สามารถระบุตัวบุคคล หากมีเหตุจำเป็น เช่น ข้อพิพาท ต้องระบุเหตุและวันทบทวนใหม่ การเปิดหรือแก้รายการไม่ถือเป็นการติดต่อใหม่ หลักฐานประกาศและตัวเลือกเก็บเท่าที่จำเป็นควบคู่รายการผู้สนใจ และลบข้อมูลที่ผูกตัวบุคคลเมื่อดำเนินคำขอลบที่อนุมัติ ทะเบียนคำร้องเก็บ 12 เดือนหลังปิดเรื่อง เว้นแต่มีเหตุจำเป็นที่บันทึกไว้ สำเนาสำรองต้องควบคุมการเข้าถึงและนำคำขอลบที่ดำเนินการแล้วมาปรับก่อนนำข้อมูลที่กู้คืนกลับใช้ ข้อมูลลูกค้าหรือสัญญาใช้นโยบายแยก ไม่มีระบบลบทุกสำเนาอัตโนมัติ"},{"heading":"สิทธิของท่าน","text":"ติดต่อช่องทางข้างต้นเพื่อขอเข้าถึงหรือรับสำเนา แก้ไข ลบ จำกัดหรือคัดค้านการใช้ ขอรับหรือโอนข้อมูล และถอนความยินยอมในส่วนที่อาศัยความยินยอม ตามเงื่อนไขกฎหมาย รวมถึงร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล บริษัทอาจยืนยันตัวตนเท่าที่จำเป็นโดยไม่เรียกสำเนาบัตรประชาชนอัตโนมัติ และจะแจ้งผลตามคำขอและเงื่อนไขที่เกี่ยวข้อง การถอนแบบสอบถามไม่ใช่การลบเอกสารสัญญาทั้งหมด เวลาที่เก็บในระบบเป็นเวลาบันทึกของพนักงาน ไม่ใช่หลักฐานเวลาที่ท่านอ่านประกาศจริง"}],"choices":{"notice_presented":"ได้แสดงและอธิบายประกาศความเป็นส่วนตัวของบริษัทตามแบรนด์ที่เลือกก่อนกรอกข้อมูลแล้ว","followup_requested":"ผู้สนใจขอให้บริษัทติดต่อกลับเกี่ยวกับบ้านหรือบริการที่สอบถาม","survey_consent":"ข้าพเจ้ายินยอมให้บริษัทใช้คำตอบแบบสอบถามเพิ่มเติมเพื่อประเมินความต้องการเกี่ยวกับบ้านหรือบริการที่สอบถาม สามารถเลือกไม่ให้ข้อมูลหรือถอนความยินยอมได้ โดยยังขอให้ติดต่อกลับได้"}}$notice$::jsonb;
begin
  if p_brand is null or not v_notice->'companies' ? p_brand then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  return (v_notice - 'companies') || jsonb_build_object(
    'brand', p_brand, 'company', v_notice->'companies'->p_brand);
end
$$;
revoke all on function private.walkin_privacy_notice(text) from public, anon, authenticated;

create or replace function private.walkin_create_lead_with_privacy(
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
$$;
revoke all on function private.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function private.walkin_create_lead_with_privacy(uuid, text, jsonb, jsonb, uuid, text, boolean, boolean, boolean) to authenticated;

create or replace function private.walkin_record_privacy_event(
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
  v_notice := case when v_lead.privacy_mode = 'synthetic'
    then private.walkin_synthetic_privacy_notice(v_lead.brand)
    else private.walkin_privacy_notice(v_lead.brand) end;
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


-- Retire the older path that could create a Lead without notice evidence.
revoke all on function public.walkin_create_lead(uuid, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.walkin_create_lead(uuid, text, jsonb, jsonb, uuid) from public, anon, authenticated;

-- Only the database administrator can perform an individually approved removal.
-- The application roles cannot set a flag and bypass this guard.
create or replace function private.walkin_guard_privacy_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'postgres' and tg_op = 'DELETE'
    and current_setting('walkin.approved_removal', true) = old.lead_id::text then
    return old;
  end if;
  raise exception 'immutable_privacy_event' using errcode = '42501';
end
$$;

create function private.walkin_remove_lead(p_lead_id uuid, p_expected_version bigint, p_case_reference text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_lead public.leads;
begin
  if current_user <> 'postgres' then raise exception 'access_denied' using errcode = '42501'; end if;
  if p_case_reference is null or length(trim(p_case_reference)) < 3 or length(p_case_reference) > 200 then
    raise exception 'approved_case_required' using errcode = '22023';
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then raise exception 'lead_not_found' using errcode = '22023'; end if;
  if p_expected_version is null or v_lead.version <> p_expected_version then
    raise exception 'stale_lead' using errcode = 'PT409';
  end if;
  -- Approval/hold review and case register are maintained outside the removed data.
  perform set_config('walkin.approved_removal', p_lead_id::text, true);
  delete from public.lead_privacy_events where lead_id = p_lead_id;
  delete from public.leads where id = p_lead_id;
  perform set_config('walkin.approved_removal', '', true);
end
$$;
revoke all on function private.walkin_remove_lead(uuid, bigint, text) from public, anon, authenticated;
