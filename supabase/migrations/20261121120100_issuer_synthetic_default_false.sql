-- ADR 0062 (Q92 ก): a NEW issuer row starts with test mode off. Existing rows are untouched;
-- switching them off is the separate go-live R0 task.
alter table private.sales_issuers alter column is_synthetic set default false;
