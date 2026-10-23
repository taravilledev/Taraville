"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/staff";
import { projectSchema } from "@/lib/walkin/models";
import { parseCancelProjectForm, parseOpenProjectForm, type ProjectCancelContext, type StatusMutation } from "@/lib/walkin/lead-stage";
import { mutationError } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";

async function finish(leadId: string, result: { data: unknown; error: { code?: string; message?: string } | null }): Promise<ActionState> {
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  if (!projectSchema.safeParse(result.data).success) return { error: "กรุณาเปิดรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/leads"); revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?saved=1`);
}

export async function openProject(context: StatusMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parseOpenProjectForm(context, form); }
  catch { return { error: "กรุณายืนยันขั้นตอน" }; }
  return finish(input.id, await supabase.rpc("walkin_open_project", {
    p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
  }).single());
}

export async function cancelProject(context: ProjectCancelContext, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  if (staff.role !== "executive") return { error: "เฉพาะผู้บริหารเท่านั้นที่ยกเลิกโครงการได้" };
  let input;
  try { input = parseCancelProjectForm(context, form); }
  catch { return { error: "กรุณาระบุเหตุผลการยกเลิก (ไม่เกิน 500 ตัวอักษร) และยืนยัน" }; }
  return finish(input.leadId, await supabase.rpc("walkin_cancel_project", {
    p_project_id: input.id, p_expected_version: input.version, p_request_id: input.requestId, p_reason: input.reason,
  }).single());
}
