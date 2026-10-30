-- Run only against an isolated local database with the candidate migrations.
begin;
do $$
declare
  contact constant jsonb := '{"first_name":"Synthetic survey check","phone":"0000000000"}';
  answers jsonb;
begin
  foreach answers in array array[
    '{}'::jsonb,
    '{"address":"Synthetic construction site","occupation":"อื่นๆ","occupation_other":"เกษตรกร","house_type":"รีโนเวท / ต่อเติม / ซ่อมแซม","payment_method":"เงินสด"}'::jsonb,
    '{"payment_method":"สินเชื่อธนาคาร"}'::jsonb,
    '{"house_type":"คอนโด","monthly_installment":"6,000-8,000"}'::jsonb
  ] loop
    perform private.walkin_validate_input('BAAN_KUNAPAP', contact, answers);
  end loop;

  foreach answers in array array[
    '{"payment_method":"เงินกู้"}'::jsonb,
    '{"payment_method":["เงินสด","สินเชื่อธนาคาร"]}'::jsonb,
    '{"payment_method":["เงินสด","เงินสด"]}'::jsonb,
    '{"payment_method":1}'::jsonb,
    '{"occupation":"ค้าขาย","occupation_other":"เกษตรกร"}'::jsonb,
    '{"occupation":"อื่นๆ","occupation_other":["เกษตรกร"]}'::jsonb
  ] loop
    begin
      perform private.walkin_validate_input('BAAN_KUNAPAP', contact, answers);
      raise exception 'Invalid BK survey accepted: %', answers;
    exception when sqlstate '22023' then null;
    end;
  end loop;

  foreach answers in array array[
    '{"payment_method":"เงินสด"}'::jsonb,
    '{"house_type":"รีโนเวท / ต่อเติม / ซ่อมแซม"}'::jsonb
  ] loop
    begin
      perform private.walkin_validate_input('TARAVILLE', contact, answers);
      raise exception 'BK-only survey accepted for Taraville: %', answers;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  perform private.walkin_validate_input('TARAVILLE', contact,
    '{"house_type":"คอนโด","monthly_installment":"15000","occupation":"พนักงานบริษัท"}'::jsonb);
  perform private.walkin_validate_input('TARAVILLE', contact,
    '{"occupation":"อื่นๆ","occupation_other":"เกษตรกร"}'::jsonb);
end
$$;
rollback;
\echo PASS: BK revised answers, optional financing, legacy answers and brand boundaries
