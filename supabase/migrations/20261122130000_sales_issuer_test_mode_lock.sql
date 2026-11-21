-- ADR 0066: no API path can switch issuer test mode on. A new issuer is stored with is_synthetic = false and an
-- update keeps the stored value; an is_synthetic key in the input is still accepted (older clients send it) but ignored.
-- Local fixtures set test mode with direct SQL. Same signature as before, so CREATE OR REPLACE replaces in place.
CREATE OR REPLACE FUNCTION private.sales_save_issuer(p_brand text, p_version bigint, p_input jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor public.staff := private.sales_actor(); v_row private.sales_issuers;
  v_payload jsonb := jsonb_build_object('brand',p_brand,'version',p_version,'input',p_input); v_result jsonb;
begin
  if v_actor.role <> 'executive' then raise exception using errcode='42501',message='executive_required'; end if;
  v_result := private.sales_replay('issuer.save',p_request_id,v_payload);
  if v_result is not null then return v_result; end if;
  if p_brand is null or p_brand not in ('BAAN_KUNAPAP','TARAVILLE') or p_input is null
    or jsonb_typeof(p_input) <> 'object' or exists(select 1 from jsonb_object_keys(p_input) k
      where k not in ('legal_name','address','tax_id','contact','contract_text','is_synthetic','contract_text_approved'))
    or (p_input ? 'is_synthetic' and jsonb_typeof(p_input->'is_synthetic') is distinct from 'boolean')
    or (p_input ? 'contract_text_approved' and jsonb_typeof(p_input->'contract_text_approved') is distinct from 'boolean')
    or (p_input->'contract_text_approved' = 'true'::jsonb and length(btrim(coalesce(p_input->>'contract_text',''))) = 0) then
    raise exception using errcode='22023',message='invalid_issuer';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sales.issuer.' || p_brand,0));
  select * into v_row from private.sales_issuers where brand=p_brand for update;
  if p_version is distinct from coalesce(v_row.version,0) then raise exception using errcode='PT409',message='stale_issuer'; end if;
  insert into private.sales_issuers(brand,legal_name,address,tax_id,contact,contract_text,is_synthetic,contract_text_approved,updated_by)
  values(p_brand,btrim(p_input->>'legal_name'),btrim(p_input->>'address'),coalesce(p_input->>'tax_id',''),
    coalesce(p_input->>'contact',''),coalesce(p_input->>'contract_text',''),false,coalesce((p_input->>'contract_text_approved')::boolean,false),v_actor.id)
  on conflict(brand) do update set legal_name=excluded.legal_name,address=excluded.address,tax_id=excluded.tax_id,
    contact=excluded.contact,contract_text=excluded.contract_text,contract_text_approved=excluded.contract_text_approved,
    version=private.sales_issuers.version+1,updated_by=v_actor.id,updated_at=now() returning * into v_row;
  insert into private.sales_events(actor_id,action,detail) values(v_actor.id,'issuer.save',jsonb_build_object('brand',p_brand,'version',v_row.version));
  return private.sales_remember('issuer.save',p_request_id,v_payload,jsonb_build_object('version',v_row.version));
end $function$;
