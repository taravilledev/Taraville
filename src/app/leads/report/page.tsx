import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/staff";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import { currentMonth, monthLabel, reportFiltersSchema, reportSchema, REPORT_BRAND_LABELS } from "@/lib/walkin/monthly-report";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ReportOutput } from "./report-output";
import styles from "./report.module.css";

export const metadata = { title: "รายงานรายเดือน · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function ReportPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Report {...props} /></Suspense>;
}
const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

async function Report({ searchParams }: Props) {
  const session = await requireStaff();
  const raw = await searchParams;
  const parsed = reportFiltersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "")));
  const invalidFilter = <AppShell staff={session.staff}><p role="alert">ตัวกรองไม่ถูกต้อง <Link href="/leads/report" prefetch={false}>ล้างตัวกรอง</Link></p></AppShell>;
  if (!parsed.success) return invalidFilter;
  const { brand, owner } = parsed.data;
  const month = parsed.data.month ?? currentMonth();
  // Every call writes an audit row inside the RPC (ADR 0014), so the page is never cached.
  const { data, error } = await session.supabase.rpc("walkin_monthly_report", { p_month: `${month}-01`, p_brand: brand ?? null, p_owner: owner ?? null });
  if (error?.message === "invalid_report_filter") return invalidFilter;
  if (error) throw new Error("โหลดรายงานไม่ได้ กรุณาลองใหม่");
  const report = reportSchema.parse(data);
  const { summary } = report;
  const scope = [brand ? REPORT_BRAND_LABELS[brand] : "ทั้งสองแบรนด์", owner ? report.owners.find(item => item.id === owner)?.name ?? "ผู้ดูแลที่เลือก" : "ผู้ดูแลทุกคน"].join(" · ");
  const title = `รายงานผู้สนใจประจำเดือน ${monthLabel(month)}`;
  const preparedBy = `${thaiDate(new Date().toISOString())} · ${session.staff.full_name}`;
  return <AppShell staff={session.staff} wide>
    <div className={styles.page}>
      <ReportOutput filterKey={JSON.stringify([month, brand, owner])} filters={{ month, latestMonth: currentMonth(), brand, owner, owners: report.owners }}
        leads={report.leads} title={title} scope={scope} preparedBy={preparedBy}>
        <header className={styles.title}>
          <h1>{title}</h1>
          <p>{scope} · จัดทำเมื่อ {preparedBy}</p>
        </header>
        <section className={styles.tiles} aria-label="สรุป">
          {([["Lead ใหม่", summary.total], ["ติดต่อแล้ว", summary.contacted], ["ปิดแล้ว", summary.closed], ["เปิดโครงการแล้ว", summary.project_opened]] as const)
            .map(([label, value]) => <div key={label} className={styles.tile}><small>{label}</small><strong>{value.toLocaleString("th-TH")}</strong></div>)}
        </section>
        {summary.synthetic > 0 && <p className={styles.note}>ไม่นับข้อมูลสมมติ {summary.synthetic.toLocaleString("th-TH")} รายการในตัวเลขสรุป (แสดงในตารางด้านล่างพร้อมป้ายกำกับ)</p>}
        <section className={styles.breakdowns}>
          <div><h2>แยกตามแบรนด์</h2><ul>{(Object.keys(REPORT_BRAND_LABELS) as (keyof typeof REPORT_BRAND_LABELS)[]).map(key => <li key={key}><span>{REPORT_BRAND_LABELS[key]}</span><b>{summary.by_brand[key] ?? 0}</b></li>)}</ul></div>
          <div><h2>แยกตามสถานะ</h2><ul>{(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map(key => <li key={key}><span>{STAGE_LABELS[key]}</span><b>{summary.by_stage[key] ?? 0}</b></li>)}</ul></div>
          <div><h2>แยกตามผู้ดูแล</h2>{summary.by_owner.length ? <ul>{summary.by_owner.map(item => <li key={item.owner_id}><span>{item.name}</span><b>{item.count}</b></li>)}</ul> : <p>—</p>}</div>
        </section>
      </ReportOutput>
    </div>
  </AppShell>;
}
