-- Staff membership is provisioned here; access still requires operator activation.
create function private.create_staff_for_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := case when jsonb_typeof(new.raw_user_meta_data -> 'full_name') = 'string'
    then nullif(btrim(new.raw_user_meta_data ->> 'full_name', E' \t\n\r\f'), '') end;
begin
  insert into public.staff(id, full_name, role, is_active)
  values (new.id, left(coalesce(v_name, nullif(btrim(new.email), ''),
    'Pending staff ' || new.id::text), 200), 'sale', false);
  return new;
end
$$;
revoke all on function private.create_staff_for_auth_user() from public, anon, authenticated;

create trigger auth_user_create_staff
after insert on auth.users
for each row execute function private.create_staff_for_auth_user();
