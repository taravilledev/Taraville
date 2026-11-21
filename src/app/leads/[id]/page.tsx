import { ChevronRight, Pencil } from "lucide-react";
import { primaryActionClass, secondaryActionClass, textActionClass } from "@/components/action-link-styles";
import { Suspense } from "react";
import Link from "next/link";
import { leadWork } from "@/lib/sales/lead-work";
import { closeInfo, evidenceActors, leadDetail, leadProjects, leadStageGroup, saleOwners } from "@/lib/walkin/queries";
import { primaryAction, workRows } from "@/lib/walkin/lead-page";
import { STAGE_GROUP_LABELS, STAGE_GROUP_TONES } from "@/lib/walkin/lead-stage";
import { staffSchema } from "@/lib/walkin/models";
import { surveyChoice } from "@/lib/walkin/privacy";
import { SURVEY_QUESTIONS } from "@/lib/walkin/survey-questions";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { EvidenceHistory, SurveyChoice, SurveyChoiceStatus, formatDate } from "@/app/walkin/privacy-controls";
import { ClosedBand, CloseLead, ReopenLead } from "@/app/walkin/status-controls";
import { CustomerWork } from "./customer-work";
import { OpenProject } from "@/app/walkin/project-controls";
import { OpenProjectDialog } from "./open-project-dialog";
import { ReassignLead } from "./reassign-lead";
import { Drawer } from "@/components/drawer";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { formCardClass } from "@/components/form-card";
import { BrandTag } from "@/components/brand-tag";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/status";
import { cn } from "@/lib/utils";

const hintClass = "m-0 text-sm text-muted-foreground";
const listClass = "grid gap-3 [&_dt]:text-sm [&_dt]:font-semibold [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere]";
const rowButtonClass = "-mx-2 mt-4 flex min-h-(--tap-min) w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-2 rounded-sm border-0 border-t bg-transparent px-2 text-left text-sm font-medium hover:bg-muted";

