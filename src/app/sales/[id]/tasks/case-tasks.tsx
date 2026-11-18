import { ActionForm } from "@/app/walkin/action-form";
import { assignCase } from "../../actions";
import { saveReservation } from "../../adjustment-actions";
import { CaseForm } from "../case-form";
import styles from "../../sales.module.css";
import { checkRowClass } from "@/components/check-row";
import { idOf, type TaskData } from "./task-data";

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
  return <ActionForm action={assignCase.bind(null, idOf(sale))} label="เปลี่ยนผู้รับผิดชอบ">
    <p className="text-sm text-muted-foreground">ไม่เปลี่ยนเจ้าของ Lead หรือเพิ่มสิทธิ์การเงินให้ผู้รับผิดชอบใหม่</p>
    <label className={styles.field}>ผู้รับผิดชอบ<select name="responsible_id" defaultValue={sale.responsible_id}>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
  </ActionForm>;
}
