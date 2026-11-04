"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import { brandLabels, type SalesBootstrap } from "@/lib/sales/models";
import { createCase } from "../actions";
import styles from "../sales.module.css";

export function NewCaseForm({ workspace, initialLead, requestId }: { workspace: SalesBootstrap; initialLead: string; requestId: string }) {
  const leads = workspace.leads.filter(lead => lead.brand === "TARAVILLE" || lead.project_id);
  const [leadId, setLeadId] = useState(leads.some(lead => lead.id === initialLead) ? initialLead : leads[0]?.id ?? "");
  const lead = leads.find(item => item.id === leadId);
  const units = workspace.developments.filter(development => development.is_active)
    .map(development => ({ ...development, units: development.units.filter(unit => unit.is_active && unit.is_available) }))
    .filter(development => development.units.length > 0);
  return <ActionForm action={createCase} label="เปิดรายการขาย">
    <input type="hidden" name="request_id" value={requestId} />
    <div className={styles.grid}>
      <label className={`${styles.field} ${styles.full}`}>Lead ลูกค้า<select name="lead_id" required value={leadId} onChange={event => setLeadId(event.target.value)}>
        <option value="" disabled>เลือกลูกค้า</option>{(Object.keys(brandLabels) as (keyof typeof brandLabels)[]).map(brand => <optgroup key={brand} label={brandLabels[brand]}>
          {leads.filter(item => item.brand === brand).map(item => <option key={item.id} value={item.id}>{item.full_name}{item.project_code ? ` · ${item.project_code}` : ""}</option>)}
        </optgroup>)}
      </select></label>
      {lead?.brand === "TARAVILLE" && !units.length && <p className={`${styles.notice} ${styles.full}`}>ยังไม่มีบ้าน/แปลงที่ว่าง เพิ่มหรือปล่อยแปลงได้ที่ <Link href="/sales/catalog" prefetch={false}>โครงการและบ้าน/แปลง</Link></p>}
      {lead?.brand === "TARAVILLE" && units.length > 0 && <label className={`${styles.field} ${styles.full}`}>บ้าน/แปลง<select name="unit_id" required defaultValue="">
        <option value="" disabled>เลือกบ้าน/แปลง</option>{units.map(development => <optgroup key={development.id} label={development.name}>
          {development.units.map(unit => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
        </optgroup>)}
      </select><small className={styles.muted}>เปิดร่างยังไม่กันแปลง ต้องยืนยันจองอีกครั้ง</small></label>}
      <label className={`${styles.field} ${styles.full}`}>ข้อมูลลูกค้า<select key={lead?.brand} name="customer_id" defaultValue="">
        <option value="">สร้างข้อมูลลูกค้าจาก Lead นี้</option>{workspace.customers.filter(customer => customer.brand === lead?.brand).map(customer => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
      </select><small className={styles.muted}>เลือกลูกค้าเดิมด้วยตัวเอง ระบบไม่รวมคนจากเบอร์โทรอัตโนมัติ</small></label>
    </div>
  </ActionForm>;
}
