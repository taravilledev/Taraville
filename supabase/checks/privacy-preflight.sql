-- Read-only collision check before the separately approved production apply.
begin read only;
select jsonb_build_object(
  'privacy_table', to_regclass('public.lead_privacy_events'),
  'retention_view', to_regclass('public.walkin_retention_due'),
  'new_lead_columns', (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name in ('privacy_mode', 'last_contact_at')),
  'new_functions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.proname in
      ('walkin_privacy_notice','walkin_guard_survey_choice','walkin_guard_privacy_history',
       'walkin_create_lead_with_privacy','walkin_record_privacy_event')),
  'staff_count', (select count(*) from public.staff),
  'lead_count', (select count(*) from public.leads),
  'migration_versions', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as privacy_preflight;
rollback;
