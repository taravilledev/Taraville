import { ActionForm } from "@/app/walkin/action-form";
import type { SalesCase } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { saveCase } from "../actions";
import styles from "../sales.module.css";

export function CaseForm({ sale, requestId }: { sale: SalesCase; requestId: string }) {
  const snapshot = sale.customer_snapshot;
  const detail = (key: string) => typeof sale.details?.[key] === "string" ? sale.details[key] as string : "";
  const money = (value: string | null | undefined) => value != null ? formatMoney(value).replaceAll(",", "") : "";
  return <ActionForm action={saveCase.bind(null, { id: sale.id, version: sale.version, requestId })} label="บันทึกข้อมูลการขาย">
    <div className={styles.grid}>
      <label className={styles.field}>ชื่อลูกค้า<input name="full_name" required maxLength={200} defaultValue={snapshot?.full_name} /></label>
      <label className={styles.field}>ชื่อเล่น<input name="nickname" maxLength={200} defaultValue={snapshot?.nickname} /></label>
      <label className={styles.field}>เบอร์โทรศัพท์<input name="phone" type="tel" maxLength={80} defaultValue={snapshot?.phone} /></label>
      <label className={styles.field}>ฝ่ายขายในเอกสาร<input name="salesperson" maxLength={200} defaultValue={snapshot?.salesperson} /></label>
      <label className={`${styles.field} ${styles.full}`}>ที่อยู่ลูกค้า<textarea name="address" maxLength={2000} defaultValue={snapshot?.address} /></label>
      <label className={styles.field}>แบบบ้าน<input name="model" maxLength={200} defaultValue={detail("model")} /></label>
      <label className={styles.field}>จำนวนชั้น<input name="stories" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("stories")} /></label>
      <label className={styles.field}>ห้องนอน<input name="bedrooms" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("bedrooms")} /></label>
      <label className={styles.field}>ห้องน้ำ<input name="bathrooms" inputMode="numeric" pattern="[0-9]*" maxLength={3} defaultValue={detail("bathrooms")} /></label>
      <label className={styles.field}>พื้นที่ใช้สอย (ตร.ม.)<input name="usable_area" inputMode="decimal" maxLength={20} defaultValue={detail("usable_area")} /></label>
      <label className={styles.field}>เนื้อที่ดิน (ตร.ว.)<input name="land_area" inputMode="decimal" maxLength={20} defaultValue={detail("land_area")} /></label>
      <label className={styles.field}>ราคาขาย (บาท)<input name="list_price" inputMode="decimal" defaultValue={money(sale.list_price_cents)} /></label>
      <label className={styles.field}>ราคาโปรโมชั่น (บาท)<input name="promotion_price" inputMode="decimal" defaultValue={money(sale.promotion_price_cents)} /><small className={styles.muted}>เว้นว่างเพื่อใช้ราคาขาย ยอด 0 หมายถึงราคาโปรโมชั่น 0 บาท</small></label>
      <label className={styles.field}>ส่วนลดเพิ่มเติม (บาท)<input name="discount" inputMode="decimal" defaultValue={money(sale.discount_cents)} /></label>
      <label className={`${styles.field} ${styles.full}`}>หมายเหตุ<textarea name="notes" maxLength={5000} defaultValue={detail("notes")} /></label>
    </div>
  </ActionForm>;
}
