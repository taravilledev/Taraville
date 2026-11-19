"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const invalid = { error: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม" };
export async function issueDesignInvoice(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = z.object({ position: z.enum(["1", "2", "3"]), due_date: z.iso.date() }).safeParse({ position: form.get("position"), due_date: form.get("due_date") });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_issue_design_invoice", { p_case_id: parsed.data.id, p_version: parsed.data.version,
    p_position: Number(fields.data.position), p_due_date: fields.data.due_date, p_request_id: parsed.data.requestId }, "finance");
}
export async function cancelDesignInvoice(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const reason = z.string().trim().min(1).max(1000).safeParse(form.get("reason"));
  if (!parsed.success || !reason.success || form.get("confirmed") !== "on") return invalid;
  return salesMutation(session, "sales_cancel_design_invoice", { p_invoice_id: parsed.data.id, p_version: parsed.data.version,
    p_reason: reason.data, p_request_id: parsed.data.requestId }, "finance");
}
export async function prepareDesignPayment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = z.object({ method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.iso.date(),
    payer_name: z.string().trim().min(1).max(300), description: z.string().trim().min(1).max(1000), proof_path: z.string().max(200) })
    .safeParse(Object.fromEntries(["method", "paid_date", "payer_name", "description", "proof_path"].map(key => [key, form.get(key) ?? ""])));
  if (!parsed.success || !fields.success) return invalid;
  return salesMutation(session, "sales_prepare_design_payment", { p_invoice_id: parsed.data.id, p_version: parsed.data.version,
    p_input: fields.data, p_request_id: parsed.data.requestId }, "finance");
}
