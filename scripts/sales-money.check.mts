import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localEnvironment } from "./dev-local.mjs";

// Only disposable local fixtures; never use .env.local or accept a remote target.
assert.equal(process.argv.length, 2);
const status = JSON.parse(readFileSync("/private/tmp/taraville-local-status.json", "utf8"));
const local = localEnvironment(status);
const database = new URL(status.DB_URL);
assert.equal(database.hostname, "127.0.0.1"); assert.equal(database.port, "54322");
const admin = createClient(local.NEXT_PUBLIC_SUPABASE_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function sql(query: string) {
  return execFileSync("psql", ["-X", "-h", database.hostname, "-p", database.port, "-U", database.username,
    "-d", database.pathname.slice(1), "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PGPASSWORD: decodeURIComponent(database.password) },
  }).trim();
}
const users = await admin.auth.admin.listUsers({ perPage: 1000 }); assert.equal(users.error, null);
async function actor(name: string, role: string) {
  const email = `moneydev_${name}@staff.taraville.invalid`; const password = `LocalOnly-${randomUUID()}`;
  const existing = users.data.users.find(user => user.email === email);
  const result = existing ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(result.error, null); const id = result.data.user?.id; assert.ok(id);
  sql(`update public.staff set role='${role}',is_active=true where id='${id}'`);
  const session = await admin.auth.signInWithPassword({ email, password }); assert.equal(session.error, null);
  assert.ok(session.data.session); return { id, token: session.data.session.access_token, refreshToken: session.data.session.refresh_token };
}
const executive = await actor("executive", "executive"); const owner = await actor("owner", "sale");
async function rpc(name: string, user: typeof owner | null, input: Record<string, unknown> = {}) {
  const response = await fetch(`${local.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST",
    headers: { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}) }, body: JSON.stringify(input) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
function ok(result: Awaited<ReturnType<typeof rpc>>) {
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
}
async function grant(action: string, enabled: boolean) {
  ok(await rpc("sales_set_capability", executive, { p_staff_id: owner.id, p_action: action,
    p_scope: "own", p_enabled: enabled, p_request_id: randomUUID() }));
}
await grant("financial.view", true); await grant("financial.prepare", true);
await grant("financial.confirm", true); await grant("receipt.issue", false);
const lead = randomUUID();
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${lead}','BAAN_KUNAPAP','Synthetic Money','HTTP','0000000000','${owner.id}','${owner.id}','${randomUUID()}',repeat('0',64),'synthetic')`);
const project = ok(await rpc("walkin_open_project", owner, { p_lead_id: lead, p_expected_version: 1, p_request_id: randomUUID() }));
let sale = ok(await rpc("sales_create_case", owner, { p_lead_id: lead, p_project_id: project.id,
  p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() }));
const issuerVersion = Number(sql("select coalesce((select version from private.sales_issuers where brand='BAAN_KUNAPAP'),0)"));
const issuerInput = { legal_name: "SYNTHETIC DEV ISSUER", address: "Local testing only", is_synthetic: true };
assert.equal((await rpc("sales_save_issuer", owner, { p_brand: "BAAN_KUNAPAP", p_version: issuerVersion,
  p_input: issuerInput, p_request_id: randomUUID() })).status, 403);
ok(await rpc("sales_save_issuer", executive, { p_brand: "BAAN_KUNAPAP", p_version: issuerVersion,
  p_input: issuerInput, p_request_id: randomUUID() }));
sale = ok(await rpc("sales_save_design_plan", owner, { p_case_id: sale.id, p_version: sale.version,
  p_input: { usable_area: "180", tier: "under150" }, p_request_id: randomUUID() }));
assert.equal(sql(`select total_cents from private.sales_design_plans where case_id='${sale.id}'`), "2500000", "Real area overrides the card");
const paymentInput = { kind: "design_fee", amount_cents: "350001", method: "cash", paid_date: "2026-11-03",
  payer_name: "Synthetic payer", description: "Synthetic design fee" };
const prepare = { p_case_id: sale.id, p_version: sale.version, p_input: paymentInput, p_request_id: randomUUID() };
assert.equal((await rpc("sales_prepare_payment", owner, { ...prepare, p_input: { ...paymentInput, amount_cents: 350001 } })).status, 400);
const prepared = ok(await rpc("sales_prepare_payment", owner, prepare));
assert.deepEqual(ok(await rpc("sales_prepare_payment", owner, prepare)), prepared);
const confirm = { p_payment_request_id: prepared.payment_request_id, p_version: prepared.version,
  p_funds_confirmed: true, p_request_id: randomUUID() };
assert.equal((await rpc("sales_confirm_payment", owner, confirm)).status, 403, "Both independent grants required");
assert.equal(sql(`select count(*) from private.sales_payments where case_id='${sale.id}'`), "0");
await grant("receipt.issue", true);
assert.equal((await rpc("sales_confirm_payment", owner, { ...confirm, p_funds_confirmed: false })).status, 400);
const [first, replay] = await Promise.all([rpc("sales_confirm_payment", owner, confirm), rpc("sales_confirm_payment", owner, confirm)]);
const received = ok(first); assert.deepEqual(ok(replay), received);
assert.match(String(received.number), /^BKP-R\d{2}-\d{4,}$/);
assert.equal(sql(`select count(*) from private.sales_payments where case_id='${sale.id}'`), "1");
assert.equal(sql(`select payload->>'amount_cents' from private.sales_documents where id='${received.document_id}'`), "350001");
assert.equal(sql(`select payload->>'is_synthetic' from private.sales_documents where id='${received.document_id}'`), "true");
assert.equal((await rpc("sales_confirm_payment", owner, { ...confirm, p_request_id: randomUUID() })).status, 409);
await grant("receipt.issue", false);
assert.equal((await rpc("sales_confirm_payment", owner, confirm)).status, 403, "Replay rechecks current permission");
assert.equal((await rpc("sales_save_design_plan", owner, { p_case_id: sale.id, p_version: received.version,
  p_input: { tier: "under150" }, p_request_id: randomUUID() })).status, 400, "Money freezes the plan until evidenced amendment");
assert.equal((await rpc("sales_prepare_payment", owner, { ...prepare, p_version: received.version, p_request_id: randomUUID(),
  p_input: { ...paymentInput, amount_cents: "2500000" } })).status, 400, "Cannot overcollect agreed fees");
assert.equal((await rpc("sales_prepare_payment", owner, { ...prepare, p_version: received.version, p_request_id: randomUUID(),
  p_input: { ...paymentInput, method: "transfer" } })).status, 400, "Transfer needs actual private evidence");
assert.ok([401, 403].includes((await rpc("sales_confirm_payment", null, confirm)).status));
const detail = ok(await rpc("sales_document_detail", owner, { p_document_id: received.document_id }));
assert.equal((detail.payload as Record<string, unknown>).amount_cents, "350001");
assert.equal((await rpc("sales_issuer_settings", owner)).status, 403);
let cookies: { name: string; value: string }[] = [];
const ssr = createServerClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { cookies: { getAll: () => cookies, setAll: values => { cookies = values; } } });
assert.equal((await ssr.auth.setSession({ access_token: owner.token, refresh_token: owner.refreshToken })).error, null);
const cookie = cookies.map(item => `${item.name}=${item.value}`).join("; ");
async function page(path: string) {
  const response = await fetch(`http://127.0.0.1:3100${path}`, { headers: { Cookie: cookie } });
  const html = await response.text(); assert.equal(response.status, 200); return html;
}
assert.ok((await page(`/sales/${sale.id}`)).includes("รายการรอยืนยันรับเงิน"));
assert.ok((await page(`/sales/documents/${received.document_id}`)).includes(String(received.number)));
// Real RSC Server Action: exact-satang input must persist through the form boundary.
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node") as { encodeReply(args: unknown[]): Promise<string | FormData> };
const manifest = JSON.parse(readFileSync(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8")) as {
  node: Record<string, { filename: string; exportedName: string }>;
};
const action = Object.entries(manifest.node).find(([, value]) => value.filename === "src/app/sales/money-actions.ts" && value.exportedName === "preparePayment");
assert.ok(action);
const form = new FormData();
Object.entries({ kind: "design_fee", amount: "10.01", method: "cash", paid_date: "2026-11-03",
  payer_name: "Synthetic action payer", description: "Synthetic action fee" }).forEach(([key, value]) => form.set(key, value));
const actionResponse = await fetch(`http://127.0.0.1:3100/sales/${sale.id}`, { method: "POST", redirect: "manual",
  headers: { Cookie: cookie, Origin: "http://127.0.0.1:3100", Accept: "text/x-component", "Next-Action": action[0] },
  body: await encodeReply([{ id: sale.id, version: received.version, requestId: randomUUID() }, { error: "" }, form]) });
await actionResponse.text();
assert.ok(actionResponse.headers.get("x-action-redirect")?.startsWith(`/sales/${sale.id}`));
assert.equal(sql(`select amount_cents from private.sales_payment_requests where case_id='${sale.id}' and state='pending' order by created_at desc limit 1`), "1001");
const proof = `${sale.id}/payment/${randomUUID()}.png`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=", "base64");
async function storage(method: string, path: string, body?: Buffer) {
  return fetch(`${local.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${path}`, { method,
    headers: { apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${owner.token}`,
      "Content-Type": "image/png", "x-upsert": "false" }, ...(body ? { body: new Uint8Array(body).buffer } : {}) });
}
assert.equal((await storage("POST", `sales-evidence/${proof}`, png)).status, 200);
assert.equal((await storage("GET", `authenticated/sales-evidence/${proof}`)).status, 200);
assert.equal((await fetch(`http://127.0.0.1:3100/sales/${sale.id}/evidence?path=${encodeURIComponent(proof)}`, { headers: { Cookie: cookie } })).status, 200);
assert.notEqual((await storage("PUT", `sales-evidence/${proof}`, png)).status, 200, "Proof must not be overwritten");
await grant("financial.view", false);
assert.equal((await rpc("sales_financial_detail", owner, { p_case_id: sale.id })).status, 403);
assert.equal((await rpc("sales_document_detail", owner, { p_document_id: received.document_id })).status, 403);
assert.notEqual((await storage("GET", `authenticated/sales-evidence/${proof}`)).status, 200, "Proof revocation uses the same token");
assert.equal((await fetch(`http://127.0.0.1:3100/sales/${sale.id}/evidence?path=${encodeURIComponent(proof)}`, { headers: { Cookie: cookie } })).status, 404);
await grant("financial.view", true);
const issuerNow = Number(sql("select version from private.sales_issuers where brand='BAAN_KUNAPAP'"));
ok(await rpc("sales_save_issuer", executive, { p_brand: "BAAN_KUNAPAP", p_version: issuerNow,
  p_input: { ...issuerInput, contract_text: "SYNTHETIC DEV CONTRACT - NOT COMPANY APPROVED WORDING" }, p_request_id: randomUUID() }));
let current = ok(await rpc("sales_case_detail", owner, { p_case_id: sale.id }));
current = ok(await rpc("sales_save_case", owner, { p_case_id: sale.id, p_expected_version: current.version, p_request_id: randomUUID(),
  p_input: { customer_snapshot: current.customer_snapshot, details: current.details,
    list_price_cents: "1000001", promotion_price_cents: null, discount_cents: "0" } }));
const quote = ok(await rpc("sales_issue_quotation", owner, { p_case_id: sale.id, p_version: current.version,
  p_description: "Synthetic test construction", p_request_id: randomUUID() }));
const schedule = [1000, 1800, 1800, 1800, 1800, 1800].map((basis_points, index) => ({
  basis_points, label: `Synthetic instalment ${index}`, progress_percent: index === 0 ? null : index * 20,
}));
const contractInput = { p_case_id: sale.id, p_version: quote.version, p_quotation_id: quote.document_id,
  p_schedule: schedule, p_request_id: randomUUID() };
assert.equal((await rpc("sales_prepare_contract", owner, contractInput)).status, 400, "Explicit accepted revision is required");
const agreementProof = `${sale.id}/agreement/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${agreementProof}`, png)).status, 200);
const accepted = ok(await rpc("sales_accept_quotation", owner, { p_document_id: quote.document_id, p_version: quote.version,
  p_evidence_path: agreementProof, p_request_id: randomUUID() }));
const contract = ok(await rpc("sales_prepare_contract", owner, { ...contractInput, p_version: accepted.version }));
const contractDoc = ok(await rpc("sales_document_detail", owner, { p_document_id: contract.document_id }));
const contractPayload = contractDoc.payload as Record<string, unknown>;
const contractRows = contractPayload.schedule as Record<string, unknown>[];
assert.equal(contractPayload.credit_cents, "350001");
assert.equal(contractRows[5].gross_cents, "180001", "Final gross carries arithmetic remainder");
assert.equal(contractRows[5].net_cents, "0"); assert.equal(contractRows[4].net_cents, "10000", "Credit spills backward");
const signedInput = { p_document_id: contract.document_id, p_version: contract.version,
  p_evidence_path: agreementProof, p_request_id: randomUUID() };
assert.equal((await rpc("sales_sign_contract", owner, signedInput)).status, 403);
const signed = ok(await rpc("sales_sign_contract", executive, signedInput));
const legacyCancel = { p_project_id: project.id, p_expected_version: project.version,
  p_request_id: randomUUID(), p_reason: "Synthetic legacy cancellation attempt" };
const guardedCancel = await rpc("walkin_cancel_project", executive, legacyCancel);
assert.equal(guardedCancel.status, 400);
assert.equal(guardedCancel.body.message, "sales_closeout_required");
assert.equal(sql(`select status from public.projects where id='${project.id}'`), "active");
assert.deepEqual(ok(await rpc("sales_sign_contract", executive, signedInput)), signed);
const agreement = ok(await rpc("sales_agreement_detail", owner, { p_case_id: sale.id }));
const instalments = agreement.instalments as Record<string, unknown>[]; assert.equal(instalments.length, 6);
assert.equal(sql(`select sum(amount_cents) from private.sales_credits where case_id='${sale.id}'`), "350001");
const zeroBillInput = { p_instalment_id: instalments[5].id, p_version: signed.version, p_due_date: "2026-11-30", p_request_id: randomUUID() };
assert.equal((await rpc("sales_issue_invoice", executive, zeroBillInput)).status, 400, "Zero cash does not bypass acceptance");
const acceptanceProof = `${sale.id}/acceptance/${randomUUID()}.png`;
const executiveClient = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${executive.token}` } }, auth: { persistSession: false },
});
assert.equal((await executiveClient.storage.from("sales-evidence").upload(acceptanceProof, png, { contentType: "image/png" })).error, null);
const acceptanceInput = { p_instalment_id: instalments[5].id, p_version: signed.version, p_inspected: true,
  p_customer_accepted: true, p_evidence_path: acceptanceProof, p_note: "Synthetic acceptance evidence", p_request_id: randomUUID() };
assert.equal((await rpc("sales_record_acceptance", executive, { ...acceptanceInput, p_inspected: false })).status, 400);
await grant("acceptance.record", true);
await grant("financial.view", false);
assert.equal((await rpc("sales_financial_detail", owner, { p_case_id: sale.id })).status, 403);
const workView = await rpc("sales_acceptance_detail", owner, { p_case_id: sale.id });
assert.equal(workView.status, 200);
assert.ok(Array.isArray(workView.body) && workView.body.length > 0);
assert.deepEqual(Object.keys(workView.body[0]).sort(), ["accepted", "id", "position", "progress_percent"]);
assert.ok((await page(`/sales/${sale.id}`)).includes("ตรวจรับงานก่อสร้าง"));
const workAccepted = ok(await rpc("sales_record_acceptance", owner, acceptanceInput));
await grant("financial.view", true);
const zeroBill = ok(await rpc("sales_issue_invoice", executive, { ...zeroBillInput, p_version: workAccepted.version }));
assert.equal(zeroBill.credit_settled, true);
assert.equal(sql(`select count(*) from private.sales_payments where case_id='${sale.id}'`), "1", "Credit settlement creates no money");
assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${sale.id}'`), "1", "Credit settlement creates no receipt");
const depositBill = ok(await rpc("sales_issue_invoice", executive, { p_instalment_id: instalments[0].id, p_version: zeroBill.version,
  p_due_date: "2026-11-30", p_request_id: randomUUID() }));
await grant("receipt.issue", true);
let part = ok(await rpc("sales_prepare_payment", owner, { p_case_id: sale.id, p_version: depositBill.version,
  p_input: { ...paymentInput, kind: "instalment", invoice_id: depositBill.invoice_id, amount_cents: "40000" }, p_request_id: randomUUID() }));
part = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: part.payment_request_id, p_version: part.version,
  p_funds_confirmed: true, p_request_id: randomUUID() }));
