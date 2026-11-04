"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { capabilitySchema, caseDetailSchema } from "@/lib/sales/models";
import { salesMutation } from "@/lib/sales/mutations";
import { parseMoney } from "@/lib/sales/money";
import type { ActionState } from "@/app/walkin/action-form";

const optionalId = z.union([z.uuid(), z.literal("")]).transform(value => value || null);
const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const invalid = { error: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม" };
const catalogIdentity = z.object({ id: z.uuid().nullable(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(), requestId: z.uuid() });

export async function createCase(_state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = z.object({ leadId: z.uuid(), unitId: optionalId, customerId: optionalId, requestId: z.uuid() }).safeParse({
    leadId: form.get("lead_id"), unitId: form.get("unit_id") ?? "", customerId: form.get("customer_id") ?? "", requestId: form.get("request_id"),
  });
  if (!parsed.success) return invalid;
  const { data: projects, error } = await session.supabase.from("projects").select("id").eq("lead_id", parsed.data.leadId).eq("status", "active").limit(1);
  if (error) return { error: "โหลดโครงการไม่ได้ กรุณาลองใหม่" };
  return salesMutation(session, "sales_create_case", {
    p_lead_id: parsed.data.leadId, p_project_id: projects?.[0]?.id ?? null, p_unit_id: parsed.data.unitId,
    p_customer_id: parsed.data.customerId, p_request_id: parsed.data.requestId,
  }, "case");
}

export async function setCapability(_state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = capabilitySchema.extend({ staffId: z.uuid(), requestId: z.uuid() }).safeParse({
    action: form.get("capability"), enabled: form.get("enabled") === "true", scope: form.get("scope"),
    staffId: form.get("staff_id"), requestId: form.get("request_id"),
  });
  if (!parsed.success || !["true", "false"].includes(String(form.get("enabled")))) return invalid;
  return salesMutation(session, "sales_set_capability", {
    p_staff_id: parsed.data.staffId, p_action: parsed.data.action, p_scope: parsed.data.scope,
    p_enabled: parsed.data.enabled, p_request_id: parsed.data.requestId,
  }, "/sales/admin");
}

export async function saveCase(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  if (!parsed.success) return invalid;
  const text = (key: string) => form.get(key) ?? "";
  const snapshot = z.object({ full_name: z.string().trim().min(1).max(200), phone: z.string().max(80), address: z.string().max(2000),
    nickname: z.string().max(200), salesperson: z.string().max(200) }).safeParse(Object.fromEntries(
      ["full_name", "phone", "address", "nickname", "salesperson"].map(key => [key, text(key)])));
  const details = z.object({ model: z.string().max(200), stories: z.string().regex(/^\d{0,3}$/), bedrooms: z.string().regex(/^\d{0,3}$/),
    bathrooms: z.string().regex(/^\d{0,3}$/), usable_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/),
    land_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/), notes: z.string().max(5000) }).safeParse(Object.fromEntries(
      ["model", "stories", "bedrooms", "bathrooms", "usable_area", "land_area", "notes"].map(key => [key, text(key)])));
  if (!snapshot.success || !details.success) return invalid;
  let prices;
  try { prices = Object.fromEntries(["list_price", "promotion_price", "discount"].map(key => {
    const value = text(key); if (typeof value !== "string") throw new Error("invalid_money");
    return [`${key}_cents`, value.trim() ? parseMoney(value) : null];
  })); } catch { return { error: "กรอกยอดเงินเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง และต้องไม่ติดลบ" }; }
  const current = await session.supabase.rpc("sales_case_detail", { p_case_id: parsed.data.id });
  const existing = caseDetailSchema.safeParse(current.data);
  if (current.error || !existing.success || !existing.data.can_finance) return { error: "ไม่มีสิทธิ์โหลดข้อมูลการเงิน กรุณาเปิดหน้าใหม่" };
  if (existing.data.version !== parsed.data.version) return { error: "ข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึก" };
  return salesMutation(session, "sales_save_case", {
    p_case_id: parsed.data.id, p_expected_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_input: { ...prices, details: { ...existing.data.details, ...details.data }, customer_snapshot: snapshot.data },
  }, "case");
}

export async function assignCase(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.extend({ responsibleId: z.uuid() }).safeParse({ ...Object(context), responsibleId: form.get("responsible_id") });
  if (!parsed.success) return invalid;
  return salesMutation(session, "sales_assign_case", {
    p_case_id: parsed.data.id, p_expected_version: parsed.data.version, p_responsible_id: parsed.data.responsibleId,
    p_request_id: parsed.data.requestId,
  }, "case");
}

export async function saveDevelopment(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = catalogIdentity.safeParse(context);
  const fields = z.object({ name: z.string().trim().min(1).max(200), address: z.string().max(2000) }).safeParse({ name: form.get("name"), address: form.get("address") ?? "" });
  if (!parsed.success || !fields.success) return invalid;
  return salesMutation(session, "sales_save_development", {
    p_id: parsed.data.id, p_expected_version: parsed.data.version, p_name: fields.data.name, p_address: fields.data.address,
    p_is_active: form.get("is_active") === "on", p_request_id: parsed.data.requestId,
  }, "/sales/catalog");
}

export async function saveUnit(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = catalogIdentity.extend({ developmentId: z.uuid() }).safeParse(context);
  const fields = z.object({ code: z.string().trim().min(1).max(80), model: z.string().max(200),
    usable_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/), land_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/),
  }).safeParse(Object.fromEntries(["code", "model", "usable_area", "land_area"].map(key => [key, form.get(key) ?? ""])));
  if (!parsed.success || !fields.success) return invalid;
  let price;
  try { const raw = form.get("list_price"); if (typeof raw !== "string") return invalid; price = raw.trim() ? parseMoney(raw) : null; }
  catch { return { error: "กรอกยอดเงินเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง และต้องไม่ติดลบ" }; }
  const { data, error } = await session.supabase.rpc("sales_bootstrap");
  if (error) return { error: "โหลดข้อมูลบ้าน/แปลงไม่ได้ กรุณาลองใหม่" };
  const { bootstrapSchema } = await import("@/lib/sales/models");
  const existing = bootstrapSchema.safeParse(data);
  if (!existing.success || !existing.data.can_catalog) return { error: "คุณไม่มีสิทธิ์จัดการโครงการและบ้าน/แปลง" };
  const unit = existing.data.developments.flatMap(development => development.units).find(item => item.id === parsed.data.id);
  return salesMutation(session, "sales_save_unit", {
    p_id: parsed.data.id, p_expected_version: parsed.data.version, p_development_id: parsed.data.developmentId,
    p_code: fields.data.code, p_details: { ...unit?.details, model: fields.data.model, usable_area: fields.data.usable_area, land_area: fields.data.land_area },
    p_list_price_cents: price, p_is_active: form.get("is_active") === "on", p_request_id: parsed.data.requestId,
  }, "/sales/catalog");
}
