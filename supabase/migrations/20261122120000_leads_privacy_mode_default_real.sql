-- ADR 0062: prod holds no test data any more (purged 2026-11-22), so a Lead inserted without an explicit
-- privacy_mode must be real, not synthetic. The live intake RPC already passes 'real'; this only changes the default.
-- Existing rows and the ('synthetic','real') check are untouched.
alter table public.leads alter column privacy_mode set default 'real';
