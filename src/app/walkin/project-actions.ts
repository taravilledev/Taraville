"use server";

import { requireStaff } from "@/lib/supabase/staff";
import { projectSchema } from "@/lib/walkin/models";
import { parseCancelProjectForm, parseReopenForm, type ProjectCancelContext, type StatusMutation } from "@/lib/walkin/lead-stage";
import type { ActionState } from "./action-form";
import { finishMutation } from "./finish-mutation";

export async function openProject(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseReopenForm(context, form); }
  catch { return { error: "กรุณายืนยันขั้นตอน" }; }
  return finishMutation(input.id, projectSchema, () => supabase.rpc("walkin_open_project", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
  }).single());
}

export async function cancelProject(context: ProjectCancelContext, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  if (staff.role !== "executive") return { error: "เฉพาะผู้บริหารเท่านั้นที่ยกเลิกโครงการได้" };
  let input;
  try { input = parseCancelProjectForm(context, form); }
  catch { return { error: "กรุณาระบุเหตุผลการยกเลิก (ไม่เกิน 500 ตัวอักษร) และยืนยัน" }; }
  return finishMutation(input.leadId, projectSchema, () => supabase.rpc("walkin_cancel_project", {
    p_project_id: input.id, p_expected_version: input.version, p_request_id: input.requestId, p_reason: input.reason,
  }).single());
}
