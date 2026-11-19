import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Suspense } from "react";
import Link from "next/link";
import { closeInfo, leadDetail, leadProjects, saleOwners } from "@/lib/walkin/queries";
import { leadWork } from "@/lib/sales/lead-work";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RequiredMark } from "@/app/walkin/required-mark";
import { ActionForm } from "@/app/walkin/action-form";
import { reassignLead } from "@/app/walkin/actions";
import { LeadStatus } from "@/app/walkin/status-controls";
import { CancelProject } from "@/app/walkin/project-controls";
import { SurveyChoice } from "@/app/walkin/privacy-controls";
import { formCardClass, formHintClass } from "@/components/form-card";

export const metadata = { title: "จัดการผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
export default function ManageLeadPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Manage {...props} /></Suspense>;
}
async function Manage({ params }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff, events } = session;
  const canEdit = staff.role === "executive" || lead.owner_id === staff.id;
  const isExecutive = staff.role === "executive";
  const [owners, info, { projects }, work] = await Promise.all([
    isExecutive ? saleOwners(session) : Promise.resolve([]), closeInfo(session), leadProjects(session), leadWork(session.supabase, lead.id)]);
  const activeProject = projects.find(project => project.status === "active");
  const openWorkCount = work?.cases.filter(item => item.brand === "TARAVILLE" && !["completed", "cancelled"].includes(item.status)).length ?? 0;
  return <AppShell staff={staff}>
    <p><Link href={`/leads/${lead.id}`} prefetch={false}>← กลับหน้าผู้สนใจ</Link></p>
    <h1>จัดการ {lead.first_name} {lead.last_name}</h1>
    <LeadStatus lead={lead} info={info} hasActiveProject={Boolean(activeProject)} canEdit={canEdit} openWorkCount={openWorkCount} />
    {isExecutive && activeProject && <CancelProject lead={lead} project={activeProject} />}
    <SurveyChoice lead={lead} events={events} canEdit={canEdit} />
    {isExecutive && <section className={formCardClass}><h2>เปลี่ยนฝ่ายขายผู้ดูแล</h2>
      <ActionForm action={reassignLead.bind(null, lead.id, lead.version)} label="เปลี่ยนผู้ดูแล">
        <Field>
          <FieldLabel htmlFor="lead-manage-owner">ฝ่ายขายผู้ดูแล<RequiredMark /></FieldLabel>
          <NativeSelect id="lead-manage-owner" name="owner_id" defaultValue={owners.some(owner => owner.id === lead.owner_id) ? lead.owner_id : ""} required>
            <option value="">เลือกฝ่ายขาย</option>
            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
          </NativeSelect>
        </Field>
        <p className={formHintClass}>ผู้ดูแลคนใหม่จะแก้ไขรายการนี้ได้ ผู้ดูแลเดิมยังดูข้อมูลได้</p>
      </ActionForm>
    </section>}
  </AppShell>;
}
