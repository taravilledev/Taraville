import { useId } from "react";
import { randomUUID } from "node:crypto";
import type { SalesBootstrap } from "@/lib/sales/models";
import { ActionForm } from "@/app/walkin/action-form";
import { saveDevelopment } from "../../actions";
import { checkRowClass } from "@/components/check-row";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DevelopmentForm({ development }: { development?: SalesBootstrap["developments"][number] }) {
  const id = useId();
  return <ActionForm action={saveDevelopment.bind(null, { id: development?.id ?? null, version: development?.version ?? null, requestId: randomUUID() })}
    label={development ? "บันทึกโครงการ" : "เพิ่มโครงการ"}>
    <div className="grid gap-4">
      <Field><FieldLabel htmlFor={`${id}-name`}>ชื่อโครงการ</FieldLabel><Input id={`${id}-name`} name="name" required maxLength={200} defaultValue={development?.name} /></Field>
      <Field><FieldLabel htmlFor={`${id}-address`}>ที่ตั้งโครงการ</FieldLabel><Textarea id={`${id}-address`} className="min-h-[100px]" name="address" maxLength={2000} defaultValue={development?.address} /></Field>
    </div>
    <label className={checkRowClass}><input type="checkbox" name="is_active" defaultChecked={development?.is_active ?? true} />เปิดใช้งาน</label>
  </ActionForm>;
}
