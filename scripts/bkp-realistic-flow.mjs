import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { localEnvironment } from './dev-local.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/bkp-realistic-flow.json', import.meta.url), 'utf8'));
assert.equal(fixture.schedule.reduce((sum, row) => sum + row.basis_points, 0), 10000);
assert.equal(fixture.brief.usable_area, '120');
assert.match(fixture.customer.full_name, /ทดสอบ/);
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const local = localEnvironment(status);
assert.equal(new URL(local.NEXT_PUBLIC_SUPABASE_URL).port, '54321', 'Docker local only');
const client = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: 'admin@staff.taraville.invalid', password: 'test1234' });
assert.equal(login.error, null);
const actor = login.data.user.id;
const headers = { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.data.session.access_token, 'Content-Type': 'application/json' };
const sql = query => execFileSync('docker', ['exec', 'supabase_db_Taraville_pj', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.equal(sql("select is_synthetic from private.sales_issuers where brand='BAAN_KUNAPAP'"), 't', 'Never change issuer settings; synthetic issuer required');
const today = '2026-11-09';
assert.ok(today <= sql("select (now() at time zone 'Asia/Bangkok')::date"), 'Paid date cannot be future');
const journalPath = '/private/tmp/taraville-bkp-realistic-flow-2026-11-09.json';
const journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : { lead: randomUUID(), leadRequest: randomUUID(), steps: {}, proofs: {} };
const persist = () => writeFileSync(journalPath, JSON.stringify(journal, null, 2));
persist();
async function rpc(name, input) {
  const response = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(input) });
  const body = await response.json();
  assert.equal(response.status, 200, name + ': ' + JSON.stringify(body));
  return body;
}
async function step(key, name, input) {
  const saved = journal.steps[key] ??= { name, input: { ...input, p_request_id: randomUUID() } };
  assert.equal(saved.name, name); persist();
  if (!saved.result) { saved.result = await rpc(name, saved.input); persist(); console.log('Completed ' + key); }
  return saved.result;
}
// Journaled UUID and ON CONFLICT make an interrupted run resume the same single Lead.
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${journal.lead}','BAAN_KUNAPAP','กานต์','ใจดี (ทดสอบ)','0000000000','${actor}','${actor}','${journal.leadRequest}',repeat('0',64),'synthetic') on conflict(id) do nothing`);
assert.equal(sql(`select privacy_mode from public.leads where id='${journal.lead}'`), 'synthetic');
const project = await step('open-project', 'walkin_open_project', { p_lead_id: journal.lead, p_expected_version: 1 });
const job = await step('open-case', 'sales_create_case', { p_lead_id: journal.lead, p_project_id: project.id, p_unit_id: null, p_customer_id: null });
const id = job.id;
const detail = () => rpc('sales_case_detail', { p_case_id: id });
const finance = () => rpc('sales_financial_detail', { p_case_id: id });
const agreement = () => rpc('sales_agreement_detail', { p_case_id: id });
const version = async () => (await detail()).version;
const original = await detail();
assert.match(original.customer_snapshot.full_name, /ทดสอบ/);
await step('customer-address', 'sales_save_case', { p_case_id: id, p_expected_version: original.version,
  p_input: { customer_snapshot: { ...fixture.customer, salesperson: 'พิมพ์ชนก ผู้ดูแลโครงการ (ทดสอบ)' },
    details: { ...original.details, site_address: fixture.site }, list_price_cents: null, promotion_price_cents: null, discount_cents: '0' } });
await step('house-requirements', 'sales_save_house_brief', { p_case_id: id, p_version: await version(), p_brief: fixture.brief });
await step('design-package', 'sales_save_design_plan', { p_case_id: id, p_version: await version(),
  p_input: { tier: 'under150', usable_area: '120', note: 'แพ็กเกจ 120 ตร.ม. รวม 12,000 บาท แบ่ง 3 งวด — ข้อมูลทดสอบ' } });
