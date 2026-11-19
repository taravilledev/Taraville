import { useId } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { recordAcceptance } from "../agreement-actions";
import { EvidenceUpload } from "../evidence-upload";
import { checkRowClass } from "@/components/check-row";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AcceptanceForm({ caseId, identity, requiresDate = false }: {
  caseId: string; identity: { id: string; version: number; requestId: string };
  requiresDate?: boolean;
}) {
  const id = useId();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <ActionForm action={recordAcceptance.bind(null, identity)} label="บันทึกผลตรวจรับงานและลูกค้ายอมรับ">
    {requiresDate && <Field><FieldLabel htmlFor={`${id}-acceptance_date`}>วันที่ตรวจรับจริง</FieldLabel><Input id={`${id}-acceptance_date`} aria-describedby={`${id}-acceptance_date-hint`} type="date" name="acceptance_date" required defaultValue={today} max={today} /><FieldDescription id={`${id}-acceptance_date-hint`}>ใช้วันที่ตรวจรับจริงตามหลักฐาน ระบบจะกำหนดชำระภายใน 30 วันปฏิทินหลังวันที่ระบุ</FieldDescription></Field>}
    <EvidenceUpload caseId={caseId} category="acceptance" />
    <Field><FieldLabel htmlFor={`${id}-note`}>ผลการตรวจรับ</FieldLabel><Textarea id={`${id}-note`} name="note" required maxLength={3000} /></Field>
    <label className={checkRowClass}><input type="checkbox" name="inspected" required />ตรวจงานตามงวดแล้ว</label>
    <label className={checkRowClass}><input type="checkbox" name="customer_accepted" required />ลูกค้ายอมรับงานตามหลักฐานแล้ว</label>
  </ActionForm>;
}