assert.equal((await rpc("sales_prepare_payment", owner, { p_case_id: sale.id, p_version: part.version,
  p_input: { ...paymentInput, kind: "instalment", invoice_id: depositBill.invoice_id, amount_cents: "60001" }, p_request_id: randomUUID() })).status, 400);
part = ok(await rpc("sales_prepare_payment", owner, { p_case_id: sale.id, p_version: part.version,
  p_input: { ...paymentInput, kind: "instalment", invoice_id: depositBill.invoice_id, amount_cents: "60000" }, p_request_id: randomUUID() }));
ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: part.payment_request_id, p_version: part.version,
  p_funds_confirmed: true, p_request_id: randomUUID() }));
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${depositBill.invoice_id}'`), "100000");
assert.ok((await page(`/sales/${sale.id}`)).includes("งวดชำระตามสัญญา"));
assert.ok((await page(`/sales/documents/${contract.document_id}`)).includes("SYNTHETIC DEV CONTRACT"));
assert.ok((await page(`/sales/documents/${quote.document_id}`)).includes("Synthetic test construction"));
assert.ok((await page(`/sales/documents/${zeroBill.document_id}`)).includes("ไม่มีการรับเงินใหม่"));
await grant("refund.request", true); await grant("refund.approve", true); await grant("refund.pay", true);
current = ok(await rpc("sales_case_detail", owner, { p_case_id: sale.id }));
const allocatedRoot = sql(`select id from private.sales_payments where case_id='${sale.id}' and amount_cents=40000`);
const refund = ok(await rpc("sales_request_refund", owner, { p_root_payment_id: allocatedRoot, p_version: current.version,
  p_amount_cents: "10000", p_reason: "Synthetic agreed refund", p_request_id: randomUUID() }));
