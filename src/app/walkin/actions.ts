"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/staff";
import { leadSchema } from "@/lib/walkin/models";
import { mutationContextSchema, parseLeadForm, mutationError, type MutationContext } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";
import { PRIVACY_NOTICE, parsePrivacyIntake } from "@/lib/walkin/privacy";

export async function saveLead(context: MutationContext, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  let input;
  const parsed = mutationContextSchema.safeParse(context);
  if (!parsed.success) return { error: "แบบฟอร์มหมดอายุหรือไม่ถูกต้อง กรุณาเปิดใหม่" };
  form.set("survey.sales_staff", staff.full_name);
  let consent: boolean | null = null;
  try {
    if (!context.id) consent = parsePrivacyIntake(form);
    else {
      const latest = await supabase.from("lead_privacy_events").select("survey_consent")
        .eq("lead_id", context.id).not("survey_consent", "is", null).order("id", { ascending: false }).limit(1);
      if (latest.error) return { error: mutationError() };
      consent = latest.data[0]?.survey_consent ?? null;
    }
    input = parseLeadForm(parsed.data, form, consent !== false);
  }
  catch { return { error: "กรุณาตรวจข้อมูล การแสดงประกาศ คำขอติดต่อกลับ ตัวเลือกแบบสอบถาม และการยืนยันข้อมูล" }; }
  if (staff.role === "sale" && input.owner !== staff.id) return { error: "ฝ่ายขายบันทึกได้เฉพาะรายการของตนเอง" };
  const request = context.id ? supabase.rpc("walkin_update_lead", {
    p_lead_id: context.id, p_expected_version: context.version, p_contact: input.contact, p_survey: input.survey,
  }).single() : supabase.rpc("walkin_create_lead_with_privacy", {
    p_request_id: context.requestId, p_brand: context.brand, p_contact: input.contact, p_survey: input.survey, p_owner: input.owner,
    p_notice_version: PRIVACY_NOTICE.version, p_notice_presented: true, p_followup_requested: true, p_survey_consent: consent,
  }).single();
  let result;
  try { result = await request; }
  catch { return { error: mutationError() }; }
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  const lead = leadSchema.safeParse(result.data);
  if (!lead.success) return { error: "ได้รับผลบันทึกไม่ครบ กรุณาตรวจรายการก่อนส่งซ้ำ" };
  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.data.id}`);
  redirect(`/leads/${lead.data.id}?saved=1`);
}

export async function reassignLead(id: string, version: number, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  if (staff.role !== "executive") return { error: "เฉพาะผู้บริหารเท่านั้นที่เปลี่ยนผู้ดูแลได้" };
  const parsed = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    owner: z.uuid(), confirmed: z.literal("on") }).safeParse({ id, version, owner: form.get("owner_id"), confirmed: form.get("data_confirmed") });
  if (!parsed.success) return { error: "กรุณาเลือกฝ่ายขายและยืนยันข้อมูล" };
  const { data, error } = await supabase.rpc("walkin_reassign_lead", {
    p_lead_id: parsed.data.id, p_expected_version: parsed.data.version, p_owner: parsed.data.owner,
  }).single();
  if (error) return { error: mutationError(error.code, error.message) };
  if (!leadSchema.safeParse(data).success) return { error: "กรุณาตรวจรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/leads"); revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}?saved=1`);
}
