-- ADR 0066: the pre-consent intake has been revoked from every API role since 20261022102243 and nothing calls it.
-- walkin_create_lead_with_privacy is the only intake path. Drop the public wrapper first, then the private function.
drop function if exists public.walkin_create_lead(uuid, text, jsonb, jsonb, uuid);
drop function if exists private.walkin_create_lead(uuid, text, jsonb, jsonb, uuid);
