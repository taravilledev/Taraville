import Link from "next/link";
import { projectOwnershipLabels, groupDashboardProjects, type ProjectOwnership } from "@/app/dashboard/project-ownership";
import { brandLabels, caseStatusLabels, type CaseListRow } from "@/lib/sales/models";
import { panelClass } from "@/components/panel";
import { tabLinksClass } from "@/components/tab-links";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { caseWork } from "@/lib/sales/case-work";
import { filterByStage, ProjectTable, StageTabs, type ProjectRow } from "./project-table";

export const caseRowClass = "grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border bg-card p-4 max-[640px]:grid-cols-1 [&_a]:font-bold [&_a]:text-foreground [&_a]:underline-offset-4";
export const projectStatusOptions = { active: "กำลังดำเนินการ", all: "ทั้งหมด", ...caseStatusLabels };
type ProjectFilters = { q?: string; brand?: string; status?: string };

// The search form of /sales, shared by the Sale list and the Executive table (the Executive filters brand by tab, so it stays hidden).
export function ProjectFilterForm({ filters, attention, ownership, basePath, executive = false }: {
  filters: ProjectFilters; attention?: string; ownership: ProjectOwnership; basePath: string; executive?: boolean;
}) {
  const { q = "", brand = "", status = "active" } = filters;
  const filtered = status !== "active" || brand !== "" || q !== "" || !!attention;
  const brands = [{ value: "", label: "ทั้งสองแบรนด์" }, ...Object.entries(brandLabels).map(([value, label]) => ({ value, label }))];
  return <form className={cn("grid grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto_auto] items-end gap-3 max-[640px]:grid-cols-1", executive && "min-[641px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]")} method="get" role="search">
    <Field><FieldLabel htmlFor="project-q">ค้นหาชื่อลูกค้าหรือรหัส</FieldLabel><Input id="project-q" type="search" name="q" defaultValue={q} maxLength={100} /></Field>
    {executive ? <input type="hidden" name="brand" value={brand} />
      : <Field><FieldLabel htmlFor="project-brand">แบรนด์</FieldLabel><NativeSelect id="project-brand" name="brand" defaultValue={brand}>
        {brands.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>}
    <Field><FieldLabel htmlFor="project-status">สถานะ</FieldLabel><NativeSelect id="project-status" name="status" defaultValue={status}>
      {Object.entries(projectStatusOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect></Field>
    {ownership !== "all" && <input type="hidden" name="ownership" value={ownership} />}
    <button className={buttonVariants({ size: "auto" })} type="submit">ค้นหา</button>
    {filtered && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={ownership === "all" ? basePath : `${basePath}?ownership=${ownership}`} prefetch={false}>ล้างตัวกรอง</Link>}
  </form>;
}

export function SaleProjectList({ cases, staffId, filters, ownership, stage, basePath }: {
  cases: (CaseListRow & { work: ReturnType<typeof caseWork> | null })[]; staffId: string; filters: ProjectFilters; ownership: ProjectOwnership; stage: string; basePath: string;
}) {
  const { q = "", brand = "", status = "active" } = filters;
  const filtered = status !== "active" || brand !== "" || q !== "";
  const visibleCases = groupDashboardProjects(cases, staffId)[ownership];
  const allRows: ProjectRow[] = visibleCases.map(({ work, ...sale }) => ({ id: sale.id, href: `/sales/${sale.id}`, code: sale.code,
    customer: sale.customer_name, brand: sale.brand, owner: sale.owner, updated_at: sale.updated_at, status: sale.status,
    track: work?.track ?? null, action: work?.action ?? null }));
  const { stage: activeStage, rows } = filterByStage(allRows, brand, stage);
  function listHref(nextOwnership: ProjectOwnership, nextStage = "") {
    const params = new URLSearchParams();
    if (nextOwnership !== "all") params.set("ownership", nextOwnership);
    if (brand) params.set("brand", brand);
    if (status !== "active") params.set("status", status);
    if (q) params.set("q", q);
    if (nextStage) params.set("stage", nextStage);
    return `${basePath}${params.size ? `?${params}` : ""}#project-list`;
  }
  return <section className="grid gap-6" id="project-list" aria-label="รายการโครงการ">
    <nav className={tabLinksClass} aria-label="ผู้รับผิดชอบโครงการ">
      {(Object.keys(projectOwnershipLabels) as ProjectOwnership[]).map(item =>
        <Link href={listHref(item, activeStage)} key={item} prefetch={false} aria-current={item === ownership ? "page" : undefined}>
          {projectOwnershipLabels[item]}
        </Link>)}
    </nav>
    <ProjectFilterForm filters={filters} ownership={ownership} basePath={basePath} />
    {visibleCases.length > 0 && <StageTabs rows={allRows} brand={brand} stage={activeStage} hrefFor={next => listHref(ownership, next)} />}
    <p className="text-sm text-muted-foreground">พบ {rows.length} โครงการ{cases.length === 100 && " จากผลล่าสุด 100 รายการ"}</p>
    {rows.length ? <ProjectTable rows={rows} /> : visibleCases.length ? <p className="text-sm text-muted-foreground">ไม่พบโครงการในขั้นที่เลือก</p> : ownership !== "all"
      ? <p className="text-sm text-muted-foreground">{ownership === "mine" ? "ไม่พบโครงการที่คุณดูแลในรายการนี้" : "ไม่พบโครงการของคนอื่นที่คุณมีสิทธิ์ดูในรายการนี้"}</p>
      : filtered ? <section className={panelClass}><h3>ไม่พบรายการตามตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด</p></section>
      : <section className={panelClass}><h3>ยังไม่มีรายการที่คุณดูได้</h3><p>เริ่มเปิดงานจาก Lead หรือให้ผู้บริหารตรวจสอบสิทธิ์ของคุณ</p><Link href="/leads" prefetch={false}>ไปที่รายการ Lead</Link></section>}
  </section>;
}
