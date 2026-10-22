-- Read-only verification after separately approved privacy foundation apply.
begin read only;
select jsonb_build_object(
  'event_table', (select jsonb_build_object('rls', c.relrowsecurity,
    'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
    'authenticated_write', has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'),
    'anon_access', has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
    from pg_class c where c.oid = 'public.lead_privacy_events'::regclass),
  'policy', (select jsonb_agg(to_jsonb(p)) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'lead_privacy_events'),
  'triggers', (select jsonb_agg(jsonb_build_object('name', t.tgname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t
    where not t.tgisinternal and t.tgrelid in ('public.leads'::regclass, 'public.lead_privacy_events'::regclass)),
  'view', (select jsonb_build_object('options', c.reloptions, 'definition', pg_get_viewdef(c.oid),
    'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
    'anon_select', has_table_privilege('anon', c.oid, 'SELECT'))
    from pg_class c where c.oid = 'public.walkin_retention_due'::regclass),
  'lead_columns', (select jsonb_agg(to_jsonb(c)) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'leads' and c.column_name in ('privacy_mode','last_contact_at')),
  'functions', (select jsonb_agg(jsonb_build_object('name', n.nspname || '.' || p.proname,
    'args', pg_get_function_identity_arguments(p.oid), 'source', p.prosrc, 'definer', p.prosecdef,
    'config', p.proconfig, 'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE')) order by n.nspname,p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.proname like 'walkin_%'),
  'counts', jsonb_build_object('leads', (select count(*) from public.leads),
    'events', (select count(*) from public.lead_privacy_events),
    'non_synthetic', (select count(*) from public.leads where privacy_mode <> 'synthetic'),
    'with_last_contact', (select count(*) from public.leads where last_contact_at is not null)),
  'migration_versions', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as privacy_postflight;
rollback;