assert.equal((await rpc("sales_request_refund", owner, { p_root_payment_id: allocatedRoot, p_version: refund.version,
  p_amount_cents: "40000", p_reason: "Would overcommit actual money", p_request_id: randomUUID() })).status, 400);
const decision = { p_refund_id: refund.refund_id, p_version: refund.version, p_decision: "approved",
  p_note: "Synthetic independent approval", p_request_id: randomUUID() };
assert.equal((await rpc("sales_decide_refund", owner, decision)).status, 403, "Requestor cannot self-approve even with the grant");
const approved = ok(await rpc("sales_decide_refund", executive, decision));
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${depositBill.invoice_id}'`), "100000", "Approval is not payout");
const refundProof = `${sale.id}/refund/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${refundProof}`, png)).status, 200);
const payout = { p_refund_id: refund.refund_id, p_version: approved.version, p_method: "transfer", p_paid_date: "2026-11-03",
  p_proof_path: refundProof, p_funds_confirmed: true, p_request_id: randomUUID() };
assert.equal((await rpc("sales_pay_refund", owner, { ...payout, p_funds_confirmed: false })).status, 400);
const paid = ok(await rpc("sales_pay_refund", owner, payout)); assert.deepEqual(ok(await rpc("sales_pay_refund", owner, payout)), paid);
assert.equal(sql(`select sum(amount_cents) from private.sales_payouts where case_id='${sale.id}'`), "10000");
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${depositBill.invoice_id}'`), "90000", "Actual refund reopens the allocated invoice balance");
assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${sale.id}'`), "3", "Refund must not erase original receipts");
const blockedRefund = ok(await rpc("sales_request_refund", owner, { p_root_payment_id: received.payment_id, p_version: paid.version,
  p_amount_cents: "1", p_reason: "Synthetic credited funds require amendment", p_request_id: randomUUID() }));
