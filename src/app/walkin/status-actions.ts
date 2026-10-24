"use server";

import { requireStaff } from "@/lib/supabase/staff";
import { leadSchema } from "@/lib/walkin/models";
import { parseCloseForm, parseReopenForm, type StatusMutation } from "@/lib/walkin/lead-stage";
import type { ActionState } from "./action-form";
import { finishMutation } from "./finish-mutation";

export async function closeLead(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseCloseForm(context, form); }
  catch { return { error: "กรุณาเลือกเหตุผลและยืนยัน หากเลือก “อื่นๆ” ต้องระบุเหตุผลด้วย" }; }
  return finishMutation(input.id, leadSchema, () => supabase.rpc("walkin_close_lead", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
    p_reason: input.reason, p_reason_text: input.text,
  }).single());
}

export async function reopenLead(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseReopenForm(context, form); }
  catch { return { error: "กรุณายืนยันขั้นตอน" }; }
  return finishMutation(input.id, leadSchema, () => supabase.rpc("walkin_reopen_lead", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
  }).single());
}
