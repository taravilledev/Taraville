import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

assert.equal(process.env.CONFIRM_LOCAL_WORK_PAYMENT_DUE_TEST, '1', 'Explicit approval required for one synthetic local Lead/case and test evidence');
assert.ok(process.env.LOCAL_TEST_PASSWORD, 'Provide the existing local synthetic admin password through LOCAL_TEST_PASSWORD');
const status = JSON.parse(execFileSync('/opt/homebrew/bin/supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
const endpoint = new URL(local.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(endpoint.origin), 'Pinned Docker local host and port only');
assert.equal(endpoint.pathname, '/');
const client = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: process.env.LOCAL_TEST_PASSWORD });
assert.equal(login.error, null);
const actor = login.data.user.id;
const headers = { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
const sql = query => execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.equal(sql("select exists(select 1 from information_schema.columns where table_schema='private' and table_name='sales_instalments' and column_name='acceptance_date')"), 't', 'Apply the approved migration to Docker local first');
const journalPath = '/private/tmp/taraville-bkp-work-payment-due-test.json';
const journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : { lead: randomUUID(), leadRequest: randomUUID(), steps: {}, proofs: {} };
const persist = () => writeFileSync(journalPath, JSON.stringify(journal, null, 2));
assert.match(journal.lead, /^[0-9a-f-]{36}$/);
assert.match(journal.leadRequest, /^[0-9a-f-]{36}$/);
persist();
async function rpc(name, input, expected = 200, anonymous = false) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: anonymous ? { apikey: headers.apikey, 'Content-Type': 'application/json' } : headers, body: JSON.stringify(input),
  });
  const body = await response.json();
  if (anonymous) assert.ok([401, 403].includes(response.status), name + ': anonymous request unexpectedly allowed');
  else assert.equal(response.status, expected, name + ': ' + JSON.stringify(body));
  return body;
}
async function step(key, name, input) {
  const saved = journal.steps[key] ??= { name, input: { ...input, p_request_id: randomUUID() } };
  assert.equal(saved.name, name); persist();
  if (!saved.result) { saved.result = await rpc(name, saved.input); persist(); console.log('Completed ' + key); }
  return saved.result;
}
// UUIDs come only from the guarded journal and authenticated local login.
assert.match(actor, /^[0-9a-f-]{36}$/);
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${journal.lead}','BAAN_KUNAPAP','ณัฐธิดา','วงศ์ดี (ทดสอบ30วัน)','0000000000','${actor}','${actor}','${journal.leadRequest}',repeat('0',64),'synthetic') on conflict(id) do nothing`);
assert.equal(sql(`select privacy_mode from public.leads where id='${journal.lead}'`), 'synthetic');
const project = await step('open-project', 'walkin_open_project', { p_lead_id: journal.lead, p_expected_version: 1 });
const job = await step('open-case', 'sales_create_case', { p_lead_id: journal.lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null });
const id = job.id;
assert.notEqual(id, '64e4cd23-5019-447c-8614-b11fb8e755b2', 'Never use the owner current test case');
const sale = () => rpc('sales_case_detail', { p_case_id: id });
const agreement = () => rpc('sales_agreement_detail', { p_case_id: id });
const version = async () => (await sale()).version;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (day, count) => { const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); };
const acceptedOn = journal.acceptedOn ??= addDays(today, -2); persist();
const house = { model: 'บ้านทดสอบชั้นเดียว', stories: '1', bedrooms: '3', kitchens: '1', bathrooms: '2', usable_area: '120' };
await step('design-plan', 'sales_save_design_plan', { p_case_id: id, p_version: await version(), p_input: { tier: 'under150', usable_area: '120', note: 'Synthetic date-rule test; no real transaction' } });
const quotation = await step('quotation', 'sales_issue_quotation', { p_case_id: id, p_version: await version(), p_input: {
  house, total_cents: '230000000', spec_rows: [{ item: 'งานก่อสร้างบ้านจำลอง', detail: 'ใช้ตรวจระบบเท่านั้น', note: '' }], exclusions: [],
  paper: { schema_version: 1, customer_name: 'ณัฐธิดา วงศ์ดี (ทดสอบ30วัน)', customer_phone: '0000000000', customer_address: 'ที่อยู่สมมติสำหรับทดสอบ',
    site_address: 'สถานที่ก่อสร้างสมมติ', salesperson: 'ผู้ดูแลระบบทดสอบ', manager: '', work_type: 'รับสร้างบ้าน', document_date: today, footnote: 'ข้อมูลทดสอบ ไม่ใช่ธุรกรรมจริง' },
} });
const stream = 'BT /F1 12 Tf 30 120 Td (SYNTHETIC LOCAL TEST ONLY - NOT A REAL SIGNATURE) Tj ET';
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf = '%PDF-1.4\n'; const offsets = [0];
for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
async function proof(category) {
  const saved = journal.proofs[category] ??= { path: `${id}/${category}/${randomUUID()}.pdf` }; persist();
  if (!saved.ready) {
    const existing = await client.storage.from('sales-evidence').download(saved.path);
    if (!existing.error) assert.ok(Buffer.from(await existing.data.arrayBuffer()).equals(Buffer.from(pdf)), 'Existing synthetic proof differs');
    else {
      const upload = await client.storage.from('sales-evidence').upload(saved.path, Buffer.from(pdf), { contentType: 'application/pdf', upsert: false });
      assert.equal(upload.error, null);
    }
    saved.ready = true; persist();
  }
  return saved.path;
}
const agreementProof = await proof('agreement');
await step('accept-quotation', 'sales_accept_quotation', { p_document_id: quotation.document_id, p_version: await version(), p_evidence_path: agreementProof });
const template = await rpc('sales_contract_template', { p_case_id: id });
assert.ok(template.contract_text?.trim(), 'Existing company template must be nonempty; script never changes issuer settings');
const paper = { schema_version: 1, signing_place: 'สำนักงานสมมติ', signing_date: addDays(today, -35), employer_address: 'ที่อยู่สมมติ', employer_national_id: '',
  contractor_name: 'บริษัททดสอบระบบ (ข้อมูลสมมติ)', contractor_address: 'สำนักงานทดสอบสมมติ', contractor_representative: 'ผู้แทนสมมติ', contractor_national_id: '',
  witness_1: '', witness_2: '', duration_days: '365', extra_clauses: [], conditions: 'ใช้ทดสอบระบบ ไม่ใช่สัญญาจริง', notes: '' };
