import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import styles from "./walkin.module.css";

// ADR 0010: only these two cases may justify a hold; other close reasons get no label.
const holdHint = (row: { has_active_project: boolean; closed_reason: string | null }) =>
  row.has_active_project ? "มีโครงการ active" : row.closed_reason === "bought_with_us" ? "ซื้อกับเราแล้ว" : null;

export async function RetentionReview({ session }: { session: Awaited<ReturnType<typeof requireStaff>> }) {
  if (session.staff.role !== "executive") return null;
  const { data, error } = await session.supabase.from("walkin_retention_due")
    .select("id,brand,review_due_at,has_active_project,closed_reason").order("review_due_at").order("id").limit(26);
  if (error) throw new Error("โหลดรายการทบทวนไม่ได้ กรุณาลองใหม่");
  const rows = z.array(z.object({ id: z.uuid(), brand: z.enum(["TARAVILLE", "BAAN_KUNAPAP"]), review_due_at: z.string(), has_active_project: z.boolean(), closed_reason: z.string().nullable() })).parse(data);
  if (!rows.length) return null;
  return <section className={styles.card}><details>
    <summary>มี {rows.length > 25 ? "25+" : rows.length} รายการครบกำหนดทบทวน 12 เดือน · ดู</summary>
    <p className={styles.hint}>สำหรับผู้บริหาร · ตรวจเหตุจำเป็นและขออนุมัติวิธีจัดการก่อนลบ ไม่มีการลบอัตโนมัติ</p>
    <ul>{rows.slice(0, 25).map(row => <li key={row.id}><a href={`/leads/${row.id}`}>
      {row.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ"} · ครบกำหนด {new Date(row.review_due_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
      {holdHint(row) && ` · ${holdHint(row)}`}
    </a></li>)}</ul>
    {rows.length > 25 && <p className={styles.hint}>แสดง 25 รายการที่เก่าสุด เมื่อจัดการแล้วให้เปิดรายการใหม่เพื่อตรวจส่วนที่เหลือ</p>}
  </details></section>;
}
