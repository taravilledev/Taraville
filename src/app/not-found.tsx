import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { shellClass, shellMainClass } from "@/components/app-shell-styles";
import Link from "next/link";
import { Suspense } from "react";
import { formCardClass } from "@/components/form-card";
import { serverClient } from "@/lib/supabase/server";

export const metadata = { title: "ไม่พบหน้านี้ · Taraville Group", robots: { index: false, follow: false } };
export default function NotFound() {
  return <div data-slot="app-shell" className={shellClass} lang="th"><main className={shellMainClass}><section className={formCardClass}>
    <h1>ไม่พบหน้านี้</h1>
    <p>รายการอาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Suspense fallback={null}><NotFoundActions /></Suspense>
    </div>
  </section></main></div>;
}
async function NotFoundActions() {
  const isSignedIn = await serverClient().then(supabase => supabase.auth.getUser()).then(({ data, error }) => !error && !!data.user, () => false);
  return isSignedIn
    ? <>
      <Link className={primaryActionClass} href="/dashboard">กลับหน้าหลัก</Link>
      <Link className={secondaryActionClass} href="/leads">ไปที่รายการ Lead</Link>
    </>
    : <Link className={primaryActionClass} href="/login">เข้าสู่ระบบ</Link>;
}
