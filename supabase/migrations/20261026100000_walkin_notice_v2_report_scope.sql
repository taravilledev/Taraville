-- ADR 0015: live privacy notice v2 for new intake, and the monthly report limits a Sale to their own Leads.
-- Same signatures as before, so CREATE OR REPLACE keeps grants and adds no overload.
-- Existing evidence keeps its own snapshot; v1 stays archived in docs/walkin/notices.
create or replace function private.walkin_privacy_notice(p_brand text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_notice jsonb := $notice${"version":"walkin-live-2026-10-26.1","mode":"real","basis":"precontract_request","companies":{"BAAN_KUNAPAP":"บริษัท บ้านคุณภาพ เพชรบูรณ์ จำกัด","TARAVILLE":"บริษัท ธารทอง พรอพเพอร์ตี้ แอนด์ คอนสตรัคชั่น จำกัด"},"address":"555/24 หมู่ 2 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์","contact":"taraville.dev@gmail.com","sections":[{"heading":"ผู้รับผิดชอบและการติดต่อ","text":"บริษัทตามแบรนด์ที่ท่านเลือกเป็นผู้ควบคุมข้อมูลสำหรับเรื่องที่ท่านสอบถาม ติดต่อได้ตามที่อยู่และอีเมลข้างต้น โดยมี Piyapat Hongron เป็นผู้ประสานงาน การอ่านประกาศเพียงอย่างเดียวไม่ถือเป็นการให้ความยินยอม"},{"heading":"ข้อมูลและวัตถุประสงค์","text":"เมื่อท่านขอให้ติดต่อกลับ บริษัทใช้ชื่อ เบอร์โทร และข้อมูลติดต่อที่ท่านเลือกให้ เพื่อรับเรื่อง ตอบคำถาม ประเมินความต้องการและดำเนินการก่อนเข้าทำสัญญาตามที่ท่านร้องขอ โดยใช้เฉพาะข้อมูลที่จำเป็นต่อคำขอนั้น หากไม่ให้ช่องทางติดต่อ บริษัทอาจติดต่อกลับไม่ได้ แต่ยังสอบถามข้อมูลทั่วไปโดยไม่สร้างรายการผู้สนใจได้ ไม่รวมการส่งโปรโมชั่น การตลาดของพันธมิตร หรือการตัดสินสิทธิ์สินเชื่ออัตโนมัติ"},{"heading":"แบบสอบถามสมัครใจ","text":"คำตอบเพิ่มเติม เช่น อาชีพ รายได้ ที่อยู่ และความต้องการเกี่ยวกับบ้าน ใช้เพื่อประเมินความต้องการเมื่อท่านเลือกให้ความยินยอมแยกต่างหาก เลือกไม่ตอบหรือถอนความยินยอมได้โดยยังขอให้ติดต่อกลับได้ เมื่อถอน บริษัทหยุดใช้และล้างคำตอบแบบสอบถามเพิ่มเติม การถอนจะไม่กระทบการดำเนินการที่ชอบด้วยกฎหมายก่อนถอน"},{"heading":"ผู้รับข้อมูลและผู้ให้บริการ","text":"พนักงานและผู้ดูแลระบบที่ได้รับอนุญาตเข้าถึงตามหน้าที่ ฝ่ายขายดูรายการที่ตนรับผิดชอบ ผู้บริหารที่ได้รับอนุญาตจากทั้งสองบริษัทดูแลทั้งสองแบรนด์ได้ ไม่มีการส่งรายการไปทำการตลาดของอีกบริษัทโดยอัตโนมัติ ผู้บริหารที่ได้รับอนุญาตอาจส่งออกรายการเป็นไฟล์หรือพิมพ์รายงานเพื่อใช้ภายในบริษัท โดยเก็บไว้ในอุปกรณ์หรือพื้นที่ที่ควบคุมการเข้าถึง และลบเมื่อหมดความจำเป็น ระบบใช้ Vercel สำหรับเว็บไซต์และ Supabase สำหรับบัญชีพนักงานและฐานข้อมูล การให้บริการอาจเกี่ยวข้องกับการประมวลผลในต่างประเทศ ผู้ดูแลเข้าถึงเท่าที่จำเป็นต่อการให้บริการและจัดการคำขอ"},{"heading":"ระยะเวลาและการลบข้อมูล","text":"ผู้สนใจที่ยังไม่ซื้อหรือทำสัญญาจะได้รับการทบทวนข้อมูลเมื่อครบ 12 เดือนหลังการติดต่อจริงครั้งล่าสุด เพื่อลบหรือทำให้ไม่สามารถระบุตัวบุคคล หากมีเหตุจำเป็น เช่น ข้อพิพาท ต้องระบุเหตุและวันทบทวนใหม่ การเปิดหรือแก้รายการไม่ถือเป็นการติดต่อใหม่ หลักฐานประกาศและตัวเลือกเก็บเท่าที่จำเป็นควบคู่รายการผู้สนใจ และลบข้อมูลที่ผูกตัวบุคคลเมื่อดำเนินคำขอลบที่อนุมัติ ทะเบียนคำร้องเก็บ 12 เดือนหลังปิดเรื่อง เว้นแต่มีเหตุจำเป็นที่บันทึกไว้ สำเนาสำรองต้องควบคุมการเข้าถึงและนำคำขอลบที่ดำเนินการแล้วมาปรับก่อนนำข้อมูลที่กู้คืนกลับใช้ หากท่านเข้าทำสัญญากับบริษัท ระยะเวลาเก็บข้อมูลลูกค้าและเอกสารสัญญาจะแจ้งไว้ในเอกสารสัญญา ไม่มีระบบลบทุกสำเนาอัตโนมัติ"},{"heading":"สิทธิของท่าน","text":"ติดต่อช่องทางข้างต้นเพื่อขอเข้าถึงหรือรับสำเนา แก้ไข ลบ จำกัดหรือคัดค้านการใช้ ขอรับหรือโอนข้อมูล และถอนความยินยอมในส่วนที่อาศัยความยินยอม ตามเงื่อนไขกฎหมาย รวมถึงร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล บริษัทอาจยืนยันตัวตนเท่าที่จำเป็นโดยไม่เรียกสำเนาบัตรประชาชนอัตโนมัติ และจะแจ้งผลตามคำขอและเงื่อนไขที่เกี่ยวข้อง การถอนแบบสอบถามไม่ใช่การลบเอกสารสัญญาทั้งหมด เวลาที่เก็บในระบบเป็นเวลาบันทึกของพนักงาน ไม่ใช่หลักฐานเวลาที่ท่านอ่านประกาศจริง"}],"choices":{"notice_presented":"ได้แสดงและอธิบายประกาศความเป็นส่วนตัวของบริษัทตามแบรนด์ที่เลือกก่อนกรอกข้อมูลแล้ว","followup_requested":"ผู้สนใจขอให้บริษัทติดต่อกลับเกี่ยวกับบ้านหรือบริการที่สอบถาม","survey_consent":"ข้าพเจ้ายินยอมให้บริษัทใช้คำตอบแบบสอบถามเพิ่มเติมเพื่อประเมินความต้องการเกี่ยวกับบ้านหรือบริการที่สอบถาม สามารถเลือกไม่ให้ข้อมูลหรือถอนความยินยอมได้ โดยยังขอให้ติดต่อกลับได้"}}$notice$::jsonb;
begin
  if p_brand is null or not v_notice->'companies' ? p_brand then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  return (v_notice - 'companies') || jsonb_build_object(
    'brand', p_brand, 'company', v_notice->'companies'->p_brand);
end
$$;

create or replace function private.walkin_monthly_report(p_month date, p_brand text default null, p_owner uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff := private.walkin_lock_actor();
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if p_month is null or (p_brand is not null and p_brand not in ('TARAVILLE', 'BAAN_KUNAPAP'))
    or (p_owner is not null and not exists (select 1 from public.staff s where s.id = p_owner))
    or (v_actor.role = 'sale' and p_owner is not null and p_owner <> v_actor.id) then
    raise exception 'invalid_report_filter' using errcode = '22023';
  end if;
  v_start := date_trunc('month', p_month)::timestamp at time zone 'Asia/Bangkok';
  v_end := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Asia/Bangkok';
  insert into public.walkin_report_audit (actor_id, month, brand, owner_filter)
  values (v_actor.id, date_trunc('month', p_month)::date, p_brand, p_owner);

  -- ADR 0015: team-wide counts for everyone; names and rows only for the caller's own Leads unless Executive.
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
          from picked p left join public.staff s on s.id = p.owner_id
          where p.privacy_mode = 'real' and (v_actor.role = 'executive' or p.owner_id = v_actor.id)
          group by p.owner_id, s.full_name) o), '[]'::jsonb)
    ),
    'leads', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'brand', p.brand, 'name', btrim(concat_ws(' ', nullif(p.name_title, ''), p.first_name, p.last_name)),
        'phone', p.phone, 'stage', p.stage, 'owner', coalesce(s.full_name, 'ผู้ดูแลเดิม'),
        'is_synthetic', p.privacy_mode = 'synthetic', 'created_at', p.created_at) order by p.created_at, p.id)
      from picked p left join public.staff s on s.id = p.owner_id
      where v_actor.role = 'executive' or p.owner_id = v_actor.id), '[]'::jsonb),
    'owners', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name) order by s.full_name)
      from public.staff s where s.role = 'sale' and s.is_active and (v_actor.role = 'executive' or s.id = v_actor.id)), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;
