import { randomUUID } from "node:crypto";
import type { Lead, Project } from "@/lib/walkin/models";
import { ActionForm } from "./action-form";
import { cancelProject, openProject } from "./project-actions";
import styles from "./walkin.module.css";

export function OpenProject({ lead }: { lead: Lead }) {
  return <ActionForm action={openProject.bind(null, { id: lead.id, version: lead.version, requestId: randomUUID() })} label="ยืนยันเปิดโครงการ">
    <p className={styles.hint}>ระบบออกรหัสโครงการให้ทันที แต่ละรายการมีโครงการที่ใช้งานอยู่ได้ครั้งละหนึ่งโครงการ และปิดรายการไม่ได้ขณะมีโครงการ</p>
    <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันเปิดโครงการสำหรับรายการนี้</span></label>
  </ActionForm>;
}

export function CancelProject({ lead, project }: { lead: Lead; project: Project }) {
  return <section className={styles.card}>
    <h2>ยกเลิกโครงการ {project.code}</h2>
    <ActionForm action={cancelProject.bind(null, { id: project.id, leadId: lead.id, version: project.version, requestId: randomUUID() })} label="ยืนยันยกเลิกโครงการ">
      <label className={styles.field}><span>เหตุผลการยกเลิก</span><input name="reason" maxLength={500} required /></label>
      <p className={styles.hint}>ยกเลิกแล้วย้อนกลับไม่ได้ รหัสเดิมยังอยู่ในประวัติ หากต้องทำต่อให้เปิดโครงการใหม่ซึ่งจะได้รหัสใหม่</p>
      <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันยกเลิกโครงการนี้</span></label>
    </ActionForm>
  </section>;
}
