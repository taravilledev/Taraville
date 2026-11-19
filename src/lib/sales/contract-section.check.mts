import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { SummaryData } from "../../app/sales/[id]/summary-sections";
import type { AgreementDetail } from "./agreement-models";
import type { Task, TaskName } from "./tasks";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const css = { default: new Proxy({}, { get: (_target, key) => String(key) }) };
const link = { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as ReactNode); } };
const heading = load("../../app/sales/[id]/workspace-heading.tsx", { "next/link": link, "./workspace-section.module.css": css });
const { ContractSection } = load("../../app/sales/[id]/contract-section.tsx", {
  "next/link": link, "@/lib/sales/money": load("./money.ts"), "@/lib/sales/tasks": load("./tasks.ts"),
  "@/lib/sales/bkp-workflow": load("./bkp-workflow.ts"), "./workspace-heading": heading,
  "../sales.module.css": css, "./workspace-section.module.css": css,
}) as typeof import("../../app/sales/[id]/contract-section");
type Document = AgreementDetail["documents"][number];
const id = (value: number) => `00000000-0000-4000-a000-${String(value).padStart(12, "0")}`;
const document = (value: number, kind: string, state: string, payload: Document["payload"] = {}, revision = 1): Document => ({
  id: id(value), kind, state, payload, revision, version: 1, number: `TEST-${value}`, evidence_path: null,
});
const task = (name: TaskName, row?: string): Task => ({ name, row, label: name, group: "main" });
const data: SummaryData = {
  sale: { id: id(1), code: "BKP-TEST", brand: "BAAN_KUNAPAP", lead_id: id(2), responsible_id: id(3), status: "draft",
    version: 1, customer_name: "Synthetic customer", can_finance: true, project_id: null, unit_id: null, customer_id: id(4),
    responsible_name: "Synthetic owner", lead_owner_name: "Synthetic owner", can_edit: true, can_assign: false, permissions: {} },
  finance: { case_id: id(1), version: 1, issuer_ready: true, can_change_design: false, design_plan: null, design_bills: [],
    design_legacy_received_cents: "0", design_legacy_has_payments: false, pending: [], payments: [], documents: [] },
  agreement: { is_settled: false, documents: [], instalments: [] }, tasks: [], work: [], refunds: [], closeout: null,
};
const render = (documents: Document[], tasks: Task[] = [], cancelled = false) => renderToStaticMarkup(createElement(ContractSection,
  { data: { ...data, sale: { ...data.sale, status: cancelled ? "cancelled" : "draft" }, agreement: { is_settled: false, documents, instalments: [] }, tasks } }));