const blockedApproved = ok(await rpc("sales_decide_refund", executive, { ...decision, p_refund_id: blockedRefund.refund_id,
  p_version: blockedRefund.version, p_request_id: randomUUID() }));
assert.equal((await rpc("sales_pay_refund", owner, { ...payout, p_refund_id: blockedRefund.refund_id,
  p_version: blockedApproved.version, p_request_id: randomUUID() })).status, 400, "Cannot refund still-applied design credit");
assert.ok((await page(`/sales/${sale.id}`)).includes("คืนเงินจริง"));
assert.ok((await page(`/sales/documents/${paid.document_id}`)).includes("เอกสารจ่ายคืนเงิน"));
const amendment = ok(await rpc("sales_amend_contract", executive, {
  p_case_id: sale.id, p_version: blockedApproved.version, p_request_id: randomUUID(),
  p_rows: instalments.map((row, index) => ({ id: row.id, gross_cents: row.gross_cents,
    credit_cents: index === 5 ? String(Number(row.credit_cents) - 1) : row.credit_cents })),
  p_reason: "Release one satang of credit", p_agreement_text: "Synthetic signed adjustment",
  p_work_changed: false, p_evidence_path: agreementProof,
}));
assert.equal(sql(`select sum(amount_cents) from private.sales_credits where case_id='${sale.id}'`), "350000");
const adjustedInvoice = ok(await rpc("sales_document_detail", owner, { p_document_id: zeroBill.document_id }));
assert.equal((adjustedInvoice.payload as Record<string, unknown>).net_cents, "0");
const invoiceAdjustments = adjustedInvoice.adjustments as { document_id: string; amount_cents: string }[];
assert.equal(invoiceAdjustments[0].document_id, amendment.document_id);
assert.equal(invoiceAdjustments[0].amount_cents, "1");
assert.ok((await page(`/sales/documents/${zeroBill.document_id}`)).includes("ยอดสุทธิหลังปรับ"));
const creditRefund = ok(await rpc("sales_pay_refund", owner, { ...payout, p_refund_id: blockedRefund.refund_id,
  p_version: amendment.version, p_request_id: randomUUID() }));
const closed = ok(await rpc("sales_close_case", executive, {
  p_case_id: sale.id, p_version: creditRefund.version, p_request_id: randomUUID(), p_retained_cents: "440000",
  p_reason: "Synthetic close-out", p_agreement_text: "Synthetic signed close-out replaces prior bills",
  p_evidence_path: agreementProof,
}));
assert.equal(sql(`select count(*) from private.sales_invoices where case_id='${sale.id}' and cancelled_at is null`), "0");
assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${sale.id}'`), "3");
assert.ok((await page(`/sales/documents/${closed.document_id}`)).includes("ข้อตกลงปิดงาน"));
const closeBalance = ok(await rpc("sales_closeout_detail", owner, { p_case_id: sale.id }));
assert.equal(closeBalance.received_cents, "440000");
assert.equal(closeBalance.remaining_cents, "0");
assert.equal(closeBalance.refund_due_cents, "0");
assert.equal((await rpc("sales_request_refund", owner, { p_root_payment_id: received.payment_id, p_version: closed.version,
  p_amount_cents: "1", p_reason: "Exceeds signed close-out", p_request_id: randomUUID() })).status, 400);
