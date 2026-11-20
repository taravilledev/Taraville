import { z } from "zod";
import type { StatusTone } from "@/components/status";

export const STAGE_CODES = ["received", "contacted", "project_opened", "closed"] as const;
export const stageSchema = z.enum(STAGE_CODES);
export type Stage = z.infer<typeof stageSchema>;
export const STAGE_LABELS: Record<Stage, string> = { received: "รับเข้า", contacted: "ติดต่อแล้ว", project_opened: "เปิดโครงการแล้ว", closed: "ปิด" };

// The UI shows three groups, never "ติดต่อแล้ว": contact is no longer recorded (ADR 0059). STAGE_LABELS stays for the report and CSV.
export const STAGE_GROUPS = ["open", "project", "closed"] as const;
export type StageGroup = (typeof STAGE_GROUPS)[number];
export const STAGE_GROUP_LABELS: Record<StageGroup, string> = { open: "ยังไม่เปิดโครงการ", project: "เปิดโครงการแล้ว", closed: "ปิด" };
export const STAGE_GROUP_TONES: Record<StageGroup, StatusTone> = { open: "waiting", project: "success", closed: "inactive" };
export const STAGE_GROUP_CODES: Record<StageGroup, readonly Stage[]> = { open: ["received", "contacted"], project: ["project_opened"], closed: ["closed"] };
export const stageGroupOf = (stage: Stage): StageGroup => STAGE_GROUPS.find(group => STAGE_GROUP_CODES[group].includes(stage)) ?? "open";
export const stageGroupLabel = (stage: Stage) => STAGE_GROUP_LABELS[stageGroupOf(stage)];

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

const projectCancelContextSchema = statusMutationSchema.extend({ leadId: z.uuid(), caseId: z.uuid().optional() });
export type ProjectCancelContext = z.infer<typeof projectCancelContextSchema>;
export function parseCancelProjectForm(context: ProjectCancelContext, form: FormData) {
  z.literal("on").parse(form.get("confirm_operation"));
  const reason = z.string().trim().min(1).max(500).parse(form.get("reason"));
  return { ...projectCancelContextSchema.parse(context), reason };
}
