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
const models = load("./models.ts");
const tasks = load("./tasks.ts");
const dates = load("./date.ts");
const css = { default: {} };
const link = { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } };
const { CaseHeader } = load("../../app/sales/[id]/case-header.tsx", {
  "next/link": link, "@/lib/sales/models": models, "@/lib/sales/tasks": tasks,
  "@/lib/sales/money": money, "../sales.module.css": css,
}) as typeof import("../../app/sales/[id]/case-header");
const moneyWorkspaceImports = { "next/link": link, "@/lib/sales/money": money, "@/lib/sales/date": dates, "@/lib/sales/tasks": tasks,
  "@/lib/sales/financial-models": load("./financial-models.ts", { "./models": models }), "../sales.module.css": css,
  "./workspace-section.module.css": css, "./finance-collection.module.css": css };
const moneyWorkspaceHeading = load("../../app/sales/[id]/workspace-heading.tsx", moneyWorkspaceImports);
const moneyPendingPayments = load("../../app/sales/[id]/pending-payments.tsx", moneyWorkspaceImports);
const collectionModel = load("./finance-collection.ts", { "./tasks": tasks, "./money": money, "./date": dates });
const financeCollection = load("../../app/sales/[id]/finance-collection.tsx", moneyWorkspaceImports);
const bkpMoneySection = load("../../app/sales/[id]/bkp-money-section.tsx", { ...moneyWorkspaceImports,
  "./workspace-heading": moneyWorkspaceHeading, "./pending-payments": moneyPendingPayments,
  "@/lib/sales/finance-collection": collectionModel, "./finance-collection": financeCollection });
const { MoneySection, OverviewSection, PendingPayments } = load("../../app/sales/[id]/summary-sections.tsx", {
  "next/link": link, "@/lib/sales/financial-models": load("./financial-models.ts", { "./models": models }),
  "@/lib/sales/money": money, "@/lib/sales/date": dates, "@/lib/sales/tasks": tasks,
  "@/app/walkin/action-form": { ActionForm: ({ children }: { children: unknown }) => createElement("form", null, children as string) },
  "../money-actions": { confirmPayment: () => {} }, "./bkp-documents": { BkpDocuments: () => null }, "../sales.module.css": css,
  "./bkp-money-section": bkpMoneySection, "./pending-payments": moneyPendingPayments, "./workspace-section.module.css": css,
}) as typeof import("../../app/sales/[id]/summary-sections");
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const sale = { id: id(1), code: "BKP-TEST", brand: "BAAN_KUNAPAP" as const, lead_id: id(2), responsible_id: id(3), status: "draft" as const,
  version: 1, customer_name: "Synthetic customer", can_finance: true, project_id: null, unit_id: null, customer_id: id(4),
  responsible_name: "Synthetic owner", lead_owner_name: "Synthetic owner", can_edit: true, can_assign: false, permissions: {} };