assert.ok((await page(`/sales/${sale.id}`)).includes("ยอดปิดงานปัจจุบัน"));
console.log("PASS local HTTP/SSR/Server Action: receipts/evidence, agreements/credit/QC, partial billing, independent refunds and allocation/credit guards");
const tvLead = randomUUID(), development = randomUUID(), unit = randomUUID();
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${tvLead}','TARAVILLE','Synthetic Reservation','HTTP','0000000000','${owner.id}','${owner.id}','${randomUUID()}',repeat('0',64),'synthetic');
insert into private.sales_developments(id,name,created_by) values('${development}','Synthetic development','${executive.id}');
insert into private.sales_units(id,development_id,code,list_price_cents,created_by) values('${unit}','${development}','A1',1000000,'${executive.id}')`);
const createTv = async () => ok(await rpc("sales_create_case", owner, {
  p_lead_id: tvLead, p_project_id: null, p_unit_id: unit, p_customer_id: null, p_request_id: randomUUID(),
}));
const tvA = await createTv(), tvB = await createTv();
const reserve = (item: typeof tvA) => rpc("sales_confirm_reservation", owner, {
  p_case_id: item.id, p_version: item.version, p_request_id: randomUUID(),
});
const results = await Promise.all([reserve(tvA), reserve(tvB)]);
assert.deepEqual(results.map(result => result.status).sort(), [200, 409], "One concurrent reservation per physical unit");
const reserved = ok(results.find(result => result.status === 200)!);
assert.equal(sql("select confdeltype from pg_constraint where conrelid='private.sales_cases'::regclass and confrelid='public.leads'::regclass and contype='f'"), "a",
  "Lead references must remain non-cascading while sale history depends on them");
const waiting = reserved.id === tvA.id ? tvB : tvA;
const release = { p_case_id: reserved.id, p_version: reserved.version, p_reason: "Synthetic manual release", p_request_id: randomUUID() };
assert.equal((await rpc("sales_release_reservation", executive, release)).status, 400);
const tvIssuerVersion = Number(sql("select coalesce((select version from private.sales_issuers where brand='TARAVILLE'),0)"));
ok(await rpc("sales_save_issuer", executive, { p_brand: "TARAVILLE", p_version: tvIssuerVersion, p_input: issuerInput, p_request_id: randomUUID() }));
const tvClosed = ok(await rpc("sales_close_case", executive, {
  p_case_id: reserved.id, p_version: reserved.version, p_request_id: randomUUID(), p_retained_cents: "0",
  p_reason: "Synthetic close-out", p_agreement_text: "Synthetic signed close-out",
  p_evidence_path: `${reserved.id}/agreement/${randomUUID()}.png`,
}).then(async result => {
  assert.equal(result.status, 400, "Missing signed evidence rejects close-out");
  const proof = `${reserved.id}/agreement/${randomUUID()}.png`;
  assert.equal((await storage("POST", `sales-evidence/${proof}`, png)).status, 200);
  return rpc("sales_close_case", executive, { p_case_id: reserved.id, p_version: reserved.version,
    p_request_id: randomUUID(), p_retained_cents: "0", p_reason: "Synthetic close-out",
    p_agreement_text: "Synthetic signed close-out", p_evidence_path: proof });
}));
assert.equal((await reserve(waiting)).status, 409, "Close-out does not automatically release the plot");
ok(await rpc("sales_release_reservation", executive, { ...release, p_version: tvClosed.version }));
const nextReservation = ok(await reserve(waiting));
const summaryInput = { p_case_id: waiting.id, p_version: nextReservation.version, p_request_id: randomUUID(),
  p_input: { booking_cents: "10000", contract_cents: "20000", down_cents: "120000", conditions: "Synthetic conditions",
    freebies: "Synthetic extras", mortgage_cents: "900001", booking_date: "2026-11-11", contract_date: "2026-11-12" } };
assert.equal((await rpc("sales_save_booking_summary", owner, { ...summaryInput, p_input: { ...summaryInput.p_input, down_cents: "1000001" } })).status, 400);
const summary = ok(await rpc("sales_save_booking_summary", owner, summaryInput));
assert.deepEqual(ok(await rpc("sales_save_booking_summary", owner, summaryInput)), summary);
assert.equal(sql(`select payload->>'balance_cents' from private.sales_documents where id='${summary.document_id}'`), "850000");
assert.ok((await page(`/sales/documents/${summary.document_id}`)).includes("Synthetic extras"));
assert.ok((await page(`/sales/documents/${summary.document_id}`)).includes("9,000.01"));
assert.equal(sql(`select payload->>'contract_date' from private.sales_documents where id='${summary.document_id}'`), "2026-11-12");
const newUnit = randomUUID(), occupiedUnit = randomUUID();
sql(`insert into private.sales_units(id,development_id,code,list_price_cents,created_by)
values('${newUnit}','${development}','A2',1200000,'${executive.id}'),('${occupiedUnit}','${development}','A3',1300000,'${executive.id}')`);
const other = ok(await rpc("sales_create_case", owner, { p_lead_id: tvLead, p_project_id: null, p_unit_id: occupiedUnit,
  p_customer_id: null, p_request_id: randomUUID() }));
ok(await reserve(other));
const changeProof = `${waiting.id}/agreement/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${changeProof}`, png)).status, 200);
const change = { p_case_id: waiting.id, p_version: summary.version, p_unit_id: newUnit, p_price_cents: "1200000",
  p_reason: "Synthetic customer agreement", p_evidence_path: changeProof, p_request_id: randomUUID() };
assert.equal((await rpc("sales_change_reserved_unit", owner, { ...change, p_unit_id: occupiedUnit })).status, 409);
assert.equal(sql(`select unit_id from private.sales_reservations where case_id='${waiting.id}' and released_at is null`), unit);
const changed = ok(await rpc("sales_change_reserved_unit", owner, change));
assert.deepEqual(ok(await rpc("sales_change_reserved_unit", owner, change)), changed);
assert.equal(sql(`select unit_id from private.sales_reservations where case_id='${waiting.id}' and released_at is null`), newUnit);
assert.equal(sql(`select payload->>'plot' from private.sales_documents where id='${summary.document_id}'`), "A1");
ok(await rpc("sales_save_issuer", executive, { p_brand: "TARAVILLE", p_version: tvIssuerVersion + 1,
  p_input: { ...issuerInput, contract_text: "SYNTHETIC DEV PROPERTY CONTRACT" }, p_request_id: randomUUID() }));
const bookingInput = { p_case_id: waiting.id, p_version: changed.version,
  p_input: { ...paymentInput, kind: "booking", amount_cents: "10000" }, p_request_id: randomUUID() };
assert.equal((await rpc("sales_prepare_payment", owner, bookingInput)).status, 400);
const currentSummary = ok(await rpc("sales_save_booking_summary", owner, { ...summaryInput, p_version: changed.version,
  p_request_id: randomUUID() }));
bookingInput.p_version = currentSummary.version;
assert.equal((await rpc("sales_prepare_payment", owner, { ...bookingInput,
  p_input: { ...bookingInput.p_input, amount_cents: "10001" } })).status, 400);
const booked = ok(await rpc("sales_prepare_payment", owner, bookingInput));
const bookingReceipt = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: booked.payment_request_id,
  p_version: booked.version, p_funds_confirmed: true, p_request_id: randomUUID() }));
const propertySign = { p_case_id: waiting.id, p_version: bookingReceipt.version, p_summary_id: summary.document_id,
  p_down_count: 3, p_evidence_path: changeProof, p_request_id: randomUUID() };
assert.equal((await rpc("sales_sign_property_contract", executive, propertySign)).status, 400, "Old plot summary is stale");
const signedProperty = ok(await rpc("sales_sign_property_contract", executive, { ...propertySign,
  p_summary_id: currentSummary.document_id }));
assert.equal(sql(`select sum(gross_cents) from private.sales_instalments where case_id='${waiting.id}'`), "1200000");
assert.equal(sql(`select sum(credit_cents) from private.sales_instalments where case_id='${waiting.id}'`), "10000");
assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${waiting.id}'`), "1");
assert.ok((await page(`/sales/documents/${signedProperty.document_id}`)).includes("SYNTHETIC DEV PROPERTY CONTRACT"));
const propertyDeposit = sql(`select id from private.sales_instalments where case_id='${waiting.id}' and position=1`);
const propertyBill = ok(await rpc("sales_issue_invoice", executive, { p_instalment_id: propertyDeposit,
  p_version: signedProperty.version, p_due_date: "2026-11-30", p_request_id: randomUUID() }));
