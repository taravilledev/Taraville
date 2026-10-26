import { Suspense } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { AuthShell, AuthSkeleton } from "./auth-shell";
import { login } from "./actions";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "เข้าสู่ระบบ · Taraville Group", robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  return <Suspense fallback={<AuthSkeleton />}><LoginContent searchParams={searchParams} /></Suspense>;
}
async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  const query = await searchParams;
  return <AuthShell>
    <h1>เข้าสู่ระบบ</h1>
    {query.error === "staff" && <p className={styles.error} role="alert">บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแล</p>}
    {query.password === "changed" && <p className={styles.banner} role="status">เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่</p>}
    <ActionForm action={login} label="เข้าสู่ระบบ">
      <div className={styles.questions}>
        <label className={styles.field}>ชื่อผู้ใช้<input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} placeholder="เช่น sale1" /></label>
        <label className={styles.field}>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
      </div>
    </ActionForm>
    <p className={styles.hint}><a href="/login/help">ลืมรหัสผ่าน</a></p>
  </AuthShell>;
}
