import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(file: string, require: (name: string) => unknown) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, { exports, Date, require }, { timeout: 1000 });
  return exports;
}
const stageModule = load("./lead-stage.ts", name => nodeRequire(name));
const questionModule = load("./survey-questions.ts", () => ({}));
const exports = load("./lead-csv.ts", name => name === "./lead-stage" ? stageModule : name === "./survey-questions" ? questionModule : {});
const { csvCell, leadsCsv, phoneCell } = exports as typeof import("./lead-csv");

// Leading-zero phones stay text in Excel; anything else goes through the normal escaping.
assert.equal(phoneCell("0812345678"), '"=""0812345678"""');
assert.equal(phoneCell("+66812345678"), "'+66812345678");
assert.equal(phoneCell("081-234-5678"), "081-234-5678");
assert.equal(phoneCell('0" & HYPERLINK("x'), csvCell('0" & HYPERLINK("x'), "a quote never reaches the formula");

// Formula triggers are neutralised; quoting follows RFC 4180.
for (const value of ["=1+1", "+66812345678", "-2", "@SUM(A1)", "\tx", "\rx"]) assert.equal(csvCell(value).replace(/^"/, "")[0], "'");
assert.equal(csvCell("0812345678"), "0812345678");
assert.equal(csvCell('a,"b"'), '"a,""b"""');
assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
assert.equal(csvCell("=a,b"), `"'=a,b"`);

const lead = {
  id: "11111111-1111-4111-8111-111111111111", brand: "BAAN_KUNAPAP", name_title: "คุณ", first_name: "=HYPERLINK(\"x\")", last_name: "ใจดี",
  phone: "+66812345678", line_id: "line", owner_id: "22222222-2222-4222-8222-222222222222", created_by: "22222222-2222-4222-8222-222222222222",
  version: 1, created_at: "2026-10-24T17:30:00Z", updated_at: "2026-10-24T17:30:00Z", privacy_mode: "real", last_contact_at: null,
  closed_at: null, closed_by: null, closed_reason: "other", stage: "closed",
  survey: { gender: "หญิง", layout: ["2 ห้องนอน", "อื่นๆ"], layout_other: "ห้องพระ", channel: "อื่นๆ",
    payment_method: "เงินสด", house_type: "คอนโด", monthly_installment: "6,000-8,000" },
} as const;
const csv = leadsCsv("BAAN_KUNAPAP", [lead as never], new Map([[lead.owner_id, "สมชาย"]]), new Map([[lead.id, "BKP-69-001"]]));
assert.ok(csv.startsWith("﻿บันทึกเมื่อ,สถานะ,"), "BOM then Thai header");
assert.ok(csv.endsWith("\r\n"));
const [header, row] = csv.slice(1).split("\r\n");
const columns = header.split(",");
assert.equal(columns.length, 11 + 12, "fixed columns plus current and historical BK survey questions");
assert.equal(columns[11], "ที่อยู่ก่อสร้าง");
assert.deepEqual(columns.slice(19, 23), ["7. วิธีชำระเงิน", "8. ท่านรู้จักและสะดวกรับข้อมูลข่าวสารจากบริษัทฯ ทางช่องทางใด",
  "ค่างวดที่สะดวกในการผ่อนชำระต่อเดือน (บาท) (ข้อมูลเดิม)", "พนักงานขาย"], "Financing precedes channel and the preserved historical installment column");
// 17:30Z on the 24th is 00:30 on the 25th in Bangkok.
assert.ok(row.startsWith("2026-10-25 00:30,ปิด,คุณ,\"'=HYPERLINK(\"\"x\"\")\",ใจดี,'+66812345678,line,สมชาย,,อื่นๆ,BKP-69-001,"), row);
assert.ok(row.includes(",หญิง,"));
assert.ok(row.includes('"2 ห้องนอน, อื่นๆ: ห้องพระ"'), "multi answers joined, other text attached");
assert.ok(row.includes(",อื่นๆ,"), "other without text stays as is");
assert.ok(row.includes(",คอนโด,"), "Historical condo answers remain exported");
assert.ok(row.includes(',เงินสด,อื่นๆ,"6,000-8,000",'), "New financing and historical installment answers occupy their corresponding columns");
const bankCsv = leadsCsv("BAAN_KUNAPAP", [{ ...lead, survey: { ...lead.survey, payment_method: "สินเชื่อธนาคาร" } } as never], new Map(), new Map());
assert.ok(bankCsv.includes(',สินเชื่อธนาคาร,อื่นๆ,"6,000-8,000",'));
const tvCsv = leadsCsv("TARAVILLE", [{ ...lead, brand: "TARAVILLE", survey: {
  address: "Synthetic contact address", occupation: "อื่นๆ", occupation_other: "เกษตรกร", house_type: "คอนโด", monthly_installment: "15000", channel: "TikTok",
  decision_factors: ["ทำเลที่ตั้ง", "เชื่อมั่นในแบรนด์", "คุณภาพของวัสดุ"], preferred_location: "Synthetic preferred location",
  budget_range: "3 ล้านขึ้นไป", decision_time: "2 สัปดาห์", purchase_reason: "ซื้อเพื่อปล่อยเช่า",
} } as never], new Map(), new Map());
const [tvHeader, tvRow] = tvCsv.slice(1).split("\r\n");
const tvColumns = tvHeader.split(",");
assert.equal(tvColumns.length, 11 + 15, "Taraville exports a separate preferred-location column");
assert.equal(tvColumns[11], "ที่อยู่");
assert.equal(tvColumns[17], "6. ปัจจัยที่ท่านใช้พิจารณาในการตัดสินใจเลือกซื้อที่อยู่อาศัย (ตอบได้มากกว่า 1 ข้อ)");
assert.equal(tvColumns[18], "ทำเลที่สนใจ");
assert.equal(tvColumns[21], "9. ค่างวดผ่อนบ้านต่อเดือนที่ท่านสะดวกชำระ (บาท)");
assert.equal(tvColumns[22], "10. ท่านรู้จักโครงการและสะดวกรับข้อมูลข่าวสารทางช่องทางใด");
assert.ok(!tvHeader.includes("วิธีชำระเงิน") && !tvHeader.includes("ข้อมูลเดิม"), "Taraville must not gain BK-specific financing or historical columns");
assert.ok(tvRow.includes(",15000,TikTok,"), "Taraville retains numeric installment answers before channel");
assert.ok(tvRow.includes(",อื่นๆ: เกษตรกร,"), "Occupation Other text is exported");
assert.ok(tvRow.includes(',คอนโด,"ทำเลที่ตั้ง, เชื่อมั่นในแบรนด์, คุณภาพของวัสดุ",Synthetic preferred location,'),
  "Legacy condo, new factors and separate location column retain their values and order");
assert.ok(tvRow.includes(",3 ล้านขึ้นไป,15000,TikTok,2 สัปดาห์,ซื้อเพื่อปล่อยเช่า,"), "Historical budget/time and rental purchase reason remain exported");
console.log("PASS: lead CSV export");
