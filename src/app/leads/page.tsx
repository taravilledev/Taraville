import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { LEAD_COLUMNS, leadSchema } from "@/lib/walkin/models";
import { saleOwners } from "@/lib/walkin/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { RetentionReview } from "@/app/walkin/retention-review";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "รายการผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
const filtersSchema = z.object({
  brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]).optional(), owner: z.uuid().optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to);
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function LeadsPage(props: Props) {
  return <Suspense fallback={<p>กำลังโหลดรายการ…</p>}><List {...props} /></Suspense>;
}
async function List({ searchParams }: Props) {
  const session = await requireStaff();
  const raw = await searchParams;
  const parsed = filtersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "")));
  if (!parsed.success) return <AppShell staff={session.staff}><p role="alert">ตัวกรองไม่ถูกต้อง <Link href="/leads" prefetch={false}>ล้างตัวกรอง</Link></p></AppShell>;
  const filters = parsed.data;
  const owners = await saleOwners(session);
  let request = session.supabase.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false });
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
  return <AppShell staff={session.staff}><h1>รายการผู้สนใจ</h1>
    <RetentionReview session={session} />
    <form className={styles.card} action="/leads" method="get"><div className={styles.contactGrid}>
      <label className={styles.field}>แบรนด์<select name="brand" defaultValue={filters.brand ?? ""}><option value="">ทุกแบรนด์</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option><option value="TARAVILLE">Taraville</option></select></label>
      {session.staff.role === "executive" && <label className={styles.field}>ฝ่ายขายผู้ดูแล<select name="owner" defaultValue={filters.owner ?? ""}>
        <option value="">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
      </select></label>}
      <label className={styles.field}>ตั้งแต่วันที่<input type="date" name="from" defaultValue={filters.from} /></label>
      <label className={styles.field}>ถึงวันที่<input type="date" name="to" defaultValue={filters.to} /></label>
    </div><button className={styles.primaryButton}>ค้นหา</button> <Link href="/leads" prefetch={false}>ล้างตัวกรอง</Link></form>
    <p>หน้า {filters.page} · แสดงครั้งละ 25 รายการ</p>
    <div className={styles.questions}>{leads.slice(0, 25).map(lead => <a key={lead.id} className={styles.leadCard} href={`/leads/${lead.id}`}>
      <strong>{lead.first_name} {lead.last_name}</strong><span>{lead.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ"} · {lead.phone}</span>
      <small>{new Date(lead.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</small></a>)}</div>
    {!leads.length && <p>ยังไม่มีรายการที่ตรงกับตัวกรอง</p>}
    <nav className={styles.sectionNav} aria-label="เปลี่ยนหน้ารายการ">
      {filters.page > 1 && <a href={pageHref(filters.page - 1)}>หน้าก่อนหน้า</a>}
      {leads.length > 25 && <a href={pageHref(filters.page + 1)}>หน้าถัดไป</a>}
    </nav>
  </AppShell>;
}
