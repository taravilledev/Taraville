"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const invalid = { error: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม" };
export async function signPropertyContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  if (!form.get("proof_path")) return { error: "เลือกไฟล์สัญญาและกดแนบหลักฐานก่อนบันทึก" };
  const fields = z.object({ summary: z.uuid(), count: z.string().regex(/^\d{1,2}$/), proof: z.string().min(1).max(200) }).safeParse({
    summary: form.get("summary_id"), count: form.get("down_count"), proof: form.get("proof_path"),
  });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_sign_property_contract", {
    p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_summary_id: fields.data.summary, p_down_count: Number(fields.data.count), p_evidence_path: fields.data.proof,
  }, "case");
}
export async function issueQuotation(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const description = z.string().trim().min(1).max(10000).safeParse(form.get("description"));
  if (!parsed.success || !description.success) return invalid;
  return salesMutation(session, "sales_issue_quotation", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_description: description.data, p_request_id: parsed.data.requestId }, "case");
}
async function evidenceMutation(name: "sales_accept_quotation" | "sales_sign_contract", context: unknown, form: FormData) {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const evidence = z.string().min(1).max(200).safeParse(form.get("proof_path"));
  if (!parsed.success || !evidence.success || form.get("confirmed") !== "on") return { error: "แนบหลักฐานและยืนยันการยอมรับเอกสารฉบับนี้" };
  return salesMutation(session, name, { p_document_id: parsed.data.id, p_version: parsed.data.version,
    p_evidence_path: evidence.data, p_request_id: parsed.data.requestId }, "case");
}
export async function acceptQuotation(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return evidenceMutation("sales_accept_quotation", context, form);
}
export async function signContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return evidenceMutation("sales_sign_contract", context, form);
}
export async function prepareContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const fields = z.object({ quotation: z.uuid(), labels: z.string().trim().min(1).max(300).array().min(1).max(100),
    percentages: z.string().regex(/^(?:100|\d{1,2})(?:\.\d{1,2})?$/).array(), progress: z.string().regex(/^\d{0,3}$/).array(),
  }).safeParse({ quotation: form.get("quotation_id"), labels: form.getAll("label"), percentages: form.getAll("percent"), progress: form.getAll("progress") });
  if (!parsed.success || !fields.success || fields.data.labels.length !== fields.data.percentages.length || fields.data.labels.length !== fields.data.progress.length) return invalid;
  const schedule = fields.data.labels.map((label, index) => {
    const [whole, fraction = ""] = fields.data.percentages[index].split(".");
    return { label, basis_points: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
      progress_percent: index === 0 ? null : fields.data.progress[index] ? Number(fields.data.progress[index]) : null };
  });
  if (schedule.some(row => row.basis_points <= 0 || row.basis_points > 10000 || (row.progress_percent != null && row.progress_percent > 100))
    || schedule.reduce((sum, row) => sum + row.basis_points, 0) !== 10000) return { error: "สัดส่วนแต่ละงวดต้องมากกว่า 0 และรวมเป็น 100% พร้อมความคืบหน้างาน 0–100" };
  return salesMutation(session, "sales_prepare_contract", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_quotation_id: fields.data.quotation, p_schedule: schedule, p_request_id: parsed.data.requestId }, "case");
}
export async function recordAcceptance(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ proof: z.string().min(1).max(200), note: z.string().trim().min(1).max(3000) }).safeParse({ proof: form.get("proof_path"), note: form.get("note") });
  if (!parsed.success || !input.success || form.get("inspected") !== "on" || form.get("customer_accepted") !== "on") return invalid;
  return salesMutation(session, "sales_record_acceptance", { p_instalment_id: parsed.data.id, p_version: parsed.data.version,
    p_inspected: true, p_customer_accepted: true, p_evidence_path: input.data.proof, p_note: input.data.note, p_request_id: parsed.data.requestId }, "case");
}
export async function issueInvoice(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context); const due = z.iso.date().safeParse(form.get("due_date"));
  if (!parsed.success || !due.success) return invalid;
  return salesMutation(session, "sales_issue_invoice", { p_instalment_id: parsed.data.id, p_version: parsed.data.version,
    p_due_date: due.data, p_request_id: parsed.data.requestId }, "case");
}
