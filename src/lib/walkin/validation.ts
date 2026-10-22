import { z } from "zod";
import { SURVEY_QUESTIONS } from "./survey-questions";

export const mutationContextSchema = z.object({
  brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]), requestId: z.uuid(),
  id: z.uuid().optional(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).refine(value => Boolean(value.id) === Boolean(value.version));
export type MutationContext = z.infer<typeof mutationContextSchema>;
const contactSchema = z.object({
  name_title: z.string().max(200), first_name: z.string().trim().min(1).max(200),
  last_name: z.string().max(200), phone: z.string().trim().min(1).max(80), line_id: z.string().max(200),
});

export function parseLeadForm(context: MutationContext, form: FormData, isSurveyAllowed = true) {
  const contact = contactSchema.parse(Object.fromEntries(
    ["name_title", "first_name", "last_name", "phone", "line_id"].map(key => [key, form.get(key) ?? ""]),
  ));
  z.literal("on").parse(form.get("synthetic_only"));
  const owner = z.uuid().parse(form.get("owner_id"));
  if (!isSurveyAllowed) {
    for (const key of form.keys()) {
      if (key.startsWith("survey.") && key !== "survey.sales_staff") throw new Error("Survey declined");
    }
    const staff = z.string().max(4000).parse(form.get("survey.sales_staff"));
    return { contact, owner, survey: { sales_staff: staff } as Record<string, string | string[]> };
  }
  const survey: Record<string, string | string[]> = {};
  const allowed = new Set<string>();
  for (const question of SURVEY_QUESTIONS[context.brand]) {
    const key = `survey.${question.key}`;
    allowed.add(key);
    const values = z.array(z.string().max(4000)).parse(form.getAll(key));
    if (question.kind === "multi") {
      if (!("options" in question) || values.some(value => !question.options.includes(value))) throw new Error("Invalid choice");
      survey[question.key] = [...new Set(values)];
    } else {
      if (values.length > 1) throw new Error("Multiple values");
      const value = values[0] ?? "";
      if (value && "options" in question && !question.options.includes(value)) throw new Error("Invalid choice");
      if (value && question.kind === "number" && !/^[0-9]+([.][0-9]+)?$/.test(value)) throw new Error("Invalid number");
      if (value) survey[question.key] = value;
    }
    if ("options" in question && question.options.includes("อื่นๆ")) {
      allowed.add(`${key}_other`);
      const values = z.array(z.string().max(4000)).max(1).parse(form.getAll(`${key}_other`));
      const other = values[0] ?? "";
      const answer = survey[question.key];
      if (other && (answer === "อื่นๆ" || (Array.isArray(answer) && answer.includes("อื่นๆ")))) {
        survey[`${question.key}_other`] = other;
      }
    }
  }
  for (const key of form.keys()) {
    if (key.startsWith("survey.") && !allowed.has(key)) throw new Error("Unknown question");
  }
  if (new TextEncoder().encode(JSON.stringify(survey)).length > 32000) throw new Error("Survey too large");
  return { contact, survey, owner };
}

export function mutationError(code?: string, message?: string) {
  if (code === "PT409" || code === "40001") return "ข้อมูลถูกแก้ไขไปแล้ว กรุณาเปิดรายการล่าสุดก่อนแก้ไขอีกครั้ง";
  if (code === "42501") return "คุณไม่มีสิทธิ์แก้ไขรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดรายการใหม่";
  if (message === "request_conflict") return "คำขอนี้ถูกบันทึกไปแล้วด้วยข้อมูลต่างกัน กรุณาตรวจรายการก่อนเริ่มใหม่";
  if (code === "22023") return "ข้อมูลหรือผู้ดูแลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่";
  return "บันทึกไม่สำเร็จ กรุณาลองส่งซ้ำจากฟอร์มเดิม หากยังไม่ได้ให้ติดต่อผู้ดูแล";
}
