import { z } from "zod";
import notice from "../../../docs/walkin/notices/walkin-live-2026-10-30.1.json";
import syntheticNotice from "../../../docs/walkin/notices/walkin-synthetic-2026-10-21.1.json";

export const PRIVACY_NOTICE = notice;
export const SYNTHETIC_NOTICE = syntheticNotice;
export function privacyNotice(mode: "synthetic" | "real") {
  return mode === "synthetic" ? SYNTHETIC_NOTICE : PRIVACY_NOTICE;
}
export const privacyEventSchema = z.object({
  id: z.number().int(), kind: z.enum(["initial", "survey_choice", "contact"]),
  survey_consent: z.boolean().nullable(), notice_presented: z.boolean().nullable(),
  followup_requested: z.boolean().nullable(), notice_version: z.string(),
  notice_hash: z.string(), recorded_at: z.string(), actor_id: z.uuid(),
});
export type PrivacyEvent = z.infer<typeof privacyEventSchema>;
export function surveyChoice(events: PrivacyEvent[]): boolean | null {
  return events.find(event => event.survey_consent !== null)?.survey_consent ?? null;
}

export function parsePrivacyIntake(form: FormData) {
  // One tick attests both notice_presented and followup_requested; the survey consent stays separate.
  z.literal("on").parse(form.get("intake_confirmed"));
  // An unchecked consent box submits nothing; the optional survey is then dropped by parseLeadForm.
  return z.literal("yes").nullable().parse(form.get("survey_consent")) === "yes";
}

export const privacyMutationSchema = z.object({
  id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid(),
  operation: z.enum(["contact", "opt_in", "withdraw"]),
});
export type PrivacyMutation = z.infer<typeof privacyMutationSchema>;
export function parsePrivacyMutation(context: PrivacyMutation, form: FormData) {
  const parsed = privacyMutationSchema.parse(context);
  z.literal("on").parse(form.get("confirm_operation"));
  if (parsed.operation === "opt_in") z.literal("on").parse(form.get("notice_presented"));
  return parsed;
}