export const metadata = { title: "รายละเอียดผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
export default function LeadPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Detail {...props} /></Suspense>;
}
async function Detail({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff, events } = session;
  const canEdit = staff.role === "executive" || lead.owner_id === staff.id;
  const isExecutive = staff.role === "executive";
  const [work, { projects, names }, group, info, actors, owners] = await Promise.all([
    leadWork(session.supabase, lead.id), leadProjects(session), leadStageGroup(session), closeInfo(session), evidenceActors(session),
    isExecutive ? saleOwners(session) : Promise.resolve([])]);
  const rows = work && workRows(lead.id, lead.brand, projects, work);
  const live = rows?.filter(row => !row.isFinished) ?? [];
  const isClosed = Boolean(lead.closed_at);
  const canOpenBkp = work && lead.brand === "BAAN_KUNAPAP" && canEdit && !isClosed;
  const action = rows ? primaryAction(group, live.length) : null;
  const openProject = canOpenBkp ? <OpenProjectDialog key={lead.version} label={action === "open" ? undefined : "เปิดโครงการเพิ่ม"} isText={action !== "open"}><OpenProject lead={lead} /></OpenProjectDialog>
    : work?.canCreate && !isClosed && <Link href={`/sales/new?lead=${lead.id}`} prefetch={false} className={action === "open" ? primaryActionClass : textActionClass}>{action === "open" ? "เปิดโครงการ" : "เปิดโครงการเพิ่ม"}</Link>;
  const blockers = projects.filter(project => project.status === "active").map(project => ({ code: project.code, href: rows?.find(row => row.project?.id === project.id)?.href }));
  const saved = (await searchParams).saved === "1";
  const ownerResult = await session.supabase.from("staff").select("id,full_name,role,is_active").eq("id", lead.owner_id).maybeSingle();
  if (ownerResult.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const owner = staffSchema.nullable().parse(ownerResult.data);
  const currentOwner = owner ? `${owner.full_name}${owner.is_active ? "" : " (ปิดใช้งาน)"}` : "ผู้ดูแลเดิม";
  const choice = surveyChoice(events);
  return <AppShell staff={staff} wide>
    <header className="mb-6 grid gap-3">
      <Link href="/leads" className="inline-flex min-h-(--tap-min) items-center gap-2 justify-self-start text-primary no-underline hover:underline hover:underline-offset-4" prefetch={false}><span aria-hidden="true">←</span> กลับรายการผู้สนใจ</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 mb-3 flex flex-wrap items-center gap-2">
            <Status tone={STAGE_GROUP_TONES[group]}>{STAGE_GROUP_LABELS[group]}{live.length > 1 ? ` · ${live.length} โครงการ` : ""}</Status>
            <BrandTag brand={lead.brand} />
            {lead.privacy_mode === "synthetic" && <Badge variant="secondary" className="px-3 py-0 font-bold text-muted-foreground">ข้อมูลสมมติสำหรับทดสอบ</Badge>}
          </p>
          <h1 className="m-0 text-title font-bold [overflow-wrap:anywhere]">{lead.name_title} {lead.first_name} {lead.last_name}</h1>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-3">
          {saved && <Link className={secondaryActionClass} href="/walkin" prefetch={false}>รับลูกค้ารายถัดไป</Link>}
          {canEdit && <Link href={`/leads/${lead.id}/edit`} className={secondaryActionClass} prefetch={false}>แก้ไขข้อมูล</Link>}
          {action === "open" && openProject}
          {action === "continue" && live[0].href && <Link href={live[0].href} prefetch={false} className={primaryActionClass}>{live[0].isHalfOpen ? "ลองเปิดโครงการอีกครั้ง" : `ไปที่โครงการ ${live[0].code}`}</Link>}
        </div>
      </div>
      {!canEdit && <p className={hintClass}>ดูได้อย่างเดียว เจ้าของรายการและผู้บริหารมีสิทธิ์แก้ไข</p>}
    </header>
    {isClosed && <div className="mb-6"><ClosedBand lead={lead} info={info} /></div>}
    <div className="grid items-start min-[900px]:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] min-[900px]:gap-x-6 [&>section]:min-w-0">
      <CustomerWork rows={rows} names={names} isClosed={isClosed} action={action === "open" ? undefined : openProject} />
      <section className={formCardClass}>
        <h2>ข้อมูลติดต่อ</h2>
        <dl className={cn(listClass, "grid-cols-[minmax(0,max-content)_minmax(0,1fr)]")}>
          <dt>เบอร์โทร</dt><dd>{lead.phone}</dd>
          <dt>LINE ID</dt><dd>{lead.line_id || "ไม่ได้ระบุ"}</dd>
          <dt>ผู้ดูแล</dt><dd className="flex items-center gap-1">{currentOwner}
            {isExecutive && <Drawer name="owner" title="เปลี่ยนผู้ดูแล" trigger={<button type="button" aria-label="เปลี่ยนผู้ดูแล" title="เปลี่ยนผู้ดูแล" className="grid size-8 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-primary hover:bg-muted"><Pencil size={16} aria-hidden /></button>}>
              <ReassignLead lead={lead} owners={owners} /></Drawer>}</dd>
          <dt>ลงทะเบียน</dt><dd>{formatDate(lead.created_at)}</dd>
        </dl>
        <Drawer name="history" title={`ประวัติหลักฐาน (${events.length})`} footer={<DialogClose asChild><Button variant="outline">ปิด</Button></DialogClose>}
          trigger={<button type="button" className={rowButtonClass}>ประวัติหลักฐานและความยินยอม<ChevronRight size={16} aria-hidden /></button>}>
          <EvidenceHistory events={events} actors={actors} />
        </Drawer>
      </section>
    </div>
    <section className={formCardClass}>
      <h2>ความต้องการของลูกค้า</h2>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
        <SurveyChoiceStatus choice={choice} />
        {canEdit && <Drawer name="survey" title="ตัวเลือกแบบสอบถามเพิ่มเติม" trigger={<button type="button" className={textActionClass}>เปลี่ยนตัวเลือก…</button>}>
          <SurveyChoice lead={lead} choice={choice} /></Drawer>}
      </div>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 [&>div]:border-b [&>div]:py-4 [&_dd]:m-0 [&_dd]:mt-2 [&_dd]:whitespace-pre-wrap [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-sm [&_dt]:font-semibold [&_dt]:text-muted-foreground">
        {SURVEY_QUESTIONS[lead.brand].filter(question => !question.legacy || lead.survey[question.key]).map(question => {
          const value = lead.survey[question.key];
          const answer = Array.isArray(value) ? value.join(" · ") : value;
          return <div key={question.key}><dt>{question.label}</dt><dd>{answer || "ไม่ได้ระบุ"}
            {lead.survey[`${question.key}_other`] && <span> · {lead.survey[`${question.key}_other`]}</span>}</dd></div>;
        })}
      </dl>
    </section>
    {canEdit && (isClosed ? <ReopenLead lead={lead} /> : <CloseLead lead={lead} blockers={blockers} openWorkCount={lead.brand === "TARAVILLE" ? live.length : 0} />)}
  </AppShell>;
}
