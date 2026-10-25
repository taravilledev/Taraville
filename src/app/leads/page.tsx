import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/staff";
import { listLeadSchema } from "@/lib/walkin/models";
import { filteredLeads, saleOwners } from "@/lib/walkin/queries";
import { PAGE_SIZE, filtersSchema, listHref } from "@/lib/walkin/lead-list";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RetentionReview } from "@/app/walkin/retention-review";
import { ListControls } from "./list-controls";
import { ListChips } from "./list-chips";
import { LeadTable } from "./lead-table";
import { ListPager } from "./list-pager";
import styles from "./leads.module.css";

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
  const { data, error, count } = await filteredLeads(session, filters).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
  // PGRST103: the requested page is past the last row (e.g. a stale URL after filtering); go back to page 1.
  if (error?.code === "PGRST103") redirect(listHref(filters, { page: 1 }));
  if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
  const leads = listLeadSchema.array().parse(data ?? []);
  const total = count ?? leads.length;
  const ownerName = new Map(owners.map(owner => [owner.id, owner.full_name]));
  const activeCount = [filters.brand, filters.owner, filters.from, filters.to, filters.stage].filter(Boolean).length;
  return <AppShell staff={session.staff} wide>
    <div className={styles.titleRow}><h1 className={styles.pageTitle}>รายการผู้สนใจ</h1><p className={styles.total}>ทั้งหมด {total.toLocaleString("th-TH")} รายการ
      {isExecutive && (filters.brand
        ? <> · <a href={listHref(filters, { page: undefined }).replace("/leads", "/leads/export")} download>ส่งออก CSV</a></>
        : <> · เลือกแบรนด์เพื่อส่งออก CSV</>)}</p></div>
    <RetentionReview session={session} />
    <ListControls filters={filters} owners={isExecutive ? owners : undefined} activeCount={activeCount} />
    <ListChips filters={filters} ownerName={ownerName} />
    {leads.length ? <LeadTable leads={leads} filters={filters} ownerName={isExecutive ? ownerName : undefined} />
      : <p className={styles.empty}>ไม่พบรายการที่ตรงกับการค้นหา</p>}
    <ListPager filters={filters} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
  </AppShell>;
}