async function proof(key, category, title) {
  const item = journal.proofs[key] ??= { path: `${id}/${category}/${randomUUID()}.png` }; persist();
  if (item.ready) return item.path;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680"><rect width="1200" height="680" fill="#fff"/><rect x="30" y="30" width="1140" height="620" fill="#f2faf6" stroke="#00805e" stroke-width="3"/><g font-family="sans-serif" fill="#12251d"><text x="75" y="110" font-size="38">หลักฐานจำลองสำหรับทดสอบระบบเท่านั้น</text><text x="75" y="190" font-size="30">${title}</text><text x="75" y="260" font-size="30">ลูกค้า: กานต์ ใจดี (ทดสอบ)</text><text x="75" y="330" font-size="25">โครงการบ้านอยู่สบาย 120 · วันที่ ${today}</text><text x="75" y="420" font-size="28">ไม่มีการโอนเงินจริง ไม่มีการลงนามหรือก่อสร้างจริง</text><text x="75" y="530" font-size="24">SYNTHETIC LOCAL DEMO - NOT A REAL TRANSACTION</text></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const existing = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/authenticated/sales-evidence/' + item.path, { headers });
  if (existing.ok) assert.ok(Buffer.from(await existing.arrayBuffer()).equals(png), 'Existing proof must match');
  else {
    assert.ok([400, 404].includes(existing.status));
    const uploaded = await fetch(local.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/sales-evidence/' + item.path,
      { method: 'POST', headers: { ...headers, 'Content-Type': 'image/png' }, body: png });
    assert.equal(uploaded.status, 200, await uploaded.text());
  }
  item.ready = true; persist(); return item.path;
}
for (let position = 1; position <= 3; position++) {
  const invoice = await step(`design-bill-${position}`, 'sales_issue_design_invoice', { p_case_id: id, p_position: position, p_version: await version(), p_due_date: today });
  const prepared = await step(`design-payment-${position}`, 'sales_prepare_design_payment', { p_invoice_id: invoice.invoice_id, p_version: await version(),
    p_input: { method: 'transfer', paid_date: today, payer_name: fixture.customer.full_name, description: `รับค่าออกแบบงวด ${position} — จำลอง`,
      proof_path: await proof(`design-${position}`, 'payment', `ชำระค่าออกแบบงวด ${position} (จำลอง)`) } });
  await step(`design-receipt-${position}`, 'sales_confirm_payment', { p_payment_request_id: prepared.payment_request_id, p_version: await version(), p_funds_confirmed: true });
}
const house = Object.fromEntries(['model', 'stories', 'bedrooms', 'kitchens', 'bathrooms', 'usable_area'].map(key => [key, fixture.brief[key]]));
const quote = await step('quotation', 'sales_issue_quotation', { p_case_id: id, p_version: await version(), p_input: {
  house, total_cents: fixture.total_cents, spec_rows: fixture.spec_rows, exclusions: fixture.exclusions,
  description: 'รับสร้างบ้านอยู่สบาย 120 — โครงการสาธิต ไม่ใช่ธุรกรรมจริง',
  paper: { schema_version: 1, customer_name: fixture.customer.full_name, customer_phone: fixture.customer.phone, customer_address: fixture.customer.address,
    site_address: fixture.site, salesperson: 'พิมพ์ชนก ผู้ดูแลโครงการ (ทดสอบ)', manager: 'ธนา ผู้จัดการโครงการ (ทดสอบ)',
    work_type: 'รับสร้างบ้าน', document_date: today, footnote: 'ราคาตัวอย่างเพื่อทดสอบระบบเท่านั้น ไม่ใช่ข้อเสนอราคาจริง และต้องให้บริษัทตรวจขอบเขตงานก่อนใช้จริง' } } });
