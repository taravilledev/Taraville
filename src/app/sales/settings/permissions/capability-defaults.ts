import { z } from "zod";

// Shape of rpc sales_capability_defaults(): the actions each role may do with no per-person override. Executives get everything.
export const capabilityDefaultsSchema = z.object({ sale: z.string().array(), staff: z.string().array() });
export type CapabilityDefaults = z.infer<typeof capabilityDefaultsSchema>;
export type StaffRole = "sale" | "executive" | "staff";

export function parseCapabilityDefaults(data: unknown): CapabilityDefaults | null {
  const parsed = capabilityDefaultsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function defaultEnabled(role: StaffRole, action: string, defaults: CapabilityDefaults): boolean {
  return role === "executive" || defaults[role].includes(action);
}

export function defaultScope(role: StaffRole, action: string): "own" | "all" {
  return role === "executive" || action === "catalog.manage" ? "all" : "own";
}
