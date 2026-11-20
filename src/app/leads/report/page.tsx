import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/staff";
import { currentMonth, monthLabel, reportFiltersSchema, reportSchema, REPORT_BRAND_LABELS, thaiDate } from "@/lib/walkin/monthly-report";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { Info } from "lucide-react";
import { LeadReportTable } from "./lead-report-table";
import { ReportControls } from "./report-controls";
import { ReportPrint } from "./report-print";
import { ReportBreakdowns, ReportCards } from "./report-summary";
import styles from "./report.module.css";

export const metadata = { title: "รายงาน Lead · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function ReportPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Report {...props} /></Suspense>;
}

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
  // The RPC scopes every non-executive role (sale and staff) to their own rows (ADR 0015).
  const isSale = session.staff.role !== "executive";
  // Test rows stay in the RPC rows until the purge (ADR 0062) but never in the UI or on paper; the summary already excludes them.
  const leads = report.leads.filter(lead => !lead.is_synthetic);
  const brandLabel = brand ? REPORT_BRAND_LABELS[brand] : "ทั้งสองแบรนด์";
  const ownerLabel = owner ? report.owners.find(item => item.id === owner)?.name ?? "ผู้ดูแลที่เลือก" : "ผู้ดูแลทุกคน";
  const scope = `${brandLabel} · ${isSale ? "ตัวเลขของทั้งทีม · รายชื่อเฉพาะที่คุณดูแล" : ownerLabel}`;
  const title = `รายงาน Lead ประจำเดือน ${monthLabel(month)}`;
  const preparedBy = `${thaiDate(new Date().toISOString())} · ${session.staff.full_name}`;
  const filterLines = [`เดือน: ${monthLabel(month)}`, `แบรนด์: ${brandLabel}`, isSale ? "รายชื่อ: เฉพาะที่คุณดูแล" : `ผู้ดูแล: ${ownerLabel}`];
  return <AppShell staff={session.staff} wide>
    <div className={`grid gap-4 ${styles.page}`}>
      <ReportPrint key={JSON.stringify([month, brand, owner])} leads={leads} title={title} scope={scope} preparedBy={preparedBy} brand={brand} filterLines={filterLines}>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-title/[1.5] font-bold">{title}</h1>
          <p className="m-0 text-sm text-muted-foreground">{scope} · จัดทำเมื่อ {preparedBy}</p>
        </div>
      </ReportPrint>
      <ReportControls month={month} latestMonth={currentMonth()} brand={brand} owner={owner} owners={report.owners} isSale={isSale} />
      <div className={`grid gap-4 ${styles.noPrint}`}>
        {isSale && <p role="note" className="m-0 flex items-center gap-2.5 rounded-sm border bg-secondary px-3.5 py-2.5 text-sm">
          <Info size={16} aria-hidden="true" />ตัวเลขสรุปและการแยกตามขั้น/แบรนด์ นับ Lead ของทั้งทีม · ตารางรายชื่อด้านล่างแสดงเฉพาะ Lead ที่คุณดูแล
        </p>}
        <ReportCards summary={summary} isSale={isSale} />
        <ReportBreakdowns summary={summary} isSale={isSale} brand={brand} />
      </div>
      <LeadReportTable leads={leads} isSale={isSale} hasFilter={Boolean(brand || (!isSale && owner))} clearHref={`/leads/report?month=${month}`} />
    </div>
  </AppShell>;
}
