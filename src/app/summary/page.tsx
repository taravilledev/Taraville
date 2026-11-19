import { Suspense, useId } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { PrintButton } from "@/app/leads/report/print-button";
import { formatDate } from "@/lib/sales/date";
import { executiveSummary } from "@/lib/sales/executive";
import { requireStaff } from "@/lib/supabase/staff";
import { pageWindow } from "@/lib/walkin/lead-list";
import { AmountGuideDialog } from "./amount-guide-dialog";
import { ProjectTable, identityColumns } from "./project-table";
import { ReportOutputDialog } from "./report-output-dialog";
import { collectionFilters, summaryPageRange, summaryQuery, summaryReport, summaryStages, type SummaryReport } from "./summary-model";
import * as styles from "./summary-styles";
import paper from "./summary-print.module.css";
import { noticeClass } from "@/components/notice";
import { pageHeaderClass } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export const metadata = { title: "สรุปโครงการและการเงิน · บ้านคุณภาพ", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Query = ReturnType<typeof summaryQuery>;
type Report = SummaryReport;

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
  const reportParams = new URLSearchParams(query.params);
  reportParams.delete("view");
  const switchParams = new URLSearchParams(reportParams);
  switchParams.delete("from");
  switchParams.delete("to");
  if (!query.isPeriodView) switchParams.set("view", "period");
  const switchUrl = switchParams.size ? `/summary?${switchParams}` : "/summary";
  const title = query.isPeriodView ? "รายงานตามช่วงวันที่" : "สรุปโครงการและการเงิน";
  const status = needsPeriod ? <p className={styles.empty}>เลือกวันที่รับเงินหรือคืนเงินเพื่อดูยอดในช่วงนั้น</p> : <ReportError query={query} />;
  const range = summaryPageRange(report?.rows.length ?? 0, query.page);
  const returnParams = new URLSearchParams(query.params);
  if (range.page > 1) returnParams.set("page", String(range.page));

  if (isPrint) return <main className={paper.printReport}>
    <div className={paper.printControls}>
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={returnParams.size ? `/summary?${returnParams}#projects` : "/summary"} prefetch={false}>
        {query.isPeriodView ? "กลับรายงาน" : "กลับหน้าสรุป"}</Link>
      {report && <PrintButton />}
    </div>
    <h1>{title} · บ้านคุณภาพ</h1>
    <ReportScope report={report} query={query} isPrint />
    {report ? <ProjectTable report={report} rows={report.rows} /> : status}
  </main>;

  return <AppShell staff={staff} wide>
    <div className={styles.page}>
      <header className={pageHeaderClass}>
        <div><h1>{title}</h1><p>บ้านคุณภาพ</p></div>
        <div className={styles.actions}>
          {!query.isPeriodView && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/dashboard" prefetch={false}>แดชบอร์ด</Link>}
          <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={switchUrl} prefetch={false}>
            {query.isPeriodView ? "กลับหน้าสรุป" : "รายงานตามช่วงวันที่"}
          </Link>
          {report && <ReportOutputDialog key={query.params.toString()} report={report} title={title} today={today} />}
        </div>
      </header>
      <SummaryFilters query={query} report={report} />
      {report ? <section id="projects" aria-label="รายการโครงการ">
        <ReportScope report={report} query={query} />
        <ProjectTable report={report} rows={report.rows.slice(range.start, range.end)} query={query} />
        <SummaryPager range={range} query={query} count={report.rows.length} />
      </section> : status}
    </div>
  </AppShell>;
}

function SummaryFilters({ query, report }: { query: Query; report: Report | null }) {
  const id = useId();
  return <form className={styles.filters} method="get" action="/summary">
    {query.isPeriodView && <input type="hidden" name="view" value="period" />}
    <Field><FieldLabel htmlFor={`${id}-q`}>ค้นหาโครงการ</FieldLabel><Input id={`${id}-q`} type="search" name="q" maxLength={150}
      placeholder="รหัสโครงการหรือชื่อลูกค้า" defaultValue={query.filters.query} /></Field>
    <Field><FieldLabel htmlFor={`${id}-stage`}>ขั้นโครงการ</FieldLabel><NativeSelect id={`${id}-stage`} name="stage" defaultValue={query.filters.stage}>
      <option value="">ทุกขั้น</option>
      {Object.entries(summaryStages).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
    </NativeSelect></Field>
    <Field><FieldLabel htmlFor={`${id}-money`}>กรองตามยอดเงิน</FieldLabel><NativeSelect id={`${id}-money`} name="money" defaultValue={query.filters.money}>
      <option value="">ทุกโครงการ</option>
      {Object.entries(collectionFilters).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
    </NativeSelect></Field>
    {report && <Field className={styles.mobileSort}><FieldLabel htmlFor={`${id}-sort`}>เรียงตาม</FieldLabel><NativeSelect id={`${id}-sort`} name="sort" defaultValue={query.params.get("sort") ?? ""}>
      <option value="">บิลเกินกำหนดก่อน</option>
      {[...identityColumns, ...report.columns].map(column => <optgroup key={column.key} label={column.label}>
        <option value={`${column.key}.asc`}>{column.label} ↑</option>
        <option value={`${column.key}.desc`}>{column.label} ↓</option>
      </optgroup>)}
    </NativeSelect></Field>}
    {!report && query.sort && <input type="hidden" name="sort" value={query.params.get("sort") ?? ""} />}
    {query.isPeriodView && <>
      <Field><FieldLabel htmlFor={`${id}-from`}>รับและคืนเงินตั้งแต่</FieldLabel><Input id={`${id}-from`} type="date" name="from" defaultValue={query.from ?? ""} /></Field>
      <Field><FieldLabel htmlFor={`${id}-to`}>ถึงวันที่</FieldLabel><Input id={`${id}-to`} type="date" name="to" defaultValue={query.to ?? ""} /></Field>
    </>}
    <button type="submit" className={buttonVariants({ size: "auto" })}>{query.isPeriodView ? "แสดงรายงาน" : "กรอง"}</button>
    {(query.params.size > (query.isPeriodView ? 1 : 0) || !query.isPeriodValid) &&
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={query.isPeriodView ? "/summary?view=period" : "/summary"} prefetch={false}>ล้างตัวกรอง</Link>}
  </form>;
}

function ReportError({ query }: { query: Query }) {
  return <p className={noticeClass} role="alert">{query.isPeriodValid ? "โหลดสรุปโครงการไม่ได้ กรุณาลองใหม่"
    : "กรุณาเลือกช่วงวันที่ที่ถูกต้อง วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"}</p>;
}

function ReportScope({ report, query, isPrint = false }: { report: Report | null; query: Query; isPrint?: boolean }) {
  if (!report) return null;
  const labels = isPrint ? [
    query.filters.query && `ค้นหา “${query.filters.query}”`,
    query.filters.stage && summaryStages[query.filters.stage as keyof typeof summaryStages],
    query.filters.money && collectionFilters[query.filters.money as keyof typeof collectionFilters],
  ].filter(Boolean) : [];
  const period = query.from && query.to && query.from === query.to ? formatDate(query.from)
    : query.from && query.to ? `${formatDate(query.from)} – ${formatDate(query.to)}`
    : query.from ? `ตั้งแต่ ${formatDate(query.from)}` : query.to ? `ถึง ${formatDate(query.to)}` : "";
  const hasUnknownBalance = report.rows.some(row => row.hasUnknownBalance);
  const hasUnknownValue = report.rows.some(row => row.amounts.value === null);
  const notes = <>
    <dl className={styles.glossary}>
      {report.columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{column.description}</dd></div>)}
    </dl>
    {period && <p>เลือกวันที่เพื่อดูเงินเข้าและเงินคืนเฉพาะช่วงนั้น ยอดสะสมและยอดค้างยังแสดงตามข้อมูลล่าสุด</p>}
    {(hasUnknownBalance || hasUnknownValue) && <p>ถ้าราคาหรือยอดค้างบางรายการยังไม่มีข้อมูล ระบบจะรวมเฉพาะตัวเลขที่มี</p>}
    <p className={styles.noteExample}><strong>ตัวอย่าง</strong> ลูกค้าค้างตามบิล 30,000 บาท ในจำนวนนี้เลยกำหนด 10,000 บาท ยอดค้างตามบิลจึงยังเป็น 30,000 บาท</p>
  </>;
  return <div className={styles.scope}>
    <p>หน่วยบาท{period && ` · รับและคืนเงิน ${period}`}{labels.length > 0 && ` · ${labels.join(" · ")}`}
      {!isPrint && (hasUnknownBalance || hasUnknownValue) && " · รวมเฉพาะยอดที่ระบุได้"}</p>
    {!isPrint && <AmountGuideDialog>
      <div className={styles.notes}>{notes}</div>
    </AmountGuideDialog>}
  </div>;
}

function SummaryPager({ range, query, count }: { range: ReturnType<typeof summaryPageRange>; query: Query; count: number }) {
  if (!count) return null;
  const href = (page: number) => {
    const params = new URLSearchParams(query.params);
    if (page > 1) params.set("page", String(page));
    return params.size ? `/summary?${params}#projects` : "/summary#projects";
  };
  return <div className={styles.pager}>
    <p>แสดง {range.start + 1}–{range.end} จาก {count.toLocaleString("th-TH")} โครงการ</p>
    {range.totalPages > 1 && <nav className={styles.actions} aria-label="เปลี่ยนหน้าโครงการ">
      {range.page > 1 && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(range.page - 1)} prefetch={false}>ก่อนหน้า</Link>}
      {pageWindow(range.page, range.totalPages).map((number, index) => number === null ? <span key={`gap-${index}`} aria-hidden>…</span>
        : <Link key={number} className={buttonVariants({ variant: "outline", size: "auto" })} href={href(number)} prefetch={false}
          aria-label={`หน้า ${number}`} aria-current={number === range.page ? "page" : undefined}>{number}</Link>)}
      {range.page < range.totalPages && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(range.page + 1)} prefetch={false}>ถัดไป</Link>}
    </nav>}
  </div>;
}
