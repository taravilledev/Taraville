import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
assert.equal(new URL(local.NEXT_PUBLIC_SUPABASE_URL).port, '54321');
const client = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
const headers = { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
async function rpc(name, input, expected = 200) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(input) });
  const body = await response.json();
  assert.equal(response.status, expected, name + ': ' + JSON.stringify(body));
  return body;
}
const caseId = '5562d7f4-ae21-48bc-839e-47930f45899a';
const original = await rpc('sales_case_detail', { p_case_id: caseId });
assert.match(original.customer_snapshot.full_name, /^Synthetic/);
const finance = await rpc('sales_financial_detail', { p_case_id: caseId });
const args = { p_case_id: caseId, p_version: original.version, p_input: { tier: 'under150' } };
for (const area of [undefined, null, '', '0', '0.000', '-1', 'x', '1.0001', 175, {}, '1000000000']) {
  const p_input = { tier: 'under150', ...(area === undefined ? {} : { usable_area: area }) };
  const error = await rpc('sales_save_design_plan', { ...args, p_input, p_request_id: randomUUID() }, 400);
  assert.equal(error.message, 'invalid_area', 'Direct API rejects missing or invalid actual area');
}
// A stale version proves valid area reaches existing concurrency validation without saving.
const stale = await rpc('sales_save_design_plan', { ...args, p_version: original.version + 1,
  p_input: { tier: 'under150', usable_area: '175.5' }, p_request_id: randomUUID() }, 409);
assert.equal(stale.message, 'stale_case');
assert.deepEqual(await rpc('sales_case_detail', { p_case_id: caseId }), original);
assert.deepEqual(await rpc('sales_financial_detail', { p_case_id: caseId }), finance);
const migration = readFileSync(new URL('../supabase/migrations/20261109000100_require_design_usable_area.sql', import.meta.url), 'utf8');
const source = execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
  "select prosrc from pg_proc where oid='private.sales_save_design_plan(uuid,bigint,jsonb,uuid)'::regprocedure"], { encoding: 'utf8' });
assert.equal(source.trim(), migration.split('as $$')[1].split('end $$;')[0].trim() + '\nend');
console.log('PASS: local source readback, HTTP 11 invalid areas rejected, valid area reaches stale-version guard, case/finance unchanged');