const { TaskHeader, focusedDocumentTasks, usesFocusedTaskHeader } = load("../../app/sales/[id]/tasks/task-header.tsx", {
  "next/link": link, "../../sales.module.css": css, "./task-header.module.css": css,
}) as typeof import("../../app/sales/[id]/tasks/task-header");
const taskHeader = renderToStaticMarkup(createElement(TaskHeader, { sale, title: "ออกใบแจ้งชำระ", backTab: "money", backLabel: "กลับการเงิน" }));
assert.equal((taskHeader.match(/<h1/g) ?? []).length, 1);
assert.ok(taskHeader.includes("BKP-TEST · Synthetic customer") && taskHeader.includes("?tab=money") && taskHeader.includes("?tab=overview"));
for (const name of ["issue-quotation", "prepare-contract", "edit-contract", "lock-contract", "unlock-contract", "sign-contract", "acceptance", "issue-invoice", "confirm-payment"] as const) {
  assert.ok(focusedDocumentTasks.includes(name), `${name} uses the focused task layout`);
}
assert.ok(!focusedDocumentTasks.includes("accept-quotation"), "Quotation acceptance retains the full checklist");
for (const name of ["design", "assign", "close", "request-refund", "cancel-design-invoice"] as const) {
  assert.equal(usesFocusedTaskHeader(name, true), true, `${name} shares the BKP task header`);
  assert.equal(usesFocusedTaskHeader(name, false), false, "Taraville task layout remains unchanged");
}
assert.equal(usesFocusedTaskHeader("accept-quotation", true), false);
const navigation = createElement("nav", { "aria-label": "Case sections" }, "TEST TABS");
const header = renderToStaticMarkup(createElement(CaseHeader, { sale, summary: null, navigation }));
assert.ok(header.includes("TEST TABS"));
const focused = renderToStaticMarkup(createElement(CaseHeader, { sale, summary: null, navigation, showProgress: false }));
assert.ok(focused.includes("TEST TABS") && !focused.includes('aria-label="สถานะงาน"'));
const data = { sale, tasks: [], work: [], closeout: null, refunds: [], agreement: { is_settled: false, documents: [], instalments: [] },
  summary: { net: null, received: "350000", outstanding: null }, finance: { case_id: sale.id, version: 1, issuer_ready: true, can_change_design: false,
    design_plan: null, design_bills: [], design_legacy_received_cents: "0", design_legacy_has_payments: false,
    pending: [{ id: id(5), kind: "design_fee" as const, amount_cents: "500000", method: "cash" as const, paid_date: "2026-11-09", payer_name: "Synthetic payer", description: "Synthetic pending", proof_path: null }],
    payments: [], documents: [{ id: id(6), kind: "receipt", number: "TEST-R1", state: "issued", document_date: "2026-11-09", amount_cents: "350000" }] } };
const moneyHtml = renderToStaticMarkup(createElement(MoneySection, { data }));
assert.ok(moneyHtml.indexOf('id="pending"') < moneyHtml.indexOf('id="schedule"'), "Pending precedes the schedule after the workspace heading");
assert.doesNotMatch(moneyHtml, /tab=design#pending/);
assert.match(moneyHtml, /Synthetic payer/);
assert.match(renderToStaticMarkup(createElement(PendingPayments, { data, payments: data.finance.pending })), /Synthetic payer/);
const nav = load("./case-navigation.ts") as typeof import("./case-navigation");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs), "overview");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs, "customer"), "overview");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs, "overview", "intake"), "overview");
assert.equal(nav.taskReturnTab("edit-case", true), "overview");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs, "overview", "fees"), "money");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs, "overview", "contract"), "contract");
assert.equal(nav.resolveCaseTab(["overview"], "overview", "contract"), "overview");
assert.equal(nav.resolveCaseTab(["overview"], "contract"), "overview");
assert.equal(nav.taskReturnTab("confirm-payment", true, true), "money");
assert.equal(nav.taskReturnTab("contract-addendum", true), "contract");
assert.equal((moneyHtml.match(/id="design-fees"/g) ?? []).length, 1);
assert.ok(!moneyHtml.includes("ความต้องการบ้าน"));
assert.ok(moneyHtml.includes("TEST-R1"), "Receipt links remain in disclosure content");
assert.doesNotMatch(moneyHtml, /<details[^>]*open=/, "Passive history and summary start collapsed");
assert.ok(moneyHtml.includes('id="prepare"') && !moneyHtml.includes("task=prepare-payment"), "Stable anchor exposes no unavailable write action");
const empty = renderToStaticMarkup(createElement(MoneySection, { data: { ...data, finance: { ...data.finance, pending: [] } } }));
assert.ok(empty.includes("ไม่มีรายการรับเงินรอยืนยัน"));
const overview = renderToStaticMarkup(createElement(OverviewSection, { data, houseBrief: "TEST HOUSE BRIEF" }));
assert.ok(overview.includes("TEST HOUSE BRIEF") && !overview.includes('aria-labelledby="design-billing-title"'), "Overview retains house information, not the full billing panel");
assert.doesNotMatch(overview, /id="manage"/);
const management = renderToStaticMarkup(createElement(OverviewSection, { data: { ...data, tasks: [
  { name: "close", label: "Close", group: "exception" },
  { name: "assign", label: "Assign", group: "exception" },
  { name: "request-refund", label: "Row-specific task", group: "exception", row: id(7) },
] }, houseBrief: null }));
assert.match(management, /id="manage".*\?task=assign.*\?task=close/);
assert.doesNotMatch(management, /task=request-refund|task=amend/);
console.log("PASS: tabs precede workflow, focused header, pending-first money, collapsed history and overview isolation");

