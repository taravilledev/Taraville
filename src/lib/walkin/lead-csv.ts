import { CLOSE_REASON_LABELS, STAGE_LABELS } from "./lead-stage";
import type { ListLead } from "./models";
import { SURVEY_QUESTIONS, type Brand } from "./survey-questions";

/** Rows per export, matching Supabase's default API max-rows; past this the Executive narrows the filters (ADR 0011). */
// ponytail: one request, refuse above the cap — page with range() in chunks once a brand has >1000 matching leads.
export const EXPORT_LIMIT = 1000;

/** One CSV cell. A leading = + - @ tab or CR would run as a formula in Excel, so it is prefixed with ' (OWASP). */
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const bangkokTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 16) : "";

function surveyAnswer(survey: ListLead["survey"], key: string) {
  const answer = survey[key];
  const other = survey[`${key}_other`];
  const values = Array.isArray(answer) ? answer : answer ? [answer] : [];
  return values.map(value => value === "อื่นๆ" && typeof other === "string" && other ? `อื่นๆ: ${other}` : value).join(", ");
}

/** One brand's leads as CSV for Excel: UTF-8 BOM so Thai renders, CRLF rows, one column per survey question. */
export function leadsCsv(brand: Brand, leads: ListLead[], ownerName: Map<string, string>, projectCode: Map<string, string>) {
  const questions = SURVEY_QUESTIONS[brand];
  const header = ["บันทึกเมื่อ", "สถานะ", "คำนำหน้า", "ชื่อ", "นามสกุล", "เบอร์โทร", "LINE ID", "ฝ่ายขายผู้ดูแล",
    "ติดต่อล่าสุด", "เหตุผลที่ปิด", "รหัสโครงการ", ...questions.map(question => question.label)];
  const rows = leads.map(lead => [
    bangkokTime(lead.created_at), STAGE_LABELS[lead.stage], lead.name_title, lead.first_name, lead.last_name, lead.phone,
    lead.line_id, ownerName.get(lead.owner_id) ?? "", bangkokTime(lead.last_contact_at),
    lead.closed_reason ? CLOSE_REASON_LABELS[lead.closed_reason] : "", projectCode.get(lead.id) ?? "",
    ...questions.map(question => surveyAnswer(lead.survey, question.key)),
  ]);
  return "﻿" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
