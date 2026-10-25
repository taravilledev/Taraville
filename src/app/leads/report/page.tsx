import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/staff";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import { currentMonth, monthLabel, reportFiltersSchema, reportSchema } from "@/lib/walkin/monthly-report";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { PrintButton } from "./print-button";
import styles from "./report.module.css";

export const metadata = { title: "รายงานรายเดือน · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function ReportPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Report {...props} /></Suspense>;
}
const BRAND_LABELS = { TARAVILLE: "ธาราวิล", BAAN_KUNAPAP: "บ้านคุณภาพ" } as const;
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
  const scope = [brand ? BRAND_LABELS[brand] : "ทั้งสองแบรนด์", owner ? report.owners.find(item => item.id === owner)?.name ?? "ผู้ดูแลที่เลือก" : "ผู้ดูแลทุกคน"].join(" · ");
  return <AppShell staff={session.staff} wide>
    <div className={styles.page}>
      <form className={`${styles.controls} ${styles.noPrint}`} method="get" action="/leads/report">
        <label className={styles.field}>เดือน<input type="month" name="month" defaultValue={month} max={currentMonth()} required /></label>
        <label className={styles.field}>แบรนด์
          <select name="brand" defaultValue={brand ?? ""}><option value="">ทั้งสองแบรนด์</option><option value="TARAVILLE">ธาราวิล</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option></select></label>
        <label className={styles.field}>ผู้ดูแล
          <select name="owner" defaultValue={owner ?? ""}><option value="">ทุกคน</option>{report.owners.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="submit" className={styles.apply}>ดูรายงาน</button>
        <PrintButton />
      </form>
      <header className={styles.title}>
        <h1>รายงาน Lead ประจำเดือน {monthLabel(month)}</h1>
        <p>{scope} · พิมพ์เมื่อ {thaiDate(new Date().toISOString())} โดย {session.staff.full_name}</p>
      </header>
      <section className={styles.tiles} aria-label="สรุป">
        {([["Lead ใหม่", summary.total], ["ติดต่อแล้ว", summary.contacted], ["ปิดแล้ว", summary.closed], ["เปิดโครงการแล้ว", summary.project_opened]] as const)
          .map(([label, value]) => <div key={label} className={styles.tile}><small>{label}</small><strong>{value.toLocaleString("th-TH")}</strong></div>)}
      </section>
      {summary.synthetic > 0 && <p className={styles.note}>ไม่นับข้อมูลสมมติ {summary.synthetic.toLocaleString("th-TH")} รายการในตัวเลขสรุป (แสดงในตารางด้านล่างพร้อมป้ายกำกับ)</p>}
      <section className={styles.breakdowns}>
        <div><h2>แยกตามแบรนด์</h2><ul>{(Object.keys(BRAND_LABELS) as (keyof typeof BRAND_LABELS)[]).map(key => <li key={key}><span>{BRAND_LABELS[key]}</span><b>{summary.by_brand[key] ?? 0}</b></li>)}</ul></div>
        <div><h2>แยกตามสถานะ</h2><ul>{(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map(key => <li key={key}><span>{STAGE_LABELS[key]}</span><b>{summary.by_stage[key] ?? 0}</b></li>)}</ul></div>
        <div><h2>แยกตามผู้ดูแล</h2>{summary.by_owner.length ? <ul>{summary.by_owner.map(item => <li key={item.owner_id}><span>{item.name}</span><b>{item.count}</b></li>)}</ul> : <p>—</p>}</div>
      </section>
      <h2>รายชื่อ ({report.leads.length.toLocaleString("th-TH")})</h2>
      {report.leads.length ? <table className={styles.table}>
        <thead><tr><th>วันที่</th><th>ชื่อ</th><th>เบอร์โทร</th><th>แบรนด์</th><th>สถานะ</th><th>ผู้ดูแล</th></tr></thead>
        <tbody>{report.leads.map(lead => <tr key={lead.id}>
          <td>{thaiDate(lead.created_at)}</td>
          <td>{lead.name}{lead.is_synthetic && <small> · ข้อมูลสมมติ</small>}</td>
          <td>{lead.phone}</td><td>{BRAND_LABELS[lead.brand]}</td><td>{STAGE_LABELS[lead.stage]}</td><td>{lead.owner}</td></tr>)}</tbody>
      </table> : <p className={styles.empty}>ไม่มี Lead ที่ลงทะเบียนในเดือนนี้</p>}
    </div>
  </AppShell>;
}
