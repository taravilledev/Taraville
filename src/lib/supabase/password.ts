import { z } from "zod";

export const passwordChangeSchema = z.object({
  current: z.string().min(1).max(1024),
  password: z.string().min(6).max(128),
  confirmation: z.string().min(6).max(128),
}).refine(value => value.password === value.confirmation)
  .refine(value => value.password !== value.current);
