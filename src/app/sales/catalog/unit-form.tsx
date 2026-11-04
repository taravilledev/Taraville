import type { z } from "zod";
import type { unitSchema } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { ActionForm } from "@/app/walkin/action-form";
import { saveUnit } from "../actions";
import styles from "../sales.module.css";

export function UnitForm({ developmentId, unit, requestId }: { developmentId: string; unit?: z.infer<typeof unitSchema>; requestId: string }) {
  const detail = (key: string) => typeof unit?.details[key] === "string" ? unit.details[key] as string : "";
  return <ActionForm action={saveUnit.bind(null, { id: unit?.id ?? null, version: unit?.version ?? null, developmentId, requestId })} label={unit ? "บันทึกบ้าน/แปลง" : "เพิ่มบ้าน/แปลง"}>
    <div className={styles.grid}>
      <label className={styles.field}>เลขบ้าน/แปลง<input name="code" required maxLength={80} defaultValue={unit?.code} /></label>
      <label className={styles.field}>แบบบ้าน<input name="model" maxLength={200} defaultValue={detail("model")} /></label>
      <label className={styles.field}>พื้นที่ใช้สอย (ตร.ม.)<input name="usable_area" inputMode="decimal" maxLength={20} defaultValue={detail("usable_area")} /></label>
      <label className={styles.field}>เนื้อที่ดิน (ตร.ว.)<input name="land_area" inputMode="decimal" maxLength={20} defaultValue={detail("land_area")} /></label>
      <label className={styles.field}>ราคาทะเบียน (บาท)<input name="list_price" inputMode="decimal" defaultValue={unit?.list_price_cents != null ? formatMoney(unit.list_price_cents).replaceAll(",", "") : ""} /></label>
    </div>
    <label className={styles.check}><input type="checkbox" name="is_active" defaultChecked={unit?.is_active ?? true} />เปิดใช้งาน</label>
    <p className={styles.muted}>การแก้ราคาทะเบียนไม่เปลี่ยนราคาหรือเอกสารของรายการขายที่เปิดไว้แล้ว</p>
  </ActionForm>;
}
