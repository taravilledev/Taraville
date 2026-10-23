import { z } from "zod";

export const STAGE_LABELS = { received: "รับเข้า", contacted: "ติดต่อแล้ว", closed: "ปิด" } as const;
export type Stage = keyof typeof STAGE_LABELS;

export const CLOSE_REASON_CODES = ["not_interested", "bought_elsewhere", "not_ready", "unreachable", "duplicate", "other", "bought_with_us"] as const;
export const closeReasonSchema = z.enum(CLOSE_REASON_CODES);
export type CloseReason = z.infer<typeof closeReasonSchema>;
export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  not_interested: "ไม่สนใจแล้ว", bought_elsewhere: "ซื้อหรือสร้างกับที่อื่นแล้ว", not_ready: "งบหรือความพร้อมยังไม่พร้อม",
  unreachable: "ติดต่อไม่ได้", duplicate: "ข้อมูลซ้ำ", other: "อื่นๆ", bought_with_us: "ซื้อกับเราแล้ว",
};
/** Reasons offered for a brand; "bought with us" stands in for a sales module only Taraville needs (ADR 0008). */
export const closeReasonsFor = (brand: "BAAN_KUNAPAP" | "TARAVILLE") =>
  CLOSE_REASON_CODES.filter(code => code !== "bought_with_us" || brand === "TARAVILLE");

export const statusMutationSchema = z.object({
  id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid(),
});
export type StatusMutation = z.infer<typeof statusMutationSchema>;

export function parseCloseForm(context: StatusMutation, form: FormData) {
  z.literal("on").parse(form.get("confirm_operation"));
  const reason = closeReasonSchema.parse(form.get("reason"));
  const text = z.string().trim().max(500).parse(form.get("reason_text") ?? "");
  if ((reason === "other") !== (text !== "")) throw new Error("reason_text");
  return { ...statusMutationSchema.parse(context), reason, text: text || null };
}
export function parseReopenForm(context: StatusMutation, form: FormData) {
  z.literal("on").parse(form.get("confirm_operation"));
  return statusMutationSchema.parse(context);
}
