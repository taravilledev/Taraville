import { Suspense } from "react";
import Link from "next/link";
import { salesBootstrap, salesCaseList, salesWorkQueue } from "@/lib/sales/queries";
import { brandLabels, caseStatusLabels, workQueueKinds } from "@/lib/sales/models";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { executiveWork } from "@/lib/sales/executive";
import { dashboardFollowUps, dashboardOverview } from "@/lib/sales/dashboard-data";
import { ExecutiveDashboard } from "../sales/executive-dashboard";
import { DashboardOverview } from "./overview";
import { groupDashboardProjects, projectOwnershipLabels, type ProjectOwnership } from "./project-ownership";
import styles from "../sales/sales.module.css";
import { tabLinksClass } from "@/components/tab-links";
import { pageHeaderClass } from "@/components/page-header";
import { noticeClass } from "@/components/notice";
import { panelClass } from "@/components/panel";
import { tagClass } from "@/components/tag";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export const metadata = { title: "แดชบอร์ด · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const statusOptions = { active: "กำลังดำเนินการ", all: "ทั้งหมด", ...caseStatusLabels };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export default function DashboardPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Workspace {...props} /></Suspense>; }
async function Workspace({ searchParams }: Props) {
  const raw = await searchParams;
  const status = Object.hasOwn(statusOptions, one(raw.status)) ? one(raw.status) : "active";
  const brand = Object.hasOwn(brandLabels, one(raw.brand)) ? one(raw.brand) : "";
  const query = one(raw.q).trim().slice(0, 100);
  const { staff, workspace, supabase } = await salesBootstrap();
  const executive = staff.role === "executive";
  const attention = one(raw.attention);
  const rawOwnership = one(raw.ownership);
  const ownership: ProjectOwnership = !executive && Object.hasOwn(projectOwnershipLabels, rawOwnership)
    ? rawOwnership as ProjectOwnership : "all";
  const filtered = status !== "active" || brand !== "" || query !== "" || attention !== "";
  const brands = [{ value: "", label: "ทั้งสองแบรนด์" }, ...Object.entries(brandLabels).map(([value, label]) => ({ value, label }))];
  const filterForm = <form className={`${styles.filters} ${executive ? styles.dashboardFilters : ""}`} method="get" role="search">
      <Field><FieldLabel htmlFor="dashboard-q">ค้นหาชื่อลูกค้าหรือรหัส</FieldLabel><Input id="dashboard-q" type="search" name="q" defaultValue={query} maxLength={100} /></Field>
      {executive ? <input type="hidden" name="brand" value={brand} />
        : <Field><FieldLabel htmlFor="dashboard-brand">แบรนด์</FieldLabel><NativeSelect id="dashboard-brand" name="brand" defaultValue={brand}>
          {brands.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>}
      <Field><FieldLabel htmlFor="dashboard-status">สถานะ</FieldLabel><NativeSelect id="dashboard-status" name="status" defaultValue={status}>
        {Object.entries(statusOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect></Field>
      {ownership !== "all" && <input type="hidden" name="ownership" value={ownership} />}
      <button className={buttonVariants({ size: "auto" })} type="submit">ค้นหา</button>
      {filtered && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={ownership === "all" ? "/dashboard" : `/dashboard?ownership=${ownership}`} prefetch={false}>ล้างตัวกรอง</Link>}
    </form>;
  const settings = (workspace.can_catalog || workspace.can_admin || workspace.developments.length > 0) &&
    <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales/settings" prefetch={false}>ตั้งค่า</Link>;
  const [dashboard, overview, overviewWork] = await Promise.all([
    executive ? executiveWork(supabase, { status, brand, query }) : null,
    executive ? dashboardOverview(supabase, brand) : null,
    executive && (status !== "active" || query) ? executiveWork(supabase, { status: "active", brand, query: "" }) : null,
  ]);
  if (dashboard) {
    const rawPage = Number(one(raw.page));
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const baseWork = status === "active" && !query ? dashboard : overviewWork;
    return <AppShell staff={staff} wide><div className="grid gap-6">
      <div className={pageHeaderClass}><div><h1>แดชบอร์ด</h1><p>ติดตามงานและโครงการของบ้านคุณภาพและธาราวิลล์</p></div>
        <div className="flex flex-wrap items-center gap-3"><Link className={buttonVariants({ size: "auto" })} href="/summary" prefetch={false}>สรุปการเงินบ้านคุณภาพ</Link>{settings}</div>
      </div>
      <nav className={tabLinksClass} aria-label="เลือกแบรนด์สำหรับแดชบอร์ด">
        {brands.map(({ value, label }) => <Link key={value} href={value ? `/dashboard?brand=${value}` : "/dashboard"}
          aria-current={value === brand ? "page" : undefined} prefetch={false}>{label}</Link>)}
      </nav>
      {overview && baseWork ? <DashboardOverview data={overview} groups={dashboardFollowUps(baseWork, overview, brand)} brand={brand} />
        : <p className={noticeClass} role="status">โหลดภาพรวมผู้บริหารไม่ได้ ตารางโครงการด้านล่างยังใช้งานได้</p>}
      <ExecutiveDashboard rows={dashboard} filterForm={filterForm} compact={!!overview && !!baseWork} filters={{ status, brand, query, page, attention }} />
    </div></AppShell>;
  }
  const [cases, queue] = await Promise.all([salesCaseList({ status, brand, query }), salesWorkQueue()]);
  const projectGroups = groupDashboardProjects(cases, staff.id);
  const visibleCases = projectGroups[ownership];
  function ownershipHref(next: ProjectOwnership) {
    const params = new URLSearchParams();
    if (next !== "all") params.set("ownership", next);
    if (brand) params.set("brand", brand);
    if (status !== "active") params.set("status", status);
    if (query) params.set("q", query);
    return params.size ? `/dashboard?${params}#dashboard-projects` : "/dashboard#dashboard-projects";
  }
  return <AppShell staff={staff} wide><div className="grid gap-6">
    <div className={pageHeaderClass}><div><h1>แดชบอร์ด</h1><p>บ้านคุณภาพ · ธาราวิลล์</p></div>
      <div className="flex flex-wrap items-center gap-3">
        {executive && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/summary" prefetch={false}>สรุปการเงินบ้านคุณภาพ</Link>}{settings}
      </div>
    </div>
    {executive && <p className={noticeClass} role="status">โหลดแดชบอร์ดผู้บริหารไม่ได้ รายการงานด้านล่างยังใช้งานได้</p>}
    <section className={panelClass} id="queue" aria-labelledby="queue-title"><h2 id="queue-title">งานรอทำ</h2>
      {!queue ? <p className={noticeClass} role="status">โหลดงานรอทำไม่ได้ ลองรีเฟรชหน้านี้ รายการทั้งหมดด้านล่างยังใช้ได้</p>
        : !queue.length ? <p className="text-sm text-muted-foreground">ไม่มีงานที่รอคุณดำเนินการ</p>
        : <ul className="grid gap-3">{queue.map(item => <li key={`${item.case_id}:${item.kind}`} className={styles.case}>
          <div><Link href={`/sales/${item.case_id}?tab=money#${item.kind === "acceptance" ? "schedule" : item.kind === "payment_pending" ? "pending" : "refunds"}`} prefetch={false}>{item.code}{item.customer_name ? ` · ${item.customer_name}` : ""}</Link>
            <p className="text-sm text-muted-foreground">{workQueueKinds[item.kind]} {item.count} รายการ · รอตั้งแต่ {new Date(item.since).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>
          <span className={tagClass}>{brandLabels[item.brand]}</span></li>)}</ul>}
    </section>
    <section className="grid gap-6" id="dashboard-projects" aria-labelledby="dashboard-projects-title">
      <h2 id="dashboard-projects-title">โครงการ</h2>
      {!executive && <nav className={tabLinksClass} aria-label="ผู้รับผิดชอบโครงการ">
        {(Object.keys(projectOwnershipLabels) as ProjectOwnership[]).map(item =>
          <Link href={ownershipHref(item)} key={item} prefetch={false} aria-current={item === ownership ? "page" : undefined}>
            {projectOwnershipLabels[item]}
          </Link>)}
      </nav>}
      {filterForm}
      <p className="text-sm text-muted-foreground">พบ {visibleCases.length} โครงการ{cases.length === 100 && " จากผลล่าสุด 100 รายการ"}</p>
      {visibleCases.length ? <ul className="grid gap-3">{visibleCases.map(sale => <li key={sale.id} className={styles.case}>
        <div><Link href={`/sales/${sale.id}`} prefetch={false}>{sale.code} · {sale.customer_name}</Link>
          <p className="text-sm text-muted-foreground">{brandLabels[sale.brand]}
            {!executive && (sale.responsible_id === staff.id ? " · ฉันดูแล" : " · คนอื่นดูแล")}
            {sale.detail && sale.detail !== sale.code ? ` · ${sale.detail}` : ""} · {sale.can_finance ? "ดูข้อมูลการเงินได้" : "ดูข้อมูลงาน"}
          </p></div>
        <span className={tagClass}>{caseStatusLabels[sale.status]}</span>
      </li>)}</ul> : ownership !== "all"
        ? <p className="text-sm text-muted-foreground">{ownership === "mine" ? "ไม่พบโครงการที่คุณดูแลในรายการนี้" : "ไม่พบโครงการของคนอื่นที่คุณมีสิทธิ์ดูในรายการนี้"}</p>
        : filtered ? <section className={panelClass}><h3>ไม่พบรายการตามตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด</p></section>
        : <section className={panelClass}><h3>ยังไม่มีรายการที่คุณดูได้</h3><p>เริ่มเปิดงานจาก Lead หรือให้ผู้บริหารตรวจสอบสิทธิ์ของคุณ</p><Link href="/leads" prefetch={false}>ไปที่รายการ Lead</Link></section>}
    </section>
  </div></AppShell>;
}
