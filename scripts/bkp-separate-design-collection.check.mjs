import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

assert.equal(process.env.CONFIRM_LOCAL_SEPARATE_DESIGN_TEST, '1');
assert.ok(process.env.LOCAL_TEST_PASSWORD);
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(local.NEXT_PUBLIC_SUPABASE_URL));
const client = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: process.env.LOCAL_TEST_PASSWORD });
assert.equal(login.error, null);
const actor = login.data.user.id;
assert.match(actor, /^[\da-f-]{36}$/);
const legacyId = '64e4cd23-5019-447c-8614-b11fb8e755b2';
const rpc = async (name, input) => {
  const { data, error } = await client.rpc(name, input);
  assert.equal(error, null, name + ': ' + (error?.message ?? ''));
  return data;
};
const sql = query => execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-X', '-w', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', query], { encoding: 'utf8' }).trim();
assert.equal(sql("select exists (select 1 from supabase_migrations.schema_migrations where version='20261116101237')"), 't');
assert.equal(sql("select is_synthetic from private.sales_issuers where brand='BAAN_KUNAPAP'"), 't');
const legacy = await rpc('sales_case_detail', { p_case_id: legacyId });
assert.equal(legacy.status, 'contracted');
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const denied = await client.rpc('sales_issue_design_invoice', {
  p_case_id: legacyId, p_position: 1, p_version: legacy.version, p_due_date: today, p_request_id: randomUUID(),
});
assert.equal(denied.error?.message, 'design_payment_unavailable');

