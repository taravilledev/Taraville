"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { parseMoney } from "@/lib/sales/money";
import { salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const invalid = { error: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม" };
export async function withdrawPayment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const reason = z.string().trim().min(1).max(1000).safeParse(form.get("reason"));
  if (!parsed.success || !reason.success || form.get("confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_reject_pending_payment", {
    p_payment_request_id: parsed.data.id, p_version: parsed.data.version,
    p_request_id: parsed.data.requestId, p_reason: reason.data,
  }, "case");
}
export async function correctPayment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = z.object({ reason: z.string().trim().min(1).max(1000), amount: z.string(), proof: z.string().min(1).max(200) }).safeParse({
    reason: form.get("reason"), amount: form.get("amount"), proof: form.get("proof_path"),
  });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return invalid;
  let amount: string;
  try { amount = parseMoney(fields.data.amount); } catch { return { error: "ตรวจสอบยอดรับจริงที่ถูกต้อง" }; }
  return salesMutation(session, "sales_correct_payment", {
    p_document_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_amount_cents: amount, p_reason: fields.data.reason, p_evidence_path: fields.data.proof,
  }, "case");
}
export async function correctReceipt(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = z.object({ reason: z.string().trim().min(1).max(1000), description: z.string().trim().max(1000) }).safeParse({
    reason: form.get("reason"), description: form.get("description") ?? "",
  });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_correct_receipt", {
    p_document_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_reason: fields.data.reason, p_description: fields.data.description || null,
  }, "case");
}
export async function saveDesign(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ usable_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/),
    tier: z.enum(["under150", "under200", "under250", "upto300", "custom"]), note: z.string().max(3000) }).safeParse({
    usable_area: form.get("usable_area"), tier: form.get("tier"), note: form.get("note") ?? "",
  });
  if (!parsed.success || !input.success) return invalid;
  let instalments: string[] | undefined;
  if (form.get("custom") === "on") {
    try { instalments = [1, 2, 3].map(index => { const value = form.get(`instalment_${index}`);
      if (typeof value !== "string") throw new Error("invalid_money"); return parseMoney(value); }); }
    catch { return { error: "กรอกยอดเงินทั้ง 3 งวดเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง" }; }
  }
  return salesMutation(session, "sales_save_design_plan", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_request_id: parsed.data.requestId, p_input: { ...input.data, ...(instalments ? { instalments } : {}) } }, "case");
}
export async function preparePayment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ kind: z.enum(["design_fee", "booking", "instalment", "unallocated"]),
    method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.iso.date(), payer_name: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(1000), proof_path: z.string().max(200), invoice_id: z.union([z.uuid(), z.literal("")]),
    amount: z.string().min(1) }).safeParse(Object.fromEntries(["kind", "method", "paid_date", "payer_name", "description", "proof_path", "invoice_id", "amount"].map(key => [key, form.get(key) ?? ""])));
  if (!parsed.success || !input.success) return invalid;
  let amount: string; try { amount = parseMoney(input.data.amount); } catch { return { error: "กรอกยอดเงินเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง" }; }
  const { amount: _amount, ...fields } = input.data; void _amount;
  return salesMutation(session, "sales_prepare_payment", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_request_id: parsed.data.requestId, p_input: { ...fields, amount_cents: amount } }, "case");
}
export async function confirmPayment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  if (!parsed.success || form.get("funds_confirmed") !== "on") return { error: "ต้องยืนยันว่าได้รับเงินจริงแล้วก่อนออกใบเสร็จ" };
  return salesMutation(session, "sales_confirm_payment", { p_payment_request_id: parsed.data.id, p_version: parsed.data.version,
    p_funds_confirmed: true, p_request_id: parsed.data.requestId }, "case");
}
export async function saveIssuer(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = z.object({ brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]), version: z.number().int().nonnegative(), requestId: z.uuid() }).safeParse(context);
  const input = z.object({ legal_name: z.string().trim().min(1).max(300), address: z.string().trim().min(1).max(3000),
    tax_id: z.string().max(40), contact: z.string().max(500), contract_text: z.string().max(100000), is_synthetic: z.boolean() }).safeParse({
    ...Object.fromEntries(["legal_name", "address", "tax_id", "contact", "contract_text"].map(key => [key, form.get(key) ?? ""])),
    is_synthetic: form.get("is_synthetic") === "on",
  });
  if (!parsed.success || !input.success) return invalid;
  return salesMutation(session, "sales_save_issuer", { p_brand: parsed.data.brand, p_version: parsed.data.version,
    p_input: input.data, p_request_id: parsed.data.requestId }, "/sales/admin/issuers");
}
