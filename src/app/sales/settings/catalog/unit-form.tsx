import { useId } from "react";
import type { z } from "zod";
import type { unitSchema } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { ActionForm } from "@/app/walkin/action-form";
import { saveUnit } from "../../actions";
import { checkRowClass } from "@/components/check-row";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function UnitForm({ developmentId, unit, requestId, backHref }: { developmentId: string; unit?: z.infer<typeof unitSchema>; requestId: string; backHref?: string }) {
  const id = useId();
  const detail = (key: string) => typeof unit?.details[key] === "string" ? unit.details[key] as string : "";
  return <ActionForm action={saveUnit.bind(null, { id: unit?.id ?? null, version: unit?.version ?? null, developmentId, requestId })} label={unit ? "บันทึกบ้าน/แปลง" : "เพิ่มบ้าน/แปลง"} secondaryAction={backHref ? { href: backHref, label: "ยกเลิก" } : undefined}>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <Field><FieldLabel htmlFor={`${id}-code`}>เลขบ้าน/แปลง</FieldLabel><Input id={`${id}-code`} name="code" required maxLength={80} defaultValue={unit?.code} /></Field>
      <Field><FieldLabel htmlFor={`${id}-model`}>แบบบ้าน</FieldLabel><Input id={`${id}-model`} name="model" maxLength={200} defaultValue={detail("model")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-usable_area`}>พื้นที่ใช้สอย (ตร.ม.)</FieldLabel><Input id={`${id}-usable_area`} name="usable_area" inputMode="decimal" maxLength={20} defaultValue={detail("usable_area")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-land_area`}>เนื้อที่ดิน (ตร.ว.)</FieldLabel><Input id={`${id}-land_area`} name="land_area" inputMode="decimal" maxLength={20} defaultValue={detail("land_area")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-layout`}>ฟังก์ชันภายใน</FieldLabel><Input id={`${id}-layout`} name="layout" maxLength={500} defaultValue={detail("layout")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-build_status`}>สถานะก่อสร้าง</FieldLabel><Input id={`${id}-build_status`} name="build_status" maxLength={100} placeholder="เช่น พร้อมเข้าอยู่, ก่อสร้าง 70%" defaultValue={detail("build_status")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-list_price`}>ราคาทะเบียน (บาท)</FieldLabel><Input id={`${id}-list_price`} name="list_price" inputMode="decimal" defaultValue={unit?.list_price_cents != null ? formatMoney(unit.list_price_cents).replaceAll(",", "") : ""} /></Field>
    </div>
    <label className={checkRowClass}><input type="checkbox" name="is_active" defaultChecked={unit?.is_active ?? true} />เปิดใช้งาน</label>
    <p className="text-sm text-muted-foreground">การแก้ราคาทะเบียนไม่เปลี่ยนราคาหรือเอกสารของรายการขายที่เปิดไว้แล้ว</p>
  </ActionForm>;
}
