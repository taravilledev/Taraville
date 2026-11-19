"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withSuccessFeedback } from "@/lib/action-feedback";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { houseBriefFields, houseBriefSchema } from "@/lib/sales/house-brief";
import { salesFailure } from "@/lib/sales/mutations";
import { taskHref, taskNames } from "@/lib/sales/tasks";
import type { ActionState } from "@/app/walkin/action-form";

const contextSchema = z.object({
  id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid(),
  task: z.enum(taskNames).optional(), row: z.uuid().optional(),
  tab: z.enum(["overview", "customer", "design", "quotation", "contract", "documents", "money"]),
});

export async function saveHouseBrief(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  const route = contextSchema.safeParse(context);
  const brief = houseBriefSchema.safeParse(Object.fromEntries(houseBriefFields.map(({ key }) => [key, form.get(key) ?? ""])));
  if (!route.success || !brief.success) return { error: "ตรวจสอบข้อมูลความต้องการบ้านก่อนบันทึก" };
  const { id, version, requestId, task, row, tab } = route.data;
  const { error } = await supabase.rpc("sales_save_house_brief", {
    p_case_id: id, p_version: version, p_brief: brief.data, p_request_id: requestId,
  });
  if (error) return salesFailure(error, { p_case_id: id }, staff);
  revalidatePath("/sales", "layout");
  redirect(withSuccessFeedback(task ? taskHref(id, task, row) : `/sales/${id}?tab=${tab}`, "sales_save_house_brief"));
}
