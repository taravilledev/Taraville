import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
const url = new URL(local.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '54321', 'Local Docker only');
const auth = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await auth.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
const headers = { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
async function rpc(name, input, expected = 200, anonymous = false) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: anonymous ? { apikey: headers.apikey, 'Content-Type': 'application/json' } : headers, body: JSON.stringify(input) });
  const body = await response.json();
  assert.equal(response.status, expected, name + ': ' + JSON.stringify(body));
  return body;
}
let job;
if (process.env.CONTRACT_TEST_CASE_ID) {
  assert.match(process.env.CONTRACT_TEST_CASE_ID, /^[0-9a-f-]{36}$/);
  job = await rpc('sales_case_detail', { p_case_id: process.env.CONTRACT_TEST_CASE_ID });
  assert.equal(job.customer_snapshot.full_name, 'Synthetic Contract Paper', 'Resume only the synthetic fixture');
  assert.equal(job.brand, 'BAAN_KUNAPAP');
} else {
const lead = randomUUID(); const actor = login.data.user.id;
execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c',
  "insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode) values('" + lead + "','BAAN_KUNAPAP','Synthetic Contract','Paper','0000000000','" + actor + "','" + actor + "','" + randomUUID() + "',repeat('0',64),'synthetic')"],
{ stdio: ['ignore', 'pipe', 'pipe'] });
const project = await rpc('walkin_open_project', { p_lead_id: lead, p_expected_version: 1, p_request_id: randomUUID() });
job = await rpc('sales_create_case', { p_lead_id: lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() });
}
const detail = () => rpc('sales_case_detail', { p_case_id: job.id });
const document = id => rpc('sales_document_detail', { p_document_id: id });
const originalCase = await detail();
const template = await rpc('sales_contract_template', { p_case_id: job.id });
assert.equal(typeof template.contract_text, 'string');
await rpc('sales_contract_template', { p_case_id: job.id }, 401, true);
const paper = { schema_version: 1, customer_name: 'Synthetic quote signer', customer_phone: '0000000001', customer_address: 'Synthetic quotation address',
  site_address: 'Synthetic quotation construction site', salesperson: 'Synthetic proposer', manager: '', work_type: 'รับสร้างบ้าน', document_date: '2026-11-09', footnote: '' };
const quoteInput = { house: { model: 'Synthetic paper house', stories: '1', bedrooms: '2', kitchens: '1', bathrooms: '1', usable_area: '53' },
  total_cents: '96000000', spec_rows: [{ item: 'Synthetic item', detail: 'Synthetic scope', note: '' }], exclusions: ['Synthetic condition'], paper };
