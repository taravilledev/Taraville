import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { LEAD_COLUMNS, leadSchema } from "@/lib/walkin/models";
import { saleOwners } from "@/lib/walkin/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RetentionReview } from "@/app/walkin/retention-review";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "รายการผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
const filtersSchema = z.object({
  q: z.string().trim().max(50).optional(),
  brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]).optional(), owner: z.uuid().optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to);
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function LeadsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><List {...props} /></Suspense>;
}
async function List({ searchParams }: Props) {
  const session = await requireStaff();
  const raw = await searchParams;
  const parsed = filtersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "")));
  if (!parsed.success) return <AppShell staff={session.staff}><p role="alert">ตัวกรองไม่ถูกต้อง <Link href="/leads" prefetch={false}>ล้างตัวกรอง</Link></p></AppShell>;
  const filters = parsed.data;
  const owners = await saleOwners(session);
  let request = session.supabase.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false });
  // PostgREST or() syntax reserves these characters; names and phones never need them.
  for (const term of (filters.q ?? "").replace(/[%,()*\\"]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3)) {
    request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  if (filters.brand) request = request.eq("brand", filters.brand);
  if (filters.owner) request = request.eq("owner_id", session.staff.role === "executive" ? filters.owner : session.staff.id);
  if (filters.from) request = request.gte("created_at", `${filters.from}T00:00:00+07:00`);
  if (filters.to) request = request.lte("created_at", `${filters.to}T23:59:59.999999+07:00`);
  const { data, error } = await request.range((filters.page - 1) * 25, filters.page * 25);
  if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
  const leads = leadSchema.array().parse(data);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (key !== "page" && value) params.set(key, String(value));
    params.set("page", String(page)); return `/leads?${params}`;
  };
  const ownerName = new Map(owners.map(owner => [owner.id, owner.full_name]));
  const hasFilters = Boolean(filters.brand || filters.owner || filters.from || filters.to);
  return <AppShell staff={session.staff}><h1 className={styles.pageTitle}>รายการผู้สนใจ</h1>
    <RetentionReview session={session} />
    <form className={styles.card} action="/leads" method="get">
      <div className={styles.searchRow}>
        <label className={styles.field}>ค้นหาชื่อหรือเบอร์โทร<input type="search" name="q" defaultValue={filters.q} maxLength={50} autoComplete="off" /></label>
        <button className={styles.primaryButton}>ค้นหา</button>
      </div>
      <details open={hasFilters}><summary>ตัวกรองเพิ่มเติม</summary><div className={styles.contactGrid}>
        <label className={styles.field}>แบรนด์<select name="brand" defaultValue={filters.brand ?? ""}><option value="">ทุกแบรนด์</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option><option value="TARAVILLE">Taraville</option></select></label>
        {session.staff.role === "executive" && <label className={styles.field}>ฝ่ายขายผู้ดูแล<select name="owner" defaultValue={filters.owner ?? ""}>
          <option value="">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
        </select></label>}
        <label className={styles.field}>ตั้งแต่วันที่<input type="date" name="from" defaultValue={filters.from} /></label>
        <label className={styles.field}>ถึงวันที่<input type="date" name="to" defaultValue={filters.to} /></label>
      </div></details>
      {(hasFilters || filters.q) && <Link href="/leads" prefetch={false}>ล้างการค้นหา</Link>}
    </form>
    <div className={styles.questions}>{leads.slice(0, 25).map(lead => <a key={lead.id} className={styles.leadCard} href={`/leads/${lead.id}`}>
      <strong>{lead.name_title} {lead.first_name} {lead.last_name}</strong>
      <span>{lead.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ"} · {lead.phone}</span>
      <small>{lead.privacy_mode === "synthetic" ? "ข้อมูลสมมติ · " : ""}{session.staff.role === "executive" ? `ผู้ดูแล ${ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"} · ` : ""}บันทึก {new Date(lead.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} · ติดต่อล่าสุด {lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "ยังไม่มี"}</small></a>)}</div>
    {!leads.length && <p className={styles.hint}>ไม่พบรายการที่ตรงกับการค้นหา</p>}
    <nav className={styles.pager} aria-label="เปลี่ยนหน้ารายการ">
      {filters.page > 1 && <a href={pageHref(filters.page - 1)}>← หน้าก่อนหน้า</a>}
      <span>หน้า {filters.page}</span>
      {leads.length > 25 && <a href={pageHref(filters.page + 1)}>หน้าถัดไป →</a>}
    </nav>
  </AppShell>;
}