const { QuotationSection } = load("../../app/sales/[id]/quotation-section.tsx", {
  "next/link": link, "@/lib/sales/money": money, "@/lib/sales/tasks": tasks,
  "../sales.module.css": css, "./quotation-section.module.css": css,
  "./workspace-heading": load("../../app/sales/[id]/workspace-heading.tsx", { "next/link": link, "./workspace-section.module.css": css }),
}) as typeof import("../../app/sales/[id]/quotation-section");
type AgreementDocument = import("./agreement-models").AgreementDetail["documents"][number];
const quote = (revision: number, state = "offered", priced = true): AgreementDocument => ({
  id: id(100 + revision), kind: "quotation", revision, state, version: 1, number: `TEST-Q${revision}`, evidence_path: null,
  payload: { total_cents: priced ? "120000000" : "0", price_set: priced },
});
const quotationPage = (documents: AgreementDocument[], actions: import("./tasks").Task[] = []) =>
  renderToStaticMarkup(createElement(QuotationSection, { data: { ...data,
    agreement: { is_settled: false, documents, instalments: [] }, tasks: actions } }));
const issueQuote: import("./tasks").Task = { name: "issue-quotation", label: "ออกใบเสนอราคา", group: "main" };
const acceptOld: import("./tasks").Task = { name: "accept-quotation", label: "บันทึกลูกค้ายอมรับใบเสนอราคา", row: id(102), group: "main" };
const revisions = [quote(1, "accepted"), quote(3, "offered", false), quote(2), quote(4, "cancelled")];
const quoteHtml = quotationPage(revisions, [issueQuote, acceptOld]);
assert.ok(quoteHtml.indexOf("TEST-Q3") < quoteHtml.indexOf("TEST-Q1"), "Highest active revision is featured even with an accepted older revision");
assert.ok(quoteHtml.indexOf("TEST-Q1") < quoteHtml.indexOf("<details"), "Accepted older revision stays visible outside history");
assert.ok(!quoteHtml.includes("TEST-Q4"), "Cancelled documents retain their existing library-only visibility");
assert.match(quoteHtml, /<details><summary>ประวัติฉบับก่อน · 1 ฉบับ · บันทึกลูกค้ายอมรับได้ 1 ฉบับ/);
assert.ok(quoteHtml.includes(`task=accept-quotation&amp;row=${id(102)}`), "Old eligible revision retains its acceptance action");
assert.match(quotationPage([quote(3, "offered", false)], [issueQuote]), /ต้องจัดทำฉบับใหม่พร้อมราคา/);
const oldEligible = quotationPage([quote(3, "offered", false), quote(2)], [acceptOld]);
assert.match(oldEligible, /เลือกฉบับก่อนที่มีราคาในประวัติ/);
assert.doesNotMatch(oldEligible, /ไม่มีงานแก้ไขหรือยอมรับที่ทำได้/);
assert.match(quotationPage([quote(1, "offered", false)]), /ไม่มีงานแก้ไขหรือยอมรับที่ทำได้/);
assert.doesNotMatch(quotationPage([quote(1)]), /task=issue-quotation|task=accept-quotation/);
assert.match(quotationPage([]), /ยังไม่มีใบเสนอราคา/);
assert.equal(revisions[0].revision, 1, "Rendering does not mutate source ordering");
console.log("PASS: latest quotation, visible accepted revision, collapsed actionable history and permission-safe links");

