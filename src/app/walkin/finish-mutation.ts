import { redirect } from "next/navigation";
import { withSuccessFeedback } from "@/lib/action-feedback";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { mutationError } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/** Shared tail of the lead-stage and project actions: map RPC errors, check the returned row, then redirect. */
export async function finishMutation<Schema extends z.ZodType>(
  leadId: string, schema: Schema, call: () => PromiseLike<RpcResult>,
  onSaved?: (row: z.output<Schema>) => Promise<ActionState>,
): Promise<ActionState> {
  let result: RpcResult;
  try { result = await call(); } catch { return { error: mutationError() }; }
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  const saved = schema.safeParse(result.data);
  if (!saved.success) return { error: "กรุณาเปิดรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/dashboard");
  revalidatePath("/leads"); revalidatePath(`/leads/${leadId}`);
  if (onSaved) return onSaved(saved.data);
  redirect(withSuccessFeedback(`/leads/${leadId}?saved=1`, "saved"));
}
