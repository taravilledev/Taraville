import Link from "next/link";
import { ArrowUpRight, Building2, Clock, Coins, Users } from "lucide-react";
import type { DashboardOverviewData } from "@/lib/sales/dashboard-data";
import { formatDate } from "@/lib/sales/date";
import { brandLabels } from "@/lib/sales/models";
import { displayAmount } from "../summary/summary-model";
import styles from "./overview.module.css";

type FollowUp = {
  label: string;
  count: number;
  project?: { code: string; customer: string; owner: string; href: string; waitingSince?: string | null };
  href: string;
};

const calendar = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" });
const number = new Intl.NumberFormat("th-TH");
const dateOf = (timestamp: string) => formatDate(calendar.format(new Date(timestamp)));
const DAY_MS = 86_400_000;

function dueLabel(date: string, today: string) {
  const days = (Date.parse(date) - Date.parse(today)) / DAY_MS;
  if (days < 0) return `เลยกำหนด ${number.format(-days)} วัน`;
  if (days === 0) return "ครบกำหนดวันนี้";
  return `ครบกำหนดใน ${number.format(days)} วัน`;
}

export function DashboardOverview({ data, groups, brand }: { data: DashboardOverviewData; groups: FollowUp[]; brand: string }) {
  const leadParams = new URLSearchParams({ closed: "show" });
  const pendingParams = new URLSearchParams({ attention: "pending" });
  if (brand) {
    leadParams.set("brand", brand);
    pendingParams.set("brand", brand);
  }
  const leadsHref = `/leads?${leadParams}`;
  const today = calendar.format(new Date());
  const metrics = [
    { label: "ลูกค้า Walk-in ทั้งหมด", amount: number.format(data.leadsTotal), unit: "ราย", Icon: Users, tone: "positive",
      href: leadsHref, action: "ดูรายชื่อผู้สนใจ" },
    { label: "มูลค่าสัญญาที่กำลังดำเนินการ", amount: displayAmount(data.signedTotal), unit: "บาท", Icon: Building2, tone: "blue",
      note: `ลงนามแล้ว ${number.format(data.signedCount)} สัญญา` },
    { label: "เงินรับจริงสุทธิสะสม", amount: displayAmount(data.received), unit: "บาท", Icon: Coins, tone: "positive",
      note: "หักยอดที่จ่ายคืนแล้ว" },
    { label: "รายการรับเงินรอยืนยัน", amount: number.format(data.pending), unit: "รายการ", Icon: Clock, tone: "warning",
      href: `/dashboard?${pendingParams}#projects-title`, action: "ดูรายการรอยืนยัน" },
  ] as const;
  return <>
    <section className={styles.metrics} aria-label="ข้อมูลภาพรวมผู้บริหาร">
      {metrics.map(({ label, amount, unit, Icon, tone, ...details }) => <article className={styles.metric} key={label} data-tone={tone}>
        <div className={styles.metricHeader}><h2>{label}</h2><span className={styles.icon}><Icon size={20} aria-hidden="true" /></span></div>
        <p className={styles.metricAmount}>{amount} <small>{unit}</small></p>
        {"href" in details ? <Link className={styles.action} href={details.href} prefetch={false}>{details.action}<ArrowUpRight size={15} aria-hidden="true" /></Link>
          : <p className={styles.meta}>{details.note}</p>}
      </article>)}
    </section>

    <div className={styles.columns}>
      <div className={styles.main}>
        <section className={styles.panel} aria-labelledby="dashboard-followup">
          <h2 id="dashboard-followup">โครงการที่ต้องติดตาม</h2>
          <ul className={styles.groups}>
            {groups.map(({ label, count, project, href }) => <li key={label} className={styles.group}>
              <Link href={href} prefetch={false} className={styles.groupLink}><span>{label}</span><span>{number.format(count)} โครงการ <ArrowUpRight size={14} aria-hidden="true" /></span></Link>
              {project ? <div className={styles.itemText}>
                <Link href={project.href} className={styles.itemTitle} prefetch={false}>{project.code} · {project.customer}</Link>
                <p className={styles.meta}>{project.owner || "—"} · {project.waitingSince ? `รอตั้งแต่ ${dateOf(project.waitingSince)}` : "ยังไม่มีวันที่เริ่มรอ"}</p>
              </div> : <p className={styles.meta}>ไม่มีโครงการในกลุ่มนี้</p>}
            </li>)}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="dashboard-due">
          <div className={styles.sectionHeader}>
            <div><h2 id="dashboard-due">บิลที่ต้องตามเก็บ</h2><p className={styles.meta}>เกินกำหนดและครบกำหนดภายใน 7 วัน</p></div>
            <Link className={styles.action} href="/summary" prefetch={false}>สรุปการเงินบ้านคุณภาพ<ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          {data.due.length > 0 ? <ul className={styles.items}>
            {data.due.map(item => <li className={styles.dueRow} key={`${item.group}:${item.id}`}>
              <span className={styles.dueBadge} data-overdue={item.due_date < today}>{dueLabel(item.due_date, today)}</span>
              <div className={styles.itemText}>
                <p className={styles.itemTitle}>{item.code} · {item.customer}</p>
                <p className={styles.meta}>{item.label} · {brandLabels[item.brand]}</p>
                <p className={styles.meta}>ครบกำหนด {formatDate(item.due_date)}</p>
              </div>
              <div className={styles.duePayment}>
                <strong>{displayAmount(item.outstanding)} บาท</strong>
                <Link className={styles.action} href={`/sales/${item.case_id}?tab=money#${item.group === "design" ? "design-fees" : "schedule"}`} prefetch={false}>
                  เปิดการเงิน<ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </li>)}
          </ul> : <p className={styles.empty}>ไม่มีบิลค้างที่ครบกำหนดในช่วงนี้</p>}
          {data.dueCount > data.due.length && <p className={styles.meta}>แสดง {number.format(data.due.length)} จาก {number.format(data.dueCount)} รายการ</p>}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.leads}`} aria-labelledby="dashboard-leads">
        <div className={styles.sectionHeader}>
          <h2 id="dashboard-leads">ลูกค้า Walk-in ล่าสุด</h2>
          <Link className={styles.action} href={leadsHref} prefetch={false}>ดูทั้งหมด<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        {data.leads.length > 0 ? <ul className={styles.items}>{data.leads.map(lead => <li className={styles.leadRow} key={lead.id}>
          <div className={styles.itemText}>
            <Link href={`/leads/${lead.id}`} className={styles.itemTitle} prefetch={false}>{lead.customer}</Link>
            <p className={styles.meta}>รับเมื่อ {dateOf(lead.created_at)}</p>
            <p className={styles.meta}>ผู้ดูแล {lead.owner || "—"}</p>
          </div>
          <span className={styles.brandBadge} data-brand={lead.brand}>{brandLabels[lead.brand]}</span>
        </li>)}</ul> : <p className={styles.empty}>ยังไม่มีรายการ Walk-in</p>}
      </section>
    </div>
  </>;
}
