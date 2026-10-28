-- Disposable local PostgreSQL ONLY; never run against the production project.
-- Caller supplies auth.users, auth.uid() reading request.jwt.claim.sub, roles
-- anon/authenticated, and applies the three migrations before this check.
-- Run as the local database owner with psql -v ON_ERROR_STOP=1 -f this-file.
-- Transaction rollback removes only this run's synthetic inserts; no DELETEs.
begin;
insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');
insert into public.staff (id, full_name, role, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'Synthetic Sale A', 'sale', true),
  ('10000000-0000-0000-0000-000000000002', 'Synthetic Sale B', 'sale', true),
  ('10000000-0000-0000-0000-000000000003', 'Synthetic Executive', 'executive', true),
  ('10000000-0000-0000-0000-000000000004', 'Synthetic Inactive', 'sale', false)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

set local role authenticated;
do $$
declare
  sale_a constant uuid := '10000000-0000-0000-0000-000000000001';
  sale_b constant uuid := '10000000-0000-0000-0000-000000000002';
  executive constant uuid := '10000000-0000-0000-0000-000000000003';
  inactive constant uuid := '10000000-0000-0000-0000-000000000004';
  request_id constant uuid := '20000000-0000-0000-0000-000000000001';
  contact constant jsonb := '{"first_name":"Synthetic","phone":"0000000000"}';
  answers constant jsonb := '{"monthly_installment":"15000"}';
  lead public.leads;
  replay public.leads;
  assigned public.leads;
  invalid_survey jsonb;
