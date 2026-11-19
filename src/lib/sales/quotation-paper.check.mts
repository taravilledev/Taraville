import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relative: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const { quotationInputSchema, quotationPaperSchema } = load("./agreement-inputs.ts", { "./contract-paper": load("./contract-paper.ts") }) as typeof import("./agreement-inputs");
const paper = { schema_version: 1, customer_name: "Synthetic customer", customer_phone: "0000000000", customer_address: "Customer address",
  site_address: "Different construction site", salesperson: "Synthetic salesperson", manager: "", work_type: "รับสร้างบ้าน", document_date: "2026-11-08", footnote: "Synthetic note" };
assert.equal(quotationPaperSchema.safeParse(paper).success, true);
for (const patch of [{ customer_name: " " }, { document_date: "2026-02-30" }, { work_type: "unknown" }, { manager: "x".repeat(201) }, { extra: "unexpected" }]) {
  assert.equal(quotationPaperSchema.safeParse({ ...paper, ...patch }).success, false);
}
const house = { model: "Synthetic model", stories: "1", bedrooms: "2", kitchens: "1", bathrooms: "1", usable_area: "85.5" };
const input = { house, total_cents: "12345", spec_rows: [], exclusions: [] };
assert.equal(quotationInputSchema.safeParse(input).success, true, "Old no-paper input remains valid");
assert.equal(quotationInputSchema.parse({ ...input, paper }).paper?.site_address, paper.site_address);
const money = load("./money.ts");
const { QuotationContent } = load("../../app/sales/documents/[id]/quotation-content.tsx", {
  "@/lib/sales/money": money, "./document.module.css": { default: {} },
}) as typeof import("../../app/sales/documents/[id]/quotation-content");
const payload = quotationInputSchema.parse({ ...input, paper, spec_rows: [{ item: "<script>", detail: "Synthetic scope", note: "" }], exclusions: ["Synthetic condition"] });
const html = renderToStaticMarkup(createElement(QuotationContent, { payload: { ...payload, total_cents: "12345" }, date: "2026-11-08" }));
for (const text of ["ประเภทงาน", "รับสร้างบ้าน", "แบบบ้าน", "123.45", "Synthetic salesperson", "ผู้จัดการ", "ผู้เสนอราคา", "Synthetic note", "Synthetic condition"]) assert.ok(html.includes(text), text);
assert.ok(html.includes("&lt;script&gt;"));
assert.ok(!html.includes("ผู้ว่าจ้าง"), "Quotation uses manager/proposer signatures, not contract signatures");
assert.ok(!html.includes("Synthetic manager"), "No invented manager default");
console.log("PASS: paper validation, legacy compatibility, quotation fields/signatures and escaped print content");

const css = { default: {} };
const content = { QuotationContent };
const pages = load("../../app/sales/documents/[id]/quotation-pages.tsx", {
  "next/image": { default: (props: Record<string, unknown>) => createElement("img", props) },
  "./quotation-content": content, "./document.module.css": css,
}) as typeof import("../../app/sales/documents/[id]/quotation-pages");
const sheet = load("../../app/sales/[id]/tasks/quotation-sheet.tsx", {
  "next/image": { default: (props: Record<string, unknown>) => createElement("img", props) },
  "../../documents/[id]/quotation-content": content, "../../documents/[id]/quotation-pages": pages,
  "../../documents/[id]/document.module.css": css, "./quotation-editor.module.css": css,
}) as typeof import("../../app/sales/[id]/tasks/quotation-sheet");
const fields = load("../../app/sales/[id]/tasks/quotation-paper-fields.tsx", { "./quotation-editor.module.css": css });
const { ActionForm } = load("../../app/walkin/action-form.tsx", {
  "@/components/form-feedback": load("../../components/form-feedback.ts"),
  "@/components/action-link-styles": load("../../components/action-link-styles.ts"),
}) as typeof import("../../app/walkin/action-form");
const reviewActionProps = { action: async () => ({ error: "" }), children: "Preview",
  label: "บันทึกเป็นฉบับใหม่", secondaryAction: { label: "กลับไปแก้บนเอกสาร", onClick: () => {} } };
const reviewActions = renderToStaticMarkup(createElement(ActionForm, reviewActionProps));
assert.match(reviewActions, /<div[^>]*><button[^>]*type="button"[^>]*>กลับไปแก้บนเอกสาร<\/button><button[^>]*type="submit"[^>]*>บันทึกเป็นฉบับใหม่<\/button><\/div>/,
  "Review navigation and submit share a footer, with submit last");
const lockActions = renderToStaticMarkup(createElement(ActionForm, { ...reviewActionProps, label: "ล็อกและออกเลขสัญญา",
  secondaryAction: { label: "กลับไปแก้ร่าง", href: "/sales/case?task=edit-contract&row=draft" } }));
assert.match(lockActions, /<div[^>]*><a[^>]*href="\/sales\/case\?task=edit-contract&amp;row=draft"[^>]*>กลับไปแก้ร่าง<\/a><button[^>]*type="submit"[^>]*>ล็อกและออกเลขสัญญา<\/button><\/div>/,
  "Draft navigation is a link in the same footer as the lock submit");
