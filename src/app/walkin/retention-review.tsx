import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import styles from "./walkin.module.css";

export async function RetentionReview({ session }: { session: Awaited<ReturnType<typeof requireStaff>> }) {
  if (session.staff.role !== "executive") return null;
  const { data, error } = await session.supabase.from("walkin_retention_due")
    .select("id,brand,review_due_at").order("review_due_at").order("id").limit(26);
  if (error) throw new Error("โหลดรายการทบทวนไม่ได้ กรุณาลองใหม่");
  const rows = z.array(z.object({ id: z.uuid(), brand: z.enum(["TARAVILLE", "BAAN_KUNAPAP"]), review_due_at: z.string() })).parse(data);
  return <section className={styles.card}><h2>รายการครบกำหนดทบทวน 12 เดือน</h2>
    <p>สำหรับผู้บริหาร · ตรวจเหตุจำเป็นและขออนุมัติวิธีจัดการก่อนลบ ไม่มีการลบอัตโนมัติ รายการที่ยังไม่มีวันที่ติดต่อจะไม่ปรากฏ</p>
    {rows.length ? <ul>{rows.slice(0, 25).map(row => <li key={row.id}><a href={`/leads/${row.id}`}>
      {row.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ"} · ครบกำหนด {new Date(row.review_due_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
    </a></li>)}</ul> : <p>ยังไม่มีรายการครบกำหนด</p>}
    {rows.length > 25 && <p>แสดง 25 รายการแรกตามกำหนดที่เก่าสุด เมื่อจัดการแล้วให้เปิดรายการใหม่เพื่อตรวจส่วนที่เหลือ</p>}
  </section>;
}
