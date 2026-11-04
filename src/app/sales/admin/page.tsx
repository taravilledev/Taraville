import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import Link from "next/link";
import { salesBootstrap } from "@/lib/sales/queries";
import { capabilityLabels, type Capability } from "@/lib/sales/models";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { ActionForm } from "@/app/walkin/action-form";
import { setCapability } from "../actions";
import styles from "../sales.module.css";

export const metadata = { title: "จัดสิทธิ์งานและการเงิน · Taraville Group", robots: { index: false, follow: false } };
export default function AdminPage() { return <Suspense fallback={<PageSkeleton />}><Admin /></Suspense>; }
async function Admin() {
  const { staff, workspace } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/sales");
  return <AppShell staff={staff} wide><div className={styles.page}>
    <div className={styles.header}><div><h1>จัดสิทธิ์งานและการเงิน</h1><p>กำหนดแต่ละงานแยกกัน การเป็นผู้รับผิดชอบงานไม่เพิ่มสิทธิ์การเงิน</p></div><Link className={styles.link} href="/sales" prefetch={false}>กลับรายการงาน</Link></div>
    <p className={styles.notice}>ขอบเขต “ของตน” สำหรับการเงินยึดเจ้าของ Lead ปัจจุบัน ส่วนข้อมูลงานยึดผู้รับผิดชอบงาน การอนุมัติคืนเงินห้ามอนุมัติคำขอของตัวเองแม้มีสิทธิ์ครบ</p>
    <Link className={styles.link} href="/sales/admin/issuers" prefetch={false}>ตั้งค่าบริษัทผู้ออกเอกสาร</Link>
    {workspace.staff.filter(user => user.is_active).map(user => <details key={user.id} className={styles.panel}>
      <summary>{user.full_name} · {user.role === "executive" ? "ผู้บริหาร" : "พนักงาน"}</summary>
      {(Object.keys(capabilityLabels) as Capability[]).map(action => {
        const override = user.capabilities.find(item => item.action === action);
        const ownDefault = ["case.view", "case.create", "case.edit", "financial.view"].includes(action);
        const enabled = override?.enabled ?? (user.role === "executive" || (ownDefault && (user.role === "sale" || action === "financial.view")));
        const scope = override?.scope ?? (user.role === "executive" ? "all" : "own");
        return <section key={action} className={styles.capability} aria-label={capabilityLabels[action]}>
          <p><strong>{capabilityLabels[action]}</strong> <small className={styles.muted}>{override ? "กำหนดไว้แล้ว" : "ค่าเริ่มต้น"}</small></p>
          <ActionForm action={setCapability} label="บันทึกสิทธิ์">
            <input type="hidden" name="staff_id" value={user.id} /><input type="hidden" name="capability" value={action} /><input type="hidden" name="request_id" value={randomUUID()} />
            <div className={styles.grid}><label className={styles.field}>สิทธิ์<select name="enabled" defaultValue={String(enabled)}><option value="true">อนุญาต</option><option value="false">ไม่อนุญาต</option></select></label>
              <label className={styles.field}>ขอบเขต<select name="scope" defaultValue={action === "catalog.manage" ? "all" : scope}>{action !== "catalog.manage" && <option value="own">ของตน</option>}<option value="all">ทั้งหมด</option></select></label></div>
          </ActionForm>
        </section>;
      })}
    </details>)}
  </div></AppShell>;
}
