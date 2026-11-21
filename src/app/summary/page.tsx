import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { PrintButton } from "@/app/leads/report/print-button";
import { executiveSummary } from "@/lib/sales/executive";
import { requireStaff } from "@/lib/supabase/staff";
import { pageWindow } from "@/lib/walkin/lead-list";
import { CloseoutChip, SummaryCards } from "./summary-cards";
import { SummaryControls } from "./summary-controls";
import { ProjectList } from "./project-list";
import { ProjectTable } from "./project-table";
import { ReportOutputDialog } from "./report-output-dialog";
import { ReportError, ReportScope } from "./summary-scope";
import { periodPresets, periodPresetValue, summaryFacets, summaryHref, summaryPageRange, summaryQuery, summaryReport } from "./summary-model";
import * as styles from "./summary-styles";
import paper from "./summary-print.module.css";
import { buttonVariants } from "@/components/ui/button";

const title = "สรุปการเงินบ้านคุณภาพ";
export const metadata = { title: `${title} · บ้านคุณภาพ`, robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function SummaryPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Summary {...props} /></Suspense>;
}

async function Summary({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "executive") notFound();

  const raw = await searchParams;
  const query = summaryQuery(raw);
  const isPrint = raw.print === "1";
  const needsPeriod = query.isPeriodView && query.isPeriodValid && !query.from && !query.to;
  const projects = query.isPeriodValid && !needsPeriod ? await executiveSummary(supabase, query) : null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const report = projects ? summaryReport(projects, today, query) : null;
  const facets = projects ? summaryFacets(projects, today, query.filters) : null;
  const status = needsPeriod ? <p className={styles.empty}>เลือกวันที่รับเงินหรือคืนเงินเพื่อดูยอดในช่วงนั้น</p> : <ReportError query={query} />;
  const range = summaryPageRange(report?.rows.length ?? 0, query.page);
  const returnParams = new URLSearchParams(query.params);
  if (range.page > 1) returnParams.set("page", String(range.page));

  if (isPrint) return <main className={paper.printReport}>
    <div className={paper.printControls}>
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={returnParams.size ? `/summary?${returnParams}#projects` : "/summary"} prefetch={false}>
        กลับหน้าสรุป</Link>
      {report && <PrintButton />}
    </div>
    <h1>{title}</h1>
    <ReportScope report={report} query={query} isPrint />
    {report ? <ProjectTable report={report} rows={report.rows} /> : status}
  </main>;

  const presets = periodPresets(today);
  const preset = periodPresetValue(presets, query);
  const { filters } = query;
  const isFiltered = Boolean(filters.query || filters.owner || filters.stage || filters.money || query.isPeriodView) || !query.isPeriodValid;
  const sortOptions = report ? [{ key: "code", label: "โครงการ" }, { key: "stage", label: "ขั้นปัจจุบัน" }, ...report.columns] : null;

  return <AppShell staff={staff} wide>
    <div className={styles.page}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1"><h1 className="m-0 text-title">{title}</h1><ReportScope report={report} query={query} /></div>
        <div className={styles.actions}>
          {report && <ReportOutputDialog key={query.params.toString()} report={report} title={title} today={today}
            csvHref={`/summary/export?${query.params}`} printHref={`/summary?${new URLSearchParams([...query.params, ["print", "1"]])}`} />}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SummaryControls key={preset} q={filters.query} owner={filters.owner} owners={facets?.owners ?? []} stage={filters.stage} money={filters.money}
          sort={query.params.get("sort") ?? ""} sortOptions={sortOptions} presets={presets} preset={preset} from={query.from ?? ""} to={query.to ?? ""} />
        {isFiltered && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/summary" prefetch={false}>ล้างตัวกรอง</Link>}
      </div>
      {report && facets ? <>
        <SummaryCards report={report} params={query.params} money={filters.money} />
        <CloseoutChip amount={facets.closeout} params={query.params} money={filters.money} />
        <section id="projects" aria-label="รายการโครงการ">
          <ProjectList report={report} rows={report.rows.slice(range.start, range.end)} query={query} stage={filters.stage}
            stageCounts={facets.stageCounts} total={facets.total} />
          <SummaryPager range={range} params={query.params} count={report.rows.length} />
        </section>
      </> : status}
    </div>
  </AppShell>;
}

function SummaryPager({ range, params, count }: { range: ReturnType<typeof summaryPageRange>; params: URLSearchParams; count: number }) {
  if (!count) return null;
  const href = (page: number) => summaryHref(params, { page: page > 1 ? String(page) : null }, "#projects");
  return <div className={styles.pager}>
    <p>แสดง {range.start + 1}–{range.end} จาก {count.toLocaleString("th-TH")} โครงการ · ยอดในการ์ดรวมทุกหน้าตามตัวกรอง</p>
    {range.totalPages > 1 && <nav className={styles.actions} aria-label="เปลี่ยนหน้าโครงการ">
      {range.page > 1 && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(range.page - 1)} prefetch={false}>ก่อนหน้า</Link>}
      {pageWindow(range.page, range.totalPages).map((number, index) => number === null ? <span key={`gap-${index}`} aria-hidden>…</span>
        : <Link key={number} className={buttonVariants({ variant: "outline", size: "auto" })} href={href(number)} prefetch={false}
          aria-label={`หน้า ${number}`} aria-current={number === range.page ? "page" : undefined}>{number}</Link>)}
      {range.page < range.totalPages && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(range.page + 1)} prefetch={false}>ถัดไป</Link>}
    </nav>}
  </div>;
}
