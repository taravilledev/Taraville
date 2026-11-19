import { z } from "zod";

export const refundSchema = z.object({ id: z.uuid(), root_payment_id: z.uuid(), amount_cents: z.string().regex(/^\d+$/),
  reason: z.string(), state: z.enum(["pending", "approved", "rejected", "withdrawn", "paid"]), requested_by: z.uuid(),
  requested_by_name: z.string(), requested_at: z.string(), decided_by: z.uuid().nullable(), decision_note: z.string().nullable(), document_id: z.uuid().nullable() });
export type Refund = z.infer<typeof refundSchema>;
