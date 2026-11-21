import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { salesCaseList, salesWorkQueue } from "@/lib/sales/queries";
import { brandLabels } from "@/lib/sales/models";
import { requireStaff } from "@/lib/supabase/staff";
import { openLeadCount } from "@/lib/walkin/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { executiveWork } from "@/lib/sales/executive";
import { dashboardFollowUps, dashboardOverview } from "@/lib/sales/dashboard-data";
import { DashboardOverview } from "./overview";
import { SaleHome } from "./sale-home";
import { queueFilterOf } from "./queue-filters";
import { groupDashboardProjects } from "./project-ownership";
import { tabLinksClass } from "@/components/tab-links";
import { pageHeaderClass } from "@/components/page-header";
import { noticeClass } from "@/components/notice";

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
    return <AppShell staff={staff} wide><div className="grid gap-5">
      <div className={pageHeaderClass}><div><h1>ภาพรวม</h1><p>ติดตามงานและโครงการของบ้านคุณภาพและธาราวิลล์</p></div></div>
      {overview && work ? <>
        <nav className={tabLinksClass} aria-label="เลือกแบรนด์สำหรับแดชบอร์ด">
          {brands.map(({ value, label }) => <Link key={value} href={value ? `/dashboard?brand=${value}` : "/dashboard"}
            aria-current={value === brand ? "page" : undefined} prefetch={false}>{label}</Link>)}
        </nav>
        <DashboardOverview data={overview} groups={dashboardFollowUps(work, overview, brand)} brand={brand} />
      </> : <p className={`${noticeClass} flex flex-wrap items-center justify-between gap-3`} role="alert">
        <span>โหลดภาพรวมไม่ได้ ลองรีเฟรชหน้านี้ · รายการโครงการยังเปิดได้ที่เมนูโครงการ</span>
        <Link className="font-semibold underline underline-offset-4" href="/sales" prefetch={false}>ไปที่โครงการ ›</Link></p>}
    </div></AppShell>;
  }
  const [cases, queue, openLeads] = await Promise.all([
    salesCaseList({ status: "active", brand: "", query: "" }), salesWorkQueue(), openLeadCount(supabase, staff.id),
  ]);
  const mine = groupDashboardProjects(cases, staff.id).mine.slice(0, 5);
  return <AppShell staff={staff} wide><div className="grid gap-5">
    <div className={pageHeaderClass}><div><h1>สวัสดี {staff.full_name}</h1><p>{thaiDate(new Date())}</p></div></div>
    <SaleHome queue={queue} openLeads={openLeads} mine={mine} filter={queueFilterOf(one(raw.kind))} />
  </div></AppShell>;
}
