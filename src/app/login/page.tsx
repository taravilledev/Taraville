import { Suspense } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { AppShell } from "@/app/walkin/app-shell";
import { login } from "./actions";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "เข้าสู่ระบบ · Taraville Group", robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  return <Suspense fallback={<p>กำลังเตรียมหน้าเข้าสู่ระบบ…</p>}><LoginContent searchParams={searchParams} /></Suspense>;
}
async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  const query = await searchParams;
  return <AppShell><section className={styles.card}>
    <p className={styles.eyebrow}>STAFF LOGIN</p><h1>ยินดีต้อนรับกลับมา</h1>
    <p>เข้าสู่ระบบด้วยบัญชีพนักงานที่ได้รับสิทธิ์</p>
    {query.error === "staff" && <p className={styles.error} role="alert">บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแล</p>}
    {query.password === "changed" && <p role="status">เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่</p>}
    <ActionForm action={login} label="เข้าสู่ระบบ">
      <div className={styles.questions}>
        <label className={styles.field}>ชื่อผู้ใช้<input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} placeholder="เช่น sale1" /></label>
        <label className={styles.field}>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
      </div>
    </ActionForm>
    <p><a href="/login/help">ลืมรหัสผ่าน / ขอความช่วยเหลือ</a></p>
    <p>ตั้งรหัสครั้งแรก: เข้าสู่ระบบด้วยรหัสชั่วคราวที่ผู้ดูแลส่งให้ แล้วเลือก “ตั้ง / เปลี่ยนรหัสผ่าน”</p>
  </section></AppShell>;
}
