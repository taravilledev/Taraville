begin;

create table private.sales_issuers (
  brand text primary key check (brand in ('BAAN_KUNAPAP','TARAVILLE')),
  legal_name text not null check (length(btrim(legal_name)) between 1 and 300),
  address text not null check (length(btrim(address)) between 1 and 3000),
  tax_id text not null default '' check (length(tax_id) <= 40),
  contact text not null default '' check (length(contact) <= 500),
  contract_text text not null default '' check (length(contract_text) <= 100000),
  is_synthetic boolean not null default true,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references public.staff(id),
  updated_at timestamptz not null default now()
);

create table private.sales_design_plans (
  case_id uuid primary key references private.sales_cases(id),
  tier text not null check (tier in ('under150','under200','under250','upto300','custom')),
  usable_area numeric(12,3) check (usable_area > 0),
  total_cents bigint not null check (total_cents >= 0),
  instalments jsonb not null check (jsonb_typeof(instalments) = 'array' and jsonb_array_length(instalments) = 3),
  note text not null default '' check (length(note) <= 3000),
  version bigint not null default 1 check (version > 0),
  agreed_by uuid not null references public.staff(id),
  agreed_at timestamptz not null default now()
);

create table private.sales_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  kind text not null check (kind in ('summary','booking','quotation','contract','amendment','invoice','receipt','refund','closeout')),
  number text unique,
  revision integer not null check (revision > 0),
  state text not null check (state in ('draft','offered','accepted','awaiting_signature','signed','issued','cancelled')),
  document_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  parent_id uuid references private.sales_documents(id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 300000),
  customer_snapshot jsonb not null check (jsonb_typeof(customer_snapshot) = 'object'),
  issuer_snapshot jsonb not null check (jsonb_typeof(issuer_snapshot) = 'object'),
  evidence_path text,
  finalized_by uuid references public.staff(id),
  finalized_at timestamptz,
  cancelled_by uuid references public.staff(id),
  cancelled_at timestamptz,
  cancel_reason text check (length(btrim(cancel_reason)) between 1 and 1000),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  unique (case_id,kind,revision),
  check ((state = 'cancelled') = (cancelled_at is not null)
    and (cancelled_at is null) = (cancelled_by is null) and (cancelled_at is null) = (cancel_reason is null))
);
create index sales_documents_case_idx on private.sales_documents(case_id,created_at,id);

create table private.sales_instalments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  contract_id uuid not null references private.sales_documents(id),
  position integer not null check (position between 0 and 100),
  label text not null check (length(btrim(label)) between 1 and 300),
  gross_cents bigint not null check (gross_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0 and credit_cents <= gross_cents),
  due_date date,
  progress_percent integer check (progress_percent between 0 and 100),
  needs_acceptance boolean not null default true,
  acceptance_path text,
  accepted_by uuid references public.staff(id),
  accepted_at timestamptz,
  is_active boolean not null default true,
  unique(contract_id,position),
  check ((accepted_at is null) = (accepted_by is null))
);

create table private.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  document_id uuid not null unique references private.sales_documents(id),
  instalment_id uuid not null references private.sales_instalments(id),
  gross_cents bigint not null check (gross_cents >= 0),
  credit_cents bigint not null check (credit_cents >= 0 and credit_cents <= gross_cents),
  net_cents bigint generated always as (gross_cents - credit_cents) stored,
  due_date date not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index sales_invoices_active_instalment on private.sales_invoices(instalment_id) where cancelled_at is null;

create table private.sales_payment_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  invoice_id uuid references private.sales_invoices(id),
  kind text not null check (kind in ('design_fee','booking','instalment','unallocated')),
  amount_cents bigint not null check (amount_cents > 0),
  method text not null check (method in ('cash','transfer','cheque')),
  paid_date date not null,
  payer_name text not null check (length(btrim(payer_name)) between 1 and 300),
  description text not null check (length(btrim(description)) between 1 and 1000),
  proof_path text,
  state text not null default 'pending' check (state in ('pending','confirmed','rejected')),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  check ((kind = 'instalment') = (invoice_id is not null))
);