const agreementProof = await proof('agreement', 'agreement', 'ยอมรับใบเสนอราคาและลงนามสัญญา (จำลอง)');
await step('accept-quotation', 'sales_accept_quotation', { p_document_id: quote.document_id, p_version: quote.version, p_evidence_path: agreementProof });
const draft = await step('draft-contract', 'sales_save_contract_draft', { p_case_id: id, p_version: await version(), p_quotation_id: quote.document_id,
  p_document_id: null, p_document_version: null, p_input: { start_date: today, schedule: fixture.schedule, additional_terms: fixture.additional_terms } });
let docs = await agreement();
const contract = docs.documents.find(doc => doc.id === draft.document_id);
assert.equal(contract.payload.customer.full_name, fixture.customer.full_name);
assert.equal(contract.payload.customer.site_address, fixture.site);
assert.equal(contract.payload.credit_cents, '1200000');
const locked = await step('lock-contract', 'sales_lock_contract', { p_document_id: contract.id, p_version: await version(), p_document_version: contract.version });
await step('sign-contract', 'sales_sign_contract', { p_document_id: contract.id, p_version: locked.version, p_evidence_path: agreementProof });
docs = await agreement();
for (const row of docs.instalments.filter(row => row.is_active)) {
  if (row.needs_acceptance) await step(`accept-work-${row.position}`, 'sales_record_acceptance', { p_instalment_id: row.id, p_version: await version(),
    p_inspected: true, p_customer_accepted: true, p_evidence_path: await proof(`work-${row.position}`, 'acceptance', `${row.label} ผ่านตรวจและลูกค้ายอมรับ (จำลอง)`),
    p_note: `${row.work_description ?? row.label} — จำลองตรวจรับผ่าน ไม่มีงานก่อสร้างจริง` });
  const invoice = await step(`work-bill-${row.position}`, 'sales_issue_invoice', { p_instalment_id: row.id, p_version: await version(), p_due_date: today });
  const payment = await step(`work-payment-${row.position}`, 'sales_prepare_payment', { p_case_id: id, p_version: await version(),
    p_input: { kind: 'instalment', invoice_id: invoice.invoice_id, amount_cents: row.net_cents, method: 'transfer', paid_date: today,
      payer_name: fixture.customer.full_name, description: `${row.label} — ชำระครบ (จำลอง)`,
      proof_path: await proof(`paid-${row.position}`, 'payment', `${row.label} รับชำระครบ (จำลอง)`) } });
  await step(`work-receipt-${row.position}`, 'sales_confirm_payment', { p_payment_request_id: payment.payment_request_id, p_version: await version(), p_funds_confirmed: true });
}
const final = await agreement(); const money = await finance(); const sale = await detail();
assert.equal(final.is_settled, true);
assert.equal(final.instalments.filter(row => row.is_active).length, 6);
assert.equal(money.pending.length, 0);
assert.equal(money.payments.length, 9);
assert.equal(money.payments.reduce((sum, payment) => sum + BigInt(payment.amount_cents), 0n).toString(), fixture.total_cents);
assert.equal(money.design_bills.reduce((sum, bill) => sum + BigInt(bill.received_cents), 0n).toString(), '1200000');
assert.equal(final.instalments.reduce((sum, row) => sum + BigInt(row.credit_cents), 0n).toString(), '1200000');
for (const doc of [...final.documents, ...money.documents]) {
  const saved = await rpc('sales_document_detail', { p_document_id: doc.id });
  assert.equal(saved.payload.is_synthetic, true, 'Every issued document must be synthetic');
}
journal.result = { case_id: id, code: sale.code, lead_id: journal.lead, quotation_id: quote.document_id, contract_id: contract.id,
  received_cents: fixture.total_cents, design_credit_cents: '1200000', receipts: money.payments.length, settled: final.is_settled,
  project: `http://localhost:3000/sales/${id}?tab=overview`, documents: `http://localhost:3000/sales/${id}?tab=documents` };
persist(); console.log(JSON.stringify(journal.result, null, 2));
