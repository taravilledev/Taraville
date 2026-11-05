import Link from "next/link";
import type { Lead, Project } from "@/lib/walkin/models";
import { caseStatusLabels } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import type { LeadWork } from "@/lib/sales/lead-work";
import { OpenProject } from "@/app/walkin/project-controls";
import { formatDate } from "@/app/walkin/privacy-controls";
import styles from "@/app/walkin/walkin.module.css";

type Props = { lead: Lead; projects: Project[]; names: Map<string, string>; work: LeadWork | null; canEdit: boolean };
const isDone = (status: LeadWork["cases"][number]["status"]) => status === "completed" || status === "cancelled";

function CaseLine({ item }: { item: LeadWork["cases"][number] }) {
  const { detail } = item;
  return <>
    <p>{item.id && item.can_open ? <Link href={`/sales/${item.id}`} prefetch={false}>{item.code}</Link> : item.code} · {caseStatusLabels[item.status]}</p>
    {detail?.plot && <p className={styles.hint}>แปลง/บ้าน {detail.plot}</p>}
    {detail?.outstanding != null && <p className={styles.hint}>ค้างชำระ {formatMoney(detail.outstanding)} บาท</p>}
    {detail?.nextStep && <p className={styles.hint}>ขั้นต่อไป: {detail.nextStep}</p>}
  </>;
}

/** Customer Work of a Lead: Baan Kunapap Projects with their sale, or Taraville sales. Active work first, finished last. */
export function CustomerWork({ lead, projects, names, work, canEdit }: Props) {
  if (!work) return <section className={styles.card}><h2>งานของลูกค้า</h2><p className={styles.error} role="alert">โหลดงานของลูกค้าไม่ได้ ลองรีเฟรชหน้านี้</p></section>;
  const newSale = work.canCreate && <Link href={`/sales/new?lead=${lead.id}`} prefetch={false}>เริ่มรายการขาย</Link>;
  if (lead.brand === "TARAVILLE") {
    const ordered = [...work.cases.filter(item => !isDone(item.status)), ...work.cases.filter(item => isDone(item.status))];
    return <section className={styles.card}><h2>งานของลูกค้า</h2>
      {!ordered.length && <p className={styles.hint}>ยังไม่มีรายการขาย</p>}
      <ul className={styles.workList}>{ordered.map(item => <li key={item.code} className={styles.workItem} data-dim={isDone(item.status)}><CaseLine item={item} /></li>)}</ul>
      {work.canCreate && <p><Link href={`/sales/new?lead=${lead.id}`} prefetch={false}>เปิดรายการขายใหม่</Link></p>}
    </section>;
  }
  const rank = (project: Project) => (project.status === "active" ? 0 : 1);
  const ordered = [...projects].sort((a, b) => rank(a) - rank(b));
  return <section className={styles.card}><h2>งานของลูกค้า</h2>
    {!projects.length && (lead.closed_at ? <p className={styles.hint}>รายการนี้ปิดอยู่ เปิดรายการอีกครั้งก่อนจึงจะเปิดโครงการได้</p>
      : canEdit ? <OpenProject lead={lead} /> : <p className={styles.hint}>ยังไม่ได้เปิดโครงการ</p>)}
    <ul className={styles.workList}>{ordered.map(project => {
      const item = work.cases.find(row => row.project_id === project.id);
      const cancelled = project.status === "cancelled";
      return <li key={project.id} className={styles.workItem} data-dim={cancelled || (item ? isDone(item.status) : false)}>
        <h3>{project.code}{cancelled ? " · ยกเลิก" : ""}</h3>
        {item ? <CaseLine item={item} /> : !cancelled && <p className={styles.hint}>ยังไม่มีรายการขาย</p>}
        {!item && !cancelled && newSale && <p>{newSale}</p>}
        {item?.status === "cancelled" && !cancelled && <p className={styles.hint}>รายการขายของโครงการนี้ถูกยกเลิกแล้ว โครงการเดิมเปิดรายการขายซ้ำไม่ได้ ให้ผู้บริหารยกเลิกโครงการนี้แล้วเปิดโครงการใหม่</p>}
        {cancelled && <p className={styles.hint}>{project.cancel_reason} · โดย {(project.cancelled_by && names.get(project.cancelled_by)) || "ผู้บริหาร"}
          {project.cancelled_at ? ` · ${formatDate(project.cancelled_at)}` : ""}</p>}
      </li>;
    })}</ul>
    {projects.length > 0 && !projects.some(project => project.status === "active") && !lead.closed_at && canEdit && <OpenProject lead={lead} />}
  </section>;
}
