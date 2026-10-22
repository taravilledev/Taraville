import { z } from "zod";

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
  privacy_mode: z.literal("synthetic"), last_contact_at: z.string().nullable(),
});
export type Lead = z.infer<typeof leadSchema>;
export const LEAD_COLUMNS = "id,brand,name_title,first_name,last_name,phone,line_id,survey,owner_id,created_by,version,created_at,updated_at,privacy_mode,last_contact_at";
