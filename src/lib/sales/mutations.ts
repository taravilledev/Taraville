import "server-only";
import { redirect } from "next/navigation";
import { withSuccessFeedback } from "@/lib/action-feedback";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorState } from "@/lib/errors/error-map";
import type { requireStaff } from "@/lib/supabase/staff";
import type { ActionState } from "@/app/walkin/action-form";

const text = (value: unknown) => typeof value === "string" ? value : undefined;
type Staff = Awaited<ReturnType<typeof requireStaff>>["staff"];

/** Rejected-call result with the fix link resolved from the ids the call carried and the actor's role. */
export function salesFailure(error: { code?: string; message?: string }, input: Record<string, unknown>, staff: Staff): ActionState {
  return errorState("sales", error, { caseId: text(input.p_case_id), leadId: text(input.p_lead_id), brand: text(input.p_brand),
    staffId: text(input.p_staff_id), isExecutive: staff.role === "executive" });
}

export async function salesMutation(session: Awaited<ReturnType<typeof requireStaff>>, name: string,
  input: Record<string, unknown>, destination: "case" | "design" | "finance" | `/sales/settings/${string}` | `/sales/${string}?tab=${"quotation" | "contract" | "money"}`, nextTask?: "design" | "reserve"): Promise<ActionState> {
  const { data, error } = await session.supabase.rpc(name, input);
  if (error) return salesFailure(error, input, session.staff);
  const result = z.object({ id: z.uuid().optional() }).safeParse(data);
  if (!result.success || (["case", "design", "finance"].includes(destination) && !result.data.id)) return { error: "บันทึกแล้วแต่โหลดรายการไม่ได้ กรุณาเปิดหน้ารายการงานใหม่" };
  revalidatePath("/sales", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/summary");
  const href = destination === "design" ? `/sales/${result.data.id}?tab=design#design-fees`
    : destination === "finance" ? `/sales/${result.data.id}?tab=money`
    : destination === "case" ? `/sales/${result.data.id}${nextTask ? `?task=${nextTask}` : ""}` : destination;
  redirect(withSuccessFeedback(href, name));
}
