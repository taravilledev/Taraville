import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const money = load("./money.ts");
const fees = load("./design-fees.ts");
const dates = load("./date.ts");
const tasks = load("./tasks.ts") as typeof import("./tasks");
const css = { default: {} };
const workspaceHeading = load("../../app/sales/[id]/workspace-heading.tsx", {
  "next/link": { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } },
  "./workspace-section.module.css": css,
});
const imports = { "next/link": { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } },
  "@/lib/sales/money": money, "@/lib/sales/design-fees": fees, "@/lib/sales/date": dates, "@/lib/sales/tasks": tasks,
  "./workspace-heading": workspaceHeading, "./workspace-section.module.css": css,
  "../sales.module.css": css, "./design-billing-panel.module.css": css };
const { DesignBillingPanel } = load("../../app/sales/[id]/design-billing-panel.tsx", imports) as typeof import("../../app/sales/[id]/design-billing-panel");
const financial = load("./financial-models.ts", { "./models": load("./models.ts") }) as typeof import("./financial-models");
const { financialSchema } = financial;
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const sale = { id: id(1), code: "BKP-TEST", brand: "BAAN_KUNAPAP" as const, lead_id: id(2), responsible_id: id(3), status: "draft" as const,
  version: 1, customer_name: "Synthetic customer", can_finance: true, project_id: null, unit_id: null, customer_id: id(4),
  responsible_name: "Synthetic owner", lead_owner_name: "Synthetic owner", can_edit: true, can_assign: false, permissions: {} };
const finance = financialSchema.parse({ case_id: sale.id, version: 1, issuer_ready: true, can_change_design: true,
  design_plan: { tier: "under150", usable_area: "53", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" },
  pending: [], payments: [], documents: [] });
const base = { brand: sale.brand, status: sale.status, can: { "billing.issue": true, "financial.prepare": true }, canAssign: false, hasNetPrice: false,
  design: { canChange: true, amounts: finance.design_plan!.instalments }, summaryCount: 0, hasPayments: false, plotHeld: false, unitOptions: 0,
  pendingPaymentIds: [], receipts: [], quotations: [], contracts: [], instalments: [], workAcceptance: [], refunds: [] };
const render = (patch: Partial<typeof finance> = {}, actionList = tasks.availableTasks(base)) => renderToStaticMarkup(createElement(DesignBillingPanel, { sale, finance: { ...finance, ...patch }, tasks: actionList }));
const initial = render();
for (const text of ["ออกแบบ", "พื้นที่ใช้สอยจริง", "53 ตร.ม.", "12,000.00 บาท", "3 งวด", "tab=money#design-fees"]) assert.ok(initial.includes(text), text);
assert.doesNotMatch(initial, /task=(?:issue-design-invoice|prepare-design-payment|cancel-design-invoice)/, "Design is configuration only; collection tasks live in finance");
assert.match(initial, /task=design/);
const bill = { id: id(5), position: 1, label: "ส่งมอบแบบแปลน", amount_cents: "350000", due_date: "2026-11-30", document_id: id(6), state: "issued" as const,
  pending_id: id(7), receipt_document_id: null, received_cents: "0", pending_cents: "350000", has_confirmed_payment: false };
const pending = render({ design_bills: [bill], pending: [{ id: id(7), kind: "design_fee", amount_cents: "350000", method: "cash", paid_date: "2026-11-09", payer_name: "Synthetic payer", description: "Design", proof_path: null }] }, []);
assert.match(pending, /tab=money#pending/);
assert.match(pending, /มีเงินค่าแบบรอยืนยัน 1 รายการ/);
assert.doesNotMatch(pending, /Synthetic payer|task=confirm-payment|task=prepare-design-payment/);
const readonly = render({ can_change_design: false }, []);
assert.doesNotMatch(readonly, /task=design/);
assert.match(readonly, /ตรวจบิลและประวัติเงินที่หน้าการเงิน/);
const noPlan = render({ design_plan: null });
assert.match(noPlan, /ยังไม่ได้เลือกแพ็กเกจ/);
assert.match(noPlan, /เลือกแพ็กเกจและกรอกพื้นที่ใช้สอยจริง/);
assert.match(initial, /tab=documents/);
const actionForm = { ActionForm: ({ children, label }: { children: unknown; label: string }) => createElement("form", null, children as string, createElement("button", { type: "submit" }, label)) };
const paymentPaper = load("../../app/sales/[id]/tasks/payment-paper.tsx", {
  "next/image": { default: (props: Record<string, unknown>) => createElement("img", props) },
  "@/app/walkin/action-form": actionForm,
  "@/lib/sales/money": money, "@/lib/sales/financial-models": financial,
  "@/lib/sales/date": dates,
  "../../evidence-upload": { EvidenceUpload: () => createElement("input", { type: "hidden", name: "proof_path", value: "" }) },
  "../../documents/[id]/receipt-paper": { ReceiptPaper: () => null },
  "../../sales.module.css": css, "./payment-paper.module.css": css,
});
const taskViews = load("../../app/sales/[id]/tasks/design-billing-tasks.tsx", {
  "@/app/walkin/action-form": actionForm, "./payment-paper": paymentPaper,
  "../../design-billing-actions": { issueDesignInvoice: () => {}, prepareDesignPayment: () => {}, cancelDesignInvoice: () => {} },
  "../../evidence-upload": { EvidenceUpload: () => null }, "../../sales.module.css": css,
  "./task-data": { idOf: () => ({}) }, "@/lib/sales/money": money, "@/lib/sales/date": dates,
}) as typeof import("../../app/sales/[id]/tasks/design-billing-tasks");
const data = { sale, finance: { ...finance, design_bills: [{ ...bill, pending_id: null }] }, agreement: null, staffId: id(3), reservation: null, refunds: [], owners: [] };
const issue = renderToStaticMarkup(createElement(taskViews.IssueDesignInvoiceTask, { ...data, row: "1" }));
assert.match(issue, /<input(?=[^>]*type="date")(?=[^>]*name="due_date")(?=[^>]*required="")[^>]*>/);
assert.match(issue, /<input(?=[^>]*name="due_date")(?=[^>]*value="")[^>]*>/, "Due date starts explicitly blank");
assert.ok(issue.includes("แก้ไขใบแจ้งชำระบนเอกสาร") && issue.includes("ดูตัวอย่างเอกสาร"));
const prep = renderToStaticMarkup(createElement(taskViews.PrepareDesignPaymentTask, { ...data, row: bill.id }));
assert.ok(prep.includes("3,500.00") && prep.includes("แก้ยอดไม่ได้"));
assert.ok(prep.includes("เตรียมใบเสร็จบนเอกสาร") && prep.includes("ดูตัวอย่างเอกสาร"));
assert.match(prep, /<textarea(?=[^>]*name="description")[^>]*>/);
assert.equal((prep.match(/<form/g) ?? []).length, 1, "Payment paper does not nest forms");
assert.doesNotMatch(prep, /name="(?:amount|amount_cents)"/, "Amount cannot be edited or sent by the payment form");
assert.equal(renderToStaticMarkup(createElement(taskViews.PrepareDesignPaymentTask, { ...data, finance: { ...data.finance, design_bills: [bill] }, row: bill.id })), "");
console.log("PASS: design package-only summary, finance bridge, permissions, explicit due date and immutable full-bill payment");
