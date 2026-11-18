"use server";

import { feedbackParam } from "@/lib/action-feedback";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { bootstrapSchema } from "@/lib/sales/models";
import { salesMutation } from "@/lib/sales/mutations";
import { unitActivityFields } from "./catalog-list";
import type { ActionState } from "@/app/walkin/action-form";

const activity = z.object({
  projectId: z.uuid(),
  unitId: z.uuid(),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  requestId: z.uuid(),
  active: z.boolean(),
  q: z.string().max(200),
  status: z.enum(["", "available", "reserved", "inactive"]),
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export async function setUnitActivity(context: unknown): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = activity.safeParse(context);
  if (!parsed.success) return { error: "เปิดทะเบียนบ้าน/แปลงใหม่แล้วลองอีกครั้ง" };
  const { projectId, unitId, version, requestId, active, q, status, page } = parsed.data;
  const result = await session.supabase.rpc("sales_bootstrap");
  if (result.error) return { error: "โหลดข้อมูลบ้าน/แปลงไม่ได้ กรุณาลองใหม่" };
  const workspace = bootstrapSchema.safeParse(result.data);
  if (!workspace.success || !workspace.data.can_catalog) return { error: "คุณไม่มีสิทธิ์จัดการโครงการและบ้าน/แปลง" };
  const project = workspace.data.developments.find(item => item.id === projectId);
  if (!project?.is_active) return { error: "เปิดใช้งานโครงการก่อนเปลี่ยนสถานะบ้าน/แปลง" };
  const unit = project.units.find(item => item.id === unitId);
  if (!unit || unit.version !== version) return { error: "ข้อมูลบ้าน/แปลงเปลี่ยนแล้ว กรุณาเปิดทะเบียนใหม่" };

  const query = new URLSearchParams({ project: projectId, [feedbackParam]: active ? "unit_enabled" : "unit_disabled" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  return salesMutation(session, "sales_save_unit", {
    p_id: unitId, p_expected_version: version, p_development_id: projectId, p_request_id: requestId,
    ...unitActivityFields(unit, active),
  }, `/sales/settings/catalog?${query}`);
}
