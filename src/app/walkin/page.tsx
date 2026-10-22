import type { Metadata } from "next";
import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { Building2, House } from "lucide-react";
import { requireStaff } from "@/lib/supabase/staff";
import { staffSchema } from "@/lib/walkin/models";
import type { Brand } from "@/lib/walkin/survey-questions";
import { AppShell } from "./app-shell";
import { LeadForm } from "./lead-form";
import styles from "./walkin.module.css";

export const metadata: Metadata = {
  title: "Walk-in · Taraville Group", robots: { index: false, follow: false },
};
type WalkinProps = { searchParams: Promise<{ brand?: string | string[]; palette?: string | string[]; font?: string | string[] }> };
export default function WalkinPage(props: WalkinProps) {
  return <Suspense fallback={<main lang="th">กำลังเตรียมแบบฟอร์ม…</main>}><WalkinContent {...props} /></Suspense>;
}
async function WalkinContent({ searchParams }: WalkinProps) {
  const { supabase, staff } = await requireStaff();
  const query = await searchParams;
  const brand: Brand = query.brand === "TARAVILLE" ? "TARAVILLE" : "BAAN_KUNAPAP";
  const paletteId = typeof query.palette === "string" ? query.palette : undefined;
  const fontId = typeof query.font === "string" ? query.font : undefined;
  const brandHref = (value: Brand) => {
    const params = new URLSearchParams({ brand: value });
    if (paletteId) params.set("palette", paletteId);
    if (fontId) params.set("font", fontId);
    return `/walkin?${params}`;
  };
  const owners = staff.role === "executive" ? await supabase.from("staff")
    .select("id,full_name,role,is_active").eq("role", "sale").eq("is_active", true).order("full_name") : null;
  if (owners?.error) throw new Error("โหลดรายชื่อผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const roster = staffSchema.array().parse(owners?.data ?? []);
  return <AppShell staff={staff} paletteId={paletteId} fontId={fontId}>
    <div className={styles.intro}><p className={styles.eyebrow}>WALK-IN REGISTRATION</p>
      <h1>เริ่มต้นบ้านที่ใช่ ด้วยการรู้จักกัน</h1><p>รับข้อมูลใหม่ · เปลี่ยนแบรนด์แล้วช่องกรอกจะเริ่มใหม่</p></div>
    <nav className={styles.brandGrid} aria-label="เลือกแบรนด์">
      <a className={styles.brandCard} href={brandHref("BAAN_KUNAPAP")} aria-current={brand === "BAAN_KUNAPAP" ? "page" : undefined}>
        <House aria-hidden="true" /><span><strong>บ้านคุณภาพ</strong><small>สร้างบ้านบนที่ดินของลูกค้า</small></span>
        <span className={styles.selectionMark} aria-hidden="true" /></a>
      <a className={styles.brandCard} href={brandHref("TARAVILLE")} aria-current={brand === "TARAVILLE" ? "page" : undefined}>
        <Building2 aria-hidden="true" /><span><strong>Taraville</strong><small>บ้านพร้อมที่ดิน</small></span>
        <span className={styles.selectionMark} aria-hidden="true" /></a>
    </nav>
    <nav className={styles.sectionNav} aria-label="ส่วนของแบบฟอร์ม"><a href="#contact">ข้อมูลติดต่อ</a><a href="#survey">แบบสอบถาม</a><a href="#privacy">ก่อนบันทึก</a></nav>
    {staff.role === "executive" && !roster.length && <p className={styles.error}>ยังไม่มีบัญชีฝ่ายขายที่ใช้งานได้ กรุณาเตรียมบัญชีก่อนบันทึก</p>}
    <LeadForm key={brand} brand={brand} staff={staff} owners={roster} requestId={randomUUID()} />
  </AppShell>;
}