create table private.sales_payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  root_id uuid references private.sales_payments(id),
  supersedes_id uuid unique references private.sales_payments(id),
  request_id uuid not null unique references private.sales_payment_requests(id),
  kind text not null check (kind in ('design_fee','booking','instalment','unallocated')),
  amount_cents bigint not null check (amount_cents > 0),
  method text not null check (method in ('cash','transfer','cheque')),
  paid_date date not null,
  payer_name text not null,
  description text not null,
  proof_path text,
  confirmed_by uuid not null references public.staff(id),
  confirmed_at timestamptz not null default now(),
  voided_by uuid references public.staff(id),
  voided_at timestamptz,
  void_reason text check (length(btrim(void_reason)) between 1 and 1000),
  check ((voided_at is null) = (voided_by is null) and (voided_at is null) = (void_reason is null))
);
create unique index sales_payments_active_root on private.sales_payments((coalesce(root_id,id))) where voided_at is null;
create unique index sales_payments_active_proof on private.sales_payments(proof_path) where proof_path is not null and voided_at is null;
create index sales_payments_case_idx on private.sales_payments(case_id);

create table private.sales_receipts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  root_payment_id uuid not null references private.sales_payments(id),
  payment_id uuid not null references private.sales_payments(id),
  document_id uuid not null unique references private.sales_documents(id),
  is_active boolean not null default true
);
create unique index sales_receipts_active_root on private.sales_receipts(root_payment_id) where is_active;

create table private.sales_allocations (
  id bigint generated always as identity primary key,
  case_id uuid not null references private.sales_cases(id),
  root_payment_id uuid not null references private.sales_payments(id),
  invoice_id uuid not null references private.sales_invoices(id),
  amount_cents bigint not null check (amount_cents <> 0),
  source_kind text not null check (source_kind in ('confirmation','correction','refund','reallocation')),
  source_id uuid not null,
  actor_id uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);
create index sales_allocations_invoice_idx on private.sales_allocations(invoice_id);
create index sales_allocations_payment_idx on private.sales_allocations(root_payment_id);

create table private.sales_credits (
  id bigint generated always as identity primary key,
  case_id uuid not null references private.sales_cases(id),
  root_payment_id uuid not null references private.sales_payments(id),
  instalment_id uuid not null references private.sales_instalments(id),
  agreement_id uuid not null references private.sales_documents(id),
  amount_cents bigint not null check (amount_cents <> 0),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);
create index sales_credits_payment_idx on private.sales_credits(root_payment_id);

create table private.sales_invoice_adjustments (
  id bigint generated always as identity primary key,
  case_id uuid not null references private.sales_cases(id),
  invoice_id uuid not null references private.sales_invoices(id),
  agreement_id uuid not null references private.sales_documents(id),
  amount_cents bigint not null check (amount_cents <> 0),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);

create table private.sales_refund_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  root_payment_id uuid not null references private.sales_payments(id),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null check (length(btrim(reason)) between 1 and 3000),
  agreement_id uuid references private.sales_documents(id),
  state text not null default 'pending' check (state in ('pending','approved','rejected','withdrawn','paid')),
  requested_by uuid not null references public.staff(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.staff(id),
  decided_at timestamptz,
  decision_note text,
  version bigint not null default 1 check (version > 0),
  check (state not in ('approved','paid') or (decided_by is not null and decided_by <> requested_by and decided_at is not null))
);
create index sales_refunds_payment_idx on private.sales_refund_requests(root_payment_id);

create table private.sales_payouts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.sales_cases(id),
  refund_id uuid not null unique references private.sales_refund_requests(id),
  amount_cents bigint not null check (amount_cents > 0),
  method text not null check (method in ('cash','transfer','cheque')),
  paid_date date not null,
  proof_path text not null,
  document_id uuid not null unique references private.sales_documents(id),
  paid_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['sales_issuers','sales_design_plans','sales_documents','sales_instalments','sales_invoices',
    'sales_payment_requests','sales_payments','sales_receipts','sales_allocations','sales_credits','sales_invoice_adjustments',
    'sales_refund_requests','sales_payouts'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on table private.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on sequence private.sales_allocations_id_seq,private.sales_credits_id_seq,
  private.sales_invoice_adjustments_id_seq from public,anon,authenticated;
commit;
