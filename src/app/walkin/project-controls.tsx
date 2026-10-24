import { randomUUID } from "node:crypto";
import type { Lead, Project } from "@/lib/walkin/models";
import { ActionForm } from "./action-form";
import { cancelProject, openProject } from "./project-actions";
import { formatDate } from "./privacy-controls";
import styles from "./walkin.module.css";

type Props = { lead: Lead; projects: Project[]; names: Map<string, string>; isExecutive: boolean };

// Baan Kunapap only (ADR 0009). Cancelled projects stay listed so an issued code never disappears.
export function LeadProject({ lead, projects, names, isExecutive }: Props) {
  if (lead.brand !== "BAAN_KUNAPAP") return null;
  const active = projects.find(project => project.status === "active");
  const cancelled = projects.filter(project => project.status === "cancelled");
  return <section className={styles.card}>
    <h2>โครงการ</h2>
    {active ? <>
      <p>รหัสโครงการ <strong>{active.code}</strong><br />เปิดเมื่อ {formatDate(active.created_at)}</p>
      {isExecutive && <details><summary>ยกเลิกโครงการนี้</summary>
        <ActionForm action={cancelProject.bind(null, { id: active.id, leadId: lead.id, version: active.version, requestId: randomUUID() })} label="ยืนยันยกเลิกโครงการ">
          <label className={styles.field}><span>เหตุผลการยกเลิก</span><input name="reason" maxLength={500} required /></label>
          <p className={styles.hint}>ยกเลิกแล้วย้อนกลับไม่ได้ รหัสเดิมยังอยู่ในประวัติ หากต้องทำต่อให้เปิดโครงการใหม่ซึ่งจะได้รหัสใหม่</p>
          <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันยกเลิกโครงการนี้</span></label>
        </ActionForm>
      </details>}
    </> : lead.closed_at ? <p className={styles.hint}>รายการนี้ปิดอยู่ เปิดรายการอีกครั้งก่อนจึงจะเปิดโครงการได้</p>
      : <details><summary>เปิดโครงการ</summary>
        <ActionForm action={openProject.bind(null, { id: lead.id, version: lead.version, requestId: randomUUID() })} label="ยืนยันเปิดโครงการ">
          <p className={styles.hint}>ระบบออกรหัสโครงการให้ทันที แต่ละรายการมีโครงการที่ใช้งานอยู่ได้ครั้งละหนึ่งโครงการ และปิดรายการไม่ได้ขณะมีโครงการ</p>
          <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันเปิดโครงการสำหรับรายการนี้</span></label>
        </ActionForm>
      </details>}
    {cancelled.map(project => <p key={project.id} className={styles.hint}>
      {project.code} · ยกเลิก · {project.cancel_reason} · โดย {(project.cancelled_by && names.get(project.cancelled_by)) || "ผู้บริหาร"}
      {project.cancelled_at ? ` · ${formatDate(project.cancelled_at)}` : ""}</p>)}
  </section>;
}
