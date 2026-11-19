import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
const url = new URL(local.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '54321', 'Local Docker only');
const auth = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await auth.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
const token = login.data.session.access_token;
const sql = query => execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function call(name, input, access = token) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: {
    apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ...(access ? { Authorization: 'Bearer ' + access } : {}), 'Content-Type': 'application/json',
  }, body: JSON.stringify(input) });
  return { status: response.status, body: await response.json() };
}
async function rpc(name, input, expected = 200, error) {
  const result = await call(name, input);
  assert.equal(result.status, expected, name + ': ' + JSON.stringify(result.body));
  if (error) assert.equal(result.body.message, error);
  return result.body;
}
const actor = login.data.user.id;
async function fixture() {
  const lead = randomUUID();
  sql("insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode) values('" + lead + "','BAAN_KUNAPAP','Synthetic Design','Billing','0000000000','" + actor + "','" + actor + "','" + randomUUID() + "',repeat('0',64),'synthetic')");
  const project = await rpc('walkin_open_project', { p_lead_id: lead, p_expected_version: 1, p_request_id: randomUUID() });
  const job = await rpc('sales_create_case', { p_lead_id: lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() });
  await rpc('sales_save_design_plan', { p_case_id: job.id, p_version: job.version, p_input: { usable_area: '100', tier: 'under150' }, p_request_id: randomUUID() });
  return job.id;
}
const id = await fixture();
const finance = () => rpc('sales_financial_detail', { p_case_id: id });
const version = async () => (await finance()).version;
const save = async (expected = 200, error) => rpc('sales_save_design_plan', { p_case_id: id, p_version: await version(), p_input: { usable_area: '100', tier: 'under150' }, p_request_id: randomUUID() }, expected, error);
const due = '2026-12-01';
const issueArgs = async position => ({ p_case_id: id, p_position: position, p_version: await version(), p_due_date: due, p_request_id: randomUUID() });
const cancel = async bill => rpc('sales_cancel_design_invoice', { p_invoice_id: bill.invoice_id, p_version: await version(), p_reason: 'Synthetic unpaid cancellation', p_request_id: randomUUID() });
const input = { method: 'cash', paid_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }), payer_name: 'Synthetic payer', description: 'ค่าออกแบบ งวดที่ 1', proof_path: '' };
await rpc('sales_issue_design_invoice', { ...await issueArgs(1), p_due_date: null }, 400, 'invalid_design_invoice');
const args = await issueArgs(1);
const first = await rpc('sales_issue_design_invoice', args);
assert.deepEqual(await rpc('sales_issue_design_invoice', args), first, 'Issue replay must not duplicate');
await rpc('sales_issue_design_invoice', await issueArgs(1), 409, 'design_invoice_already_issued');
assert.equal((await finance()).can_change_design, false);
await save(400, 'design_billing_locked');
const doc = await rpc('sales_document_detail', { p_document_id: first.document_id });
assert.equal(doc.kind, 'invoice'); assert.equal(doc.payload.net_cents, '350000');
assert.equal(doc.payload.due_date, due); assert.equal(doc.payload.is_synthetic, true);
for (const amount of ['1', '350001', '350000']) {
  await rpc('sales_prepare_payment', { p_case_id: id, p_version: await version(), p_input: { ...input, kind: 'design_fee', amount_cents: amount, invoice_id: '' }, p_request_id: randomUUID() }, 400, 'design_invoice_required');
}
await rpc('sales_prepare_design_payment', { p_invoice_id: first.invoice_id, p_version: await version(), p_input: { ...input, amount_cents: '1' }, p_request_id: randomUUID() }, 400, 'invalid_payment');
const second = await rpc('sales_issue_design_invoice', await issueArgs(2));
await cancel(second);
await cancel(first);
assert.equal((await finance()).can_change_design, true, 'Cancelling all unpaid invoices unlocks plan');
await save();
const active = await rpc('sales_issue_design_invoice', await issueArgs(1));
const prepareArgs = { p_invoice_id: active.invoice_id, p_version: await version(), p_input: input, p_request_id: randomUUID() };
const competingArgs = { ...prepareArgs, p_request_id: randomUUID() };
const race = await Promise.all([call('sales_prepare_design_payment', prepareArgs), call('sales_prepare_design_payment', competingArgs)]);
assert.deepEqual(race.map(result => result.status).sort(), [200, 409], 'One concurrent pending request only');
const prepared = race.find(result => result.status === 200).body;
const winnerArgs = race[0].status === 200 ? prepareArgs : competingArgs;
assert.deepEqual(await rpc('sales_prepare_design_payment', winnerArgs), prepared);
let state = await finance();
let bill = state.design_bills.find(item => item.id === active.invoice_id);
assert.equal(bill.received_cents, '0', 'Pending is not received'); assert.equal(bill.pending_cents, '350000');
assert.equal(bill.has_confirmed_payment, false); assert.equal(bill.pending_id, prepared.payment_request_id);
await rpc('sales_prepare_design_payment', { ...prepareArgs, p_version: state.version, p_request_id: randomUUID() }, 409, 'design_payment_pending');
await rpc('sales_cancel_design_invoice', { p_invoice_id: active.invoice_id, p_version: state.version, p_reason: 'Synthetic blocked', p_request_id: randomUUID() }, 400, 'design_invoice_has_payment');
await rpc('sales_reject_pending_payment', { p_payment_request_id: prepared.payment_request_id, p_version: state.version, p_reason: 'Synthetic withdrawal', p_request_id: randomUUID() });
assert.equal((await finance()).design_bills.find(item => item.id === active.invoice_id).pending_id, null);
const readyArgs = { p_invoice_id: active.invoice_id, p_version: await version(), p_input: input, p_request_id: randomUUID() };
const ready = await rpc('sales_prepare_design_payment', readyArgs);
assert.deepEqual(await rpc('sales_prepare_design_payment', readyArgs), ready);
const confirm = { p_payment_request_id: ready.payment_request_id, p_version: await version(), p_funds_confirmed: true, p_request_id: randomUUID() };
await rpc('sales_confirm_payment', { ...confirm, p_funds_confirmed: false, p_request_id: randomUUID() }, 400, 'actual_funds_confirmation_required');
const paid = await rpc('sales_confirm_payment', confirm);
assert.deepEqual(await rpc('sales_confirm_payment', confirm), paid);
state = await finance(); bill = state.design_bills.find(item => item.id === active.invoice_id);
assert.equal(bill.received_cents, '350000'); assert.equal(bill.pending_id, null); assert.equal(bill.has_confirmed_payment, true);
assert.equal(bill.receipt_document_id, paid.document_id); assert.equal(state.can_change_design, false);
const receipt = await rpc('sales_document_detail', { p_document_id: paid.document_id });
assert.equal(receipt.kind, 'receipt'); assert.equal(receipt.payload.amount_cents, '350000');
assert.equal(sql("select count(*) from private.sales_allocations where case_id='" + id + "'"), '0', 'Design payment is not allocated as a contract invoice');
await rpc('sales_prepare_design_payment', { ...readyArgs, p_version: state.version, p_request_id: randomUUID() }, 409, 'design_invoice_already_paid');
await rpc('sales_cancel_design_invoice', { p_invoice_id: active.invoice_id, p_version: state.version, p_reason: 'Synthetic blocked paid', p_request_id: randomUUID() }, 400, 'design_invoice_has_payment');
await save(400, 'design_billing_locked');
await rpc('sales_correct_payment', { p_document_id: paid.document_id, p_version: state.version, p_amount_cents: '1', p_reason: 'Synthetic blocked correction', p_evidence_path: '', p_request_id: randomUUID() }, 400, 'design_bill_amount_locked');
assert.notEqual((await call('sales_issue_design_invoice', await issueArgs(3), null)).status, 200, 'Anonymous cannot issue');
console.log(JSON.stringify({ result: 'PASS: local design billing issue/cancel/replay/full-only/pending race/withdraw/confirm/receipt/locks/anonymous-denial', case_id: id, receipt_id: paid.document_id }, null, 2));