begin
  perform set_config('request.jwt.claim.sub', sale_a::text, true);
  if auth.uid() is distinct from sale_a then raise exception 'auth.uid fixture mismatch'; end if;
  begin
    perform public.walkin_create_lead(request_id, 'TARAVILLE', contact, answers, sale_b);
    raise exception 'Sale owner spoof unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'access_denied' then raise; end if;
  end;
  select * into lead from public.walkin_create_lead(request_id, 'TARAVILLE', contact, answers, sale_a);
  if lead.id is null or lead.owner_id is distinct from sale_a
    or lead.created_by is distinct from sale_a or lead.version is distinct from 1 then
    raise exception 'Create identity/owner/version mismatch';
  end if;
  select * into replay from public.walkin_create_lead(request_id, 'TARAVILLE', contact, answers, sale_a);
  if replay.id is distinct from lead.id then raise exception 'Identical retry duplicated lead'; end if;
  begin
    perform public.walkin_create_lead(request_id, 'TARAVILLE', contact || '{"first_name":"Changed"}', answers, sale_a);
    raise exception 'Changed payload retry unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'request_conflict' then raise; end if;
  end;
  select * into replay from public.walkin_create_lead(
    '20000000-0000-0000-0000-000000000002', 'TARAVILLE', contact, answers, sale_a);
  if replay.id is null or replay.id = lead.id then raise exception 'Same phone must allow another enquiry'; end if;
  if (select count(*) from public.leads where owner_id = sale_a) <> 2 then
    raise exception 'Sale must see both own leads';
  end if;

  -- Validate through public RPCs, not by invoking the internal validator.
  foreach invalid_survey in array array[
    '{"unknown_key":"x"}'::jsonb, '{"gender":"invalid-option"}'::jsonb,
    '{"monthly_installment":15000}'::jsonb, '{"monthly_installment":["15000"]}'::jsonb,
    '{"monthly_installment":"6,000-8,000"}'::jsonb
  ] loop
    begin
      perform public.walkin_create_lead(gen_random_uuid(), 'TARAVILLE', contact, invalid_survey, sale_a);
      raise exception 'Invalid Taraville survey unexpectedly accepted: %', invalid_survey;
    exception when invalid_parameter_value then
      if sqlerrm not in ('unknown_survey_key', 'invalid_survey') then raise; end if;
    end;
  end loop;
  foreach invalid_survey in array array[
    '{"monthly_installment":"15000"}'::jsonb,
    '{"monthly_installment":15000}'::jsonb, '{"monthly_installment":["6,000-8,000"]}'::jsonb
  ] loop
    begin
      perform public.walkin_create_lead(gen_random_uuid(), 'BAAN_KUNAPAP', contact, invalid_survey, sale_a);
      raise exception 'Invalid BK monthly installment unexpectedly accepted: %', invalid_survey;
    exception when invalid_parameter_value then
      if sqlerrm <> 'invalid_survey' then raise; end if;
    end;
  end loop;
  select * into replay from public.walkin_create_lead(
    gen_random_uuid(), 'BAAN_KUNAPAP', contact, '{"monthly_installment":"6,000-8,000"}', sale_a);
  if replay.brand is distinct from 'BAAN_KUNAPAP' then raise exception 'Valid BK answer rejected/mis-saved'; end if;

  perform set_config('request.jwt.claim.sub', sale_b::text, true);
  if (select count(*) from public.leads) <> 0 then raise exception 'Other Sale can read leads'; end if;
  begin
    perform public.walkin_update_lead(lead.id, 1, contact, answers);
    raise exception 'Other Sale update unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'access_denied' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', executive::text, true);
  select * into assigned from public.walkin_create_lead(
    gen_random_uuid(), 'TARAVILLE', contact, answers, sale_a);
  if assigned.owner_id is distinct from sale_a or assigned.created_by is distinct from executive then
    raise exception 'Executive create must preserve explicit Sale owner and creator';
  end if;
  if not exists (select 1 from public.leads where id = lead.id) then
    raise exception 'Executive cannot read another owner lead';
  end if;
  select * into replay from public.walkin_reassign_lead(lead.id, lead.version, sale_b);
  if replay.owner_id is distinct from sale_b or replay.version is distinct from lead.version + 1 then
    raise exception 'Reassign must change owner and increment version';
  end if;
  begin
    perform public.walkin_update_lead(lead.id, lead.version, contact, answers);
    raise exception 'Stale Executive edit unexpectedly succeeded';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'stale_lead' then raise; end if;
  end;
  select * into assigned from public.walkin_update_lead(lead.id, replay.version, contact, answers);
  if assigned.version is distinct from replay.version + 1 or assigned.owner_id is distinct from sale_b then
    raise exception 'Current Executive edit must increment version and preserve owner';
  end if;

  perform set_config('request.jwt.claim.sub', sale_a::text, true);
  if exists (select 1 from public.leads where id = lead.id) then
    raise exception 'Old Sale can still read reassigned lead';
  end if;
  begin
    perform public.walkin_create_lead(request_id, 'TARAVILLE', contact, answers, sale_a);
    raise exception 'Old Sale retry unexpectedly returned reassigned lead';
  exception when insufficient_privilege then
    if sqlerrm <> 'access_denied' then raise; end if;
  end;
  begin
    perform public.walkin_update_lead(lead.id, assigned.version, contact, answers);
    raise exception 'Old Sale edit unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'access_denied' then raise; end if;
  end;
  -- A new owner can read and edit using the latest version.
  perform set_config('request.jwt.claim.sub', sale_b::text, true);
  if not exists (select 1 from public.leads where id = lead.id) then
    raise exception 'New Sale cannot read reassigned lead';
  end if;
  select * into replay from public.walkin_update_lead(lead.id, assigned.version, contact, answers);
  if replay.version is distinct from assigned.version + 1 then raise exception 'New owner edit did not advance version'; end if;

  perform set_config('request.jwt.claim.sub', inactive::text, true);
  if (select count(*) from public.leads) <> 0 or (select count(*) from public.staff) <> 0 then
    raise exception 'Inactive staff can read protected data';
  end if;
  begin
    perform public.walkin_create_lead(gen_random_uuid(), 'TARAVILLE', contact, answers, inactive);
    raise exception 'Inactive staff create unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'access_denied' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', executive::text, true);
  begin
    insert into public.leads default values;
    raise exception 'Direct lead INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for table leads' then raise; end if;
  end;
  begin
    update public.leads set first_name = 'Forbidden' where id = lead.id;
    raise exception 'Direct lead UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for table leads' then raise; end if;
  end;
  begin
    insert into public.staff default values;
    raise exception 'Direct staff INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for table staff' then raise; end if;
  end;
  begin
    update public.staff set is_active = false where id = sale_a;
    raise exception 'Direct staff UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for table staff' then raise; end if;
  end;
end
$$;

set local role anon;
do $$
begin
  begin
    perform public.walkin_create_lead(
      gen_random_uuid(), 'TARAVILLE', '{"first_name":"Synthetic","phone":"0000000000"}', '{}',
      '10000000-0000-0000-0000-000000000001');
    raise exception 'Anon create RPC unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for function walkin_create_lead' then raise; end if;
  end;
  begin
    perform public.walkin_update_lead('00000000-0000-0000-0000-000000000000', 1, '{}', '{}');
    raise exception 'Anon update RPC unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for function walkin_update_lead' then raise; end if;
  end;
  begin
    perform public.walkin_reassign_lead('00000000-0000-0000-0000-000000000000', 1,
      '10000000-0000-0000-0000-000000000001');
    raise exception 'Anon reassign RPC unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'permission denied for function walkin_reassign_lead' then raise; end if;
  end;
end
$$;
rollback;
-- Passing SQL checks do not prove HTTP exposure configuration, concurrent sessions,
-- production role/grant state, privacy release, browser flows or physical devices.
