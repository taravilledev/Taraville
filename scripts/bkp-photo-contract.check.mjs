import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { localEnvironment } from './dev-local.mjs';

assert.equal(process.env.CONFIRM_LOCAL_PHOTO_CONTRACT_TEST, '1', 'Run only after approval to save a synthetic draft and addendum');
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const env = localEnvironment(status);
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).port, '54321');
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
async function rpc(name, input, expected = 200, anonymous = false) {
  const response = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: anonymous ? { apikey: key, 'Content-Type': 'application/json' } : headers, body: JSON.stringify(input),
  });
  const body = await response.json();
  assert.equal(response.status, expected, name + ': ' + body.message);
  return body;
}
const draftCase = 'c2b7d6fe-44a3-414f-9556-39cd778e192e';
const signedCase = '7759899b-6171-4f26-b4ea-6b0409906833';
const agreement = id => rpc('sales_agreement_detail', { p_case_id: id });
const finance = id => rpc('sales_financial_detail', { p_case_id: id });
const sale = id => rpc('sales_case_detail', { p_case_id: id });
const document = id => rpc('sales_document_detail', { p_document_id: id });
const template = await rpc('sales_contract_template', { p_case_id: draftCase });
assert.equal(template.is_synthetic, true);
assert.equal(typeof template.contract_text_approved, 'boolean');
await rpc('sales_contract_template', { p_case_id: draftCase }, 401, true);
const draft = (await agreement(draftCase)).documents.find(doc => doc.kind === 'contract' && doc.state === 'draft');
const signedBefore = await agreement(signedCase);
const signed = signedBefore.documents.find(doc => doc.kind === 'contract' && doc.state === 'signed');
assert.ok(draft?.payload.is_synthetic && signed?.payload.is_synthetic);
assert.ok(!draft.payload.contract_paper, 'This one-time check only converts the agreed legacy synthetic draft');
assert.ok(!signedBefore.documents.some(doc => doc.payload.text_addendum?.conditions === 'ใช้เฉพาะทดสอบระบบ'));
const before = await document(signed.id);
const moneyBefore = await finance(signedCase);
const paper = { schema_version: 1, signing_place: 'สำนักงานโครงการ (ทดสอบ)', signing_date: '2026-11-09',
  employer_address: 'ที่อยู่สมมติของผู้ว่าจ้าง', employer_national_id: '', contractor_name: template.contractor_name,
  contractor_address: template.contractor_address, contractor_representative: '', contractor_national_id: '',
  witness_1: '', witness_2: '', duration_days: '120', extra_clauses: ['ข้อความตัวอย่างสำหรับตรวจรูปแบบ'],
  conditions: 'ตรวจวัสดุตามรายการก่อนส่งมอบ (ทดสอบ)', notes: 'เว้นวันที่จ่ายในเอกสารไว้เขียนมือ' };
const caseBefore = await sale(draftCase);
const args = { p_case_id: draftCase, p_version: caseBefore.version, p_quotation_id: draft.parent_id,
  p_document_id: draft.id, p_document_version: draft.version, p_request_id: randomUUID() };
const input = { customer: draft.payload.customer, start_date: '2026-11-09', schedule: draft.payload.schedule_input, contract_paper: paper };
assert.equal((await rpc('sales_save_contract_draft', { ...args, p_input: { ...input, contract_paper: { ...paper, employer_national_id: '12' } } }, 400)).message, 'invalid_contract_paper');
const result = await rpc('sales_save_contract_draft', { ...args, p_input: input });
assert.deepEqual((await document(draft.id)).payload.contract_paper, paper);
assert.equal((await rpc('sales_lock_contract', { p_document_id: draft.id, p_version: result.version,
  p_document_version: result.document_version, p_request_id: randomUUID() }, 400)).message, 'complete_contract_paper_required');
const addendum = { date: '2026-11-09', extra_clauses: ['ตัวอย่างตรวจรับเอกสารส่งมอบ'], conditions: 'ใช้เฉพาะทดสอบระบบ', notes: 'ไม่เปลี่ยนยอดเงินหรือค่างวด' };
const addArgs = { p_document_id: signed.id, p_version: (await sale(signedCase)).version, p_input: addendum, p_request_id: randomUUID() };
assert.equal((await rpc('sales_add_contract_addendum', { ...addArgs, p_evidence_path: '' }, 400)).message, 'evidence_required');
const proofPath = signedCase + '/agreement/' + randomUUID() + '.png';
const proof = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><rect width="800" height="200" fill="white"/><text x="30" y="80" font-size="28">SYNTHETIC ADDENDUM EVIDENCE</text><text x="30" y="130" font-size="22">Local test only - no real signature</text></svg>')).png().toBuffer();
const upload = await client.storage.from('sales-evidence').upload(proofPath, proof, { contentType: 'image/png' });
assert.equal(upload.error, null);
const sent = { ...addArgs, p_evidence_path: proofPath };
const added = await rpc('sales_add_contract_addendum', sent);
assert.deepEqual(await rpc('sales_add_contract_addendum', sent), added);
const saved = await document(added.document_id);
assert.equal(saved.state, 'signed'); assert.equal(saved.kind, 'amendment'); assert.ok(saved.number);
assert.equal(saved.payload.is_synthetic, true); assert.equal(saved.payload.contract_number, signed.number);
assert.deepEqual(saved.payload.text_addendum, addendum);
const after = await agreement(signedCase);
assert.equal(after.documents.find(doc => doc.id === added.document_id).parent_id, signed.id);
assert.deepEqual(after.instalments, signedBefore.instalments);
assert.equal(after.is_settled, signedBefore.is_settled);
assert.deepEqual(await document(signed.id), before);
const omitSummary = ({ version, documents, ...money }) => { void version; void documents; return money; };
assert.deepEqual(omitSummary(await finance(signedCase)), omitSummary(moneyBefore));
console.log(JSON.stringify({ result: 'PASS: photo draft, lock guard, signed linked addendum, immutable contract/finance', draft: draft.id, addendum: saved.id, number: saved.number }));
