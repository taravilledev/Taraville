-- Frozen catalog; checked against the TypeScript source before release.
create function private.walkin_survey_catalog() returns jsonb
language sql immutable set search_path = '' as $$
  select $catalog${"TARAVILLE":[{"key":"address","kind":"text"},{"key":"gender","kind":"single","options":["ชาย","หญิง"]},{"key":"age_range","kind":"single","options":["21-30 ปี","31-40 ปี","41-50 ปี","มากกว่า 50 ปี"]},{"key":"occupation","kind":"single","options":["เจ้าของธุรกิจ","พนักงานบริษัท","ข้าราชการ","ค้าขาย"]},{"key":"income_range","kind":"single","options":["15,000-25,000","25,001-35,000","35,001-45,000","มากกว่า 45,000","มากกว่า 100,000"]},{"key":"house_type","kind":"single","options":["บ้านเดี่ยวชั้นเดียว","บ้านเดี่ยวสองชั้น","บ้านแฝด","ทาวน์โฮมชั้นเดียว","ทาวน์โฮมสองชั้น","อาคารพาณิชย์","คอนโด"]},{"key":"decision_factors","kind":"multi","options":["ทำเลที่ตั้ง","ราคาที่เหมาะสม","รูปแบบ","ระบบรักษาความปลอดภัย"]},{"key":"bedrooms","kind":"single","options":["2 ห้องนอน","3 ห้องนอน","มากกว่า 4 ห้องนอน"]},{"key":"budget_range","kind":"single","options":["1-2 ล้าน","2.1-3 ล้าน","3 ล้านขึ้นไป"]},{"key":"monthly_installment","kind":"number"},{"key":"channel","kind":"single","options":["Line / Facebook","โบรชัวร์","ป้ายไวนิล","TikTok","อื่นๆ"]},{"key":"decision_time","kind":"single","options":["2 สัปดาห์","1 เดือน","3 เดือน","6 เดือน","12 เดือน"]},{"key":"purchase_reason","kind":"single","options":["ขยายครอบครัว","ย้ายที่ทำงาน","ซื้อเป็นทรัพย์สิน"]},{"key":"sales_staff","kind":"text"}],"BAAN_KUNAPAP":[{"key":"address","kind":"text"},{"key":"gender","kind":"single","options":["ชาย","หญิง"]},{"key":"age_range","kind":"single","options":["21-30 ปี","31-40 ปี","41-50 ปี","มากกว่า 50 ปี"]},{"key":"occupation","kind":"single","options":["เจ้าของธุรกิจ","พนักงานประจำ","ข้าราชการ","ค้าขาย"]},{"key":"income_range","kind":"single","options":["10,001-25,000","25,001-35,000","35,001-40,000","40,001-50,000","มากกว่า 50,000"]},{"key":"house_type","kind":"single","options":["บ้านเดี่ยวชั้นเดียว","บ้านเดี่ยว 2 ชั้น","ทาวน์โฮมชั้นเดียว","ทาวน์โฮม 2 ชั้น","ทาวน์โฮม 3 ชั้น","บ้านแฝด","อาคารพาณิชย์","คอนโด"]},{"key":"layout","kind":"multi","options":["2 ห้องนอน","3 ห้องนอน","2 ห้องน้ำ","3 ห้องน้ำ","อื่นๆ"]},{"key":"budget_range","kind":"single","options":["ไม่เกิน 1 ล้านบาท","1-2 ล้านบาท","2-3 ล้านบาท","3 ล้านบาทขึ้นไป"]},{"key":"channel","kind":"single","options":["Line / Facebook","สื่อสิ่งพิมพ์ / โบรชัวร์","เพื่อนและครอบครัว","ป้ายไวนิล","อื่นๆ"]},{"key":"monthly_installment","kind":"single","options":["6,000-8,000","9,000-12,000","14,000-16,000","มากกว่า 20,000"]},{"key":"sales_staff","kind":"text"}]}$catalog$::jsonb
$$;
revoke all on function private.walkin_survey_catalog() from public, anon, authenticated;

create function private.walkin_validate_input(p_brand text, p_contact jsonb, p_survey jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_question jsonb;
  v_value jsonb;
  v_other jsonb;
  v_key text;
  v_allowed text[] := '{}';
begin
  if p_brand is null or not private.walkin_survey_catalog() ? p_brand
     or p_contact is null or jsonb_typeof(p_contact) <> 'object'
     or p_survey is null or jsonb_typeof(p_survey) <> 'object'
     or octet_length(p_survey::text) > 32000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_contact) k
    where k not in ('name_title', 'first_name', 'last_name', 'phone', 'line_id'))
    or exists (select 1 from jsonb_each(p_contact) e
      where jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 200)
    or coalesce(length(btrim(p_contact->>'first_name')), 0) = 0
    or coalesce(length(btrim(p_contact->>'phone')), 0) not between 1 and 80 then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  for v_question in select value from jsonb_array_elements(
    private.walkin_survey_catalog()->p_brand) loop
    v_key := v_question->>'key';
    v_allowed := array_append(v_allowed, v_key);
    v_value := p_survey->v_key;
    if v_question ? 'options' and v_question->'options' ? 'อื่นๆ' then
      v_allowed := array_append(v_allowed, v_key || '_other');
      v_other := p_survey->(v_key || '_other');
      if v_other is not null and (
        jsonb_typeof(v_other) <> 'string' or length(v_other #>> '{}') > 4000
        or (length(btrim(v_other #>> '{}')) > 0 and not coalesce(
          v_value = to_jsonb('อื่นๆ'::text) or v_value @> '["อื่นๆ"]'::jsonb, false))) then
        raise exception 'invalid_other' using errcode = '22023';
      end if;
    end if;
    if v_value is null then continue; end if;
    if v_question->>'kind' = 'multi' then
      if jsonb_typeof(v_value) <> 'array' then
        raise exception 'invalid_survey' using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_array_elements(v_value) a
        where jsonb_typeof(a) <> 'string' or not (v_question->'options' @> jsonb_build_array(a)))
        or jsonb_array_length(v_value) <> (select count(distinct a) from jsonb_array_elements(v_value) a) then
        raise exception 'invalid_survey' using errcode = '22023';
      end if;
    else
      if jsonb_typeof(v_value) <> 'string' or length(v_value #>> '{}') > 4000 then
        raise exception 'invalid_survey' using errcode = '22023';
      end if;
      if v_question->>'kind' = 'single' and v_value <> '""'::jsonb
        and not (v_question->'options' @> jsonb_build_array(v_value)) then
        raise exception 'invalid_survey' using errcode = '22023';
      end if;
      if v_question->>'kind' = 'number' and v_value <> '""'::jsonb
        and (v_value #>> '{}') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'invalid_survey' using errcode = '22023';
      end if;
    end if;
  end loop;
  if exists (select 1 from jsonb_object_keys(p_survey) k where not k = any(v_allowed)) then
    raise exception 'unknown_survey_key' using errcode = '22023';
  end if;
end
$$;
revoke all on function private.walkin_validate_input(text, jsonb, jsonb) from public, anon, authenticated;

-- SHARE, rather than KEY SHARE, also serializes staff deactivation/role changes.
create function private.walkin_lock_actor(p_owner uuid default null) returns public.staff
language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff;
begin
  perform s.id from public.staff s
    where s.id = auth.uid() or s.id = p_owner order by s.id for share;
  select * into v_actor from public.staff where id = auth.uid() and is_active;
  if v_actor.id is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return v_actor;
end
$$;
revoke all on function private.walkin_lock_actor(uuid) from public, anon, authenticated;