function uploadStatus(path: string, pending: boolean, grouped = false) {
  const state: unknown[] = [{ name: "test.pdf" }, path, "", pending];
  const { EvidenceUpload } = load("../../app/sales/evidence-upload.tsx", {
    react: { ...require("react"), useState: () => [state.shift(), () => {}] },
    "@supabase/ssr": { createBrowserClient: () => { throw new Error("No upload in render checks"); } },
    "@/lib/supabase/config": {}, "./sales.module.css": css, "./evidence-upload.module.css": css,
  }) as typeof import("../../app/sales/evidence-upload");
  return renderToStaticMarkup(createElement(EvidenceUpload, { caseId: sale.id, className: grouped ? "custom-evidence" : undefined }));
}
assert.match(uploadStatus("", false), /ยังไม่ได้อัปโหลด/);
assert.doesNotMatch(uploadStatus("", true), /ยังไม่ได้อัปโหลด|พร้อมบันทึกรายการ/);
assert.match(uploadStatus("", true), /กำลังอัปโหลด/);
assert.doesNotMatch(uploadStatus("saved-path", false), /ยังไม่ได้อัปโหลด|กำลังอัปโหลด/);
assert.match(uploadStatus("saved-path", false), /อัปโหลดสำเร็จ · พร้อมบันทึกรายการ/);
const selectedEvidence = uploadStatus("", false, true);
assert.match(selectedEvidence, /1\. เลือกไฟล์หลักฐาน/);
assert.match(selectedEvidence, /2\. อัปโหลดไฟล์ที่เลือก/);
assert.match(selectedEvidence, /เลือก test.pdf แล้ว · ยังไม่ได้อัปโหลด/);
assert.doesNotMatch(uploadStatus("", true, true), /ยังไม่ได้อัปโหลด<\/p>/);
const uploadedEvidence = uploadStatus("saved-path", false, true);
assert.match(uploadedEvidence, /name="proof_path" value="saved-path"/);
assert.equal((uploadedEvidence.match(/อัปโหลดสำเร็จ/g) ?? []).length, 1, "Grouped upload has one success status");
assert.doesNotMatch(uploadedEvidence, /<button/);
assert.match(uploadedEvidence, /test.pdf/);
console.log("PASS: selected, uploading and uploaded evidence statuses are distinct");

