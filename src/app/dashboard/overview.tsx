import Link from "next/link";
import { Building2, Clock, Coins, Users } from "lucide-react";
import type { DashboardOverviewData } from "@/lib/sales/dashboard-data";
import { formatDate } from "@/lib/sales/date";
import { BrandTag } from "@/components/brand-tag";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { displayAmount } from "../summary/summary-model";
import * as styles from "./overview-styles";

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
    { label: "Lead ทั้งหมด", amount: number.format(data.leadsTotal), unit: "ราย", Icon: Users, tone: "blue",
      href: leadsHref, action: "ดูรายชื่อ Lead ›" },
    { label: "มูลค่าสัญญาที่กำลังดำเนินการ", amount: displayAmount(data.signedTotal), unit: "บาท", Icon: Building2, tone: "blue",
      note: `ลงนามแล้ว ${number.format(data.signedCount)} สัญญา` },
    { label: "เงินรับจริงสุทธิสะสม", amount: displayAmount(data.received), unit: "บาท", Icon: Coins, tone: "positive",
      note: "หักยอดที่จ่ายคืนแล้ว" },
    { label: "รายการรับเงินรอยืนยัน", amount: number.format(data.pending), unit: "รายการ", Icon: Clock, tone: "warning",
      href: `/sales?${pendingParams}#projects-title`, action: "ดูรายการรอยืนยัน ›" },
  ] as const;
  return <>
    <section className={styles.metrics} aria-label="สรุปภาพรวม">
      {metrics.map(({ label, amount, unit, Icon, tone, ...details }) => <article className={styles.metric} key={label} data-tone={tone}>
        <div className={styles.metricHeader}><h2>{label}</h2><span className={styles.icon}><Icon size={16} aria-hidden="true" /></span></div>
        <p className={styles.metricAmount}>{amount} <small>{unit}</small></p>
        {"href" in details ? <Link className={styles.action} href={details.href} prefetch={false}>{details.action}</Link>
          : <p className={styles.meta}>{details.note}</p>}
      </article>)}
    </section>

    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="dashboard-followup">
        <h2 id="dashboard-followup">โครงการที่ต้องติดตาม</h2>
        <ul className={styles.list}>
          {groups.map(({ label, count, project, href }) => <li key={label}>
            {count > 0 ? <Link href={href} prefetch={false} className={styles.followRow}>
              <span className="grid min-w-0 gap-1">
                <span className="flex items-center gap-2.5"><strong>{label}</strong><span className={styles.pill}>{number.format(count)} โครงการ</span></span>
                {project && <span className="text-xs text-muted-foreground">{project.code} · {project.customer} · <span className="font-semibold text-warn-ink">{project.waitingSince ? `รอตั้งแต่ ${dateOf(project.waitingSince)}` : "ยังไม่มีวันที่เริ่มรอ"}</span></span>}
              </span>
              <span className="text-lg text-muted-foreground" aria-hidden="true">›</span>
            </Link> : <div className={styles.emptyRow}><strong>{label}</strong><span className="text-xs">ไม่มีโครงการในกลุ่มนี้</span></div>}
          </li>)}
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="dashboard-leads">
        <div className={styles.sectionHeader}>
          <h2 id="dashboard-leads">Lead ล่าสุด</h2>
          <Link className={styles.action} href={leadsHref} prefetch={false}>ดูทั้งหมด ›</Link>
        </div>
        {data.leads.length > 0 ? <ul className={styles.list}>{data.leads.map(lead => <li className={styles.leadRow} key={lead.id}>
          <span className="grid min-w-0 gap-0.5">
            <Link href={`/leads/${lead.id}`} className="font-semibold text-foreground" prefetch={false}>{lead.customer}</Link>
            <span className="text-xs text-muted-foreground">รับเมื่อ {dateOf(lead.created_at)} · ผู้ดูแล {lead.owner || "—"}</span>
          </span>
          <BrandTag brand={lead.brand} />
        </li>)}</ul> : <p className={styles.empty}>ยังไม่มี Lead</p>}
      </section>
    </div>

    <section className={styles.panel} aria-labelledby="dashboard-due">
      <div className={styles.sectionHeader}>
        <div><h2 id="dashboard-due">บิลที่ต้องตามเก็บ</h2><p className={styles.meta}>เกินกำหนดและครบกำหนดภายใน 7 วัน</p></div>
        <Link className={styles.action} href="/summary" prefetch={false}>สรุปการเงินบ้านคุณภาพ ›</Link>
      </div>
      {data.due.length > 0 ? <DataTable label="บิลที่ต้องตามเก็บ">
        <thead><tr><th scope="col">โครงการ</th><th scope="col">งวด</th><th scope="col">ครบกำหนด</th><th scope="col" className="text-end">ค้าง (บาท)</th><th scope="col"><span className="sr-only">เปิดโครงการ</span></th></tr></thead>
        <tbody>{[...data.due].sort((a, b) => a.due_date.localeCompare(b.due_date)).map(item => <DataRow key={`${item.group}:${item.id}`}>
          <td><span className="font-semibold tabular-nums">{item.code}</span><span className="block text-xs text-muted-foreground">{item.customer}</span></td>
          <td><span className="block">{item.label}</span><BrandTag brand={item.brand} /></td>
          <td className="whitespace-nowrap"><span className={item.due_date < today ? "font-bold text-danger-ink" : "text-warn-ink"}>{dueLabel(item.due_date, today)}</span><span className="block text-xs text-muted-foreground">{formatDate(item.due_date)}</span></td>
          <td className="whitespace-nowrap text-end font-semibold tabular-nums">{displayAmount(item.outstanding)}</td>
          <td className="text-end text-muted-foreground"><RowLink href={`/sales/${item.case_id}?tab=money#${item.group === "design" ? "design-fees" : "schedule"}`}><span className="sr-only">เปิดการเงิน</span><span aria-hidden="true">›</span></RowLink></td>
        </DataRow>)}</tbody>
      </DataTable> : <p className={styles.empty}>ไม่มีบิลค้างที่ครบกำหนดในช่วงนี้</p>}
      {data.dueCount > data.due.length && <p className={styles.meta}>แสดง {number.format(data.due.length)} จาก {number.format(data.dueCount)} รายการ</p>}
    </section>
  </>;
}
