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
const contractPaper = load("./contract-paper.ts") as typeof import("./contract-paper");
const schema = load("./agreement-inputs.ts", { "./contract-paper": contractPaper }) as typeof import("./agreement-inputs");
const css = { default: {} };
const moneyText = load("../../app/sales/documents/[id]/contract-money-text.ts") as typeof import("../../app/sales/documents/[id]/contract-money-text");
const photoContent = load("../../app/sales/documents/[id]/photo-contract-content.tsx", {
  "@/lib/sales/money": money, "@/lib/sales/contract-paper": contractPaper, "../../[id]/tasks/contract-paper.module.css": css, "./contract-money-text": moneyText,
}) as typeof import("../../app/sales/documents/[id]/photo-contract-content");
const partyFields = load("../../app/sales/[id]/tasks/contract-party-fields.tsx", { "./contract-paper.module.css": css });
const agreementContent = load("../../app/sales/documents/[id]/agreement-content.tsx", {
  "@/lib/sales/money": money, "./document.module.css": css, "./photo-contract-content": photoContent, "../../[id]/tasks/contract-paper.module.css": css,
}) as typeof import("../../app/sales/documents/[id]/agreement-content");
const taskHeader = load("../../app/sales/[id]/tasks/task-header.tsx", { "../../sales.module.css": css, "./task-header.module.css": css });
const { ContractWizard } = load("../../app/sales/[id]/tasks/contract-wizard.tsx", {
  "next/link": { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } },
  "@/app/walkin/action-form": { ActionForm: () => null }, "@/lib/sales/money": money,
  "@/lib/sales/agreement-inputs": schema, "@/lib/sales/contract-paper": contractPaper, "./contract-party-fields": partyFields,
  "../../documents/[id]/photo-contract-content": photoContent, "../../documents/[id]/agreement-content": agreementContent,
  "../../sales.module.css": css, "./contract-paper.module.css": css,
  "./task-header": taskHeader,
}) as typeof import("../../app/sales/[id]/tasks/contract-wizard");
const { financialSchema } = load("./financial-models.ts", { "./models": load("./models.ts") }) as typeof import("./financial-models");
const { bkpWorkflow } = load("./bkp-workflow.ts") as typeof import("./bkp-workflow");
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const sale = { id: id(1), code: "BKP-TEST", brand: "BAAN_KUNAPAP" as const, lead_id: id(2), responsible_id: id(3), status: "draft" as const,
  version: 1, customer_name: "Case original", can_finance: true, project_id: null, unit_id: null, customer_id: id(4),
  responsible_name: "Synthetic owner", lead_owner_name: "Synthetic owner", can_edit: true, can_assign: false, permissions: {} };
const paper = { schema_version: 1 as const, customer_name: "Selected quote signer", customer_phone: "0000000001", customer_address: "Selected address",
  site_address: "Selected construction site", salesperson: "Synthetic proposer", manager: "", work_type: "รับสร้างบ้าน" as const, document_date: "2026-11-09", footnote: "" };
const quote = { id: id(5), kind: "quotation", state: "accepted", number: "TEST-Q1", revision: 1, version: 1, evidence_path: null,
  payload: { total_cents: "96000000", price_set: true, paper, house: { model: "Test house", stories: "1", bedrooms: "2", kitchens: "1", bathrooms: "1", usable_area: "53" } } };
const agreement = { is_settled: false, documents: [quote], instalments: [] };
const markup = renderToStaticMarkup(createElement(ContractWizard, { sale, agreement, action: async () => ({ error: "" }), contractText: "READONLY STANDARD CLAUSE <script>" }));
assert.equal((markup.match(/<form/g) ?? []).length, 1);
assert.equal((markup.match(/<h1/g) ?? []).length, 1, "Contract owns one task heading");
assert.ok(markup.includes("ฉบับใหม่ · ยังไม่บันทึก"));
assert.ok(markup.includes("กลับรายการสัญญา"));
const missingQuote = renderToStaticMarkup(createElement(ContractWizard, { sale,
  agreement: { ...agreement, documents: [] }, action: async () => ({ error: "" }) }));
