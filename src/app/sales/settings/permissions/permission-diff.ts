export type Scope = "own" | "all";
export type Perm = { enabled: boolean; scope: Scope };
export type PermChange = { action: string; from: Perm; to: Perm };

const enabledText = (value: boolean) => value ? "เปิด" : "ปิด";
export const scopeText = (value: Scope) => value === "own" ? "เฉพาะของตน" : "ทั้งหมด";

/** Capabilities whose edited value differs from the saved one; reverting an edit drops it from the list. */
export function diffPermissions(saved: Record<string, Perm>, current: Record<string, Perm>): PermChange[] {
  return Object.keys(saved).flatMap(action => {
    const from = saved[action], to = current[action] ?? from;
    return from.enabled === to.enabled && from.scope === to.scope ? [] : [{ action, from, to }];
  });
}

/** "<label>: ปิด → เปิด · เฉพาะของตน → ทั้งหมด", listing only the parts that changed. */
export function describeChange(label: string, { from, to }: PermChange): string {
  const parts = [
    from.enabled !== to.enabled && `${enabledText(from.enabled)} → ${enabledText(to.enabled)}`,
    from.scope !== to.scope && `${scopeText(from.scope)} → ${scopeText(to.scope)}`,
  ].filter(Boolean);
  return `${label}: ${parts.join(" · ")}`;
}
