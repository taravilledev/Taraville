-- Read-only inventory. Run against exactly gquytrggcghnhlrpzcli before approval.
begin read only;
select jsonb_build_object(
  'database', current_database(),
  'postgres_version', current_setting('server_version'),
  'business_tables', (select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', c.relname, 'rls', c.relrowsecurity)), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm')),
  'existing_functions', (select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname, 'args', pg_get_function_identity_arguments(p.oid))), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')),
  'private_schema_exists', exists(select 1 from pg_namespace where nspname = 'private'),
  'migration_history_exists', to_regclass('supabase_migrations.schema_migrations') is not null,
  'auth_user_count', (select count(*) from auth.users)
) as preflight;
rollback;
