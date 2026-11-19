import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { ActionState } from "@/app/walkin/action-form";

const require = createRequire(import.meta.url);
function load(relative: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const states: unknown[] = [];
let cursor = 0;
let currentAction: (state: ActionState, data: FormData) => Promise<ActionState> = async () => ({ error: "unbound" });
const receiptPaper = load("../../documents/[id]/receipt-paper.tsx", {
  "@/lib/sales/money": load("../../../../lib/sales/money.ts"),
  "@/lib/sales/date": load("../../../../lib/sales/date.ts"),
  "./contract-money-text": load("../../documents/[id]/contract-money-text.ts"),
  "./receipt-paper.module.css": { default: {} },
}) as typeof import("../../documents/[id]/receipt-paper");
const paper = load("./payment-paper.tsx", {
  react: { ...require("react"), useState: (initial: unknown) => {
    const index = cursor++;
    if (states[index] === undefined) states[index] = typeof initial === "function" ? initial() : initial;
    return [states[index], (value: unknown) => { states[index] = value; }];
  }, useRef: () => ({ current: null }), useEffect: () => {} },
  "next/image": { default: (props: Record<string, unknown>) => createElement("img", props) },
  "@/app/walkin/action-form": { ActionForm: ({ action, children, label }: { action: typeof currentAction; children: string; label: string }) => {
    currentAction = action;
    return createElement("form", null, children, createElement("button", { type: "submit" }, label));
  } },
  "@/lib/sales/money": load("../../../../lib/sales/money.ts"),
  "@/lib/sales/date": load("../../../../lib/sales/date.ts"),
  "@/lib/sales/financial-models": { paymentMethods: { cash: "เงินสด", transfer: "โอนเงิน", cheque: "เช็คที่เรียกเก็บแล้ว" } },
  "../../evidence-upload": { EvidenceUpload: () => createElement("input", { type: "hidden", name: "proof_path", value: "test-proof" }) },
  "../../documents/[id]/receipt-paper": receiptPaper,
  "../../sales.module.css": { default: {} }, "./payment-paper.module.css": { default: {} },
}) as typeof import("./payment-paper");
let writes = 0;
const base = { caseId: "case", customerName: "Synthetic customer", customerAddress: "Synthetic address", label: "Design fee instalment", amountCents: "350000",
  finalLabel: "FINAL MUTATION", action: async () => { writes++; return { error: "server rejection retains form" }; } };
const render = (props: Parameters<typeof paper.PaymentPaper>[0]) => { cursor = 0; return renderToStaticMarkup(createElement(paper.PaymentPaper, props)); };
const invoiceProps = { ...base, mode: "invoice" as const, hiddenFields: { position: "1" } };
const invoice = render(invoiceProps);
assert.equal((invoice.match(/<form/g) ?? []).length, 1);
assert.match(invoice, /<input(?=[^>]*name="due_date")(?=[^>]*required="")(?=[^>]*value="")[^>]*>/);
assert.ok(invoice.includes("แก้ไขใบแจ้งชำระบนเอกสาร") && invoice.includes("3,500.00"));
assert.ok(!invoice.includes("FINAL MUTATION"), "Initial submit is preview, not issue");
assert.ok((await currentAction({ error: "" }, new FormData())).error, "Blank due date cannot enter review");
assert.equal(writes, 0);
const dated = new FormData(); dated.set("due_date", "2026-12-01");
await currentAction({ error: "" }, dated);
assert.equal(states[1], "2026-12-01", "Preview uses the submitted date even when native input state lags");
assert.equal(writes, 0, "Preview does not invoke server action");
const invoiceReview = render(invoiceProps);
assert.ok(invoiceReview.includes("ตัวอย่างใบแจ้งชำระ") && invoiceReview.includes("FINAL MUTATION"));
assert.match(invoiceReview, /name="confirmed"/);
assert.doesNotMatch(invoiceReview, /name="amount"/);
assert.ok(invoiceReview.includes('name="position" value="1"'));
await currentAction({ error: "" }, new FormData());
assert.equal(writes, 1, "Final review submit uses existing server action");
states.length = 0;
const receiptProps = { ...base, mode: "receipt" as const };
const receipt = render(receiptProps);
assert.ok(receipt.includes("เตรียมใบเสร็จบนเอกสาร") && receipt.includes("แก้ยอดไม่ได้"));
assert.doesNotMatch(receipt, /name="amount(?:_cents)?"/);
assert.ok(receipt.includes('name="proof_path"'));
states[2] = "transfer";
render(receiptProps);
const noProof = new FormData(); noProof.set("paid_date", String(states[1]));
assert.match((await currentAction({ error: "" }, noProof)).error, /แนบหลักฐาน/, "Transfer needs evidence before preview");
const proof = new FormData(); proof.set("proof_path", "synthetic-proof"); proof.set("paid_date", String(states[1]));
await currentAction({ error: "" }, proof);
assert.equal(writes, 1);
const receiptReview = render(receiptProps);
assert.ok(receiptReview.includes("ตัวอย่างใบเสร็จ · ยังไม่ออกเลข · ยังไม่ยืนยันรับเงินจริง"));
assert.ok(receiptReview.includes('name="proof_path"'), "Upload stays mounted through review");
assert.ok(receiptReview.includes('name="method" value="transfer"'));
assert.doesNotMatch(receiptReview, /name="funds_confirmed"/, "Preparation never confirms money");
states.length = 0;
const normalReceipt = render({ ...receiptProps, brand: "TARAVILLE", amountEditable: true, kindOptions: [{ value: "unallocated", label: "เงินเข้า" }] });
assert.ok(normalReceipt.includes('name="amount"') && normalReceipt.includes('name="kind"'));
assert.ok(!normalReceipt.includes("baan-kunapap-logo"), "Taraville never uses BKP logo");
const preview = renderToStaticMarkup(createElement(paper.PaymentPaperPreview, { ...receiptProps, date: "2026-11-09", payerName: "<script>", method: "cash" }));
assert.ok(preview.includes("&lt;script&gt;") && preview.includes("2569"));
assert.ok(!preview.includes("<input") && !preview.includes("<form"));
const issuedReceipt = renderToStaticMarkup(createElement(receiptPaper.ReceiptPaper, {
  issuer: { legal_name: "Synthetic issuer", address: "Synthetic office", contact: "", tax_id: "0000000000000" },
  customer: { full_name: "<script>", salesperson: "Synthetic salesperson" }, number: "TEST-R1", date: "2026-11-09", paidDate: "2026-11-08",
  receiverName: "Synthetic receiver", method: "transfer", label: "ค่าออกแบบ", description: "งวดที่ 1", amountCents: "1000001", isInstalment: true,
  notice: "ยกเลิกเอกสาร", replacement: "ออกแทนใบเสร็จเลขที่ TEST-R0",
}));
assert.match(issuedReceipt, /data-issued="true"/);
assert.match(issuedReceipt, /TEST-R1/);
assert.match(issuedReceipt, /รับเงินจริง 8\/11\/2569/);
assert.match(issuedReceipt, /data-checked="true"[^>]*><span[^>]*>✓<\/span>โอน/);
assert.match(issuedReceipt, /หนึ่งหมื่นบาทหนึ่งสตางค์/);
assert.match(issuedReceipt, /<td>1\.00<\/td><td>งวด<\/td><td>10,000\.01/);
assert.match(issuedReceipt, /ยกเลิกเอกสาร/);
assert.match(issuedReceipt, /TEST-R0/);
assert.match(issuedReceipt, /&lt;script&gt;/);
assert.match(issuedReceipt, /ผู้อนุมัติ.*ผู้รับเงิน.*Synthetic receiver/);
const issuedInvoice = renderToStaticMarkup(createElement(receiptPaper.ReceiptPaper, {
  customer: { full_name: "Synthetic customer" }, number: "TEST-I1", date: "2026-11-09", label: "งานก่อสร้าง", amountCents: "750000",
  invoice: { dueDate: "2026-12-09", grossCents: "1000000", creditCents: "250000", acceptanceDate: "2026-11-09" },
}, createElement("p", null, "ยอดสุทธิหลังปรับ")));
assert.match(issuedInvoice, /วันครบกำหนด<\/dt><dd><strong>9\/12\/2569/);
assert.match(issuedInvoice, /หักเครดิตจากเงินที่รับไว้<\/td><td>2,500\.00/);
assert.match(issuedInvoice, /ยอดต้องชำระตามเอกสาร<\/span><strong>7,500\.00 บาท/);
assert.match(issuedInvoice, /เจ็ดพันห้าร้อยบาทถ้วน/);
assert.match(issuedInvoice, /ยอดสุทธิหลังปรับ/);
assert.doesNotMatch(issuedInvoice, /ผู้รับเงิน|วิธีชำระ/);
console.log("PASS: inline payment papers, local review before mutation, exact fixed design amount, proof retention and brand-safe readonly preview");

states.length = 0;
const acceptanceInvoice = { ...invoiceProps, fixedDueDate: "2026-12-01", acceptanceDate: "2026-11-01" };
const fixed = render(acceptanceInvoice);
assert.match(fixed, /<input(?=[^>]*name="due_date")(?=[^>]*readOnly="")(?=[^>]*value="2026-12-01")[^>]*>/);
assert.match(fixed, /วันที่ตรวจรับจริง/);
const wrongDate = new FormData(); wrongDate.set("due_date", "2026-12-02");
assert.match((await currentAction({ error: "" }, wrongDate)).error, /วันที่ตรวจรับจริงบวก 30 วัน/);
const actualDue = new FormData(); actualDue.set("due_date", "2026-12-01");
await currentAction({ error: "" }, actualDue);
const fixedReview = render(acceptanceInvoice);
assert.match(fixedReview, /วันที่ตรวจรับจริง · ชำระภายใน 30 วัน/);
assert.match(fixedReview, /name="due_date" value="2026-12-01"/);

const { AcceptanceForm } = load("../acceptance-form.tsx", {
  "@/app/walkin/action-form": { ActionForm: ({ children }: { children: string }) => createElement("form", null, children) },
  "../agreement-actions": { recordAcceptance: () => {} }, "../evidence-upload": { EvidenceUpload: () => null }, "../sales.module.css": { default: {} },
}) as typeof import("../acceptance-form");
const acceptanceProps = { caseId: "case", identity: { id: "row", version: 1, requestId: "request" } };
const datedAcceptance = renderToStaticMarkup(createElement(AcceptanceForm, { ...acceptanceProps, requiresDate: true }));
assert.match(datedAcceptance, /<input(?=[^>]*name="acceptance_date")(?=[^>]*required="")[^>]*>/);
assert.match(datedAcceptance, /max="\d{4}-\d{2}-\d{2}"/);
assert.doesNotMatch(renderToStaticMarkup(createElement(AcceptanceForm, acceptanceProps)), /name="acceptance_date"/);
console.log("PASS: actual acceptance date entry, readonly derived invoice date and unchanged legacy date flow");
