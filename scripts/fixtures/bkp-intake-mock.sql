-- Run only through the Taraville_pj local Docker database.
begin;
do $$
declare
  v_lead_id constant uuid := '41bc9a33-7aad-476c-9c0e-e9a63086a8f2';
  v_actor uuid;
  v_owner uuid;
  v_project public.projects;
  v_case jsonb;
  v_site constant text := 'แปลงสมมติ B-07 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์';
begin
  select id into strict v_actor from public.staff where full_name = 'Synthetic admin' and role = 'executive' and is_active;
  select id into strict v_owner from public.staff where full_name = 'Synthetic sale' and role = 'sale' and is_active;
  if exists (select 1 from public.leads where id = v_lead_id) then
    raise exception 'Fixture already exists. Open Lead %', v_lead_id;
  end if;

  insert into public.leads(id, brand, name_title, first_name, last_name, phone, owner_id, created_by,
    create_request_id, create_payload_hash, privacy_mode, survey)
  values(v_lead_id, 'BAAN_KUNAPAP', 'นางสาว', 'พิมพ์ชนก', 'วัฒนกุล (ข้อมูลสมมติ)', '000-000-0000',
    v_owner, v_actor, v_lead_id, repeat('0',64), 'synthetic',
    jsonb_build_object('address', v_site, 'house_type', 'บ้านเดี่ยวชั้นเดียว',
      'layout', jsonb_build_array('3 ห้องนอน', '2 ห้องน้ำ'),
      'budget_range', '2-3 ล้านบาท', 'payment_method', 'สินเชื่อธนาคาร',
      'age_range', '31-40 ปี', 'occupation', 'พนักงานประจำ',
      'income_range', 'มากกว่า 50,000', 'channel', 'เพื่อนและครอบครัว', 'sales_staff', 'Synthetic admin'));

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  select * into v_project from public.walkin_open_project(v_lead_id, 1, gen_random_uuid());
  v_case := public.sales_case_detail((public.sales_create_case(v_lead_id, v_project.id, null, null, gen_random_uuid())->>'id')::uuid);

  if v_case->'details'->>'site_address' is distinct from v_site
    or v_case->'customer_snapshot'->>'address' is distinct from ''
    or v_case->'house_brief'->>'bedrooms' is distinct from '3' then
    raise exception 'BKP mock handoff did not preserve the site, contact and survey fields separately';
  end if;
  raise notice 'Mock Lead %, Project %, sales case %', v_lead_id, v_project.code, v_case->>'id';
end $$;
commit;