const journalFile = '/private/tmp/taraville-separate-design-20261116.json';
let journal;
try { journal = JSON.parse(readFileSync(journalFile, 'utf8')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  journal = { lead: randomUUID(), create: randomUUID(), proof: randomUUID(), steps: {} };
}
for (const value of [journal.lead, journal.create, journal.proof]) assert.match(value, /^[\da-f-]{36}$/);
const persist = () => writeFileSync(journalFile, JSON.stringify(journal, null, 2), { mode: 0o600 });
persist();
const step = async (key, name, input) => {
  const saved = journal.steps[key] ??= { name, input: { ...input, p_request_id: randomUUID() } };
  assert.equal(saved.name, name);
  persist();
  if (!saved.result) {
    saved.result = await rpc(name, saved.input);
    persist();
  }
  return saved.result;
};
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
  values('${journal.lead}','BAAN_KUNAPAP','ณิชา','อยู่สบาย (ทดสอบแยกค่าแบบ)','0000000000','${actor}','${actor}','${journal.create}',repeat('0',64),'synthetic') on conflict(id) do nothing`);
assert.equal(sql(`select privacy_mode from public.leads where id='${journal.lead}'`), 'synthetic');
const project = await step('project', 'walkin_open_project', { p_lead_id: journal.lead, p_expected_version: 1 });
const job = await step('case', 'sales_create_case', { p_lead_id: journal.lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null });
const id = { p_case_id: job.id };
const details = () => rpc('sales_case_detail', id);
const version = async () => (await details()).version;
const agreement = () => rpc('sales_agreement_detail', id);
const finance = () => rpc('sales_financial_detail', id);
await step('design', 'sales_save_design_plan', { ...id, p_version: await version(), p_input: { tier: 'under150', usable_area: '120' } });
const issue = async (key, p_position) => step(key, 'sales_issue_design_invoice', { ...id, p_position, p_version: await version(), p_due_date: today });
const collect = async (key, bill) => {
  const prepared = await step(key + '-prepare', 'sales_prepare_design_payment', { p_invoice_id: bill.invoice_id, p_version: await version(),
    p_input: { method: 'cash', paid_date: today, payer_name: 'ณิชา อยู่สบาย (ทดสอบ)', description: 'ค่าออกแบบ (ข้อมูลสมมติ)' } });
  return step(key + '-confirm', 'sales_confirm_payment', { p_payment_request_id: prepared.payment_request_id, p_version: await version(), p_funds_confirmed: true });
};
await collect('pre-sign', await issue('first-bill', 1));
const quote = await step('quote', 'sales_issue_quotation', { ...id, p_version: await version(), p_input: {
  house: { model: 'บ้านชั้นเดียว 120 ตร.ม.', stories: '1', bedrooms: '3', kitchens: '1', bathrooms: '2', usable_area: '120' },
  total_cents: '200000000', spec_rows: [{ item: 'รับสร้างบ้านชั้นเดียว', detail: 'โครงการสมมติสำหรับทดสอบ', note: '' }], exclusions: [],
} });
assert.equal((await agreement()).documents.find(doc => doc.id === quote.document_id).payload.design_fee_separate, true);
const proofPath = `${job.id}/agreement/${journal.proof}.png`;
if (!journal.proofReady) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
  const proof = await client.storage.from('sales-evidence').upload(proofPath, png, { contentType: 'image/png', upsert: false });
  if (proof.error) {
    const found = await client.storage.from('sales-evidence').download(proofPath);
    assert.equal(found.error, null);
    assert.deepEqual(Buffer.from(await found.data.arrayBuffer()), png);
  }
  journal.proofReady = true;
  persist();
}
await step('accept', 'sales_accept_quotation', { p_document_id: quote.document_id, p_version: await version(), p_evidence_path: proofPath });
const customer = { full_name: 'ณิชา อยู่สบาย (ทดสอบแยกค่าแบบ)', phone: '0000000000', site_address: 'สถานที่ก่อสร้างสมมติ' };
const draft = await step('draft', 'sales_save_contract_draft', { ...id, p_version: await version(), p_quotation_id: quote.document_id,
  p_document_id: null, p_document_version: null, p_input: { customer, start_date: today, schedule: [
    { label: 'มัดจำวันลงนาม', basis_points: 1000, progress_percent: null, work_description: '' },
    ...[20, 40, 60, 80, 100].map(percent => ({ label: `งวดงาน ${percent}%`, basis_points: 1800, progress_percent: percent, work_description: 'งานก่อสร้างสมมติ' })),
  ] } });
const signedDoc = { p_document_id: draft.document_id };
const savedDraft = (await agreement()).documents.find(doc => doc.id === draft.document_id);
assert.equal(savedDraft.payload.credit_cents, '0');
assert.equal(savedDraft.payload.design_fee_separate, true);
await step('lock', 'sales_lock_contract', { ...signedDoc, p_version: await version(), p_document_version: savedDraft.version });
await step('sign', 'sales_sign_contract', { ...signedDoc, p_version: await version(), p_evidence_path: proofPath });
const schedule = (await agreement()).instalments.filter(row => row.is_active);
assert.equal(schedule.length, 6);
assert.equal(schedule.reduce((sum, row) => sum + BigInt(row.net_cents), 0n), 200000000n);
assert.ok(schedule.every(row => row.credit_cents === '0'));
const cancelledBill = await issue('cancelled-bill', 2);
await step('cancel', 'sales_cancel_design_invoice', { p_invoice_id: cancelledBill.invoice_id, p_version: await version(), p_reason: 'ทดสอบยกเลิกบิลที่ยังไม่รับเงิน' });
const second = await issue('second-bill', 2);
const receipt = await collect('post-sign', second);
const state = await finance();
assert.equal(state.design_plan.total_cents, '1200000');
assert.equal(state.pending.length, 0);
assert.equal(state.payments.reduce((sum, payment) => sum + BigInt(payment.amount_cents), 0n), 700000n);
assert.ok(state.payments.every(payment => payment.kind === 'design_fee'));
assert.equal(state.design_bills.find(bill => bill.id === second.invoice_id).receipt_document_id, receipt.document_id);
assert.equal(state.design_bills.filter(bill => bill.position === 3).length, 0);
assert.deepEqual((await agreement()).instalments.filter(row => row.is_active), schedule);
assert.equal((await details()).status, 'contracted');
assert.equal((await rpc('sales_case_detail', { p_case_id: legacyId })).version, legacy.version);
const code = (await details()).code;
console.log(JSON.stringify({ code, id: job.id, construction_cents: '200000000', design_cents: '1200000',
  design_received_cents: '700000', design_outstanding_cents: '500000', receipt: receipt.document_id }));
