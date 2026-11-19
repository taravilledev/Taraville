import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { accountMenuClass } from "@/components/app-shell-styles";
import { Suspense } from "react";
import Link from "next/link";
import { dialablePhone } from "@/lib/walkin/phone";
import { leadWork } from "@/lib/sales/lead-work";
import { leadDetail, leadProjects } from "@/lib/walkin/queries";
import { staffSchema } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS } from "@/lib/walkin/survey-questions";
import { COMPANIES } from "@/lib/walkin/companies";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ContactRecord, formatDate } from "@/app/walkin/privacy-controls";
import { CustomerWork } from "./customer-work";
import { OpenProject } from "@/app/walkin/project-controls";
import { OpenProjectDialog } from "./open-project-dialog";
import { formCardClass } from "@/components/form-card";
import layout from "./lead-detail.module.css";

export const metadata = { title: "รายละเอียดผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
export default function LeadPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Detail {...props} /></Suspense>;
}
async function Detail({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff } = session;
  const canEdit = staff.role === "executive" || lead.owner_id === staff.id;
  const [work, { projects, names }] = await Promise.all([leadWork(session.supabase, lead.id), leadProjects(session)]);
  const canOpenBkp = work && lead.brand === "BAAN_KUNAPAP" && canEdit && !lead.closed_at;
  const phone = dialablePhone(lead.phone);
  const saved = (await searchParams).saved === "1";
  const ownerResult = await session.supabase.from("staff").select("id,full_name,role,is_active").eq("id", lead.owner_id).maybeSingle();
  if (ownerResult.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const owner = staffSchema.nullable().parse(ownerResult.data);
  const currentOwner = owner ? `${owner.full_name}${owner.is_active ? "" : " (ปิดใช้งาน)"}` : "ผู้ดูแลเดิม";
  return <AppShell staff={staff} wide>
    <header className={layout.header}>
      <Link href="/leads" className={layout.back} prefetch={false}><span aria-hidden="true">←</span> กลับรายการผู้สนใจ</Link>
      <div className={layout.identity}>
        <div>
          <p className={layout.pills}>
            <span className={`${layout.pill} ${lead.brand === "TARAVILLE" ? layout.pillTv : layout.pillBk}`}>{COMPANIES[lead.brand].brandName}</span>
            {lead.privacy_mode === "synthetic" && <span className={layout.pill}>ข้อมูลสมมติสำหรับทดสอบ</span>}
            {lead.closed_at && <span className={layout.pill}>ปิดรายการแล้ว</span>}
          </p>
          <h1>{lead.name_title} {lead.first_name} {lead.last_name}</h1>
        </div>
        <div className={`${layout.actions} ${layout.headerActions}`}>
          {saved && <Link className={secondaryActionClass} href="/walkin" prefetch={false}>รับลูกค้ารายถัดไป</Link>}
          {canEdit && <Link href={`/leads/${lead.id}/edit`} className={secondaryActionClass} prefetch={false}>แก้ไขข้อมูล</Link>}
          <details className={layout.options}>
            <summary className={secondaryActionClass}>ตัวเลือก <span aria-hidden="true">▾</span></summary>
            <div className={accountMenuClass}>
              <Link href={`/leads/${lead.id}/manage`} prefetch={false}>{canEdit ? "จัดการสถานะและข้อมูล" : "ดูสถานะและความยินยอม"}</Link>
              <Link href={`/leads/${lead.id}/history`} prefetch={false}>ประวัติหลักฐาน</Link>
            </div>
          </details>
        </div>
      </div>
      {!canEdit && <p className={layout.hint}>ดูได้อย่างเดียว เจ้าของรายการและผู้บริหารมีสิทธิ์แก้ไข</p>}
    </header>
    <div className={layout.workspace}>
      <CustomerWork lead={lead} projects={projects} names={names} work={work} action={
        canOpenBkp ? <OpenProjectDialog key={lead.version}><OpenProject lead={lead} /></OpenProjectDialog>
          : work?.canCreate && <Link href={`/sales/new?lead=${lead.id}`} prefetch={false} className={primaryActionClass}>เปิดโครงการ</Link>
      } />
      <section className={formCardClass}>
        <h2>ข้อมูลติดต่อและผู้ดูแล</h2>
        <dl className={`${layout.details} ${layout.contact}`}>
          <dt>เบอร์โทร</dt><dd>{lead.phone}</dd>
          <dt>LINE ID</dt><dd>{lead.line_id || "ไม่ได้ระบุ"}</dd>
          <dt>ผู้ดูแล</dt><dd>{currentOwner}</dd>
          <dt>ลงทะเบียน</dt><dd>{formatDate(lead.created_at)}</dd>
          <dt>ติดต่อล่าสุด</dt><dd>{lead.last_contact_at ? formatDate(lead.last_contact_at) : "ยังไม่มีวันที่ติดต่อ"}</dd>
        </dl>
        {(phone || canEdit) && <div className={layout.actions}>
          {phone && <a href={`tel:${phone}`} className={secondaryActionClass}>โทร</a>}
          {canEdit && <ContactRecord lead={lead} />}
        </div>}
      </section>
    </div>
    <section className={`${formCardClass} ${layout.survey}`}>
      <h2>คำตอบแบบสอบถาม</h2>
      <dl className={`${layout.answers} ${layout.answersGrid}`}>
        {SURVEY_QUESTIONS[lead.brand].filter(question => !question.legacy || lead.survey[question.key]).map(question => {
          const value = lead.survey[question.key];
          const answer = Array.isArray(value) ? value.join(" · ") : value;
          return <div key={question.key}><dt>{question.label}</dt><dd>{answer || "ไม่ได้ระบุ"}
            {lead.survey[`${question.key}_other`] && <span> · {lead.survey[`${question.key}_other`]}</span>}</dd></div>;
        })}
      </dl>
    </section>
  </AppShell>;
}
