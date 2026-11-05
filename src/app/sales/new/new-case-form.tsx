import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import type { SalesBootstrap } from "@/lib/sales/models";
import { createCase } from "../actions";
import styles from "../sales.module.css";

type Lead = SalesBootstrap["leads"][number];

export function NewCaseForm({ workspace, lead, requestId }: { workspace: SalesBootstrap; lead: Lead; requestId: string }) {
  const units = workspace.developments.filter(development => development.is_active)
    .map(development => ({ ...development, units: development.units.filter(unit => unit.is_active && unit.is_available) }))
    .filter(development => development.units.length > 0);
  return <ActionForm action={createCase} label="เปิดรายการขาย">
    <input type="hidden" name="request_id" value={requestId} />
    <div className={styles.grid}>
      <input type="hidden" name="lead_id" value={lead.id} />
      <p className={styles.full}>ลูกค้า: <strong>{lead.full_name}</strong>{lead.project_code ? ` · ${lead.project_code}` : ""}</p>
      {lead.brand === "TARAVILLE" && !units.length && <p className={`${styles.notice} ${styles.full}`}>ยังไม่มีบ้าน/แปลงที่ว่าง เพิ่มหรือปล่อยแปลงได้ที่ <Link href="/sales/catalog" prefetch={false}>โครงการและบ้าน/แปลง</Link></p>}
      {lead.brand === "TARAVILLE" && units.length > 0 && <label className={`${styles.field} ${styles.full}`}>บ้าน/แปลง<select name="unit_id" required defaultValue="">
        <option value="" disabled>เลือกบ้าน/แปลง</option>{units.map(development => <optgroup key={development.id} label={development.name}>
          {development.units.map(unit => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
        </optgroup>)}
      </select><small className={styles.muted}>เปิดร่างยังไม่กันแปลง ต้องยืนยันจองอีกครั้ง</small></label>}
      <label className={`${styles.field} ${styles.full}`}>ข้อมูลลูกค้า<select name="customer_id" defaultValue="">
        <option value="">สร้างข้อมูลลูกค้าจาก Lead นี้</option>{workspace.customers.filter(customer => customer.brand === lead.brand).map(customer => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
      </select><small className={styles.muted}>เลือกลูกค้าเดิมด้วยตัวเอง ระบบไม่รวมคนจากเบอร์โทรอัตโนมัติ</small></label>
    </div>
  </ActionForm>;
}