const propertyPayment = ok(await rpc("sales_prepare_payment", owner, { p_case_id: waiting.id, p_version: propertyBill.version,
  p_input: { ...paymentInput, kind: "instalment", invoice_id: propertyBill.invoice_id, amount_cents: "20000" }, p_request_id: randomUUID() }));
const propertyReceipt = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: propertyPayment.payment_request_id,
  p_version: propertyPayment.version, p_funds_confirmed: true, p_request_id: randomUUID() }));
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${propertyBill.invoice_id}'`), "20000");
assert.ok((await page(`/sales/documents/${propertyReceipt.document_id}`)).includes("ใบเสร็จรับเงิน"));
const correction = { p_document_id: propertyReceipt.document_id, p_version: propertyReceipt.version,
  p_reason: "Synthetic wording correction", p_description: "Updated wording", p_request_id: randomUUID() };
assert.equal((await rpc("sales_correct_receipt", owner, correction)).status, 403);
const replacement = ok(await rpc("sales_correct_receipt", executive, correction));
assert.deepEqual(ok(await rpc("sales_correct_receipt", executive, correction)), replacement);
assert.equal(sql(`select state from private.sales_documents where id='${propertyReceipt.document_id}'`), "cancelled");
assert.equal(sql(`select count(*) from private.sales_payments where case_id='${waiting.id}'`), "2");
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${propertyBill.invoice_id}'`), "20000");
const replacementHtml = await page(`/sales/documents/${replacement.document_id}`);
assert.ok(replacementHtml.includes("Updated wording"));
assert.ok(replacementHtml.includes(`ออกแทนใบเสร็จเลขที่ <!-- -->${propertyReceipt.number}`) || (
  replacementHtml.includes("ออกแทนใบเสร็จเลขที่") && replacementHtml.includes(String(propertyReceipt.number))));
const signedMove = { p_case_id: waiting.id, p_version: replacement.version, p_unit_id: unit,
  p_reason: "Synthetic signed plot change", p_agreement_text: "Synthetic signed plot addendum",
  p_evidence_path: changeProof, p_request_id: randomUUID() };
assert.equal((await rpc("sales_change_signed_plot", owner, signedMove)).status, 403);
assert.equal((await rpc("sales_change_signed_plot", executive, { ...signedMove, p_unit_id: occupiedUnit })).status, 409);
assert.equal(sql(`select unit_id from private.sales_cases where id='${waiting.id}'`), newUnit);
const signedMoved = ok(await rpc("sales_change_signed_plot", executive, signedMove));
assert.equal(sql(`select payload->>'unit_id' from private.sales_documents where id='${signedProperty.document_id}'`), newUnit);
assert.equal(sql(`select unit_id from private.sales_reservations where case_id='${waiting.id}' and released_at is null`), unit);
assert.ok((await page(`/sales/documents/${signedMoved.document_id}`)).includes("Synthetic signed plot addendum"));
const correctionProof = `${waiting.id}/payment/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${correctionProof}`, png)).status, 200);
const actualCorrection = { p_document_id: replacement.document_id, p_version: signedMoved.version, p_amount_cents: "15000",
  p_reason: "Synthetic actual amount correction", p_evidence_path: correctionProof, p_request_id: randomUUID() };
assert.equal((await rpc("sales_correct_payment", owner, actualCorrection)).status, 403);
assert.equal((await rpc("sales_correct_payment", executive, { ...actualCorrection, p_amount_cents: "20001" })).status, 400);
const corrected = ok(await rpc("sales_correct_payment", executive, actualCorrection));
assert.deepEqual(ok(await rpc("sales_correct_payment", executive, actualCorrection)), corrected);
assert.equal(sql(`select sum(amount_cents) from private.sales_allocations where invoice_id='${propertyBill.invoice_id}'`), "15000");
assert.equal(sql(`select count(*) from private.sales_payments where case_id='${waiting.id}' and voided_at is null`), "2");
assert.equal(sql(`select count(*) from private.sales_payouts where case_id='${waiting.id}'`), "0");
assert.ok((await page(`/sales/documents/${corrected.document_id}`)).includes("150.00"));
const pendingCorrection = ok(await rpc("sales_prepare_payment", owner, { p_case_id: waiting.id, p_version: corrected.version,
  p_input: { ...paymentInput, kind: "instalment", invoice_id: propertyBill.invoice_id, amount_cents: "5000" }, p_request_id: randomUUID() }));
