import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { SummaryData } from "../../app/sales/[id]/summary-sections";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const models = load("./models.ts") as typeof import("./models");
const financial = load("./financial-models.ts", { "./models": models }) as typeof import("./financial-models");
const common = {
  "next/link": { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } },
  "@/lib/sales/money": load("./money.ts"), "@/lib/sales/date": load("./date.ts"), "@/lib/sales/tasks": load("./tasks.ts"),
  "@/lib/sales/financial-models": financial,
  "../sales.module.css": { default: { primary: "primary", link: "secondary" } }, "./workspace-section.module.css": { default: {} }, "./finance-collection.module.css": { default: {} },
};
const heading = load("../../app/sales/[id]/workspace-heading.tsx", common);
const pending = load("../../app/sales/[id]/pending-payments.tsx", common) as typeof import("../../app/sales/[id]/pending-payments");
const collectionModel = load("./finance-collection.ts", { "./tasks": common["@/lib/sales/tasks"], "./money": common["@/lib/sales/money"], "./date": common["@/lib/sales/date"] });
const collectionView = load("../../app/sales/[id]/finance-collection.tsx", common);
const { BkpMoneySection } = load("../../app/sales/[id]/bkp-money-section.tsx", { ...common,
  "./workspace-heading": heading, "./pending-payments": pending, "./finance-collection": collectionView, "@/lib/sales/finance-collection": collectionModel,
}) as typeof import("../../app/sales/[id]/bkp-money-section");
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const sale = models.caseDetailSchema.parse({ id: id(1), code: "BKP-TEST", brand: "BAAN_KUNAPAP", lead_id: id(2), responsible_id: id(3), status: "contracted",
  version: 1, customer_name: "Synthetic", can_finance: true, project_id: null, unit_id: null, customer_id: id(4), responsible_name: "Synthetic", lead_owner_name: "Synthetic",
  can_edit: false, can_assign: false, permissions: { "financial.confirm": true, "receipt.issue": true } });
const row = { id: id(5), contract_id: id(6), is_active: true, position: 1, label: "งานโครงสร้าง", gross_cents: "50000", credit_cents: "10000", net_cents: "40000",
  progress_percent: 20, needs_acceptance: true, accepted_at: null, acceptance_path: null, acceptance_date: null, due_date: null, invoice_id: null,
  invoice_document_id: null, balance: null };
const data: SummaryData = { sale, finance: financial.financialSchema.parse({ case_id: sale.id, version: 1, issuer_ready: true, can_change_design: false,
  design_plan: null, pending: [], payments: [], documents: [] }), agreement: { is_settled: false, documents: [], instalments: [row] }, refunds: [], closeout: null, tasks: [], work: [],
  summary: { net: null, received: "10000", outstanding: null } };
