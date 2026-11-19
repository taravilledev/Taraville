import { useId } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { assignCase } from "../../actions";
import { saveReservation } from "../../adjustment-actions";
import { CaseForm } from "../case-form";
import { checkRowClass } from "@/components/check-row";
import { idOf, type TaskData } from "./task-data";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";

export function EditCaseTask({ sale }: TaskData) {
  return <CaseForm sale={sale} requestId={crypto.randomUUID()} />;
}

export function ReserveTask({ sale }: TaskData) {
  return <ActionForm action={saveReservation.bind(null, "confirm", idOf(sale))} label="ยืนยันจองแปลง">
    <p className="text-sm text-muted-foreground">ร่างยังไม่กันแปลง ยืนยันแล้วแปลงจะไม่ถูกขายซ้ำ</p>
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ยืนยันกันแปลงนี้ไว้ให้ลูกค้า</label>
  </ActionForm>;
}

export function AssignTask({ sale, owners }: TaskData) {
  const id = useId();
  return <ActionForm action={assignCase.bind(null, idOf(sale))} label="เปลี่ยนผู้รับผิดชอบ">
    <p className="text-sm text-muted-foreground">ไม่เปลี่ยนเจ้าของ Lead หรือเพิ่มสิทธิ์การเงินให้ผู้รับผิดชอบใหม่</p>
    <Field><FieldLabel htmlFor={`${id}-responsible_id`}>ผู้รับผิดชอบ</FieldLabel><NativeSelect id={`${id}-responsible_id`} name="responsible_id" defaultValue={sale.responsible_id}>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</NativeSelect></Field>
  </ActionForm>;
}
