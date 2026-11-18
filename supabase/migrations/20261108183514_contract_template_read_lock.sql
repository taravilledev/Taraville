begin;
-- Existing permission checks take a row share lock; PostgREST must use a read-write transaction.
alter function private.sales_contract_template(uuid) volatile;
alter function public.sales_contract_template(uuid) volatile;
notify pgrst,'reload schema';
commit;