const render = (next: SummaryData = data) => renderToStaticMarkup(createElement(BkpMoneySection, { data: next }));
const noRights = render();
assert.match(noRights, /ยังไม่กำหนดค่าออกแบบ/);
assert.doesNotMatch(noRights, /\?task=/, "No write action without registry authorization");
assert.match(noRights, /รอตรวจรับงาน/);
assert.match(render({ ...data, agreement: { is_settled: false, documents: [], instalments: [] } }), /tab=contract/);
assert.ok(noRights.indexOf('id="pending"') < noRights.indexOf('id="schedule"'), "Pending comes before the schedule");
assert.ok(noRights.includes('id="prepare"') && !noRights.includes("task=prepare-payment"), "Stable anchor without unauthorized action");
const acceptance = render({ ...data, tasks: [{ name: "acceptance", label: "Acceptance", row: row.id, group: "main" }] });
assert.equal((acceptance.match(/class="primary"/g) ?? []).length, 2, "One primary in each mutually exclusive desktop/mobile row");
assert.match(acceptance, /task=acceptance/);
const acceptedRow = { ...row, accepted_at: "2026-11-11T00:00:00Z", acceptance_date: "2026-11-11", due_date: "2026-12-11" };
const acceptedData = { ...data, agreement: { ...data.agreement!, instalments: [acceptedRow] }, tasks: [{ name: "issue-invoice" as const, label: "Invoice", row: row.id, group: "main" as const }] };
assert.match(render(acceptedData), /task=issue-invoice/);
assert.match(render(acceptedData), /ตรวจรับ/);
assert.match(render(acceptedData), /ครบกำหนด/);
const invoicedRow = { ...acceptedRow, invoice_id: id(7), invoice_document_id: id(8), balance: { allocated_cents: "10000", outstanding_cents: "30000", net_cents: "40000", is_active: true } };
const invoiced = render({ ...data, agreement: { ...data.agreement!, instalments: [invoicedRow] }, tasks: [{ name: "prepare-instalment", label: "Collect", row: row.id, group: "main" }] });
assert.match(invoiced, /task=prepare-instalment/);
assert.match(invoiced, /รอรับชำระ/);
assert.match(invoiced, /300\.00 บาท/);
assert.match(invoiced, new RegExp(`/sales/documents/${id(8)}`));
const paid = render({ ...data, agreement: { is_settled: true, documents: [], instalments: [{ ...invoicedRow, balance: { ...invoicedRow.balance, outstanding_cents: "0" } }] } });
assert.match(paid, /ครบยอดแล้ว/);
assert.match(paid, /ชำระครบทุกงวดตามสัญญาแล้ว/);
const creditedRow = { ...acceptedRow, net_cents: "0", credit_cents: "50000",
  balance: { allocated_cents: "0", outstanding_cents: "0", net_cents: "0", is_active: true } };
const credited = render({ ...acceptedData, agreement: { is_settled: false, documents: [], instalments: [creditedRow] } });
assert.match(credited, /รอบันทึกสรุปเครดิต/);
assert.match(credited, /บันทึกสรุปเครดิตงวดนี้/);
assert.doesNotMatch(credited, /ครบยอดแล้ว|>ออกใบแจ้งชำระ<|data-done="true"/, "Unbilled credit-only rows are not complete");
const creditedComplete = render({ ...data, agreement: { is_settled: false, documents: [], instalments: [{ ...creditedRow, invoice_id: id(7), invoice_document_id: id(8) }] } });
assert.match(creditedComplete, /ครบยอดแล้ว/);
const inactiveBalance = render({ ...data, agreement: { is_settled: false, documents: [], instalments: [{ ...creditedRow, invoice_id: id(7),
  balance: { ...creditedRow.balance, is_active: false } }] } });
assert.doesNotMatch(inactiveBalance, /ครบยอดแล้ว|data-done="true"/, "Inactive invoice balances do not imply settlement");
const payment = { id: id(9), kind: "instalment" as const, amount_cents: "30000", method: "cash" as const, paid_date: "2026-11-14", payer_name: "Synthetic payer", description: "Synthetic pending", proof_path: null };
const paymentData: SummaryData = { ...data, finance: { ...data.finance!, pending: [payment] }, tasks: [{ name: "confirm-payment", label: "Confirm", row: payment.id, group: "main" }] };
const pendingHtml = render(paymentData);
assert.match(pendingHtml, /task=confirm-payment/);
assert.match(pendingHtml, /ยังไม่นับเป็นเงินรับจริงจนกว่าจะตรวจสอบและยืนยัน/);
assert.doesNotMatch(render({ ...paymentData, sale: { ...sale, permissions: {} } }), /task=confirm-payment/);
const designOnly = render({ ...paymentData, finance: { ...data.finance!, pending: [{ ...payment, kind: "design_fee" }] } });
assert.match(designOnly, /Synthetic payer/);
assert.match(designOnly, /task=confirm-payment/, "Design and contract pending share the finance confirmation queue");
const receiptId = id(10);
const receiptData: SummaryData = { ...data, finance: { ...data.finance!, documents: [{ id: receiptId, number: "TEST-R1", kind: "receipt", state: "issued", document_date: "2026-11-14", amount_cents: "10000" }] },
  tasks: [{ name: "fix-receipt", label: "Correction", row: receiptId, group: "exception" }] };
