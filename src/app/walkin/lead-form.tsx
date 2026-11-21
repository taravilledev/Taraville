import type { Lead, Staff } from "@/lib/walkin/models";
import type { Brand } from "@/lib/walkin/survey-questions";
import { ActionForm } from "./action-form";
import { saveLead } from "./actions";
import { ConsentFields } from "./consent-fields";
import { ContactFields } from "./contact-fields";
import { NoticeDialog } from "./notice-dialog";
import { SurveyGroups } from "./survey-groups";
import { VersionedNotice } from "./versioned-notice";
import { formCardClass } from "@/components/form-card";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";
import { WalkinSteps } from "./walkin-steps";

export const LEAD_FORM_ID = "lead-form";

export function LeadForm({ brand, staff, owners, lead, requestId, choice = null }: {
  brand: Brand; staff: Staff; owners: Staff[]; lead?: Lead; requestId: string; choice?: boolean | null;
}) {
  const context = { brand, requestId, ...(lead ? { id: lead.id, version: lead.version } : {}) };
  const action = saveLead.bind(null, context);
  if (!lead) return <>
    <NoticeDialog><VersionedNotice brand={brand} /></NoticeDialog>
    <WalkinSteps formId={LEAD_FORM_ID} staff={staff} owners={owners} action={action}
      survey={<SurveyGroups brand={brand} />} attestation={<ConsentFields />} />
  </>;
  return <>
    <UnsavedChangesGuard formId={LEAD_FORM_ID} />
    <ActionForm id={LEAD_FORM_ID} sticky action={action} secondaryAction={{ label: "ยกเลิก", href: `/leads/${lead.id}` }}>
      <ContactFields lead={lead} staff={staff} owners={owners} />
      <section id="survey" className={formCardClass} aria-labelledby="survey-title">
        <h2 id="survey-title">แบบสอบถามความต้องการ</h2>
        {choice !== false ? <>
          <p className="-mt-3 mb-6 text-sm text-muted-foreground">ไม่บังคับ ข้อที่ลูกค้าไม่ตอบ เว้นว่างได้</p>
          <SurveyGroups brand={brand} answers={lead.survey} />
        </> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-4" role="status">
          <span className="text-muted-foreground">ลูกค้าไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม</span>
          <a className="inline-flex min-h-(--tap-min) items-center font-semibold text-primary no-underline" href={`/leads/${lead.id}?drawer=survey`}>เปลี่ยนตัวเลือกได้ที่หน้า Lead ›</a>
        </div>}
      </section>
    </ActionForm>
  </>;
}
