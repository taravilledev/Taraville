"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { capabilitySchema } from "@/lib/sales/models";
import { salesFailure, salesMutation } from "@/lib/sales/mutations";
import type { ActionState } from "@/app/walkin/action-form";

const input = z.object({ staffId: z.uuid(), changes: capabilitySchema.array().min(1).max(40) });

// One sales_set_capability call per change (the RPC saves one capability); the last call goes through salesMutation,
// which revalidates and redirects once. shortcut: not atomic — a failure part-way keeps the earlier changes; a batch RPC fixes that.
export async function savePermissions(_state: ActionState, form: FormData): Promise<ActionState> {
  let changes: unknown;
  try { changes = JSON.parse(String(form.get("changes"))); } catch { changes = null; }
  const parsed = input.safeParse({ staffId: form.get("staff_id"), changes });
  if (!parsed.success) return { error: "ข้อมูลสิทธิ์ไม่ถูกต้อง กรุณาโหลดหน้านี้ใหม่" };
  const session = await requireStaff(true);
  const args = (change: z.infer<typeof capabilitySchema>) => ({ p_staff_id: parsed.data.staffId, p_action: change.action,
    p_scope: change.scope, p_enabled: change.enabled, p_request_id: randomUUID() });
  const all = parsed.data.changes;
  for (const [index, change] of all.slice(0, -1).entries()) {
    const call = args(change);
    const { error } = await session.supabase.rpc("sales_set_capability", call);
    if (!error) continue;
    const failure = salesFailure(error, call, session.staff);
    return index ? { ...failure, error: `${failure.error} (บันทึกไปแล้ว ${index} จาก ${all.length} รายการ)` } : failure;
  }
  const result = await salesMutation(session, "sales_set_capability", args(all[all.length - 1]), `/sales/settings/permissions?staff=${parsed.data.staffId}`);
  return all.length > 1 && result.error ? { ...result, error: `${result.error} (บันทึกไปแล้ว ${all.length - 1} จาก ${all.length} รายการ)` } : result;
}