let current = await detail();
const existing = await rpc('sales_agreement_detail', { p_case_id: job.id });
let quote = existing.documents.find(doc => doc.kind === 'quotation');
if (quote) { assert.equal(quote.state, 'accepted'); quote = { document_id: quote.id }; }
else {
  quote = await rpc('sales_issue_quotation', { p_case_id: job.id, p_version: originalCase.version, p_input: quoteInput, p_request_id: randomUUID() });
  const proof = job.id + '/agreement/' + randomUUID() + '.png';
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=', 'base64');
  const upload = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/sales-evidence/' + proof, { method: 'POST', headers: { ...headers, 'Content-Type': 'image/png' }, body: image });
  assert.equal(upload.status, 200, await upload.text());
  current = await rpc('sales_accept_quotation', { p_document_id: quote.document_id, p_version: quote.version, p_evidence_path: proof, p_request_id: randomUUID() });
}
const quoteSnapshot = await document(quote.document_id);
const schedule = [1000, 2000, 2500, 2500, 2000].map((basis_points, index) => ({ basis_points, label: 'Synthetic instalment ' + index, progress_percent: index === 0 ? null : index * 25, work_description: 'Synthetic work ' + index }));
const base = { start_date: '2026-11-09', schedule };
const previousDraft = existing.documents.find(doc => doc.kind === 'contract' && doc.state === 'draft');
const args = { p_case_id: job.id, p_version: current.version, p_quotation_id: quote.document_id, p_input: { ...base, additional_terms: '  Synthetic additional clause\n\t' }, p_document_id: previousDraft?.id ?? null, p_document_version: previousDraft?.version ?? null, p_request_id: randomUUID() };
let draft = await rpc('sales_save_contract_draft', args);
assert.deepEqual(await rpc('sales_save_contract_draft', args), draft, 'Draft replay');
let saved = await document(draft.document_id);
assert.deepEqual(saved.payload.customer, { full_name: paper.customer_name, phone: paper.customer_phone, site_address: paper.site_address }, 'Selected quote paper seeds contract identity');
assert.equal(saved.customer_snapshot.address, paper.customer_address);
assert.equal(saved.payload.additional_terms, 'Synthetic additional clause');
assert.equal(saved.payload.total_cents, quoteInput.total_cents);
assert.deepEqual(saved.payload.house, quoteInput.house);
assert.deepEqual(saved.payload.spec_rows, quoteInput.spec_rows);
const standardText = saved.payload.contract_text;
assert.equal(typeof standardText, 'string');
assert.equal(standardText, template.contract_text, 'New draft standard text uses scoped template');
async function save(input, expected = 200) {
  const latest = await detail(); const doc = (await rpc('sales_agreement_detail', { p_case_id: job.id })).documents.find(item => item.id === draft.document_id);
  return rpc('sales_save_contract_draft', { ...args, p_version: latest.version, p_document_id: doc.id, p_document_version: doc.version, p_input: input, p_request_id: randomUUID() }, expected);
}
for (const invalid of [{ additional_terms: null }, { additional_terms: 2 }, { additional_terms: {} }, { additional_terms: 'x'.repeat(10001) }, { extra: 'unknown' }, { contract_text: 'Cannot replace standard text' }, { total_cents: '1' }, { customer: null }]) {
  const before = await document(draft.document_id);
  const version = (await detail()).version;
  await save({ ...base, ...invalid }, 400);
  assert.deepEqual(await document(draft.document_id), before, 'Invalid input has no document side effects');
  assert.equal((await detail()).version, version);
}
await save({ ...base, customer: { full_name: 'Synthetic explicit signer', phone: '0000000002', site_address: 'Synthetic explicit site' } });
saved = await document(draft.document_id);
assert.equal(saved.payload.additional_terms, 'Synthetic additional clause', 'Omitted terms preserve existing draft');
assert.equal(saved.payload.customer.full_name, 'Synthetic explicit signer', 'Explicit edits take priority');
await save(base);
saved = await document(draft.document_id);
assert.equal(saved.payload.customer.full_name, 'Synthetic explicit signer', 'Omitted customer preserves existing draft');
assert.equal(saved.payload.contract_text, standardText, 'Standard text is not edited by additional terms');
assert.deepEqual((await detail()).customer_snapshot, originalCase.customer_snapshot, 'Case customer remains unchanged');
assert.deepEqual(await document(quote.document_id), quoteSnapshot, 'Accepted quote remains unchanged');
await save({ ...base, additional_terms: '' });
assert.equal((await document(draft.document_id)).payload.additional_terms, '', 'Explicit empty terms clears draft only');
await save({ ...base, additional_terms: 'Synthetic final additional clause' });
saved = await document(draft.document_id); current = await detail();
await rpc('sales_save_contract_draft', { ...args, p_version: current.version, p_document_id: saved.id, p_document_version: (await rpc('sales_agreement_detail', { p_case_id: job.id })).documents.find(item => item.id === saved.id).version, p_input: base, p_request_id: randomUUID() }, 401, true);
console.log(JSON.stringify({ result: 'PASS: contract paper quote defaults, explicit edits, additional terms, validation/replay, immutable quote/case/price/standard text', case_id: job.id, quotation_id: quote.document_id, draft_id: saved.id }, null, 2));
