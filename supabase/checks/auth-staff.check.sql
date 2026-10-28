-- Disposable local PostgreSQL ONLY, after local-bootstrap.sql and all migrations.
-- No remote execution. All synthetic Auth/staff rows and overrides roll back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run in the disposable local database as postgres'; end if;
end $$;

create function pg_temp.expect_denied(p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'Expected permission denial: %', p_sql;
end $$;

do $$
declare v_function oid := 'private.create_staff_for_auth_user()'::regprocedure;
begin
  if not exists (select 1 from pg_proc where oid = v_function and prosecdef
    and proconfig @> array['search_path=""']) then
    raise exception 'Staff trigger must use SECURITY DEFINER with an empty search_path';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass
    and tgfoid = v_function and not tgisinternal and tgenabled = 'O'
    and tgtype = 5) <> 1 then
    raise exception 'Expected exactly one enabled AFTER INSERT FOR EACH ROW Auth trigger';
  end if;
  if has_function_privilege('anon', v_function, 'EXECUTE')
    or has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'Client roles can execute the internal trigger function';
  end if;
end $$;

-- Assertions use the actual INSERT trigger, not a direct call to its function.
do $$
declare v_case record; v_id uuid; v_staff public.staff;
begin
  for v_case in select * from (values
    (1, 'named@staff.taraville.invalid', '{"full_name":"  Synthetic Name  ","role":"executive","is_active":true}'::jsonb, 'Synthetic Name'),
    (2, 'blank@staff.taraville.invalid', '{"full_name":"   "}'::jsonb, 'blank@staff.taraville.invalid'),
    (3, 'null@staff.taraville.invalid', '{"full_name":null}'::jsonb, 'null@staff.taraville.invalid'),
    (4, 'number@staff.taraville.invalid', '{"full_name":42}'::jsonb, 'number@staff.taraville.invalid'),
    (5, 'object@staff.taraville.invalid', '{"full_name":{"name":"ignored"}}'::jsonb, 'object@staff.taraville.invalid'),
    (6, 'long@staff.taraville.invalid', jsonb_build_object('full_name', repeat('ก', 201)), repeat('ก', 200)),
    (7, null, null::jsonb, 'Pending staff 91000000-0000-4000-a000-000000000007'),
    (8, '', '{}'::jsonb, 'Pending staff 91000000-0000-4000-a000-000000000008'),
    (9, repeat('a', 201) || '@staff.taraville.invalid', '{}'::jsonb, repeat('a', 200))
  ) as cases(n, email, metadata, expected_name) loop
    v_id := ('91000000-0000-4000-a000-' || lpad(v_case.n::text, 12, '0'))::uuid;
    insert into auth.users(id, email, raw_user_meta_data) values (v_id, v_case.email, v_case.metadata);
    select * into v_staff from public.staff where id = v_id;
    if v_staff.id is distinct from v_id or v_staff.full_name is distinct from v_case.expected_name
      or v_staff.role is distinct from 'sale' or v_staff.is_active is distinct from false then
      raise exception 'Auth INSERT case % did not produce the expected inactive Sale staff', v_case.n;
    end if;
  end loop;
end $$;

-- Metadata is display input at creation only; later user edits cannot grant rights.
update auth.users set email = 'renamed@staff.taraville.invalid',
  raw_user_meta_data = '{"full_name":"Changed","role":"executive","is_active":true}'
  where id = '91000000-0000-4000-a000-000000000001';
do $$ begin
  if not exists (select 1 from public.staff where id = '91000000-0000-4000-a000-000000000001'
    and full_name = 'Synthetic Name' and role = 'sale' and not is_active) then
    raise exception 'Auth UPDATE changed staff identity or granted access';
  end if;
end $$;

-- Explicit operator changes survive future Auth metadata updates too.
update public.staff set full_name = 'Operator Name', role = 'executive', is_active = true
  where id = '91000000-0000-4000-a000-000000000002';
update auth.users set raw_user_meta_data = '{"full_name":"Overwrite","role":"sale","is_active":false}'
  where id = '91000000-0000-4000-a000-000000000002';
do $$ begin
  if not exists (select 1 from public.staff where id = '91000000-0000-4000-a000-000000000002'
    and full_name = 'Operator Name' and role = 'executive' and is_active) then
    raise exception 'Auth UPDATE overwrote operator-managed staff access';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-a000-000000000001', true);
do $$ begin
  if private.walkin_actor_role() is not null or exists (select 1 from public.staff)
    or exists (select 1 from public.leads) then
    raise exception 'New inactive staff can access protected data';
  end if;
end $$;
select pg_temp.expect_denied('select private.create_staff_for_auth_user()');
select pg_temp.expect_denied($q$update public.staff set role = 'executive', is_active = true
  where id = '91000000-0000-4000-a000-000000000001'$q$);
select pg_temp.expect_denied($q$insert into public.staff(id, full_name, role, is_active)
  values ('91000000-0000-4000-a000-000000000001', 'Forbidden', 'executive', true)$q$);

reset role;
set local role anon;
select pg_temp.expect_denied('select private.create_staff_for_auth_user()');
select pg_temp.expect_denied('select * from public.staff');
select pg_temp.expect_denied($q$update public.staff set is_active = true$q$);
select pg_temp.expect_denied($q$insert into public.staff(id, full_name, role)
  values ('91000000-0000-4000-a000-000000000001', 'Forbidden', 'executive')$q$);
rollback;
\echo PASS: Auth INSERT creates inactive Sale staff, bounded display names, no metadata privilege sync, private trigger and RLS boundaries
-- SQL only: the parent must separately verify real Auth HTTP execution and production state.
