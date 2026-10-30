-- Validator-only checks: no customer fixtures or persistent writes.
begin;
do $$
declare
  contact constant jsonb := '{"first_name":"Synthetic Taraville survey check","phone":"0000000000"}';
  answers jsonb;
begin
  foreach answers in array array[
    '{}'::jsonb,
    '{"occupation":"อื่นๆ","occupation_other":"เกษตรกร","decision_factors":["ทำเลที่ตั้ง","เชื่อมั่นในแบรนด์","คุณภาพของวัสดุ"],"preferred_location":"Synthetic preferred location","budget_range":"3-4 ล้าน","purchase_reason":"ซื้อเพื่อปล่อยเช่า"}'::jsonb,
    '{"decision_factors":["ทำเลที่ตั้ง"]}'::jsonb,
    '{"budget_range":"4 ล้านขึ้นไป"}'::jsonb,
    '{"house_type":"คอนโด","budget_range":"3 ล้านขึ้นไป","decision_time":"2 สัปดาห์","monthly_installment":"15000"}'::jsonb,
    jsonb_build_object('decision_factors', jsonb_build_array('ทำเลที่ตั้ง'), 'preferred_location', repeat('x', 4000))
  ] loop
    perform private.walkin_validate_input('TARAVILLE', contact, answers);
  end loop;

  foreach answers in array array[
    '{"preferred_location":"Stale location"}'::jsonb,
    '{"decision_factors":["ราคาที่เหมาะสม"],"preferred_location":"Stale location"}'::jsonb,
    '{"decision_factors":["ทำเลที่ตั้ง"],"preferred_location":["one","two"]}'::jsonb,
    '{"decision_factors":["ทำเลที่ตั้ง"],"preferred_location":1}'::jsonb,
    '{"decision_factors":["ทำเลที่ตั้ง"],"preferred_location":null}'::jsonb,
    jsonb_build_object('decision_factors', jsonb_build_array('ทำเลที่ตั้ง'), 'preferred_location', repeat('x', 4001)),
    '{"decision_factors":["ทำเลที่ตั้ง","ทำเลที่ตั้ง"]}'::jsonb,
    '{"decision_factors":["unknown factor"]}'::jsonb,
    '{"occupation":"ค้าขาย","occupation_other":"Stale occupation"}'::jsonb,
    '{"occupation":"อื่นๆ","occupation_other":["เกษตรกร"]}'::jsonb,
    '{"unknown_question":"value"}'::jsonb,
    '{"payment_method":"เงินสด"}'::jsonb
  ] loop
    begin
      perform private.walkin_validate_input('TARAVILLE', contact, answers);
      raise exception 'Invalid Taraville survey accepted: %', answers;
    exception when sqlstate '22023' then null;
    end;
  end loop;

  begin
    perform private.walkin_validate_input('BAAN_KUNAPAP', contact, '{"preferred_location":"Wrong brand"}'::jsonb);
    raise exception 'Taraville-only location accepted for BK';
  exception when sqlstate '22023' then null;
  end;
  perform private.walkin_validate_input('BAAN_KUNAPAP', contact,
    '{"occupation":"อื่นๆ","occupation_other":"เกษตรกร","house_type":"รีโนเวท / ต่อเติม / ซ่อมแซม","payment_method":"สินเชื่อธนาคาร"}'::jsonb);
  perform private.walkin_validate_input('BAAN_KUNAPAP', contact,
    '{"house_type":"คอนโด","monthly_installment":"6,000-8,000"}'::jsonb);
end
$$;
rollback;
\echo PASS: Taraville revised answers, dependent location, legacy answers and BK boundaries
