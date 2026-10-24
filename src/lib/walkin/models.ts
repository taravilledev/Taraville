import { z } from "zod";
import { closeReasonSchema, stageSchema } from "./lead-stage";

export const staffSchema = z.object({
  id: z.uuid(), full_name: z.string(), role: z.enum(["sale", "executive"]), is_active: z.boolean(),
});
export type Staff = z.infer<typeof staffSchema>;
export const leadSchema = z.object({
  id: z.uuid(), brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]),
  name_title: z.string(), first_name: z.string(), last_name: z.string(), phone: z.string(), line_id: z.string(),
  survey: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  owner_id: z.uuid(), created_by: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  created_at: z.string(), updated_at: z.string(),
  privacy_mode: z.enum(["synthetic", "real"]), last_contact_at: z.string().nullable(),
  closed_at: z.string().nullable(), closed_by: z.uuid().nullable(), closed_reason: closeReasonSchema.nullable(),
});
export type Lead = z.infer<typeof leadSchema>;
/** A lead as read from `walkin_leads_staged`, the one SQL definition of stage. */
export const listLeadSchema = leadSchema.extend({ stage: stageSchema });
export type ListLead = z.infer<typeof listLeadSchema>;
export const LEAD_COLUMNS = "id,brand,name_title,first_name,last_name,phone,line_id,survey,owner_id,created_by,version,created_at,updated_at,privacy_mode,last_contact_at,closed_at,closed_by,closed_reason";
export const projectSchema = z.object({
  id: z.uuid(), code: z.string(), status: z.enum(["active", "cancelled"]), lead_id: z.uuid(),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), created_at: z.string(),
  cancelled_at: z.string().nullable(), cancelled_by: z.uuid().nullable(), cancel_reason: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;
export const PROJECT_COLUMNS = "id,code,status,lead_id,version,created_at,cancelled_at,cancelled_by,cancel_reason";
