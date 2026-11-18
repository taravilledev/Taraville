import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Task } from "./tasks";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const money = load("./money.ts"); const tasks = load("./tasks.ts");
const models = load("./models.ts");
const { financialSchema } = load("./financial-models.ts", { "./models": models }) as typeof import("./financial-models");
const paper = load("./contract-paper.ts");
const agreementInputs = load("./agreement-inputs.ts", { "./contract-paper": paper });
const { agreementSchema } = load("./agreement-models.ts", { "./contract-paper": paper, "./models": models, "./agreement-inputs": agreementInputs }) as typeof import("./agreement-models");
const { collectionRows, collectionSummary } = load("./finance-collection.ts", { "./tasks": tasks, "./money": money, "./date": load("./date.ts") }) as typeof import("./finance-collection");
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const finance = financialSchema.parse({ case_id: id(1), version: 1, issuer_ready: true, can_change_design: true,
  design_plan: { tier: "under150", usable_area: "53", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" },
  payments: [{ id: id(2), kind: "design_fee", amount_cents: "350000", method: "cash", paid_date: "2026-11-14", payer_name: "Synthetic", totals: { refunded_cents: "50000" } },
    { id: id(3), kind: "instalment", amount_cents: "200000", method: "cash", paid_date: "2026-11-14", payer_name: "Synthetic", totals: {} }],
  pending: [{ id: id(4), kind: "design_fee", amount_cents: "350000", method: "cash", paid_date: "2026-11-14", payer_name: "Synthetic", description: "Synthetic pending", proof_path: null },
    { id: id(5), kind: "instalment", amount_cents: "100000", method: "cash", paid_date: "2026-11-14", payer_name: "Synthetic", description: "Synthetic pending", proof_path: null }], documents: [] });
const row = { id: id(6), contract_id: id(7), position: 1, is_active: true, label: "Synthetic contract row", gross_cents: "1000000", credit_cents: "100000", net_cents: "900000",
  needs_acceptance: true, progress_percent: 20, accepted_at: null, acceptance_path: null, invoice_id: null, invoice_document_id: null, balance: null };
const agreement = agreementSchema.parse({ is_settled: false, documents: [], instalments: [row] });
const task = (name: Task["name"], row?: string): Task => ({ name, row, group: "main", label: name });
const available = [task("issue-design-invoice", "1"), task("issue-design-invoice", "2"), task("issue-design-invoice", "3"), task("acceptance", row.id)];
const totals = collectionSummary(finance, agreement, "500000");
assert.deepEqual({ ...totals }, { received: "500000", pending: "450000", isDesignIncluded: false, designRemaining: "900000", contractRemaining: "900000" }, "Global receipts used once, refunds reduce design subset only");
assert.equal(collectionSummary({ ...finance, design_legacy_received_cents: "123000" }, agreement, "500000").designRemaining, "900000", "Legacy subset is not added/subtracted again");
assert.equal(collectionSummary(finance, agreement, undefined).received, null);
assert.equal(collectionSummary({ ...finance, design_plan: null }, { ...agreement, instalments: [] }, "0").contractRemaining, null);
assert.equal(collectionSummary({ ...finance, design_plan: null }, agreement, "0").designRemaining, null);
assert.equal(collectionSummary(finance, agreement, "500000", "12300").contractRemaining, "12300", "Closeout remaining overrides scheduled balances");
const closedFinance = { ...finance, payments: [], pending: [] };
const closedSummary = collectionSummary(closedFinance, agreement, "0", "0", true);
assert.equal(closedSummary.designRemaining, null, "Old design price is not a current receivable after closeout");
assert.equal(closedSummary.contractRemaining, "0", "Closed current receivable comes only from closeout");
assert.equal(collectionSummary(closedFinance, agreement, "0", undefined, true).contractRemaining, null, "Missing closeout never falls back to old rows");
let rows = collectionRows(id(1), finance, agreement, available);
assert.equal(rows.length, 4);
assert.equal(rows[0].primaryAction?.label, "ออกใบแจ้งชำระ");
assert.equal(rows[3].filter, "acceptance");
assert.match(rows[3].primaryAction?.href ?? "", /task=acceptance/);
assert.equal(rows[3].status, "รอตรวจรับงาน");
assert.ok(!rows[3].status.includes("รอยืนยัน"), "Unbound contract pending must not change the contract row status");
assert.ok(collectionRows(id(1), finance, agreement, []).every(row => !row.primaryAction));
const bill = { id: id(8), position: 1, label: "Synthetic bill", amount_cents: "350000", due_date: "2026-12-14", document_id: id(9), state: "issued" as const,
  pending_id: id(4), receipt_document_id: null, received_cents: "0", pending_cents: "350000", has_confirmed_payment: false };
const signed = { ...agreement, documents: [{ id: row.contract_id, kind: "contract", state: "signed", number: "TEST-C1", revision: 1, version: 1, evidence_path: null, payload: {} }] };
assert.deepEqual({ ...collectionSummary(finance, signed, "500000") }, { ...totals, isDesignIncluded: true, designRemaining: null });
const includedRows = collectionRows(id(1), { ...finance, design_bills: [bill] }, signed, available);
assert.equal(includedRows[0].primaryAction?.href, "#pending", "Existing money remains visible for review");
assert.match(includedRows[0].links[0].href, /sales\/documents/);
assert.ok(includedRows.slice(1, 3).every(item => item.isReference && item.status === "รวมในราคาสัญญาแล้ว" &&
  item.filter === null && item.outstandingCents === null && !item.primaryAction));
assert.equal(includedRows[3].filter, "acceptance");
const includedUnpaid = collectionRows(id(1), { ...finance, design_bills: [{ ...bill, pending_id: null }] }, signed,
  [...available, task("prepare-design-payment", bill.id), task("cancel-design-invoice", bill.id)])[0];
assert.equal(includedUnpaid.status, "รวมในราคาสัญญาแล้ว");
assert.equal(includedUnpaid.primaryAction, undefined);
assert.deepEqual(Array.from(includedUnpaid.links, link => link.label), ["ดูบิล"]);
assert.equal(collectionSummary(finance, signed, "500000", "100", true).contractRemaining, "100");
const awaitingSignature = { ...signed, documents: signed.documents.map(doc => ({ ...doc, state: "awaiting_signature" })) };
assert.equal(collectionSummary(finance, awaitingSignature, "500000").designRemaining, "900000");
const separateContract = { ...signed, documents: signed.documents.map(doc => ({ ...doc, payload: { design_fee_separate: true } })) };
const separateRows = collectionRows(id(1), finance, separateContract, available);
assert.equal(separateRows[0].filter, "ready");
assert.ok(separateRows[0].primaryAction?.href.includes("task=issue-design-invoice"));
assert.equal(collectionSummary(finance, separateContract, "500000").designRemaining, "900000");
assert.equal(collectionSummary(finance, separateContract, "500000").contractRemaining, "900000");
const closedTasks = [task("prepare-design-payment", bill.id), task("acceptance", row.id)];
const closedRows = collectionRows(id(1), { ...closedFinance, design_bills: [{ ...bill, pending_id: null }] }, agreement, closedTasks, true);
assert.ok(closedRows.every(row => row.isReference && row.outstandingCents === null && row.status === "อ้างอิงก่อนปิดงาน" && row.filter === null));
assert.match(closedRows[0].links[0].href, /sales\/documents/);
assert.match(closedRows[0].primaryAction?.href ?? "", /task=prepare-design-payment/, "Existing registry actions remain authoritative on closed projects");
assert.match(closedRows[3].primaryAction?.href ?? "", /task=acceptance/);
rows = collectionRows(id(1), { ...finance, design_bills: [bill] }, agreement, available);
assert.equal(rows[0].primaryAction?.href, "#pending");
assert.equal(rows[0].status, "รอยืนยันรับเงิน");
assert.equal(rows[0].dueDate, "2026-12-14");
const cancelled = collectionRows(id(1), { ...finance, design_bills: [{ ...bill, state: "cancelled", pending_id: null }] }, agreement, [task("prepare-design-payment", bill.id)]);
assert.equal(cancelled[0].primaryAction, undefined);
assert.equal(cancelled[0].history[0].cancelled, true);
assert.equal(cancelled[0].dueDate, null);
const legacy = collectionRows(id(1), { ...finance, design_legacy_has_payments: true, design_bills: [{ ...bill, pending_id: null }] }, agreement, [task("prepare-design-payment", bill.id), ...available]);
assert.equal(legacy[0].outstandingCents, null);
assert.equal(legacy[0].primaryAction, undefined);
assert.equal(legacy[1].primaryAction, undefined);
const legacyBoundPaid = collectionRows(id(1), { ...finance, design_legacy_has_payments: true,
  design_bills: [{ ...bill, pending_id: null, received_cents: "350000", has_confirmed_payment: true }] }, agreement, available);
assert.equal(legacyBoundPaid[0].outstandingCents, "0", "An exactly bound paid bill stays complete even alongside other legacy money");
const closedPaid = collectionRows(id(1), { ...finance, design_bills: [{ ...bill, pending_id: null, received_cents: "350000", has_confirmed_payment: true }] }, agreement, [], true);
assert.equal(closedPaid[0].status, "รับครบแล้ว"); assert.equal(closedPaid[0].filter, "complete");
const adjusted = collectionRows(id(1), { ...finance, design_bills: [{ ...bill, pending_id: null, has_confirmed_payment: true, received_cents: "10000" }] }, agreement, [task("prepare-design-payment", bill.id)]);
assert.equal(adjusted[0].status, "มีการปรับยอด");
assert.equal(adjusted[0].primaryAction, undefined);
assert.equal(adjusted[0].links.at(-1)?.href, "#receipts");
const zeroDesign = collectionRows(id(1), { ...finance, design_plan: { ...finance.design_plan!, instalments: ["0", "350000", "500000"] } }, agreement, available);
assert.equal(zeroDesign[0].filter, "complete"); assert.equal(zeroDesign[0].primaryAction, undefined);
const accepted = { ...agreement.instalments[0], accepted_at: "2026-11-14T00:00:00Z", acceptance_date: "2026-11-14", due_date: "2026-12-14" };
const credit = { ...accepted, net_cents: "0", balance: { outstanding_cents: "0", allocated_cents: "0", net_cents: "0", is_active: true } };
let credited = collectionRows(id(1), finance, { ...agreement, instalments: [credit] }, [task("issue-invoice", row.id)]).at(-1)!;
assert.equal(credited.status, "รอบันทึกสรุปเครดิต"); assert.equal(credited.primaryAction?.label, "บันทึกสรุปเครดิตงวดนี้");
assert.equal(credited.filter, "ready");
credited = collectionRows(id(1), finance, { ...agreement, instalments: [{ ...credit, invoice_id: id(10) }] }, [task("prepare-instalment", row.id)]).at(-1)!;
assert.equal(credited.filter, "complete"); assert.equal(credited.primaryAction, undefined, "Zero cash amount cannot offer collection");
const closedCredit = collectionRows(id(1), finance, { ...agreement, instalments: [{ ...credit, invoice_id: id(10) }] }, [], true).at(-1)!;
assert.equal(closedCredit.status, "ครบยอดแล้ว"); assert.equal(closedCredit.filter, "complete");
const invoiced = { ...accepted, invoice_id: id(10), invoice_document_id: id(11), balance: { outstanding_cents: "700000", allocated_cents: "200000", net_cents: "900000", is_active: true } };
assert.equal(collectionSummary(finance, { ...agreement, instalments: [invoiced] }, "500000").contractRemaining, "700000");
assert.equal(collectionSummary(finance, { ...agreement, instalments: [{ ...invoiced, balance: { ...invoiced.balance, is_active: false, outstanding_cents: "0" } }] }, "500000").contractRemaining, "900000");
rows = collectionRows(id(1), finance, { ...agreement, instalments: [invoiced] }, [task("prepare-instalment", row.id)]);
assert.equal(rows.at(-1)?.filter, "payment"); assert.equal(rows.at(-1)?.outstandingCents, "700000");
assert.equal(rows.at(-1)?.primaryAction?.label, "บันทึกเงินเข้างวดนี้");
assert.equal(rows.at(-1)?.acceptanceDate, "2026-11-14");
assert.equal(rows.at(-1)?.dueDate, "2026-12-14");
let selected = "all";
const css = { default: {} };
const { FinanceCollection } = load("../../app/sales/[id]/finance-collection.tsx", {
  react: { ...require("react"), useState: () => [selected, () => {}] },
  "next/link": { default: ({ children, prefetch: _prefetch, ...props }: Record<string, unknown>) => { void _prefetch; return createElement("a", props, children as string); } },
  "@/lib/sales/money": money, "@/lib/sales/date": load("./date.ts"), "../sales.module.css": css, "./finance-collection.module.css": css,
}) as typeof import("../../app/sales/[id]/finance-collection");
const render = () => renderToStaticMarkup(createElement(FinanceCollection, { rows, caseId: id(1) }));
const closedEmpty = renderToStaticMarkup(createElement(FinanceCollection, { rows: [], caseId: id(1), isClosed: true }));
assert.match(closedEmpty, /ไม่มีรายการอ้างอิงในหมวดนี้/);
assert.doesNotMatch(closedEmpty, /ตารางงวดจะแสดงหลังลงนามสัญญา|ยังไม่มีแพ็กเกจค่าออกแบบ/);
const all = render();
const noActionRows = collectionRows(id(1), finance, agreement, []);
assert.match(renderToStaticMarkup(createElement(FinanceCollection, { rows: noActionRows, caseId: id(1) })), /ยังดำเนินการไม่ได้ตามสถานะหรือสิทธิ์/);
assert.equal((all.match(/<table/g) ?? []).length, 2, "Desktop grouped semantic tables");
assert.equal((all.match(/<caption/g) ?? []).length, 2);
assert.equal((all.match(/id="design-fees"/g) ?? []).length, 1); assert.equal((all.match(/id="schedule"/g) ?? []).length, 1);
assert.match(all, /กรองสถานะรายการชำระ/); assert.match(all, /aria-pressed="true"/);
selected = "acceptance";
const filtered = render();
assert.match(filtered, /แสดง 0 จาก 4 รายการ/);
assert.doesNotMatch(filtered, /Synthetic contract row|task=prepare-instalment|<table/);
assert.equal((filtered.match(/id="design-fees"/g) ?? []).length, 1); assert.equal((filtered.match(/id="schedule"/g) ?? []).length, 1);
selected = "payment";
assert.match(render(), /Synthetic contract row/);
assert.doesNotMatch(render(), /ส่งมอบแบบแปลน/);
assert.doesNotThrow(() => JSON.stringify(rows), "Client row model has no BigInt or function values");
const openRows = rows; rows = closedRows; selected = "all";
const closedMarkup = renderToStaticMarkup(createElement(FinanceCollection, { rows, caseId: id(1), isClosed: true }));
assert.match(closedMarkup, /ยอดเดิมก่อนปิดงาน/);
assert.match(closedMarkup, /ข้อมูลอ้างอิง ไม่ใช่ยอดเรียกเก็บปัจจุบัน/);
assert.doesNotMatch(closedMarkup, /คงเหลือ 3,500\.00 บาท/);
rows = openRows;
console.log("PASS: unified collection totals without double counting, legacy/zero/adjustment guards, exact row states, filters and stable anchors");
