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
const { csvCell, leadsCsv } = exports as typeof import("./lead-csv");

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
  survey: { gender: "หญิง", layout: ["2 ห้องนอน", "อื่นๆ"], layout_other: "ห้องพระ", channel: "อื่นๆ" },
} as const;
const csv = leadsCsv("BAAN_KUNAPAP", [lead as never], new Map([[lead.owner_id, "สมชาย"]]), new Map([[lead.id, "BKP-69-001"]]));
assert.ok(csv.startsWith("﻿บันทึกเมื่อ,สถานะ,"), "BOM then Thai header");
assert.ok(csv.endsWith("\r\n"));
const [header, row] = csv.slice(1).split("\r\n");
assert.equal(header.split(",").length, 11 + 11, "fixed columns plus every BK survey question");
// 17:30Z on the 24th is 00:30 on the 25th in Bangkok.
assert.ok(row.startsWith("2026-10-25 00:30,ปิด,คุณ,\"'=HYPERLINK(\"\"x\"\")\",ใจดี,'+66812345678,line,สมชาย,,อื่นๆ,BKP-69-001,"), row);
assert.ok(row.includes(",หญิง,"));
assert.ok(row.includes('"2 ห้องนอน, อื่นๆ: ห้องพระ"'), "multi answers joined, other text attached");
assert.ok(row.includes(",อื่นๆ,"), "other without text stays as is");
console.log("PASS: lead CSV export");