const withdraw = { p_payment_request_id: pendingCorrection.payment_request_id, p_version: pendingCorrection.version,
  p_reason: "Synthetic duplicate preparation", p_request_id: randomUUID() };
const withdrawn = ok(await rpc("sales_reject_pending_payment", owner, withdraw));
assert.deepEqual(ok(await rpc("sales_reject_pending_payment", owner, withdraw)), withdrawn);
assert.equal((await rpc("sales_confirm_payment", owner, { p_payment_request_id: pendingCorrection.payment_request_id,
  p_version: withdrawn.version, p_funds_confirmed: true, p_request_id: randomUUID() })).status, 409);
assert.equal(sql(`select count(*) from private.sales_payments where request_id='${pendingCorrection.payment_request_id}'`), "0");
const propertyClosed = ok(await rpc("sales_close_case", executive, {
  p_case_id: waiting.id, p_version: withdrawn.version, p_retained_cents: "24000", p_reason: "Synthetic close-out",
  p_agreement_text: "Synthetic close-out with 10 THB refund", p_evidence_path: changeProof, p_request_id: randomUUID(),
}));
const finalRefundInput = { p_root_payment_id: propertyReceipt.payment_id, p_version: propertyClosed.version,
  p_amount_cents: "1000", p_reason: "Signed close-out refund", p_request_id: randomUUID() };
const concurrentRefunds = await Promise.all([
  rpc("sales_request_refund", owner, finalRefundInput),
  rpc("sales_request_refund", owner, { ...finalRefundInput, p_request_id: randomUUID() }),
]);
assert.deepEqual(concurrentRefunds.map(result => result.status).sort(), [200, 409]);
const finalRefund = ok(concurrentRefunds.find(result => result.status === 200)!);
assert.equal((await rpc("sales_request_refund", owner, { ...finalRefundInput, p_version: finalRefund.version,
  p_amount_cents: "1", p_request_id: randomUUID() })).status, 400);
const finalApproval = ok(await rpc("sales_decide_refund", executive, { ...decision, p_refund_id: finalRefund.refund_id,
  p_version: finalRefund.version, p_request_id: randomUUID() }));
const finalProof = `${waiting.id}/refund/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${finalProof}`, png)).status, 200);
ok(await rpc("sales_pay_refund", owner, { ...payout, p_refund_id: finalRefund.refund_id, p_version: finalApproval.version,
  p_proof_path: finalProof, p_request_id: randomUUID() }));
