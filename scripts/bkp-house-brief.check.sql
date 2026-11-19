-- Run against the local database with synthetic fixtures. Every write is rolled back.
begin;
do $$
declare
  v_actor uuid;
  v_lead public.leads;
  v_project public.projects;
  v_case uuid;
  v_other uuid;
  v_before jsonb;
  v_details jsonb;
  v_created jsonb;
  v_result jsonb;
  v_request uuid := gen_random_uuid();
begin
  select id into strict v_actor from public.staff where role = 'executive' and is_active order by id limit 1;
  select * into strict v_lead from public.leads l
    where l.brand = 'BAAN_KUNAPAP' and l.privacy_mode = 'synthetic' and l.closed_at is null
      and exists (select 1 from private.sales_cases c where c.lead_id = l.id)
    order by l.id limit 1;
  select c.id, c.house_brief into strict v_other, v_before from private.sales_cases c
    where c.lead_id = v_lead.id order by c.id limit 1;

  if has_function_privilege('anon','public.sales_save_house_brief(uuid,bigint,jsonb,uuid)','EXECUTE') then
    raise exception 'Anonymous callers can execute the save endpoint';
  end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  update public.leads set survey = survey || '{"house_type":"บ้านเดี่ยว 2 ชั้น","layout":["2 ห้องนอน","3 ห้องน้ำ"],"budget_range":"2-3 ล้านบาท","payment_method":"เงินสด"}'
    where id = v_lead.id;
  select * into v_project from public.walkin_open_project(v_lead.id,v_lead.version,gen_random_uuid());
  v_created := public.sales_create_case(v_lead.id,v_project.id,null,null,gen_random_uuid());
  v_case := (v_created->>'id')::uuid;
  if (public.sales_case_detail(v_case)->'house_brief') is distinct from
    '{"model":"บ้านเดี่ยว 2 ชั้น","stories":"2","bedrooms":"2","bathrooms":"3","layout":"2 ห้องนอน · 3 ห้องน้ำ","budget":"2-3 ล้านบาท","payment_method":"เงินสด"}'::jsonb then
    raise exception 'BKP case did not seed the expected Lead preferences';
  end if;
  select details into strict v_details from private.sales_cases where id = v_case;
  v_result := public.sales_save_house_brief(v_case,1,'{"model":"แบบทดสอบ","usable_area":"175.5","roof":"ทรงจั่ว"}',v_request);
  if (public.sales_case_detail(v_case)->'house_brief'->>'usable_area') is distinct from '175.5'
    or (select house_brief from private.sales_cases where id = v_other) is distinct from v_before
    or (select details from private.sales_cases where id = v_case) is distinct from v_details
    or (select survey->>'house_type' from public.leads where id = v_lead.id) is distinct from 'บ้านเดี่ยว 2 ชั้น' then
    raise exception 'Saving the brief changed a different record or did not persist the edit';
  end if;
  if public.sales_save_house_brief(v_case,1,'{"model":"แบบทดสอบ","usable_area":"175.5","roof":"ทรงจั่ว"}',v_request) is distinct from v_result then
    raise exception 'A retry did not replay the first result';
  end if;
  begin
    perform public.sales_save_house_brief(v_case,1,'{"usable_area":"200"}',gen_random_uuid());
    raise exception 'Stale write was accepted';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.sales_save_house_brief(v_case,2,'{"net_price_cents":"1"}',gen_random_uuid());
    raise exception 'Unknown key was accepted';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'PASS: Lead seeding, project isolation, separate case details, replay, stale write and input guards';
end $$;
rollback;
