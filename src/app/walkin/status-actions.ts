"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/staff";
import { leadSchema } from "@/lib/walkin/models";
import { parseCloseForm, parseReopenForm, type StatusMutation } from "@/lib/walkin/lead-stage";
import { mutationError } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";

async function finish(id: string, result: { data: unknown; error: { code?: string; message?: string } | null }): Promise<ActionState> {
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  if (!leadSchema.safeParse(result.data).success) return { error: "กรุณาเปิดรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/leads"); revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}?saved=1`);
}

export async function closeLead(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseCloseForm(context, form); }
  catch { return { error: "กรุณาเลือกเหตุผลและยืนยัน หากเลือก “อื่นๆ” ต้องระบุเหตุผลด้วย" }; }
  return finish(input.id, await supabase.rpc("walkin_close_lead", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
    p_reason: input.reason, p_reason_text: input.text,
  }).single());
}

export async function reopenLead(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseReopenForm(context, form); }
  catch { return { error: "กรุณายืนยันขั้นตอน" }; }
  return finish(input.id, await supabase.rpc("walkin_reopen_lead", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
  }).single());
}
