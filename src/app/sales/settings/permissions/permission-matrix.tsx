"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Status } from "@/components/status";
import { useConfirm } from "@/components/confirm-dialog";
import { formErrorClass } from "@/components/form-feedback";
import { panelClass } from "@/components/panel";
import type { ActionState } from "@/app/walkin/action-form";
import { describeChange, diffPermissions, scopeText, type Perm, type Scope } from "./permission-diff";
import { savePermissions } from "./save-permissions";

export type MatrixRow = { action: string; label: string; saved: Perm; fallback: Perm; isOverride: boolean; isScopeFixed: boolean };
export type MatrixGroup = { title: string; rows: MatrixRow[] };

const same = (a: Perm, b: Perm) => a.enabled === b.enabled && a.scope === b.scope;
const scopes: Scope[] = ["own", "all"];

export function PermissionMatrix({ staffId, staffName, groups }: { staffId: string; staffName: string; groups: MatrixGroup[] }) {
  const rows = groups.flatMap(group => group.rows);
  const [edits, setEdits] = useState<Record<string, Perm>>({});
  const [state, submit, isPending] = useActionState<ActionState, FormData>(savePermissions, { error: "" });
  const { confirm, confirmDialog } = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const current = (row: MatrixRow) => edits[row.action] ?? row.saved;
  const changes = diffPermissions(
    Object.fromEntries(rows.map(row => [row.action, row.saved])), Object.fromEntries(rows.map(row => [row.action, current(row)])));
  const labelOf = (action: string) => rows.find(row => row.action === action)?.label ?? action;
  const set = (row: MatrixRow, patch: Partial<Perm>) => setEdits(previous => ({ ...previous, [row.action]: { ...current(row), ...patch } }));

  async function review() {
    const isConfirmed = await confirm({
      title: `บันทึกสิทธิ์ของ ${staffName}`, cancelLabel: "กลับไปแก้", confirmLabel: "บันทึกสิทธิ์", isDestructive: false,
      description: `${changes.length} รายการ · ` + changes.map(change => describeChange(labelOf(change.action), change)).join(" ; "),
    });
    if (isConfirmed) form.current?.requestSubmit();
  }

  return <form ref={form} action={submit} className="flex flex-col gap-4">
    <input type="hidden" name="staff_id" value={staffId} />
    <input type="hidden" name="changes" value={JSON.stringify(changes.map(change => ({ action: change.action, ...change.to })))} />
    {groups.map(group => <section key={group.title} className={panelClass} aria-label={group.title}>
      <h2 className="m-0 mb-3">{group.title}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {group.rows.map(row => {
          const value = current(row);
          return <li key={row.action} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0">
            <div className="min-w-0 flex-[1_1_14rem]">
              <h3 className="m-0 text-base font-semibold">{row.label}</h3>
              <small className="text-muted-foreground">{row.action}</small>
            </div>
            <label className="inline-flex min-h-(--tap-min) items-center gap-2">
              <Checkbox checked={value.enabled} onCheckedChange={checked => set(row, { enabled: checked === true })} disabled={isPending} />
              อนุญาต
            </label>
            {row.isScopeFixed ? <span className="text-muted-foreground">ทุกรายการ (กำหนดตายตัว)</span>
              : <RadioGroup className="flex gap-4" value={value.scope} onValueChange={scope => set(row, { scope: scope === "all" ? "all" : "own" })}
                  disabled={isPending || !value.enabled} aria-label={`ขอบเขต ${row.label}`}>
                {scopes.map(scope => <label key={scope} className="inline-flex min-h-(--tap-min) items-center gap-2">
                  <RadioGroupItem value={scope} />{scopeText(scope)}
                </label>)}
              </RadioGroup>}
            <div className="flex items-center gap-2">
              <Status tone={row.isOverride ? "progress" : "inactive"}>{row.isOverride ? "ตั้งเฉพาะคน" : "ค่าเริ่มต้น"}</Status>
              {!same(value, row.fallback) && <Button type="button" variant="ghost" size="sm" disabled={isPending}
                onClick={() => set(row, row.fallback)}>คืนค่าเริ่มต้น</Button>}
            </div>
          </li>;
        })}
      </ul>
    </section>)}
    {state.error && <p className={formErrorClass} role="alert">{state.error}</p>}
    <div className="sticky bottom-0 z-[5] -mx-3 flex flex-wrap items-center justify-between gap-2 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-[640px]:-mx-2 max-[640px]:px-2">
      <strong aria-live="polite">{changes.length ? `เปลี่ยน ${changes.length} รายการ · ยังไม่ได้บันทึก` : "ยังไม่มีการเปลี่ยนแปลง"}</strong>
      <span className="flex gap-2">
        <Button type="button" variant="secondary" disabled={!changes.length || isPending} onClick={() => setEdits({})}>ยกเลิกการเปลี่ยน</Button>
        <Button type="button" disabled={!changes.length || isPending} onClick={review}>{isPending ? "กำลังบันทึก…" : "ตรวจและบันทึก"}</Button>
      </span>
    </div>
    {confirmDialog}
  </form>;
}
