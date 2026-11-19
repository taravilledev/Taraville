import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  "insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode) values('" + lead + "','BAAN_KUNAPAP','Synthetic Photo','Quotation','0000000000','" + actor + "','" + actor + "','" + randomUUID() + "',repeat('0',64),'synthetic')"],
{ stdio: ['ignore', 'pipe', 'pipe'] });
const project = await rpc('walkin_open_project', { p_lead_id: lead, p_expected_version: 1, p_request_id: randomUUID() });
const job = await rpc('sales_create_case', { p_lead_id: lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() });
const detail = () => rpc('sales_case_detail', { p_case_id: job.id });
const document = id => rpc('sales_document_detail', { p_document_id: id });
const input = JSON.parse(readFileSync(new URL('./fixtures/quotation-photo-sample.json', import.meta.url), 'utf8'));
const original = await detail();
const issued = await rpc('sales_issue_quotation', { p_case_id: job.id, p_version: original.version, p_input: input, p_request_id: randomUUID() });
const saved = await document(issued.document_id);
assert.equal(saved.payload.is_synthetic, true);
assert.equal(saved.payload.total_cents, input.total_cents);
assert.equal(saved.payload.house.usable_area, input.house.usable_area);
assert.deepEqual(saved.payload.paper, input.paper);
assert.deepEqual(saved.payload.spec_rows, input.spec_rows);
assert.deepEqual(saved.payload.exclusions, input.exclusions);
assert.deepEqual((await detail()).customer_snapshot, original.customer_snapshot);
console.log(JSON.stringify({ result: 'PASS: local synthetic photo quotation roundtrip', case_id: job.id, document_id: issued.document_id,
  editor: 'http://localhost:3000/sales/' + job.id + '?task=issue-quotation', document: 'http://localhost:3000/sales/documents/' + issued.document_id }, null, 2));