assert.ok(missingQuote.includes("กลับรายการสัญญา") && missingQuote.includes("<h1"), "Missing quote still has task context and a return path");
assert.equal((markup.match(/<article/g) ?? []).length, 3);
for (const value of ["Selected quote signer", "Selected construction site", "READONLY STANDARD CLAUSE &lt;script&gt;", "96", "ข้อสัญญาเพิ่มเติม", "Selected address", "ระยะเวลาก่อสร้าง", "ดูตัวอย่างสัญญา"]) assert.ok(markup.includes(value), value);
assert.ok(!markup.includes('value="Case original"'));
assert.doesNotMatch(markup, /(?:input|textarea)[^>]*name="(?:total_cents|contract_text)"/);
assert.equal((markup.match(/สัดส่วนงวด /g) ?? []).length, 6, "Default instalments remain editable on sheet");
assert.ok(markup.includes("ชำระภายใน 30 วันปฏิทินหลังวันที่ตรวจรับงานจริง"));
assert.ok(markup.includes("รอตรวจต้นฉบับ"), "Photo fragments remain visibly unapproved drafts");
const customer = { full_name: "Saved signer", phone: "0000000002", site_address: "Saved site" };
const schedule = [{ label: "Deposit", basis_points: 1000, progress_percent: null, work_description: "" }, { label: "Final", basis_points: 9000, progress_percent: 100, work_description: "Test work" }];
const input = { customer, start_date: "2026-11-09", schedule, additional_terms: "  Additional only  " };
assert.equal(schema.contractInputSchema.parse(input).additional_terms, "Additional only");
assert.equal(schema.contractInputSchema.safeParse({ ...input, additional_terms: "x".repeat(10001) }).success, false);
assert.equal(schema.contractInputSchema.safeParse({ ...input, contract_text: "Injected" }).success, false);
const draft = { id: id(6), kind: "contract", state: "draft", number: null, revision: 1, version: 1, parent_id: quote.id, evidence_path: null,
  payload: { ...quote.payload, customer, start_date: input.start_date, additional_terms: "Saved extra", contract_text: "SAVED STANDARD", schedule_input: schedule } };
const saved = renderToStaticMarkup(createElement(ContractWizard, { sale, agreement: { ...agreement, documents: [quote, draft] }, draftId: draft.id,
  action: async () => ({ error: "" }), contractText: "NEW COMPANY TEXT" }));
assert.ok(saved.includes('value="Saved signer"') && saved.includes("Saved extra") && saved.includes("NEW COMPANY TEXT"));
assert.ok(saved.includes("ร่างที่บันทึกไว้"));
assert.ok(!saved.includes("ยังไม่ได้บันทึกการแก้ไข"));
assert.ok(!saved.includes("SAVED STANDARD"), "Editable draft refreshes company wording, historical print remains snapshotted");
assert.ok(!saved.includes("ชำระภายใน 30 วันปฏิทินหลังวันที่ตรวจรับงานจริง"), "Existing drafts do not silently acquire the new payment term");
const preview = renderToStaticMarkup(createElement(agreementContent.AgreementContent, { payload: { ...draft.payload,
  schedule: schedule.map((row, index) => ({ ...row, position: index, needs_acceptance: index > 0, gross_cents: "48000000", credit_cents: "0", net_cents: "48000000" })) } }));
assert.equal((preview.match(/<article/g) ?? []).length, 4);
assert.ok(preview.includes("Saved extra") && !preview.includes("<input") && !preview.includes("<textarea"));
const newPaper = { ...contractPaper.emptyContractPaper, signing_date: "2026-11-09", duration_days: "3",
  contractor_representative: "Test representative", extra_clauses: ["Extra <script>"], witness_1: "First witness", witness_2: "Second witness" };
