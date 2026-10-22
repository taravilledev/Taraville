-- Synthetic privacy foundation only. Never infer historical consent.
alter table public.leads
  add column privacy_mode text not null default 'synthetic' check (privacy_mode = 'synthetic'),
  add column last_contact_at timestamptz;

create table public.lead_privacy_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id),
  actor_id uuid not null references public.staff(id),
  request_id uuid not null,
  kind text not null check (kind in ('initial', 'survey_choice', 'contact')),
  survey_consent boolean,
  notice_presented boolean,
  followup_requested boolean,
  notice_version text not null,
  notice_snapshot jsonb not null check (jsonb_typeof(notice_snapshot) = 'object'),
  notice_hash text not null check (notice_hash ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  check (kind = 'contact' or survey_consent is not null),
  check (kind <> 'initial' or (notice_presented is true and followup_requested is true)),
  check (kind <> 'survey_choice' or not survey_consent or notice_presented is true),
  unique (lead_id, actor_id, request_id)
);
create unique index lead_privacy_initial_idx on public.lead_privacy_events(lead_id) where kind = 'initial';
create index lead_privacy_latest_idx on public.lead_privacy_events(lead_id, id desc);
create index leads_last_contact_idx on public.leads(last_contact_at) where last_contact_at is not null;
alter table public.lead_privacy_events enable row level security;
revoke all on public.lead_privacy_events from public, anon, authenticated;
revoke all on sequence public.lead_privacy_events_id_seq from public, anon, authenticated;
grant select on public.lead_privacy_events to authenticated;
create policy lead_privacy_read on public.lead_privacy_events for select to authenticated using (
  exists (select 1 from public.leads l where l.id = lead_id)
  and (select private.walkin_actor_role()) in ('sale', 'executive')
);

create function private.walkin_privacy_notice(p_brand text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_notice jsonb := $notice${"version":"walkin-synthetic-2026-10-21.1","mode":"synthetic","basis":"precontract_request_proposed","companies":{"BAAN_KUNAPAP":"บริษัท บ้านคุณภาพ เพชรบูรณ์ จำกัด","TARAVILLE":"บริษัท ธารทอง พรอพเพอร์ตี้ แอนด์ คอนสตรัคชั่น จำกัด"},"address":"555/24 หมู่ 2 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์","contact":"taraville.dev@gmail.com","sections":[{"heading":"ร่างสำหรับจำลองขั้นตอน","text":"ใช้ข้อมูลสมมติเท่านั้น ยังไม่ใช่ประกาศสำหรับรับข้อมูลลูกค้าจริง การเปิดอ่านไม่ถือเป็นการให้ความยินยอม"},{"heading":"วัตถุประสงค์","text":"รับเรื่อง ประเมินความต้องการ และติดต่อกลับเกี่ยวกับบ้านหรือบริการที่ร้องขอ ไม่รวมโปรโมชั่นหรือการตลาดของพันธมิตร ฐานก่อนสัญญาต้องได้รับการรับรองความจำเป็นและการใช้กับกรณีจริงจากบริษัท"},{"heading":"ข้อมูลและการเลือกตอบ","text":"ชื่อและเบอร์โทรใช้สำหรับเรื่องที่ขอให้ติดต่อกลับ ส่วน LINE และคำตอบแบบสอบถามเป็นข้อมูลเพิ่มเติม แบบสอบถามต้องมีตัวเลือกสมัครใจแยก การไม่ให้คำตอบเพิ่มเติมไม่ขัดขวางการรับเรื่องที่จำเป็น หากต้องการเพียงข้อมูลทั่วไปสามารถสอบถามโดยไม่บันทึก Lead"},{"heading":"ระยะเวลาเก็บ","text":"Lead ที่ยังไม่เป็นลูกค้าให้ทบทวนเมื่อครบ 12 เดือนหลังติดต่อล่าสุด เพื่อลบหรือทำให้ไม่ระบุตัวบุคคลโดยพิจารณาเหตุจำเป็นที่ยังต้องเก็บ การเปิดหรือแก้รายการไม่ถือเป็นการติดต่อใหม่ ข้อมูลลูกค้าและสัญญาใช้นโยบายแยก ยังไม่มีระบบลบอัตโนมัติ"},{"heading":"สิทธิและการติดต่อ","text":"ติดต่อช่องทางที่ระบุเพื่อขอใช้สิทธิที่เกี่ยวข้อง รวมถึงแก้ไข ลบ จำกัดหรือคัดค้านการใช้ ขอรับหรือโอนข้อมูล และถอนความยินยอมในส่วนที่อาศัยความยินยอม ตามเงื่อนไขกฎหมาย รวมถึงสิทธิร้องเรียนต่อหน่วยงานกำกับ การถอนแบบสำรวจไม่ใช่การลบเอกสารสัญญาทั้งหมด"},{"heading":"ส่วนที่ยังต้องยืนยัน","text":"บริษัทต้องรับรองฐานการใช้ข้อมูล บทบาทระหว่างบริษัท ผู้รับข้อมูล ผู้ให้บริการและสถานที่ประมวลผล ผู้รับผิดชอบคำขอ ขั้นตอนใช้สิทธิ ระยะเก็บหลักฐานและสำรองข้อมูล และประกาศฉบับสุดท้ายก่อนใช้จริง"}],"choices":{"notice_presented":"จำลองว่าได้แสดงและอธิบายร่างประกาศก่อนกรอกข้อมูลสมมติแล้ว","followup_requested":"จำลองว่าผู้สนใจขอให้ติดต่อกลับเกี่ยวกับบ้านหรือบริการที่สอบถาม","survey_consent":"จำลองการเลือกให้ข้อมูลแบบสอบถามเพิ่มเติมโดยสมัครใจ และถอนตัวเลือกนี้ได้"}}$notice$::jsonb;
begin
  if p_brand is null or not v_notice->'companies' ? p_brand then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  return (v_notice - 'companies') || jsonb_build_object(
    'brand', p_brand, 'company', v_notice->'companies'->p_brand);
end
$$;
revoke all on function private.walkin_privacy_notice(text) from public, anon, authenticated;

-- Evidence is changed only by dedicated owner-checked privileged operations.
create function private.walkin_guard_survey_choice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_consent boolean;
begin
  select e.survey_consent into v_consent from public.lead_privacy_events e
    where e.lead_id = new.id and e.survey_consent is not null order by e.id desc limit 1;
  if v_consent = false and (new.survey - 'sales_staff') <> '{}'::jsonb then
    raise exception 'survey_consent_required' using errcode = '22023';
  end if;
  return new;
end
$$;
revoke all on function private.walkin_guard_survey_choice() from public, anon, authenticated;
create trigger leads_guard_survey_choice before update of survey on public.leads
  for each row execute function private.walkin_guard_survey_choice();

-- Admin deletion/rectification needs its own scoped procedure; no generic client writes.
create function private.walkin_guard_privacy_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'immutable_privacy_event' using errcode = '42501';
end
$$;
revoke all on function private.walkin_guard_privacy_history() from public, anon, authenticated;
create trigger privacy_history_immutable before update or delete on public.lead_privacy_events
  for each row execute function private.walkin_guard_privacy_history();