assert.equal(ok(await rpc("sales_closeout_detail", owner, { p_case_id: waiting.id })).refund_due_cents, "0");
const leadSales = ok(await rpc("sales_cases_for_lead", owner, { p_lead_id: tvLead }));
assert.equal(leadSales.can_create, true);
assert.ok(Array.isArray(leadSales.cases) && leadSales.cases.length === 3);
assert.deepEqual(Object.keys(leadSales.cases[0]).sort(), ["code", "id", "status"]);
const leadHtml = await page(`/leads/${tvLead}`);
assert.ok(leadHtml.includes(`/sales/${waiting.id}`) && leadHtml.includes("เปิดรายการขายใหม่"));
const otherCurrent = ok(await rpc("sales_case_detail", owner, { p_case_id: other.id }));
const otherProof = `${other.id}/agreement/${randomUUID()}.png`;
assert.equal((await storage("POST", `sales-evidence/${otherProof}`, png)).status, 200);
const otherSummary = ok(await rpc("sales_save_booking_summary", owner, {
  p_case_id: other.id, p_version: otherCurrent.version, p_request_id: randomUUID(),
  p_input: { booking_cents: null, contract_cents: "1300000", down_cents: "0" },
}));
const optionalAmounts = ok(await rpc("sales_document_detail", owner, { p_document_id: otherSummary.document_id }));
const amountsSnapshot = optionalAmounts.payload as Record<string, unknown>;
assert.equal(amountsSnapshot.booking_cents, null);
assert.equal(amountsSnapshot.down_cents, "0");
assert.equal(amountsSnapshot.balance_cents, "0");
const fullCycleSummary = ok(await rpc("sales_save_booking_summary", owner, {
  p_case_id: other.id, p_version: otherSummary.version, p_request_id: randomUUID(),
  p_input: { booking_cents: "10000", contract_cents: "20000", down_cents: "120001" },
}));
const fullCycleBooking = ok(await rpc("sales_prepare_payment", owner, {
  p_case_id: other.id, p_version: fullCycleSummary.version, p_request_id: randomUUID(),
  p_input: { ...paymentInput, kind: "booking", amount_cents: "10000" },
}));
const fullCycleBookingReceipt = ok(await rpc("sales_confirm_payment", owner, {
  p_payment_request_id: fullCycleBooking.payment_request_id, p_version: fullCycleBooking.version,
  p_funds_confirmed: true, p_request_id: randomUUID(),
}));
let settlement = ok(await rpc("sales_sign_property_contract", executive, {
  p_case_id: other.id, p_version: fullCycleBookingReceipt.version, p_summary_id: fullCycleSummary.document_id,
  p_down_count: 3, p_evidence_path: otherProof, p_request_id: randomUUID(),
}));
const settlementDetail = async () => ok(await rpc("sales_agreement_detail", owner, { p_case_id: other.id }));
assert.equal((await settlementDetail()).is_settled, false);
for (const credit of ["180000", "1000000"]) {
  const creditLead = randomUUID();
  sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${creditLead}','BAAN_KUNAPAP','Synthetic Credit','Boundary','0000000000','${owner.id}','${owner.id}','${randomUUID()}',repeat('0',64),'synthetic')`);
  const creditProject = ok(await rpc("walkin_open_project", owner, { p_lead_id: creditLead, p_expected_version: 1, p_request_id: randomUUID() }));
  let job = ok(await rpc("sales_create_case", owner, { p_lead_id: creditLead, p_project_id: creditProject.id,
    p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() }));
  const caseId = job.id;
  job = ok(await rpc("sales_save_design_plan", owner, { p_case_id: caseId, p_version: job.version,
    p_input: { usable_area: "180", tier: "under150" }, p_request_id: randomUUID() }));
  job = ok(await rpc("sales_prepare_payment", owner, { p_case_id: caseId, p_version: job.version,
    p_input: { ...paymentInput, amount_cents: credit }, p_request_id: randomUUID() }));
  job = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: job.payment_request_id, p_version: job.version,
    p_funds_confirmed: true, p_request_id: randomUUID() }));
  const snapshot = ok(await rpc("sales_case_detail", owner, { p_case_id: caseId }));
  job = ok(await rpc("sales_save_case", owner, { p_case_id: caseId, p_expected_version: job.version, p_request_id: randomUUID(),
    p_input: { customer_snapshot: snapshot.customer_snapshot, details: snapshot.details,
      list_price_cents: "1000000", promotion_price_cents: null, discount_cents: "0" } }));
  const offer = ok(await rpc("sales_issue_quotation", owner, { p_case_id: caseId, p_version: job.version,
    p_description: "Synthetic credit boundary", p_request_id: randomUUID() }));
  const proof = `${caseId}/agreement/${randomUUID()}.png`;
  assert.equal((await storage("POST", `sales-evidence/${proof}`, png)).status, 200);
  job = ok(await rpc("sales_accept_quotation", owner, { p_document_id: offer.document_id, p_version: offer.version,
    p_evidence_path: proof, p_request_id: randomUUID() }));
  job = ok(await rpc("sales_prepare_contract", owner, { p_case_id: caseId, p_version: job.version,
    p_quotation_id: offer.document_id, p_schedule: schedule, p_request_id: randomUUID() }));
  job = ok(await rpc("sales_sign_contract", executive, { p_document_id: job.document_id, p_version: job.version,
    p_evidence_path: proof, p_request_id: randomUUID() }));
  const detail = ok(await rpc("sales_agreement_detail", owner, { p_case_id: caseId }));
  const rows = detail.instalments as { id: string; net_cents: string; needs_acceptance: boolean }[];
  assert.equal(rows[5].net_cents, "0");
  assert.equal(rows[4].net_cents, credit === "180000" ? "180000" : "0");
  assert.equal(rows.reduce((total, row) => total + BigInt(row.net_cents), BigInt(0)).toString(),
    (BigInt(1000000) - BigInt(credit)).toString());
  let expectedReceipts = 1;
  for (const row of rows) {
    const issue = { p_instalment_id: row.id, p_version: job.version, p_due_date: "2026-11-30", p_request_id: randomUUID() };
    if (row.needs_acceptance) {
      assert.equal((await rpc("sales_issue_invoice", executive, issue)).status, 400);
      const workProof = `${caseId}/acceptance/${randomUUID()}.png`;
      assert.equal((await storage("POST", `sales-evidence/${workProof}`, png)).status, 200);
      job = ok(await rpc("sales_record_acceptance", owner, { ...acceptanceInput, p_instalment_id: row.id, p_version: job.version,
        p_evidence_path: workProof, p_request_id: randomUUID() }));
    }
    issue.p_version = job.version;
    job = ok(await rpc("sales_issue_invoice", executive, issue));
    assert.equal(job.credit_settled, row.net_cents === "0");
    assert.deepEqual(ok(await rpc("sales_issue_invoice", executive, issue)), job);
    if (row.net_cents === "0") continue;
    const request = ok(await rpc("sales_prepare_payment", owner, { p_case_id: caseId, p_version: job.version,
      p_input: { ...paymentInput, kind: "instalment", invoice_id: job.invoice_id, amount_cents: row.net_cents }, p_request_id: randomUUID() }));
    job = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: request.payment_request_id,
      p_version: request.version, p_funds_confirmed: true, p_request_id: randomUUID() }));
    expectedReceipts++;
  }
  assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${caseId}'`), String(expectedReceipts));
  assert.equal(sql(`select count(*) from private.sales_payments where case_id='${caseId}'`), String(expectedReceipts));
  assert.equal(sql(`select sum(amount_cents) from private.sales_payments where case_id='${caseId}' and voided_at is null`), "1000000");
  assert.equal(ok(await rpc("sales_agreement_detail", owner, { p_case_id: caseId })).is_settled, true);
}
console.log("PASS local HTTP: complete BKP payment cycles with final-instalment credit and full-contract credit");
const settlementRows = (await settlementDetail()).instalments as { id: string; net_cents: string }[];
assert.deepEqual(settlementRows.map(row => row.net_cents), ["0", "20000", "40000", "40000", "40001", "1149999"]);
let settlementPaymentId: unknown;
for (const row of settlementRows) {
  settlement = ok(await rpc("sales_issue_invoice", executive, { p_instalment_id: row.id, p_version: settlement.version,
    p_due_date: "2026-11-30", p_request_id: randomUUID() }));
  if (row.net_cents === "0") continue;
  const request = ok(await rpc("sales_prepare_payment", owner, { p_case_id: other.id, p_version: settlement.version,
    p_input: { ...paymentInput, kind: "instalment", invoice_id: settlement.invoice_id, amount_cents: row.net_cents }, p_request_id: randomUUID() }));
  settlement = ok(await rpc("sales_confirm_payment", owner, { p_payment_request_id: request.payment_request_id,
    p_version: request.version, p_funds_confirmed: true, p_request_id: randomUUID() }));
  settlementPaymentId = settlement.payment_id;
}
assert.equal((await settlementDetail()).is_settled, true);
assert.equal(sql(`select sum(amount_cents) from private.sales_payments where case_id='${other.id}' and voided_at is null`), "1300000");
assert.equal(sql(`select count(*) from private.sales_receipts where case_id='${other.id}'`), "6");
assert.ok((await page(`/sales/${other.id}`)).includes("ชำระครบทุกงวดตามสัญญาแล้ว"));
ok(await rpc("sales_request_refund", owner, { p_root_payment_id: settlementPaymentId, p_version: settlement.version,
  p_amount_cents: "1", p_reason: "Synthetic pending refund", p_request_id: randomUUID() }));
assert.equal((await settlementDetail()).is_settled, false);
console.log("PASS local HTTP/SSR: complete Taraville payment cycle, booking credit, three down payments and final balance");
console.log("PASS local HTTP: concurrent plot reservation, evidence-backed close-out, separate manual release");
