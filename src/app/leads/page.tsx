import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/staff";
import { listLeadSchema } from "@/lib/walkin/models";
import { leadTags } from "@/lib/sales/lead-work";
import { brandCounts, filteredLeads, saleOwners } from "@/lib/walkin/queries";
import { PAGE_SIZE, filtersSchema, listHref } from "@/lib/walkin/lead-list";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RetentionReview } from "@/app/walkin/retention-review";
import { ListControls } from "./list-controls";
import { BrandTiles } from "./brand-tiles";
import { ListChips } from "./list-chips";
import { LeadCards } from "./lead-cards";
import { ListPager } from "./list-pager";
import { ReportIcon } from "./header-icons";
import { LeadExportDialog } from "./export-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const actionClass = cn(buttonVariants({ variant: "outline" }), "no-underline");
const emptyClass = "m-0 rounded-lg border bg-card px-4 py-8 text-center text-muted-foreground";
export const metadata = { title: "รายการผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function LeadsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><List {...props} /></Suspense>;
}
async function List({ searchParams }: Props) {
  const session = await requireStaff();
  const raw = await searchParams;
  const parsed = filtersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "")));
  if (!parsed.success) return <AppShell staff={session.staff} wide><p role="alert">ตัวกรองไม่ถูกต้อง <Link href="/leads" prefetch={false}>ล้างตัวกรอง</Link></p></AppShell>;
  const filters = parsed.data;
  const isExecutive = session.staff.role === "executive";
  const owners = await saleOwners(session);
  const [{ data, error, count }, counts] = await Promise.all([
    filteredLeads(session, filters).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
    brandCounts(session, filters),
  ]);
  // PGRST103: the requested page is past the last row (e.g. a stale URL after filtering); go back to page 1.
  if (error?.code === "PGRST103") redirect(listHref(filters, { page: 1 }));
  if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
  const leads = listLeadSchema.array().parse(data ?? []);
  const total = count ?? leads.length;
  const workTags = await leadTags(session.supabase, leads.map(lead => lead.id));
  const ownerName = new Map(owners.map(owner => [owner.id, owner.full_name]));
  const activeCount = [filters.owner, filters.from, filters.to, filters.stage, filters.sort !== "created" || filters.dir !== "desc"].filter(Boolean).length;
  return <AppShell staff={session.staff} wide>
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="m-0 text-title/[1.5] font-bold">รายการผู้สนใจ</h1>
        <div className="flex flex-wrap items-start gap-2">
          <Link href="/leads/report" prefetch={false} className={actionClass}><ReportIcon />รายงานรายเดือน</Link>
          {isExecutive && <LeadExportDialog options={[
            { label: "ธาราวิล", href: listHref(filters, { brand: "TARAVILLE", page: undefined }).replace("/leads", "/leads/export") },
            { label: "บ้านคุณภาพ", href: listHref(filters, { brand: "BAAN_KUNAPAP", page: undefined }).replace("/leads", "/leads/export") },
          ]} />}
          <Link href="/walkin" prefetch={false} className={cn(buttonVariants({ size: "default" }), "no-underline")}>รับลูกค้า</Link>
        </div>
      </header>
      <RetentionReview session={session} />
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3 max-[400px]:gap-2" aria-label="ค้นหาและกรองรายการผู้สนใจ">
        <BrandTiles filters={filters} counts={counts} />
        <ListControls filters={filters} owners={owners} activeCount={activeCount} />
        <ListChips filters={filters} ownerName={ownerName} />
      </section>
      <section aria-label="ผลการค้นหาผู้สนใจ">
        <p className="m-0 mb-3 text-sm text-muted-foreground" role="status">พบ {total.toLocaleString("th-TH")} รายการ</p>
        {leads.length ? <LeadCards leads={leads} workTags={workTags} ownerName={ownerName} />
          : activeCount || filters.q || filters.brand ? <div className={emptyClass}>
            <p className="m-0 mb-3">ไม่พบรายการที่ตรงกับตัวกรอง</p>
            {filters.q
              ? <a className={actionClass} href={listHref(filters, { q: undefined, page: undefined })}>ล้างคำค้น</a>
              : <a className={actionClass} href={listHref(filters, { stage: undefined, owner: undefined, from: undefined, to: undefined, brand: undefined, page: undefined })}>ล้างตัวกรอง</a>}
          </div>
          : <p className={emptyClass}>ยังไม่มีผู้สนใจที่กำลังติดตาม · <Link href="/walkin" prefetch={false}>เริ่มรับลูกค้า Walk-in</Link></p>}
        <ListPager filters={filters} total={total} />
      </section>
    </div>
  </AppShell>;
}