assert.match(render(receiptData), /<details[^>]*open=""[^>]*><summary>ประวัติใบเสร็จรับเงิน/);
assert.match(render(receiptData), /แก้ไขเอกสารได้ 1 รายการ/);
assert.match(render(receiptData), /task=fix-receipt/);
const refundData: SummaryData = { ...data, refunds: [{ id: id(11), root_payment_id: id(12), amount_cents: "10000", reason: "Synthetic refund", state: "approved", requested_by: id(3),
  requested_by_name: "Synthetic", requested_at: "2026-11-14", decided_by: id(3), decision_note: null, document_id: null }],
  tasks: [{ name: "pay-refund", label: "Refund", row: id(11), group: "exception" }] };
assert.match(render(refundData), /id="refunds"[^>]*open=""/);
assert.match(render(refundData), /รอดำเนินการ 1 รายการ/);
assert.match(render(refundData), /task=pay-refund/);
const closedData: SummaryData = { ...data, sale: { ...sale, status: "cancelled" }, finance: { ...data.finance!,
  design_plan: { tier: "under150", usable_area: "53", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" } },
  summary: { net: null, received: "0", outstanding: "0" },
  closeout: { document_id: id(12), retained_cents: "0", received_cents: "0", remaining_cents: "0", refund_due_cents: "0" } };
const closedHtml = render(closedData);
const signedHtml = render({ ...closedData, sale, closeout: null, agreement: { ...data.agreement!, documents: [
  { id: row.contract_id, kind: "contract", state: "signed", number: "TEST-C1", revision: 1, version: 1, evidence_path: null, payload: {} },
] } });
assert.match(signedHtml, /ค่าออกแบบ<\/dt><dd>รวมในราคาสัญญาแล้ว/);
assert.doesNotMatch(signedHtml, /ค่าแบบคงเหลือ|task=issue-design-invoice/);
assert.match(signedHtml, /รอออกบิล <span>0<\/span>/);
assert.match(signedHtml, /ยอดตามแพ็กเกจ/);
assert.match(closedHtml, /ข้อมูลค่าแบบก่อนปิดงาน<\/dt><dd>ดูรายการอ้างอิงด้านล่าง/);
assert.match(closedHtml, /ยอดคงเหลือตามปิดงาน<\/dt><dd>0\.00 บาท/);
assert.doesNotMatch(closedHtml, /12,000\.00 บาท|ค่าแบบคงเหลือ/);
assert.match(closedHtml, /อ้างอิงก่อนปิดงาน/);
assert.match(render({ ...closedData, closeout: null }), /ยังไม่มีสรุปปิดงาน/);
assert.match(render({ ...closedData, finance: { ...closedData.finance!, pending: [payment] }, tasks: paymentData.tasks }), /task=confirm-payment/,
  "Closing context does not suppress authorized pending confirmations");
const legacy = renderToStaticMarkup(createElement(pending.PendingPayments, { data: { ...paymentData, sale: { ...sale, brand: "TARAVILLE" } }, payments: [payment] }));
assert.ok(legacy.startsWith('<section id="pending">'));
assert.match(legacy, /Synthetic payer/);
const summarySections = load("../../app/sales/[id]/summary-sections.tsx", { ...common,
  "./bkp-money-section": { BkpMoneySection }, "./pending-payments": pending, "./bkp-documents": { BkpDocuments: () => null },
}) as typeof import("../../app/sales/[id]/summary-sections");
const legacyMoney = renderToStaticMarkup(createElement(summarySections.MoneySection, { data: { ...paymentData, sale: { ...sale, brand: "TARAVILLE" } } }));
assert.ok(legacyMoney.startsWith('<section id="pending">'));
assert.match(legacyMoney, /id="schedule"/);
assert.match(legacyMoney, /<details[^>]*open=""[^>]*><summary>ประวัติใบเสร็จรับเงิน/);
assert.doesNotMatch(legacyMoney, /aria-label="งวดและรับเงิน"|สรุปยอดโครงการ/, "Taraville keeps its existing money presentation");
console.log("PASS: unified finance composition, pending-first, action/status/date hierarchy, permissions, actionable history and Taraville preservation");
