import { formErrorClass } from "@/components/form-feedback";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lead, Project } from "@/lib/walkin/models";
import { caseStatusLabels } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import type { LeadWork } from "@/lib/sales/lead-work";
import type { ProjectProgress } from "@/lib/sales/case-progress";
import { formatDate } from "@/app/walkin/privacy-controls";
import { formCardClass, formHintClass, sectionHeadingClass } from "@/components/form-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = { lead: Lead; projects: Project[]; names: Map<string, string>; work: LeadWork | null; action?: ReactNode };
const isDone = (status: LeadWork["cases"][number]["status"]) => status === "completed" || status === "cancelled";

const workCardClass = "grid gap-2 rounded-md border bg-card p-4 text-foreground no-underline [overflow-wrap:anywhere] [&_p]:m-0";
const hintClass = "m-0 text-sm text-muted-foreground";

function Progress({ progress }: { progress: ProjectProgress }) {
  return <ol className="my-1 flex list-none items-center gap-1 p-0" aria-label="ความคืบหน้าโครงการ">{progress.steps.map((label, index) => {
    const current = index === progress.current;
    const done = progress.complete || index < progress.current;
    return <li key={index} className="group flex min-w-0 flex-1 items-center gap-1 last:flex-none not-last:after:h-px not-last:after:min-w-2 not-last:after:flex-1 not-last:after:bg-line-strong not-last:after:content-['']" data-state={done ? "done" : current ? "current" : "waiting"}
      aria-current={current && !progress.complete ? "step" : undefined}>
      {current ? <span className="shrink-0 text-xs font-bold text-primary">{label}</span> : <>
        <span className="size-2 shrink-0 rounded-full border border-line-strong group-data-[state=done]:border-primary group-data-[state=done]:bg-primary" aria-hidden="true" /><span className="sr-only">{label}{done ? " · ผ่านแล้ว" : " · ยังไม่ถึงขั้นนี้"}</span>
      </>}
    </li>;
  })}</ol>;
}

function WorkCard({ code, status, item, href, children }: {
  code: string; status: string; item?: LeadWork["cases"][number]; href?: string; children?: ReactNode;
}) {
  const detail = item?.detail;
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-md">{code}</strong><Badge variant="secondary" className="px-3 py-0 font-bold text-muted-foreground">{status}</Badge></div>
    {item && item.code !== code && <p className={formHintClass}>{item.code}</p>}
    {detail?.plot && <p className={formHintClass}>{detail.plot}</p>}
    {detail?.outstanding != null && detail.outstanding !== "0" && <p className="text-sm font-semibold">ค้างชำระ {formatMoney(detail.outstanding)} บาท</p>}
    {detail?.progress ? <Progress progress={detail.progress} /> : detail?.nextStep && <p className={formHintClass}>{detail.nextStep}</p>}
    {children}
    {href && <span className="flex items-center justify-between text-sm font-bold text-primary">ดูรายละเอียด <span aria-hidden="true">→</span></span>}
  </>;
  return href ? <Link href={href} prefetch={false} className={cn(workCardClass, "border-line-strong hover:border-primary hover:bg-tint active:border-primary active:bg-tint")} aria-label={`เปิดโครงการ ${code}`}>{content}</Link>
    : <div className={workCardClass}>{content}</div>;
}

/** Customer Work of a Lead: Baan Kunapap Projects with their sale, or Taraville sales. Active work first, finished last. */
export function CustomerWork({ lead, projects, names, work, action }: Props) {
  if (!work) return <section className={formCardClass}><h2>โครงการ</h2><p className={formErrorClass} role="alert">โหลดโครงการไม่ได้ ลองรีเฟรชหน้านี้</p></section>;
  const count = lead.brand === "TARAVILLE" ? work.cases.length : projects.length;
  const heading = <div className={cn(sectionHeadingClass, "flex-wrap items-center")}>
    <div><h2>โครงการ</h2><span className={hintClass}>{count} โครงการ</span></div>
    {action}
  </div>;
  if (lead.brand === "TARAVILLE") {
    const ordered = [...work.cases.filter(item => !isDone(item.status)), ...work.cases.filter(item => isDone(item.status))];
    return <section className={formCardClass}>{heading}
      {!ordered.length && <p className={formHintClass}>ยังไม่มีโครงการ</p>}
      <ul className="m-0 grid list-none gap-3 p-0">{ordered.map(item => <li key={item.code} className="min-w-0 data-[dim=true]:opacity-65" data-dim={isDone(item.status)}>
        <WorkCard code={item.code} status={caseStatusLabels[item.status]} item={item} href={item.id && item.can_open ? `/sales/${item.id}` : undefined} />
      </li>)}</ul>
    </section>;
  }
  const rank = (project: Project) => (project.status === "active" ? 0 : 1);
  const ordered = [...projects].sort((a, b) => rank(a) - rank(b));
  return <section className={formCardClass}>{heading}
    {!projects.length && <p className={formHintClass}>{lead.closed_at ? "รายการนี้ปิดอยู่ เปิดรายการอีกครั้งก่อนจึงจะเปิดโครงการได้" : "ยังไม่ได้เปิดโครงการ"}</p>}
    <ul className="m-0 grid list-none gap-3 p-0">{ordered.map(project => {
      const item = work.cases.find(row => row.project_id === project.id);
      const cancelled = project.status === "cancelled";
      const href = item ? item.id && item.can_open ? `/sales/${item.id}` : undefined
        : !cancelled && work.canCreate ? `/sales/new?lead=${lead.id}&project=${project.id}` : undefined;
      return <li key={project.id} className="min-w-0 data-[dim=true]:opacity-65" data-dim={cancelled || (item ? isDone(item.status) : false)}>
        <WorkCard code={project.code} status={cancelled ? "ยกเลิก" : item ? caseStatusLabels[item.status] : "รอกรอกข้อมูล"} item={item} href={href}>
        {item?.status === "cancelled" && !cancelled && <p className={formHintClass}>โครงการนี้ถูกยกเลิกแล้ว เริ่มดำเนินการซ้ำไม่ได้ หากต้องทำงานต่อให้เปิดโครงการใหม่</p>}
        {cancelled && <p className={formHintClass}>{project.cancel_reason} · โดย {(project.cancelled_by && names.get(project.cancelled_by)) || "ผู้บริหาร"}
          {project.cancelled_at ? ` · ${formatDate(project.cancelled_at)}` : ""}</p>}
        </WorkCard>
      </li>;
    })}</ul>
  </section>;
}
