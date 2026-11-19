import { useId } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import type { SalesCase } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { saveCase } from "../actions";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CaseForm({ sale, requestId }: { sale: SalesCase; requestId: string }) {
  const id = useId();
  const snapshot = sale.customer_snapshot;
  const detail = (key: string) => typeof sale.details?.[key] === "string" ? sale.details[key] as string : "";
  const money = (value: string | null | undefined) => value != null ? formatMoney(value).replaceAll(",", "") : "";
  return <ActionForm action={saveCase.bind(null, { id: sale.id, version: sale.version, requestId })} label="บันทึกข้อมูลการขาย">
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <Field><FieldLabel htmlFor={`${id}-full_name`}>ชื่อลูกค้า</FieldLabel><Input id={`${id}-full_name`} name="full_name" required maxLength={200} defaultValue={snapshot?.full_name} /></Field>
      <Field><FieldLabel htmlFor={`${id}-nickname`}>ชื่อเล่น</FieldLabel><Input id={`${id}-nickname`} name="nickname" maxLength={200} defaultValue={snapshot?.nickname} /></Field>
      <Field><FieldLabel htmlFor={`${id}-phone`}>เบอร์โทรศัพท์</FieldLabel><Input id={`${id}-phone`} name="phone" type="tel" maxLength={80} defaultValue={snapshot?.phone} /></Field>
      <Field><FieldLabel htmlFor={`${id}-salesperson`}>ฝ่ายขายในเอกสาร</FieldLabel><Input id={`${id}-salesperson`} name="salesperson" maxLength={200} defaultValue={snapshot?.salesperson} /></Field>
      <Field className="col-span-full"><FieldLabel htmlFor={`${id}-address`}>ที่อยู่ลูกค้า</FieldLabel><Textarea id={`${id}-address`} className="min-h-[100px]" name="address" maxLength={2000} defaultValue={snapshot?.address} /></Field>
      <Field><FieldLabel htmlFor={`${id}-model`}>แบบบ้าน</FieldLabel><Input id={`${id}-model`} name="model" maxLength={200} defaultValue={detail("model")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-stories`}>จำนวนชั้น</FieldLabel><Input id={`${id}-stories`} name="stories" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("stories")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-bedrooms`}>ห้องนอน</FieldLabel><Input id={`${id}-bedrooms`} name="bedrooms" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("bedrooms")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-bathrooms`}>ห้องน้ำ</FieldLabel><Input id={`${id}-bathrooms`} name="bathrooms" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("bathrooms")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-usable_area`}>พื้นที่ใช้สอย (ตร.ม.)</FieldLabel><Input id={`${id}-usable_area`} name="usable_area" inputMode="decimal" maxLength={20} defaultValue={detail("usable_area")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-land_area`}>เนื้อที่ดิน (ตร.ว.)</FieldLabel><Input id={`${id}-land_area`} name="land_area" inputMode="decimal" maxLength={20} defaultValue={detail("land_area")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-list_price`}>ราคาขาย (บาท)</FieldLabel><Input id={`${id}-list_price`} name="list_price" inputMode="decimal" defaultValue={money(sale.list_price_cents)} /></Field>
      <Field><FieldLabel htmlFor={`${id}-promotion_price`}>ราคาโปรโมชั่น (บาท)</FieldLabel><Input id={`${id}-promotion_price`} aria-describedby={`${id}-promotion_price-hint`} name="promotion_price" inputMode="decimal" defaultValue={money(sale.promotion_price_cents)} /><FieldDescription id={`${id}-promotion_price-hint`}>เว้นว่างเพื่อใช้ราคาขาย ยอด 0 หมายถึงราคาโปรโมชั่น 0 บาท</FieldDescription></Field>
      <Field><FieldLabel htmlFor={`${id}-discount`}>ส่วนลดเพิ่มเติม (บาท)</FieldLabel><Input id={`${id}-discount`} name="discount" inputMode="decimal" defaultValue={money(sale.discount_cents)} /></Field>
      <Field className="col-span-full"><FieldLabel htmlFor={`${id}-notes`}>หมายเหตุ</FieldLabel><Textarea id={`${id}-notes`} name="notes" maxLength={5000} defaultValue={detail("notes")} /></Field>
    </div>
  </ActionForm>;
}
