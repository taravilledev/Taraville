import { randomUUID } from "node:crypto";
import type { Lead, Project } from "@/lib/walkin/models";
import { ActionForm } from "./action-form";
import { FixNotice } from "@/components/fix-notice";
import { guidance } from "@/lib/errors/error-map";
import { cancelProject, openProject } from "./project-actions";
import { formCardClass, formHintClass } from "@/components/form-card";
import { walkinFieldClass, walkinOptionClass } from "./walkin-form-styles";

export function OpenProject({ lead }: { lead: Lead }) {
  return <ActionForm id="open-project" action={openProject.bind(null, { id: lead.id, version: lead.version, requestId: randomUUID() })} label="ยืนยันเปิดโครงการ">
    <p className={formHintClass}>เปิดได้หลายโครงการ แต่ละโครงการมีรหัสและข้อมูลแยกกัน</p>
    <label className={walkinOptionClass}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันเปิดโครงการสำหรับรายการนี้</span></label>
  </ActionForm>;
}

export function CancelProject({ lead, project, openCaseId }: { lead: Lead; project: Project; openCaseId?: string }) {
  return <section className={formCardClass}>
    <h2>ยกเลิกโครงการ {project.code}</h2>
    {openCaseId && <FixNotice {...guidance("sales_closeout_required", { caseId: openCaseId, isExecutive: true })} />}
    <ActionForm action={cancelProject.bind(null, { id: project.id, leadId: lead.id, caseId: openCaseId, version: project.version, requestId: randomUUID() })} label="ยืนยันยกเลิกโครงการ">
      <label data-slot="walkin-field" className={walkinFieldClass}><span>เหตุผลการยกเลิก</span><input name="reason" maxLength={500} required /></label>
      <p className={formHintClass}>ยกเลิกแล้วย้อนกลับไม่ได้ รหัสเดิมยังอยู่ในประวัติ หากต้องทำต่อให้เปิดโครงการใหม่ซึ่งจะได้รหัสใหม่</p>
      <label className={walkinOptionClass}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันยกเลิกโครงการนี้</span></label>
    </ActionForm>
  </section>;
}