const button = load("../../components/ui/button.tsx", { "@/lib/utils": load("../utils.ts") });
const taskHeader = load("../../app/sales/[id]/tasks/task-header.tsx", {
  "./task-header.module.css": css, "@/components/ui/button": button,
});
const { QuotationEditor } = load("../../app/sales/[id]/tasks/quotation-editor.tsx", {
  "@/app/walkin/action-form": { ActionForm: () => null }, "@/lib/sales/money": money,
  "@/components/ui/button": button, "@/components/check-row": load("../../components/check-row.tsx"),
  "./task-header": taskHeader,
  "../../sales.module.css": css, "./quotation-editor.module.css": css,
  "@/lib/sales/agreement-inputs": { quotationPaperSchema }, "./quotation-paper-fields": fields, "./quotation-sheet": sheet,
}) as typeof import("../../app/sales/[id]/tasks/quotation-editor");
const sale = { id: "case", code: "BKP-TEST", brand: "BAAN_KUNAPAP" as const, lead_id: "lead", responsible_id: "staff", status: "draft" as const,
  version: 1, customer_name: "Synthetic customer", can_finance: true, project_id: null, unit_id: null, customer_id: "customer",
  responsible_name: "Synthetic proposer", lead_owner_name: "Synthetic owner", can_edit: true, can_assign: false, permissions: {},
  customer_snapshot: { full_name: "Synthetic customer", phone: "0000000000", address: "Customer address", nickname: "", salesperson: "" }, house_brief: house };
const editor = renderToStaticMarkup(createElement(QuotationEditor, { sale, agreement: null, action: async () => ({ error: "" }) }));
const areaValue = (markup: string) => markup.match(/id="quote-usable_area"[^>]*value="([^"]*)"/)?.[1];
assert.equal(areaValue(editor), "85.5", "House brief remains the fallback without design area");
const designEditor = renderToStaticMarkup(createElement(QuotationEditor, { sale, agreement: null, designArea: "175.5", action: async () => ({ error: "" }) }));
assert.equal(areaValue(designEditor), "175.5", "Design area overrides the initial house brief");
const revisionEditor = renderToStaticMarkup(createElement(QuotationEditor, { sale, designArea: "175.5",
  agreement: { is_settled: false, instalments: [], documents: [{ id: "quote", kind: "quotation", state: "issued", number: null,
    revision: 1, version: 1, evidence_path: null, payload: { house: { ...house, usable_area: "180" } } }] },
  action: async () => ({ error: "" }) }));
assert.equal(areaValue(revisionEditor), "180", "Existing quotation area is preserved when revising");
assert.ok(editor.includes('aria-label="แก้ไขใบเสนอราคาแบบ A4"'));
assert.equal((editor.match(/<form/g) ?? []).length, 1, "Only one editable form");
assert.equal((editor.match(/<h1/g) ?? []).length, 1, "One task heading");
assert.ok(editor.includes("ใบเสนอราคา · กำลังแก้ไข"), "Task phase does not claim a competing project stage number");
assert.ok(!editor.includes("ขั้นที่"));
assert.equal((editor.match(/aria-label="รายการที่ /g) ?? []).length, 18, "All material rows remain editable");
for (const label of ["ดูตัวอย่างใบเสนอราคา", "ผู้จัดการ", "ผู้เสนอราคา", "สถานที่ก่อสร้าง", "แบบบ้าน"]) assert.ok(editor.includes(label), label);
assert.ok(!editor.includes("contenteditable"), "Native fields preserve validation and escaping");
const preview = renderToStaticMarkup(createElement(sheet.QuotationPreview, { input: payload }));
assert.ok(preview.includes('aria-label="ตัวอย่างใบเสนอราคา"'));
assert.ok(preview.includes("Synthetic note") && preview.includes("123.45"));
assert.ok(preview.includes("ผู้เสนอราคา") && !preview.includes("<input"), "Preview is read-only and uses quotation content");
console.log("PASS: A4 editable sheet,18 rows, one form and shared read-only preview");

const sample = JSON.parse(readFileSync(new URL("../../../scripts/fixtures/quotation-photo-sample.json", import.meta.url), "utf8"));
const photoInput = quotationInputSchema.parse(sample);
const photo = renderToStaticMarkup(createElement(pages.QuotationPages, { payload: { ...photoInput, total_cents: photoInput.total_cents ?? "0" }, date: photoInput.paper!.document_date, issuerName: "Synthetic issuer", notice: "ข้อมูลทดสอบ" }));
assert.equal((photo.match(/<article/g) ?? []).length, 3, "Sample uses three sheets");
assert.equal((photo.match(/aria-label="ข้อมูลลูกค้า"/g) ?? []).length, 3, "Customer context repeats on each sheet");
assert.equal((photo.match(/<tbody>/g) ?? []).length, 2);
assert.equal((photo.match(/scope="row"/g) ?? []).length, 18, "All rows appear once across both material pages");
assert.equal((photo.match(/<li>/g) ?? []).length, 12, "All conditions preserved");
for (const value of ["960,000.00", "53", "2569", "Synthetic issuer", "หน้า 3 / 3", "PHILIPS"]) assert.ok(photo.includes(value), value);
assert.ok(photo.indexOf("เงื่อนไขเพิ่มเติม") > photo.indexOf('aria-label="ใบเสนอราคา หน้า 3"'));
assert.equal((photo.match(/ผู้จัดการ<\/p>/g) ?? []).length, 1, "Signatures only on final sheet");
console.log("PASS: photo sample schema, three-page layout, repeated headers, 18 rows and 12 conditions");
