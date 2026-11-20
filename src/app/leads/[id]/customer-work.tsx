import { formErrorClass } from "@/components/form-feedback";
import Link from "next/link";
import type { ReactNode } from "react";
import { caseStatusLabels, caseStatusTones } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import type { LeadWork } from "@/lib/sales/lead-work";
import type { WorkRow } from "@/lib/walkin/lead-page";
import type { ProjectProgress } from "@/lib/sales/case-progress";
import { formatDate } from "@/app/walkin/privacy-controls";
import { secondaryActionClass } from "@/components/action-link-styles";
import { formCardClass, formHintClass, sectionHeadingClass } from "@/components/form-card";
import { noticeClass } from "@/components/notice";
import { Status, type StatusTone } from "@/components/status";
import { cn } from "@/lib/utils";

type Props = { rows: WorkRow[] | null; names: Map<string, string>; isClosed: boolean; action?: ReactNode };

const workCardClass = "grid gap-2 rounded-md border bg-card p-4 text-foreground no-underline [overflow-wrap:anywhere] [&_p]:m-0";
const hintClass = "m-0 text-sm text-muted-foreground";

function Progress({ progress }: { progress: ProjectProgress }) {
  return <ol className="my-1 flex list-none items-center gap-1 p-0" aria-label="ความคืบหน้าโครงการ">{progress.steps.map((label, index) => {
    const current = index === progress.current;
    const done = progress.complete || index < progress.current;
    return <li key={index} className="group flex min-w-0 flex-1 items-center gap-1 last:flex-none not-last:after:h-px not-last:after:min-w-2 not-last:after:flex-1 not-last:after:bg-line-strong not-last:after:content-['']" data-state={done ? "done" : current ? "current" : "waiting"}
      aria-current={current && !progress.complete ? "step" : undefined}>
      {current ? <span className="shrink-0 text-xs font-bold text-primary">{label}</span> : <>
        <span className="size-2 shrink-0 rounded-full border border-line-strong group-data-[state=done]:border-success group-data-[state=done]:bg-success" aria-hidden="true" /><span className="sr-only">{label}{done ? " · ผ่านแล้ว" : " · ยังไม่ถึงขั้นนี้"}</span>
      </>}
    </li>;
  })}</ol>;
}

function WorkCard({ code, status, tone, item, href, children }: {
  code: string; status: string; tone: StatusTone; item?: LeadWork["cases"][number]; href?: string; children?: ReactNode;
}) {
  const detail = item?.detail;
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-md">{code}</strong><Status tone={tone}>{status}</Status></div>
    {item && item.code !== code && <p className={formHintClass}>{item.code}</p>}
    {detail?.plot && <p className={formHintClass}>{detail.plot}</p>}
    {detail?.outstanding != null && detail.outstanding !== "0" && <p className="text-sm font-semibold">ค้างชำระ {formatMoney(detail.outstanding)} บาท</p>}
    {detail?.progress ? <Progress progress={detail.progress} /> : detail?.nextStep && <p className={formHintClass}>{detail.nextStep}</p>}
    {children}
    {href && <span className="flex items-center justify-between text-sm font-bold text-primary">ดูรายละเอียด <span aria-hidden="true">→</span></span>}
  </>;
  return href ? <Link href={href} prefetch={false} className={cn(workCardClass, "border-line-strong hover:border-primary hover:bg-accent active:border-primary active:bg-accent")} aria-label={`เปิดโครงการ ${code}`}>{content}</Link>
    : <div className={workCardClass}>{content}</div>;
}

/** Customer Work of a Lead: live Projects (BKP) or sales (Taraville) as cards, finished ones folded below. */
export function CustomerWork({ rows, names, isClosed, action }: Props) {
  if (!rows) return <section className={formCardClass}><h2>โครงการ</h2><p className={formErrorClass} role="alert">โหลดโครงการไม่ได้ ลองรีเฟรชหน้านี้</p></section>;
  const card = ({ item, project, href, isFinished, isHalfOpen, code }: WorkRow) => {
    const isCancelled = project?.status === "cancelled";
    return <li key={project?.id ?? code} className="min-w-0 data-[dim=true]:opacity-65" data-dim={isFinished}>
      <WorkCard code={code} status={isCancelled ? "ยกเลิก" : item ? caseStatusLabels[item.status] : "รอกรอกข้อมูล"}
        tone={isCancelled ? "inactive" : item ? caseStatusTones[item.status] : "waiting"} item={item} href={isHalfOpen ? undefined : href}>
        {project && !isCancelled && item?.status === "cancelled" && <p className={formHintClass}>โครงการนี้ถูกยกเลิกแล้ว เริ่มดำเนินการซ้ำไม่ได้ หากต้องทำงานต่อให้เปิดโครงการใหม่</p>}
        {project && isCancelled && <p className={formHintClass}>{project.cancel_reason} · โดย {(project.cancelled_by && names.get(project.cancelled_by)) || "ผู้บริหาร"}
          {project.cancelled_at ? ` · ${formatDate(project.cancelled_at)}` : ""}</p>}
        {isHalfOpen && <p className={cn(noticeClass, "p-3 text-sm")}>เปิดโครงการแล้ว แต่ยังไม่ได้บันทึกข้อมูลโครงการ{href ? " ลองเปิดอีกครั้งเพื่อทำต่อ" : " เจ้าของรายการหรือผู้บริหารเปิดต่อได้"}</p>}
        {isHalfOpen && href && <Link href={href} prefetch={false} className={cn(secondaryActionClass, "justify-self-start")}>ลองเปิดโครงการอีกครั้ง</Link>}
      </WorkCard>
    </li>;
  };
  const finished = rows.filter(row => row.isFinished);
  const listClass = "m-0 grid list-none gap-3 p-0";
  return <section className={formCardClass}>
    <div className={cn(sectionHeadingClass, "flex-wrap items-center")}>
      <div><h2>โครงการ</h2><span className={hintClass}>{rows.length} โครงการ</span></div>
      {action}
    </div>
    {!rows.length && <p className={formHintClass}>{isClosed ? "Lead นี้ปิดอยู่ เปิด Lead อีกครั้งก่อนจึงจะเปิดโครงการได้" : "ยังไม่มีโครงการ"}</p>}
    <ul className={listClass}>{rows.filter(row => !row.isFinished).map(card)}</ul>
    {finished.length > 0 && <details className="mt-4"><summary>โครงการที่จบแล้ว ({finished.length})</summary>
      <ul className={cn(listClass, "mt-3")}>{finished.map(card)}</ul></details>}
  </section>;
}