const input = { customer: { full_name: 'ณัฐธิดา วงศ์ดี (ทดสอบ30วัน)', phone: '0000000000', site_address: 'สถานที่ก่อสร้างสมมติ' }, start_date: addDays(today, -30),
  contract_paper: paper, schedule: [{ label: 'มัดจำ', basis_points: 1000, progress_percent: null, work_description: 'วันลงนาม' },
    ...[20, 40, 60, 80, 100].map(percent => ({ label: `งวดงาน ${percent}%`, basis_points: 1800, progress_percent: percent, work_description: 'งานสมมติเพื่อทดสอบ' }))] };
const draft = await step('contract-draft', 'sales_save_contract_draft', { p_case_id: id, p_version: await version(), p_quotation_id: quotation.document_id,
  p_document_id: null, p_document_version: null, p_input: input });
let doc = (await agreement()).documents.find(item => item.id === draft.document_id);
assert.equal(doc.payload.contract_paper.payment_due_days, 30, 'Server injects rule even when direct RPC omits flag');
const locked = await step('contract-lock', 'sales_lock_contract', { p_document_id: doc.id, p_version: await version(), p_document_version: doc.version });
await step('contract-sign', 'sales_sign_contract', { p_document_id: doc.id, p_version: locked.version, p_evidence_path: agreementProof });
const work = (await agreement()).instalments.find(row => row.is_active && row.needs_acceptance);
const acceptanceProof = await proof('acceptance');
if (!journal.steps['work-acceptance']) {
  const common = { p_instalment_id: work.id, p_version: await version(), p_inspected: true, p_customer_accepted: true, p_evidence_path: acceptanceProof, p_note: 'Synthetic work accepted, no real work' };
  assert.equal((await rpc('sales_record_acceptance', { ...common, p_request_id: randomUUID() }, 400)).message, 'invalid_acceptance_date');
  assert.equal((await rpc('sales_record_acceptance_dated', { ...common, p_acceptance_date: addDays(today, 1), p_request_id: randomUUID() }, 400)).message, 'invalid_acceptance_date');
}
const accepted = await step('work-acceptance', 'sales_record_acceptance_dated', { p_instalment_id: work.id, p_version: await version(),
  p_inspected: true, p_customer_accepted: true, p_evidence_path: acceptanceProof, p_note: 'Synthetic work accepted, no real work', p_acceptance_date: acceptedOn });
assert.deepEqual(await rpc(journal.steps['work-acceptance'].name, journal.steps['work-acceptance'].input), accepted);
const acceptedRow = (await agreement()).instalments.find(row => row.id === work.id);
assert.equal(acceptedRow.acceptance_date, acceptedOn); assert.equal(acceptedRow.due_date, addDays(acceptedOn, 30));
if (!journal.steps['work-invoice']) assert.equal((await rpc('sales_issue_invoice', { p_instalment_id: work.id, p_version: await version(), p_due_date: addDays(acceptedOn, 29), p_request_id: randomUUID() }, 400)).message, 'acceptance_due_date_required');
const invoice = await step('work-invoice', 'sales_issue_invoice', { p_instalment_id: work.id, p_version: await version(), p_due_date: addDays(acceptedOn, 30) });
assert.deepEqual(await rpc(journal.steps['work-invoice'].name, journal.steps['work-invoice'].input), invoice);
const issued = await rpc('sales_document_detail', { p_document_id: invoice.document_id });
assert.equal(issued.payload.acceptance_date, acceptedOn); assert.equal(issued.payload.payment_due_days, 30); assert.equal(issued.payload.due_date, addDays(acceptedOn, 30));
await rpc('sales_record_acceptance_dated', { ...journal.steps['work-acceptance'].input, p_request_id: randomUUID() }, 401, true);
journal.result = { lead_id: journal.lead, case_id: id, code: (await sale()).code, quotation_id: quotation.document_id, contract_id: doc.id,
  instalment_id: work.id, invoice_id: invoice.invoice_id, document_id: invoice.document_id, acceptance_date: acceptedOn, due_date: acceptedRow.due_date };
persist(); console.log(JSON.stringify({ result: 'PASS: local HTTP new-contract30day rule', ...journal.result }, null, 2));
