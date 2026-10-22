-- Read-only verification after the approved migration application.
begin read only;
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_object(
    'name', c.relname, 'rls', c.relrowsecurity,
    'owner', pg_get_userbyid(c.relowner),
    'columns', (select jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull)
      order by a.attnum) from pg_attribute a
      where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
    'constraints', (select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname)
      from pg_constraint k where k.conrelid = c.oid),
    'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
    'authenticated_write', has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'anon_access', has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('staff', 'leads')),
  'functions', (select jsonb_agg(jsonb_build_object(
    'name', n.nspname || '.' || p.proname, 'args', pg_get_function_identity_arguments(p.oid),
    'source', p.prosrc, 'definer', p.prosecdef, 'config', p.proconfig,
    'owner', pg_get_userbyid(p.proowner),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE')) order by n.nspname, p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.proname like 'walkin_%'),
  'policies', (select jsonb_agg(to_jsonb(p) order by p.tablename)
    from pg_policies p where p.schemaname = 'public' and p.tablename in ('staff', 'leads')),
  'indexes', (select jsonb_agg(to_jsonb(i) order by i.indexname)
    from pg_indexes i where i.schemaname = 'public' and i.tablename in ('staff', 'leads')),
  'migration_versions', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'private_schema_owner', (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'private'),
  'private_authenticated_usage', has_schema_privilege('authenticated', 'private', 'USAGE'),
  'private_authenticated_create', has_schema_privilege('authenticated', 'private', 'CREATE'),
  'private_anon_usage', has_schema_privilege('anon', 'private', 'USAGE'),
  'data_api_schema_settings', (select jsonb_agg(setting) from pg_db_role_setting s,
    lateral unnest(s.setconfig) setting where setting like 'pgrst.db_schemas=%'),
  'staff_count', (select count(*) from public.staff),
  'lead_count', (select count(*) from public.leads),
  'auth_user_count', (select count(*) from auth.users)
) as postflight;
rollback;
