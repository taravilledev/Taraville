import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/staff";
import { listLeadSchema } from "@/lib/walkin/models";
import { leadTags } from "@/lib/sales/lead-work";
import { brandCounts, filteredLeads, saleOwners, stageCounts } from "@/lib/walkin/queries";
import { PAGE_SIZE, activeSurveyFilters, filtersSchema, listHref, panelFilterCount, surveyFilterOptions } from "@/lib/walkin/lead-list";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RetentionReview } from "@/app/walkin/retention-review";
import { ListControls } from "./list-controls";
import { BrandTiles } from "./brand-tiles";
import { ListChips } from "./list-chips";
import { StageTabs } from "./stage-tabs";
import { LeadTable } from "./lead-table";
import { ListPager } from "./list-pager";
import { LeadExportDialog } from "./export-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const actionClass = cn(buttonVariants({ variant: "outline" }), "no-underline");
const emptyClass = "rounded-lg border bg-card px-4 py-10 text-center text-muted-foreground";
const withoutSurvey = { budget: undefined, channel: undefined, page: undefined };
export const metadata = { title: "ลูกค้า (Lead) · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function LeadsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><List {...props} /></Suspense>;
}
async function List({ searchParams }: Props) {
  const session = await requireStaff();
  const raw = await searchParams;
  const parsed = filtersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "")));
  if (!parsed.success) return <AppShell staff={session.staff} wide><p role="alert">ตัวกรองไม่ถูกต้อง <Link href="/leads" prefetch={false}>ล้างตัวกรอง</Link></p></AppShell>;
  const isExecutive = session.staff.role === "executive";
  // A Sale starts on their own Leads; "ทุกคน" in the owner list (?owner=all) shows everyone.
  const filters = { ...parsed.data, owner: parsed.data.owner ?? (isExecutive ? undefined : session.staff.id) };
  const owners = await saleOwners(session);
  const [{ data, error, count }, counts, stages] = await Promise.all([
    filteredLeads(session, filters).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
    brandCounts(session, filters),
    stageCounts(session, filters),
  ]);
  // PGRST103: the requested page is past the last row (e.g. a stale URL after filtering); go back to page 1.
  if (error?.code === "PGRST103") redirect(listHref(filters, { page: 1 }));
  if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
  const leads = listLeadSchema.array().parse(data ?? []);
  const total = count ?? leads.length;
  const workTags = await leadTags(session.supabase, leads.map(lead => lead.id));
  const ownerName = new Map(owners.map(owner => [owner.id, owner.full_name]));
  const survey = surveyFilterOptions(filters.brand);
  const selected = activeSurveyFilters(filters);
  const activeCount = panelFilterCount(filters);
  const subtitle = !filters.owner || filters.owner === "all" ? "Lead ของทุกคน" : filters.owner === session.staff.id ? "Lead ที่คุณดูแล" : `Lead ของ ${ownerName.get(filters.owner) ?? "ผู้ดูแล"}`;
  return <AppShell staff={session.staff} wide>
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="m-0 text-title/[1.5] font-bold">ลูกค้า (Lead)</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">{subtitle} · เรียงตามวันลงทะเบียน</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {isExecutive && <LeadExportDialog options={[
            { label: "ธาราวิลล์", href: listHref(filters, { brand: "TARAVILLE", ...withoutSurvey }).replace("/leads", "/leads/export") },
            { label: "บ้านคุณภาพ", href: listHref(filters, { brand: "BAAN_KUNAPAP", ...withoutSurvey }).replace("/leads", "/leads/export") },
          ]} />}
          <Link href="/walkin" prefetch={false} className={cn(buttonVariants({ size: "default" }), "no-underline")}>รับลูกค้า</Link>
        </div>
      </header>
      <RetentionReview session={session} />
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="ค้นหาและกรองรายการ Lead">
        <BrandTiles filters={filters} counts={counts} />
        <ListControls filters={filters} owners={owners} selfId={session.staff.id} activeCount={activeCount} survey={survey} selected={selected} />
        <ListChips filters={filters} survey={survey} selected={selected} />
      </section>
      <section aria-label="ผลการค้นหา Lead">
        <StageTabs filters={filters} counts={stages} />
        <p className="m-0 my-3 text-sm text-muted-foreground" role="status">พบ {total.toLocaleString("th-TH")} รายการ</p>
        {leads.length ? <LeadTable leads={leads} workTags={workTags} ownerName={ownerName} filters={filters} />
          : <div className={emptyClass}>
            {activeCount || filters.q || filters.brand
              ? <><p className="m-0 mb-3">ไม่มี Lead ที่ตรงกับตัวกรอง</p>
                {filters.q
                  ? <a className={actionClass} href={listHref(filters, { q: undefined, page: undefined })}>ล้างคำค้น</a>
                  : <a className={actionClass} href={listHref(filters, { brand: undefined, from: undefined, to: undefined, range: undefined, ...withoutSurvey })}>ล้างตัวกรอง</a>}</>
              : <p className="m-0">ยังไม่มี Lead ในขั้นนี้ · <Link href="/walkin" prefetch={false}>เริ่มรับลูกค้า Walk-in</Link></p>}
          </div>}
        <ListPager filters={filters} total={total} />
      </section>
    </div>
  </AppShell>;
}
