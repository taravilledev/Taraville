"use server";

import { z } from "zod";
import { contractAddendumSchema } from "@/lib/sales/contract-paper";
import { requireStaff } from "@/lib/supabase/staff";
import { salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";
import { agreementFormInput, contractInputSchema, quotationInputSchema } from "@/lib/sales/agreement-inputs";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid(), returnTab: z.literal("money").optional() });
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
  const input = quotationInputSchema.safeParse(agreementFormInput(form.get("quotation_input")));
  if (!parsed.success || !input.success) return invalid;
  return salesMutation(session, "sales_issue_quotation", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_input: input.data, p_request_id: parsed.data.requestId }, `/sales/${parsed.data.id}?tab=quotation`);
}
async function evidenceMutation(name: "sales_accept_quotation" | "sales_sign_contract", context: unknown, form: FormData) {
  const session = await requireStaff(true); const parsed = identity.extend({ caseId: z.uuid().optional() }).safeParse(context);
  const evidence = z.string().min(1).max(200).safeParse(form.get("proof_path"));
  if (!parsed.success || !evidence.success || form.get("confirmed") !== "on") return { error: "แนบหลักฐานและยืนยันการยอมรับเอกสารฉบับนี้" };
  return salesMutation(session, name, { p_document_id: parsed.data.id, p_version: parsed.data.version,
    p_evidence_path: evidence.data, p_request_id: parsed.data.requestId }, parsed.data.caseId ? `/sales/${parsed.data.caseId}?tab=${name === "sales_accept_quotation" ? "quotation" : "contract"}` : "case");
}
export async function acceptQuotation(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return evidenceMutation("sales_accept_quotation", context, form);
}
export async function signContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return evidenceMutation("sales_sign_contract", context, form);
}
export async function prepareContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.extend({ documentId: z.uuid().nullable().default(null), documentVersion: z.number().int().positive().nullable().default(null) }).safeParse(context);
  const quotation = z.uuid().safeParse(form.get("quotation_id"));
  const input = contractInputSchema.safeParse(agreementFormInput(form.get("contract_input"), 550000));
  if (!parsed.success || !quotation.success || !input.success) return invalid;
  return salesMutation(session, "sales_save_contract_draft", {
    p_case_id: parsed.data.id, p_version: parsed.data.version, p_quotation_id: quotation.data,
    p_document_id: parsed.data.documentId, p_document_version: parsed.data.documentVersion,
    p_input: input.data, p_request_id: parsed.data.requestId,
  }, `/sales/${parsed.data.id}?tab=contract`);
}

export async function lockContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return contractTransition("sales_lock_contract", context, form);
}
export async function unlockContract(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  return contractTransition("sales_unlock_contract", context, form);
}
async function contractTransition(name: string, context: unknown, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.extend({ documentId: z.uuid(), documentVersion: z.number().int().positive() }).safeParse(context);
  const reason = z.string().trim().min(1).max(3000).safeParse(form.get("reason"));
  if (!parsed.success || form.get("confirmed") !== "on" || (name === "sales_unlock_contract" && !reason.success)) return invalid;
  return salesMutation(session, name, { p_document_id: parsed.data.documentId, p_version: parsed.data.version,
    p_document_version: parsed.data.documentVersion, p_request_id: parsed.data.requestId,
    ...(name === "sales_unlock_contract" && reason.success ? { p_reason: reason.data } : {}),
  }, `/sales/${parsed.data.id}?tab=contract`);
}
export async function recordAcceptance(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ proof: z.string().min(1).max(200), note: z.string().trim().min(1).max(3000) }).safeParse({ proof: form.get("proof_path"), note: form.get("note") });
  const acceptanceDate = z.iso.date().nullable().safeParse(form.get("acceptance_date") || null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!acceptanceDate.success || (acceptanceDate.data && acceptanceDate.data > today)) return { error: "ระบุวันที่ตรวจรับจริงที่ไม่เกินวันนี้", field: "acceptance_date" };
  if (!parsed.success || !input.success || form.get("inspected") !== "on" || form.get("customer_accepted") !== "on") return invalid;
  return salesMutation(session, acceptanceDate.data ? "sales_record_acceptance_dated" : "sales_record_acceptance", { p_instalment_id: parsed.data.id, p_version: parsed.data.version,
    p_inspected: true, p_customer_accepted: true, p_evidence_path: input.data.proof, p_note: input.data.note,
    ...(acceptanceDate.data ? { p_acceptance_date: acceptanceDate.data } : {}), p_request_id: parsed.data.requestId }, parsed.data.returnTab === "money" ? "finance" : "case");
}
export async function issueInvoice(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context); const due = z.iso.date().safeParse(form.get("due_date"));
  if (!parsed.success || !due.success) return invalid;
  return salesMutation(session, "sales_issue_invoice", { p_instalment_id: parsed.data.id, p_version: parsed.data.version,
    p_due_date: due.data, p_request_id: parsed.data.requestId }, parsed.data.returnTab === "money" ? "finance" : "case");
}

export async function addContractAddendum(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.extend({ caseId: z.uuid() }).safeParse(context);
  const input = contractAddendumSchema.safeParse(agreementFormInput(form.get("addendum_input"), 180000));
  const evidence = z.string().min(1).max(200).safeParse(form.get("proof_path"));
  if (!parsed.success || !input.success) return invalid;
  if (!evidence.success || form.get("confirmed") !== "on") return { error: "แนบหลักฐานที่ลงนามแล้วและยืนยันก่อนบันทึก" };
  return salesMutation(session, "sales_add_contract_addendum", {
    p_document_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_input: input.data, p_evidence_path: evidence.data,
  }, `/sales/${parsed.data.caseId}?tab=contract`);
}
