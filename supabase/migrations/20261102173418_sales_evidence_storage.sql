begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sales-evidence','sales-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id = 'sales-evidence' and public) then
    raise exception 'sales_evidence_bucket_must_be_private';
  end if;
end $$;

create policy sales_evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'sales-evidence' and private.sales_evidence_allowed(name,false));
create policy sales_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sales-evidence' and private.sales_evidence_allowed(name,true));
-- Keep this bucket protected even if a later feature introduces a broad policy for another bucket.
create policy sales_evidence_read_boundary on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'sales-evidence' or private.sales_evidence_allowed(name,false));
create policy sales_evidence_insert_boundary on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'sales-evidence' or private.sales_evidence_allowed(name,true));
create policy sales_evidence_no_update on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'sales-evidence') with check (bucket_id <> 'sales-evidence');
create policy sales_evidence_no_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'sales-evidence');
create policy sales_evidence_no_anon on storage.objects as restrictive for all to anon
  using (bucket_id <> 'sales-evidence') with check (bucket_id <> 'sales-evidence');
commit;
