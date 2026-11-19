begin;

-- The capability guard returns void; obtain the active actor separately.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('private.sales_confirm_payment(uuid,bigint,boolean,uuid)'::regprocedure) into v_definition;
  if position('v_actor := private.sales_require(''receipt.issue'',v_case.id);' in v_definition)=0 then
    raise exception 'Unexpected receipt confirmation definition';
  end if;
  execute replace(v_definition,'v_actor := private.sales_require(''receipt.issue'',v_case.id);',
    'perform private.sales_require(''receipt.issue'',v_case.id); v_actor := private.sales_actor();');
end $$;

commit;
