import Link from "next/link";
import type { ReactNode } from "react";
import type { Lead, Project } from "@/lib/walkin/models";
import { caseStatusLabels } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import type { LeadWork } from "@/lib/sales/lead-work";
import type { ProjectProgress } from "@/lib/sales/case-progress";
import { formatDate } from "@/app/walkin/privacy-controls";
import styles from "@/app/walkin/walkin.module.css";
import layout from "./lead-detail.module.css";

type Props = { lead: Lead; projects: Project[]; names: Map<string, string>; work: LeadWork | null; action?: ReactNode };
const isDone = (status: LeadWork["cases"][number]["status"]) => status === "completed" || status === "cancelled";

function Progress({ progress }: { progress: ProjectProgress }) {
  return <ol className={styles.projectProgress} aria-label="ความคืบหน้าโครงการ">{progress.steps.map((label, index) => {
    const current = index === progress.current;
    const done = progress.complete || index < progress.current;
    return <li key={index} className={styles.progressStep} data-state={done ? "done" : current ? "current" : "waiting"}
      aria-current={current && !progress.complete ? "step" : undefined}>
      {current ? <span className={styles.progressLabel}>{label}</span> : <>
        <span className={styles.progressDot} aria-hidden="true" /><span className={styles.srOnly}>{label}{done ? " · ผ่านแล้ว" : " · ยังไม่ถึงขั้นนี้"}</span>
      </>}
    </li>;
  })}</ol>;
}

function WorkCard({ code, status, item, href, children }: {
  code: string; status: string; item?: LeadWork["cases"][number]; href?: string; children?: ReactNode;
}) {
  const detail = item?.detail;
  const content = <>
    <div className={styles.workHeading}><strong>{code}</strong><span className={styles.pill}>{status}</span></div>
    {item && item.code !== code && <p className={styles.hint}>{item.code}</p>}
    {detail?.plot && <p className={styles.hint}>{detail.plot}</p>}
    {detail?.outstanding != null && detail.outstanding !== "0" && <p className={styles.workBalance}>ค้างชำระ {formatMoney(detail.outstanding)} บาท</p>}
    {detail?.progress ? <Progress progress={detail.progress} /> : detail?.nextStep && <p className={styles.hint}>{detail.nextStep}</p>}
    {children}
    {href && <span className={styles.workOpen}>ดูรายละเอียด <span aria-hidden="true">→</span></span>}
  </>;
  return href ? <Link href={href} prefetch={false} className={styles.workCard} aria-label={`เปิดโครงการ ${code}`}>{content}</Link>
    : <div className={styles.workCard}>{content}</div>;
}

/** Customer Work of a Lead: Baan Kunapap Projects with their sale, or Taraville sales. Active work first, finished last. */
export function CustomerWork({ lead, projects, names, work, action }: Props) {
  if (!work) return <section className={styles.card}><h2>โครงการ</h2><p className={styles.error} role="alert">โหลดโครงการไม่ได้ ลองรีเฟรชหน้านี้</p></section>;
  const count = lead.brand === "TARAVILLE" ? work.cases.length : projects.length;
  const heading = <div className={`${styles.sectionHeading} ${layout.workHeading}`}>
    <div><h2>โครงการ</h2><span className={layout.hint}>{count} โครงการ</span></div>
    {action}
  </div>;
  if (lead.brand === "TARAVILLE") {
    const ordered = [...work.cases.filter(item => !isDone(item.status)), ...work.cases.filter(item => isDone(item.status))];
    return <section className={styles.card}>{heading}
      {!ordered.length && <p className={styles.hint}>ยังไม่มีโครงการ</p>}
      <ul className={styles.workList}>{ordered.map(item => <li key={item.code} className={styles.workItem} data-dim={isDone(item.status)}>
        <WorkCard code={item.code} status={caseStatusLabels[item.status]} item={item} href={item.id && item.can_open ? `/sales/${item.id}` : undefined} />
      </li>)}</ul>
    </section>;
  }
  const rank = (project: Project) => (project.status === "active" ? 0 : 1);
  const ordered = [...projects].sort((a, b) => rank(a) - rank(b));
  return <section className={styles.card}>{heading}
    {!projects.length && <p className={styles.hint}>{lead.closed_at ? "รายการนี้ปิดอยู่ เปิดรายการอีกครั้งก่อนจึงจะเปิดโครงการได้" : "ยังไม่ได้เปิดโครงการ"}</p>}
    <ul className={styles.workList}>{ordered.map(project => {
      const item = work.cases.find(row => row.project_id === project.id);
      const cancelled = project.status === "cancelled";
      const href = item ? item.id && item.can_open ? `/sales/${item.id}` : undefined
        : !cancelled && work.canCreate ? `/sales/new?lead=${lead.id}&project=${project.id}` : undefined;
      return <li key={project.id} className={styles.workItem} data-dim={cancelled || (item ? isDone(item.status) : false)}>
        <WorkCard code={project.code} status={cancelled ? "ยกเลิก" : item ? caseStatusLabels[item.status] : "รอกรอกข้อมูล"} item={item} href={href}>
        {item?.status === "cancelled" && !cancelled && <p className={styles.hint}>โครงการนี้ถูกยกเลิกแล้ว เริ่มดำเนินการซ้ำไม่ได้ หากต้องทำงานต่อให้เปิดโครงการใหม่</p>}
        {cancelled && <p className={styles.hint}>{project.cancel_reason} · โดย {(project.cancelled_by && names.get(project.cancelled_by)) || "ผู้บริหาร"}
          {project.cancelled_at ? ` · ${formatDate(project.cancelled_at)}` : ""}</p>}
        </WorkCard>
      </li>;
    })}</ul>
  </section>;
}
