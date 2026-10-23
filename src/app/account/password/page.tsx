import { Suspense } from "react";
import { requireStaff } from "@/lib/supabase/staff";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ActionForm } from "@/app/walkin/action-form";
import { changePassword } from "./actions";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "ตั้ง / เปลี่ยนรหัสผ่าน · Taraville Group", robots: { index: false, follow: false } };
export default function PasswordPage() {
  return <Suspense fallback={<PageSkeleton />}><PasswordContent /></Suspense>;
}
async function PasswordContent() {
  const { staff } = await requireStaff();
  return <AppShell staff={staff}><section className={styles.card}>
    <h1>ตั้ง / เปลี่ยนรหัสผ่าน</h1>
    <p>รหัสใหม่ 6–128 ตัวอักษร เลือกคำหลายคำที่จำได้หรือใช้ตัวจัดการรหัสผ่าน หลีกเลี่ยงชื่อและรหัสที่ใช้กับระบบอื่น</p>
    <ActionForm action={changePassword} label="ยืนยันเปลี่ยนรหัสผ่าน">
      <div className={styles.questions}>
        <label className={styles.field}>รหัสผ่านปัจจุบัน<input name="current_password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
        <label className={styles.field}>รหัสผ่านใหม่<input name="new_password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} /></label>
        <label className={styles.field}>ยืนยันรหัสผ่านใหม่<input name="confirm_password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} /></label>
      </div>
      <p className={styles.hint}>เมื่อบันทึกสำเร็จ ให้เข้าสู่ระบบใหม่ด้วยรหัสใหม่</p>
    </ActionForm>
    <a href="/walkin">กลับไปรับลูกค้า</a>
  </section></AppShell>;
}
