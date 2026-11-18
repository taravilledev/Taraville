import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
const url = new URL(local.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '54321', 'Only local Docker Supabase is allowed');
const auth = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await auth.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
assert.match(login.data.user.id, /^[0-9a-f-]{36}$/);
const headers = { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
async function rpc(name, input, expected = 200) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(input) });
  const body = await response.json();
  assert.equal(response.status, expected, name + ': ' + JSON.stringify(body));
  return body;
}
const lead = randomUUID();
const actor = login.data.user.id;
execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c',
  "insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode) values('" + lead + "','BAAN_KUNAPAP','Synthetic Paper','Quotation','0000000000','" + actor + "','" + actor + "','" + randomUUID() + "',repeat('0',64),'synthetic')"],
{ stdio: ['ignore', 'pipe', 'pipe'] });
const project = await rpc('walkin_open_project', { p_lead_id: lead, p_expected_version: 1, p_request_id: randomUUID() });
const job = await rpc('sales_create_case', { p_lead_id: lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() });
const detail = () => rpc('sales_case_detail', { p_case_id: job.id });
const document = id => rpc('sales_document_detail', { p_document_id: id });
const house = { model: 'Synthetic paper house', stories: '1', bedrooms: '2', kitchens: '1', bathrooms: '1', usable_area: '85.5' };
const base = { house, total_cents: '123456789', spec_rows: [{ item: 'Synthetic structure', detail: 'Synthetic specification only', note: '' }], exclusions: ['Synthetic exclusion only'] };
const paper = { schema_version: 1, customer_name: 'Synthetic quotation customer', customer_phone: '0000000000', customer_address: 'Synthetic customer address',
  site_address: 'Synthetic distinct construction site', salesperson: 'Synthetic salesperson', manager: '', work_type: 'รับสร้างบ้าน', document_date: '2026-11-01', footnote: 'Synthetic additional-work note only' };
const original = await detail();
const args = { p_case_id: job.id, p_version: original.version, p_input: { ...base, paper: { ...paper, customer_name: '  ' + paper.customer_name + '  ', footnote: '\n' + paper.footnote + '\t' } }, p_request_id: randomUUID() };
const issued = await rpc('sales_issue_quotation', args);
assert.deepEqual(await rpc('sales_issue_quotation', args), issued, 'Exact replay returns the same document');
const saved = await document(issued.document_id);
assert.deepEqual(saved.payload.paper, paper, 'All header fields round-trip, with whitespace trimmed');
assert.equal(saved.document_date, paper.document_date, 'Custom date belongs to this quotation only');
assert.deepEqual(saved.customer_snapshot, original.customer_snapshot, 'Paper customer edits do not overwrite the case customer snapshot');
assert.deepEqual((await detail()).customer_snapshot, original.customer_snapshot);

const invalidPapers = [null, [], { ...paper, extra: 'unexpected' }, { ...paper, schema_version: '1' }, { ...paper, schema_version: 2 },
  { ...paper, customer_name: '' }, { ...paper, customer_name: 'x'.repeat(201) }, { ...paper, customer_phone: 'x'.repeat(81) },
  { ...paper, customer_address: 'x'.repeat(2001) }, { ...paper, site_address: 'x'.repeat(2001) }, { ...paper, salesperson: 'x'.repeat(201) },
  { ...paper, manager: 'x'.repeat(201) }, { ...paper, footnote: 'x'.repeat(3001) }, { ...paper, work_type: 'unknown' },
  { ...paper, document_date: '2026-02-30' }, { ...paper, document_date: '2026-2-1' }, { ...paper, customer_phone: 123 },
  Object.fromEntries(Object.entries(paper).filter(([key]) => key !== 'site_address'))];
const current = await detail();
const before = (await rpc('sales_agreement_detail', { p_case_id: job.id })).documents.length;
for (const invalidPaper of invalidPapers) {
  const rejected = await rpc('sales_issue_quotation', { p_case_id: job.id, p_version: current.version, p_input: { ...base, paper: invalidPaper }, p_request_id: randomUUID() }, 400);
  assert.equal(rejected.message, 'invalid_quotation_paper');
}
assert.equal((await detail()).version, current.version, 'Invalid input cannot touch the case');
assert.equal((await rpc('sales_agreement_detail', { p_case_id: job.id })).documents.length, before, 'Invalid input cannot issue documents');
const legacy = await rpc('sales_issue_quotation', { p_case_id: job.id, p_version: current.version, p_input: base, p_request_id: randomUUID() });
assert.equal((await document(legacy.document_id)).payload.paper, undefined, 'Older no-paper clients remain compatible');
const next = await detail();
await rpc('sales_issue_quotation', { p_case_id: job.id, p_version: next.version, p_input: { ...base, paper: { ...paper, customer_name: 'Synthetic revised customer', document_date: '2026-11-02' } }, p_request_id: randomUUID() });
assert.deepEqual((await document(issued.document_id)).payload.paper, paper, 'New revisions do not rewrite old paper snapshots');
assert.equal((await document(issued.document_id)).document_date, '2026-11-01');
console.log('PASS: paper snapshot, trimmed fields/date, replay, strict boundary rejection, no-paper compatibility and immutable prior revision. Case ' + job.id);
