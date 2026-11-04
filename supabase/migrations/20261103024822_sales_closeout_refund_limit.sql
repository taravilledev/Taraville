begin;
create function private.sales_check_closeout_refund_limit() returns trigger
language plpgsql set search_path='' as $$
declare
  v_retained numeric;
  v_committed numeric := 0;
begin
  select (payload->>'retained_cents')::numeric into v_retained
    from private.sales_documents where case_id=new.case_id and kind='closeout' and state='signed'
    order by revision desc limit 1;
  if not found then return new; end if;
  if tg_table_name='sales_refund_requests' then
    select coalesce(sum(amount_cents),0) into v_committed from private.sales_refund_requests
      where case_id=new.case_id and state in ('pending','approved');
  end if;
  if new.amount_cents+v_committed>greatest(0,private.sales_case_money(new.case_id)-v_retained) then
    raise exception using errcode='22023',message='refund_exceeds_signed_closeout';
  end if;
  return new;
end $$;
create trigger sales_closeout_refund_request before insert on private.sales_refund_requests
  for each row execute function private.sales_check_closeout_refund_limit();
create trigger sales_closeout_refund_payout before insert on private.sales_payouts
  for each row execute function private.sales_check_closeout_refund_limit();
revoke all on function private.sales_check_closeout_refund_limit() from public,anon,authenticated;
commit;