const quote = document(10, "quotation", "accepted", { price_set: true, total_cents: "120000000" });
const draft = { ...document(20, "contract", "draft", { total_cents: "120000000", credit_cents: "1200000", schedule_input: [
  { label: "วันเซ็น", basis_points: 1000, progress_percent: null, work_description: "" },
  { label: "งวดสุดท้าย", basis_points: 9000, progress_percent: 100, work_description: "" },
] }), parent_id: quote.id, number: null };
assert.match(render([]), /ต้องมีใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับ/);
assert.doesNotMatch(render([]), /task=prepare-contract/);
assert.match(render([quote], [task("prepare-contract")]), /task=prepare-contract/);
const acceptedOptions = render([quote, document(11, "quotation", "accepted", { price_set: true, total_cents: "150000000" })]);
for (const text of ["TEST-10", "TEST-11", "1,200,000.00 บาท", "1,500,000.00 บาท", "เลือกฉบับอ้างอิงอีกครั้ง"]) assert.ok(acceptedOptions.includes(text), text);
assert.match(render([quote]), /รอผู้มีสิทธิ์จัดทำร่างสัญญา/);
const draftHtml = render([quote, draft], [task("edit-contract", draft.id), task("lock-contract", draft.id)]);
assert.match(draftHtml, /class="primary"[^>]*>แก้ไข \/ ตรวจร่าง<\/a>/);
assert.match(draftHtml, /class="link"[^>]*>ตรวจความพร้อมก่อนออกเลข<\/a>/);
for (const value of ["1,200,000.00 บาท", "12,000.00 บาท", "2 งวด", "TEST-10", "ยังไม่แปลว่าข้อมูลครบ"]) assert.ok(draftHtml.includes(value), value);
assert.doesNotMatch(draftHtml, /พร้อมล็อก|พร้อมออกเลข|task=sign-contract/);
assert.doesNotMatch(render([quote, draft]), /task=edit-contract|task=lock-contract/);
const missing = render([quote, { ...draft, payload: {} }]);
assert.ok(!missing.includes("1,200,000.00"), "Missing contract value never falls back to quote value");
assert.ok((missing.match(/ยังไม่ระบุ/g) ?? []).length >= 3);
const awaiting = { ...draft, state: "awaiting_signature", number: "CONTRACT-READY-FOR-SIGNATURE" };
const awaitingHtml = render([quote, awaiting], [task("sign-contract", awaiting.id), task("unlock-contract", awaiting.id)]);
assert.match(awaitingHtml, /class="primary"[^>]*>บันทึกลงนามสัญญา<\/a>/);
assert.match(awaitingHtml, /เก็บเลขฉบับนี้เป็นเอกสารยกเลิก/);
assert.doesNotMatch(awaitingHtml, /task=lock-contract|task=edit-contract/);
const signed = { ...awaiting, state: "signed" };
const cancelled = document(30, "contract", "cancelled", {}, 99);
const signedBeforeDraft = render([quote, signed, { ...draft, id: id(21), revision: 2 }, cancelled]);
assert.ok(signedBeforeDraft.indexOf(signed.number) < signedBeforeDraft.indexOf("<details"), "An older signed contract remains visible outside collapsed history even without tasks");
assert.match(signedBeforeDraft, /สัญญาที่ออกเลขแล้วซึ่งยังไม่ยกเลิก/);
const awaitingBeforeDraft = render([quote, awaiting, { ...draft, id: id(21), revision: 2 }], [task("sign-contract", awaiting.id)]);
assert.ok(!awaitingBeforeDraft.includes("<details"), "An awaiting-signature contract stays visible with its allowed action");
assert.ok(awaitingBeforeDraft.includes(`task=sign-contract&amp;row=${awaiting.id}`));
const signedHtml = render([quote, signed, cancelled], [task("contract-addendum", signed.id), task("edit-contract", cancelled.id)]);
assert.ok(signedHtml.indexOf(signed.number) < signedHtml.indexOf("TEST-30"), "Live contract stays featured ahead of a newer cancelled revision");
assert.match(signedHtml, /tab=money#schedule/);
assert.match(signedHtml, /task=contract-addendum/);
assert.match(signedHtml, /ยกเลิกแล้ว/);
assert.ok(!signedHtml.includes(`task=edit-contract&amp;row=${cancelled.id}`), "Cancelled history remains read-only");
const actionableHistory = render([quote, draft, { ...draft, id: id(21), revision: 2 }], [task("edit-contract", draft.id)]);
assert.match(actionableHistory, /<details class="history" open="">/);
assert.match(actionableHistory, /มีงานที่ทำได้ 1 รายการ/);
assert.ok(actionableHistory.includes(`task=edit-contract&amp;row=${draft.id}`));
const annex = document(40, "amendment", "issued", { contract_number: signed.number, text_addendum: { date: "2026-11-14", extra_clauses: ["Synthetic clause"], conditions: "", notes: "" } });
const annexHtml = render([quote, signed, annex]);
assert.match(annexHtml, /เอกสารแนบท้ายและข้อตกลงที่ใช้งาน \(1\)/);
assert.ok(!annexHtml.includes("<details"), "Active annex is visible without opening history");
const cancelledProject = render([cancelled], [], true);
assert.match(cancelledProject, /โครงการยกเลิกแล้ว/);
assert.doesNotMatch(cancelledProject, /task=prepare-contract|task=sign-contract|task=lock-contract/);
const cancelledSigned = render([quote, signed], [], true);
assert.match(cancelledSigned, /สัญญาอ้างอิงของโครงการยกเลิก/);
assert.match(cancelledSigned, /ดูยอดและประวัติรับเงิน/);
assert.doesNotMatch(cancelledSigned, /ติดตามตรวจรับงาน ออกบิล/);
console.log("PASS: contract states, truthful readiness, snapshot facts, active annex/history and permission-safe actions");
