import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { salesCaseList, salesWorkQueue } from "@/lib/sales/queries";
import { brandLabels, caseStatusLabels, caseStatusTones, workQueueKinds } from "@/lib/sales/models";
import { requireStaff } from "@/lib/supabase/staff";
import { uncontactedLeadCount } from "@/lib/walkin/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { executiveWork } from "@/lib/sales/executive";
import { dashboardFollowUps, dashboardOverview } from "@/lib/sales/dashboard-data";
import { caseRowClass } from "../sales/project-list";
import { DashboardOverview } from "./overview";
import { groupDashboardProjects } from "./project-ownership";
import { BrandTag } from "@/components/brand-tag";
import { tabLinksClass } from "@/components/tab-links";
import { pageHeaderClass } from "@/components/page-header";
import { noticeClass } from "@/components/notice";
import { panelClass } from "@/components/panel";
import { Status } from "@/components/status";
import { statCardsClass } from "@/components/stat-cards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "แดชบอร์ด · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const LIST_PARAMS = ["attention", "status", "q", "ownership", "page"];
const thaiDate = (date: Date) => date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function DashboardPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Home {...props} /></Suspense>; }
async function Home({ searchParams }: Props) {
  const raw = await searchParams;
  // The project list moved to /sales; old /dashboard?attention=… (and other list filter) links still open that list.
  if (LIST_PARAMS.some(key => one(raw[key]))) {
    const params = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
    redirect(`/sales?${params}`);
  }
  const { staff, supabase } = await requireStaff();
  if (staff.role === "executive") {
    const requested = one(raw.brand);
    const brand = Object.hasOwn(brandLabels, requested) ? requested : "";
    const brands = [{ value: "", label: "ทั้งสองแบรนด์" }, ...Object.entries(brandLabels).map(([value, label]) => ({ value, label }))];
    const [work, overview] = await Promise.all([
      executiveWork(supabase, { status: "active", brand, query: "" }),
      dashboardOverview(supabase, brand),
    ]);
    return <AppShell staff={staff} wide><div className="grid gap-6">
      <div className={pageHeaderClass}><div><h1>แดชบอร์ด</h1><p>ติดตามงานและโครงการของบ้านคุณภาพและธาราวิลล์</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales" prefetch={false}>ดูโครงการทั้งหมด</Link>
          <Link className={buttonVariants({ size: "auto" })} href="/summary" prefetch={false}>สรุปการเงินบ้านคุณภาพ</Link>
        </div>
      </div>
      <nav className={tabLinksClass} aria-label="เลือกแบรนด์สำหรับแดชบอร์ด">
        {brands.map(({ value, label }) => <Link key={value} href={value ? `/dashboard?brand=${value}` : "/dashboard"}
          aria-current={value === brand ? "page" : undefined} prefetch={false}>{label}</Link>)}
      </nav>
      {overview && work ? <DashboardOverview data={overview} groups={dashboardFollowUps(work, overview, brand)} brand={brand} />
        : <p className={noticeClass} role="status">โหลดภาพรวมผู้บริหารไม่ได้ ลองรีเฟรชหน้านี้ รายการโครงการยังเปิดได้ที่เมนูโครงการ</p>}
    </div></AppShell>;
  }
  const [cases, queue, uncontacted] = await Promise.all([
    salesCaseList({ status: "active", brand: "", query: "" }), salesWorkQueue(), uncontactedLeadCount(supabase, staff.id),
  ]);
  const mine = groupDashboardProjects(cases, staff.id).mine.slice(0, 5);
  const total = (...kinds: (keyof typeof workQueueKinds)[]) => queue ? queue.filter(item => kinds.includes(item.kind)).reduce((sum, item) => sum + item.count, 0) : null;
  const counts = [
    { label: "เงินเข้ารอยืนยัน", value: total("payment_pending") },
    { label: "รอตรวจรับงาน", value: total("acceptance") },
    { label: "คำขอคืนเงิน", value: total("refund_pending", "refund_approved") },
    { label: "Lead ที่ยังไม่ได้ติดต่อ", value: uncontacted },
  ];
  return <AppShell staff={staff} wide><div className="grid gap-6">
    <div className={pageHeaderClass}><div><h1>สวัสดี {staff.full_name}</h1><p>{thaiDate(new Date())}</p></div></div>
    <dl className={cn(statCardsClass, "grid-cols-4 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1")}>
      {counts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className="tabular-nums">{value === null ? "—" : value.toLocaleString("th-TH")}</dd></div>)}
    </dl>
    <section className={panelClass} id="queue" aria-labelledby="queue-title"><h2 id="queue-title">งานรอทำ</h2>
      {!queue ? <p className={noticeClass} role="status">โหลดงานรอทำไม่ได้ ลองรีเฟรชหน้านี้ รายการทั้งหมดที่เมนูโครงการยังใช้ได้</p>
        : !queue.length ? <p className="text-sm text-muted-foreground">ไม่มีงานที่รอคุณดำเนินการ</p>
        : <ul className="grid gap-3">{queue.map(item => <li key={`${item.case_id}:${item.kind}`} className={caseRowClass}>
          <div><Link href={`/sales/${item.case_id}?tab=money#${item.kind === "acceptance" ? "schedule" : item.kind === "payment_pending" ? "pending" : "refunds"}`} prefetch={false}>{item.code}{item.customer_name ? ` · ${item.customer_name}` : ""}</Link>
            <p className="text-sm text-muted-foreground">{item.count} รายการ · รอตั้งแต่ {new Date(item.since).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status tone="waiting">{workQueueKinds[item.kind]}</Status><BrandTag brand={item.brand} /></div></li>)}</ul>}
    </section>
    <section className="grid gap-3" aria-labelledby="mine-title">
      <div className="flex items-center justify-between gap-3"><h2 id="mine-title" className="m-0">โครงการที่ฉันดูแล</h2>
        <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales?ownership=mine" prefetch={false}>ดูทั้งหมด</Link></div>
      {mine.length ? <ul className="grid gap-3">{mine.map(sale => <li key={sale.id} className={caseRowClass}>
        <div><Link href={`/sales/${sale.id}`} prefetch={false}>{sale.code} · {sale.customer_name}</Link>
          {sale.detail && sale.detail !== sale.code && <p className="text-sm text-muted-foreground">{sale.detail}</p>}</div>
        <div className="flex flex-wrap items-center gap-2"><Status tone={caseStatusTones[sale.status]}>{caseStatusLabels[sale.status]}</Status><BrandTag brand={sale.brand} /></div>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">ไม่พบโครงการที่คุณดูแลในรายการนี้</p>}
    </section>
  </div></AppShell>;
}