const { BkpOverview } = load("../../app/sales/[id]/bkp-workflow.tsx", {
  "next/link": link, "@/lib/sales/bkp-workflow": load("./bkp-workflow.ts"), "@/lib/sales/tasks": tasks, "@/lib/sales/money": money,
  "./workspace-heading": moneyWorkspaceHeading, "./quotation-section": { QuotationSection }, "./contract-section": { ContractSection: () => null },
  "../sales.module.css": css, "./bkp-workflow.module.css": css, "./workspace-section.module.css": css,
}) as typeof import("../../app/sales/[id]/bkp-workflow");
const overviewWorkspace = renderToStaticMarkup(createElement(BkpOverview, { data }));
assert.ok(overviewWorkspace.indexOf("ภาพรวมโครงการ</h2>") < overviewWorkspace.indexOf("มูลค่าโครงการ"), "Overview facts follow the section heading");
assert.ok(overviewWorkspace.includes("3,500.00 บาท"));
assert.equal((overviewWorkspace.match(/ยังไม่ระบุ/g) ?? []).length, 2, "Missing project values are not represented as zero");
assert.match(overviewWorkspace, /tab=documents/);
const separateOverview = renderToStaticMarkup(createElement(BkpOverview, { data: {
  ...data,
  finance: { ...data.finance!, design_plan: { tier: "under150", usable_area: "120", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" } },
  agreement: { ...data.agreement!, documents: [{ id: id(50), kind: "contract", state: "signed", number: "SYNTHETIC", revision: 1, version: 1, evidence_path: null, payload: { design_fee_separate: true } }] },
  summary: { net: "200000000", received: "350000", outstanding: "200000000" },
} }));
assert.match(separateOverview, /2,012,000\.00 บาท/);
assert.match(separateOverview, /ค้างชำระค่าก่อสร้าง<\/dt><dd>2,000,000\.00 บาท/);
assert.match(separateOverview, /รับแล้วหลังหักคืนเงิน<\/dt><dd>3,500\.00 บาท/);
console.log("PASS: overview hierarchy and exact financial summary");

const signingEvidence = load("../../app/sales/evidence-upload.tsx", {
  "@supabase/ssr": { createBrowserClient: () => { throw new Error("No upload in render checks"); } },
  "@/lib/supabase/config": {}, "./sales.module.css": css, "./evidence-upload.module.css": css,
});
const { SignContractTask } = load("../../app/sales/[id]/tasks/document-tasks.tsx", {
  "next/link": link, "@/lib/sales/money": money, "@/lib/sales/contract-paper": {},
  "@/app/walkin/action-form": { ActionForm: ({ children, label }: { children: unknown; label: string }) => createElement("form", null, children as string, createElement("button", { type: "submit" }, label)) },
  "../../agreement-actions": { signContract: () => {} }, "../../adjustment-actions": {}, "../../money-actions": {},
  "../../evidence-upload": signingEvidence, "./contract-addendum-form": {}, "./quotation-editor": {}, "./contract-wizard": {},
  "../../documents/[id]/agreement-content": {}, "./task-data": { idOf: () => ({}) }, "./design-packages": {},
  "../../sales.module.css": css, "./quotation-acceptance.module.css": { default: { evidence: "contract-evidence" } },
}) as typeof import("../../app/sales/[id]/tasks/document-tasks");
const signingDocument: AgreementDocument = { ...quote(3), id: id(303), kind: "contract", state: "awaiting_signature", number: "TEST-C3",
  payload: { total_cents: "123456789", customer: { full_name: "Contract snapshot signer", phone: "0000000000", site_address: "Test site" },
    schedule_input: [{ label: "Deposit", basis_points: 1000, progress_percent: null, work_description: "" },
      { label: "Work", basis_points: 9000, progress_percent: 100, work_description: "Test work" }] } };
const signingData = { sale, agreement: { is_settled: false, documents: [signingDocument], instalments: [] },
  finance: null, refunds: [], owners: [], reservation: null, staffId: id(3), row: signingDocument.id };
const signingHtml = renderToStaticMarkup(createElement(SignContractTask, signingData));
assert.match(signingHtml, /TEST-C3 · ฉบับที่ 3/);
assert.match(signingHtml, /Contract snapshot signer/);
assert.match(signingHtml, /1,234,567.89 บาท.*2 งวด/);
assert.match(signingHtml, /สัญญาและตารางงวดที่ลงนามแล้ว/);
assert.match(signingHtml, /1\. เลือกไฟล์หลักฐาน/);
assert.match(signingHtml, /2\. อัปโหลดไฟล์ที่เลือก/);
assert.match(signingHtml, /<input(?=[^>]*type="checkbox")(?=[^>]*name="confirmed")(?=[^>]*required="")[^>]*>/);
assert.match(signingHtml, /name="proof_path" value=""/);
assert.match(signingHtml, /target="_blank"/);
assert.ok(signingHtml.includes(`/sales/documents/${signingDocument.id}`));
assert.equal(renderToStaticMarkup(createElement(SignContractTask, { ...signingData, row: "missing" })), "");
assert.equal(renderToStaticMarkup(createElement(SignContractTask, { ...signingData,
  agreement: { ...signingData.agreement, documents: [{ ...signingDocument, state: "signed" }] } })), "");
console.log("PASS: signing form exact document context, grouped explicit upload, confirmation and stale-row safety");
