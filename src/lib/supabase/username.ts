import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z][a-z0-9_-]*$/);

export function usernameEmail(username: string) {
  return `${usernameSchema.parse(username)}@staff.taraville.invalid`;
}