assert.equal(contractPaper.contractEndDate("2026-11-09", "1"), "2026-11-09");
assert.equal(contractPaper.contractEndDate("2028-02-28", "3"), "2028-03-01");
assert.equal(contractPaper.contractEndDate("2026-11-09", "0"), "");
assert.ok(contractPaper.contractPaperMissing(newPaper).includes("ที่อยู่ผู้ว่าจ้าง"));
assert.ok(schema.contractInputSchema.safeParse({ ...input, start_date: "", contract_paper: newPaper }).success);
assert.equal(schema.contractInputSchema.safeParse({ ...input, start_date: "" }).success, false);
assert.equal(contractPaper.contractPaperSchema.safeParse({ ...newPaper, employer_national_id: "12" }).success, false);
assert.equal(contractPaper.contractAddendumSchema.safeParse({ date: "2026-11-09", extra_clauses: [], conditions: " ", notes: "" }).success, false);
const rows = schedule.map((row, position) => ({ ...row, position, needs_acceptance: position > 0, gross_cents: "48000000", credit_cents: "0", net_cents: "48000000" }));
const photo = (contract_paper: typeof newPaper) => renderToStaticMarkup(createElement(agreementContent.AgreementContent, {
  payload: { ...draft.payload, contract_paper, schedule: rows }, number: "BKP-C-TEST",
}));
const three = photo(newPaper);
const noticed = renderToStaticMarkup(createElement(photoContent.PhotoContractContent, {
  payload: { ...draft.payload, contract_paper: newPaper, schedule: rows }, notice: "SYNTHETIC STATUS NOTICE",
}));
assert.equal((noticed.match(/SYNTHETIC STATUS NOTICE/g) ?? []).length, 3, "Document state remains visible on every standalone contract sheet");
assert.equal((three.match(/<article/g) ?? []).length, 3);
for (const text of ["รอตรวจข้อความบริษัท", "BKP-C-TEST", "First witness", "Second witness", "Extra &lt;script&gt;", "วันที่ชำระ", "สัดส่วนค่าจ้าง (% เงิน)", "% งาน"]) assert.ok(three.includes(text), text);
assert.equal((three.match(/aria-label="เว้นไว้เขียนบนกระดาษ"><\/td>/g) ?? []).length, 2);
const table = three.split("<table")[1].split("</table>")[0];
assert.equal((table.match(/scope="col"/g) ?? []).length, 5, "Schedule matches the five-column photo");
assert.ok(three.indexOf("หักเครดิตค่าออกแบบที่รับชำระแล้ว") > three.indexOf("</table>"), "Credit remains distinct beneath the gross schedule");
assert.ok(three.includes("ยอดชำระเพิ่มรวม 960,000.00 บาท"));
assert.ok(three.indexOf("ข้อ 1.") < three.indexOf("ข้อ 2."));
assert.ok(three.indexOf("SAVED STANDARD") > three.indexOf('aria-label="สัญญา หน้า 2"'), "Standard text is retained on the continuation section");
assert.equal((three.match(/ลงชื่อ ____________________/g) ?? []).length, 8, "Four blank signatures on contract and schedule");
const termPreview = photo({ ...newPaper, payment_due_days: 30 });
assert.match(termPreview, /30 วันปฏิทินนับจากวันที่ตรวจรับงานจริง/);
assert.doesNotMatch(three, /30 วันปฏิทิน/);
const four = photo({ ...newPaper, conditions: "Conditions only on annex", notes: "Separate note" });
assert.equal((four.match(/<article/g) ?? []).length, 4);
assert.match(four.split('aria-label="สัญญา หน้า 4"')[1], /Conditions only on annex.*Separate note/);
const addendum = renderToStaticMarkup(createElement(agreementContent.AgreementContent, { payload: { ...draft.payload, contract_number: "BKP-C-TEST",
  text_addendum: { date: "2026-11-09", extra_clauses: ["Text only"], conditions: "", notes: "Test note" } } }));
assert.match(addendum, /BKP-C-TEST.*Text only.*Test note/);
assert.doesNotMatch(addendum, /<table|<input/);
for (const [cents, text] of [["0", "ศูนย์บาทถ้วน"], ["100", "หนึ่งบาทถ้วน"], ["1100", "สิบเอ็ดบาทถ้วน"],
  ["10100", "หนึ่งร้อยเอ็ดบาทถ้วน"], ["230000000", "สองล้านสามแสนบาทถ้วน"], ["100000100", "หนึ่งล้านเอ็ดบาทถ้วน"],
  ["200000001", "สองล้านบาทหนึ่งสตางค์"], ["21", "ยี่สิบเอ็ดสตางค์"], ["10050", "หนึ่งร้อยบาทห้าสิบสตางค์"]]) {
  assert.equal(moneyText.contractMoneyText(cents), text);
}
const finance = financialSchema.parse({ case_id: sale.id, version: 1, issuer_ready: true, can_change_design: true, design_plan: null, pending: [], payments: [], documents: [] });
assert.equal(bkpWorkflow(finance, { ...agreement, documents: [] }).selected, "design");
assert.equal(bkpWorkflow(finance, agreement).selected, "contract", "Accepted quote advances even without design collection");
assert.equal(bkpWorkflow(finance, agreement).done.fees, false);
assert.equal(bkpWorkflow(finance, agreement, "fees").selected, "fees", "User can inspect unpaid earlier stages");
assert.equal(bkpWorkflow(finance, agreement, "unknown").selected, "contract");
console.log("PASS: photo contract drafts, optional appendix, four signatures, blank payment dates, addendum and legacy rendering");
