import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { mutationError } from "@/lib/walkin/validation";
import type { ActionState } from "./action-form";

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/** Shared tail of the lead-stage and project actions: map RPC errors, check the returned row, then redirect. */
export async function finishMutation(leadId: string, schema: z.ZodType, call: () => PromiseLike<RpcResult>): Promise<ActionState> {
  let result: RpcResult;
  try { result = await call(); } catch { return { error: mutationError() }; }
  if (result.error) return { error: mutationError(result.error.code, result.error.message) };
  if (!schema.safeParse(result.data).success) return { error: "กรุณาเปิดรายการล่าสุดก่อนดำเนินการซ้ำ" };
  revalidatePath("/leads"); revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?saved=1`);
}
