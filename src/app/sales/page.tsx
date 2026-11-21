import { Suspense } from "react";
import Link from "next/link";
import { salesBootstrap, salesCaseList } from "@/lib/sales/queries";
import { brandLabels } from "@/lib/sales/models";
import { executiveWork } from "@/lib/sales/executive";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { projectOwnershipLabels, type ProjectOwnership } from "@/app/dashboard/project-ownership";
import { noticeClass } from "@/components/notice";
import { pageHeaderClass } from "@/components/page-header";
import { tabLinksClass } from "@/components/tab-links";
import { buttonVariants } from "@/components/ui/button";
import { ExecutiveDashboard } from "./executive-dashboard";
import { ProjectFilterForm, projectStatusOptions, SaleProjectList } from "./project-list";

export const metadata = { title: "โครงการ · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const basePath = "/sales";

export default function ProjectsPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Workspace {...props} /></Suspense>; }
async function Workspace({ searchParams }: Props) {
  const raw = await searchParams;
  const status = Object.hasOwn(projectStatusOptions, one(raw.status)) ? one(raw.status) : "active";
  const brand = Object.hasOwn(brandLabels, one(raw.brand)) ? one(raw.brand) : "";
  const query = one(raw.q).trim().slice(0, 100);
  const { staff, workspace, supabase } = await salesBootstrap();
  const executive = staff.role === "executive";
  const attention = one(raw.attention);
  const stage = one(raw.stage);
  const rawOwnership = one(raw.ownership);
  const ownership: ProjectOwnership = !executive && Object.hasOwn(projectOwnershipLabels, rawOwnership)
    ? rawOwnership as ProjectOwnership : "all";
  const filters = { status, brand, q: query };
  const settings = (workspace.can_catalog || workspace.can_admin || workspace.developments.length > 0) &&
    <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales/settings" prefetch={false}>ตั้งค่า</Link>;
  const header = <div className={pageHeaderClass}><div><h1>โครงการ</h1><p>บ้านคุณภาพ · ธาราวิลล์</p></div>
    {settings && <div className="flex flex-wrap items-center gap-3">{settings}</div>}
  </div>;

  if (executive) {
    const rows = await executiveWork(supabase, { status, brand, query });
    const rawPage = Number(one(raw.page));
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const brands = [{ value: "", label: "ทั้งสองแบรนด์" }, ...Object.entries(brandLabels).map(([value, label]) => ({ value, label }))];
    return <AppShell staff={staff} wide><div className="grid gap-6">
      {header}
      <nav className={tabLinksClass} aria-label="เลือกแบรนด์สำหรับโครงการ">
        {brands.map(({ value, label }) => <Link key={value} href={value ? `${basePath}?brand=${value}` : basePath}
          aria-current={value === brand ? "page" : undefined} prefetch={false}>{label}</Link>)}
      </nav>
      {rows ? <ExecutiveDashboard compact rows={rows} basePath={basePath} filters={{ status, brand, query, page, attention, stage }}
        filterForm={<ProjectFilterForm filters={filters} attention={attention} ownership="all" basePath={basePath} executive />} />
        : <p className={noticeClass} role="status">โหลดรายการโครงการของผู้บริหารไม่ได้ ลองรีเฟรชหน้านี้</p>}
    </div></AppShell>;
  }

  const cases = await salesCaseList({ status, brand, query });
  return <AppShell staff={staff} wide><div className="grid gap-6">
    {header}
    <SaleProjectList cases={cases} staffId={staff.id} filters={filters} ownership={ownership} stage={stage} basePath={basePath} />
  </div></AppShell>;
}
