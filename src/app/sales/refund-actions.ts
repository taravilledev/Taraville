"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { parseMoney } from "@/lib/sales/money";
import { salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const invalid = { error: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม" };
export async function requestRefund(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ amount: z.string().min(1), reason: z.string().trim().min(1).max(3000) }).safeParse({ amount: form.get("amount"), reason: form.get("reason") });
  if (!parsed.success || !input.success) return invalid;
  let amount: string; try { amount = parseMoney(input.data.amount); } catch { return { error: "กรอกยอดคืนเงินเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง" }; }
  // The case page picks the payment in the form; callers that bind the payment id in the context still work.
  const payment = z.uuid().safeParse(form.get("payment_id") ?? parsed.data.id);
  if (!payment.success) return invalid;
  return salesMutation(session, "sales_request_refund", { p_root_payment_id: payment.data, p_version: parsed.data.version,
    p_amount_cents: amount, p_reason: input.data.reason, p_request_id: parsed.data.requestId }, "case");
}
export async function decideRefund(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ decision: z.enum(["approved", "rejected", "withdrawn"]), note: z.string().trim().min(1).max(3000) }).safeParse({ decision: form.get("decision"), note: form.get("note") });
  if (!parsed.success || !input.success) return invalid;
  return salesMutation(session, "sales_decide_refund", { p_refund_id: parsed.data.id, p_version: parsed.data.version,
    p_decision: input.data.decision, p_note: input.data.note, p_request_id: parsed.data.requestId }, "case");
}
export async function payRefund(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true); const parsed = identity.safeParse(context);
  const input = z.object({ method: z.enum(["cash", "transfer", "cheque"]), date: z.iso.date(), proof: z.string().min(1).max(200) }).safeParse({
    method: form.get("method"), date: form.get("paid_date"), proof: form.get("proof_path"),
  });
  if (!parsed.success || !input.success || form.get("funds_confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_pay_refund", { p_refund_id: parsed.data.id, p_version: parsed.data.version,
    p_method: input.data.method, p_paid_date: input.data.date, p_proof_path: input.data.proof,
    p_funds_confirmed: true, p_request_id: parsed.data.requestId }, "case");
}
