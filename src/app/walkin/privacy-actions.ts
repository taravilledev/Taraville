"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/staff";
import { leadSchema } from "@/lib/walkin/models";
import { PRIVACY_NOTICE, parsePrivacyMutation, type PrivacyMutation } from "@/lib/walkin/privacy";
import { mutationError } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";

export async function recordPrivacy(context: PrivacyMutation, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff(true);
  let input;
  try { input = parsePrivacyMutation(context, form); }
  catch { return { error: "กรุณายืนยันขั้นตอนและการใช้ข้อมูลสมมติ หากเลือกให้ข้อมูลเพิ่มเติมต้องแสดงประกาศก่อน" }; }
  let result;
  try {
    result = await supabase.rpc("walkin_record_privacy_event", {
      p_lead_id: input.id, p_expected_version: input.version, p_request_id: input.requestId,
      p_kind: input.operation === "contact" ? "contact" : "survey_choice",
      p_survey_consent: input.operation === "contact" ? null : input.operation === "opt_in",
      p_notice_version: input.operation === "opt_in" ? PRIVACY_NOTICE.version : null,
      p_notice_presented: input.operation === "opt_in",
    }).single();
  } catch { return { error: mutationError() }; }
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  if (!leadSchema.safeParse(result.data).success) return { error: "กรุณาเปิดรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/leads"); revalidatePath(`/leads/${input.id}`);
  redirect(`/leads/${input.id}?saved=1`);
}
