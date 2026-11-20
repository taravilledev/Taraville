import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { shellClass, shellMainClass } from "@/components/app-shell-styles";
import Link from "next/link";
import { formCardClass } from "@/components/form-card";

export const metadata = { title: "ไม่พบหน้านี้ · Taraville Group", robots: { index: false, follow: false } };
export default function NotFound() {
  return <div data-slot="app-shell" className={shellClass} lang="th"><main className={shellMainClass}><section className={formCardClass}>
    <h1>ไม่พบหน้านี้</h1>
    <p>รายการอาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link className={primaryActionClass} href="/leads">ไปที่รายการผู้สนใจ</Link>
      <Link className={secondaryActionClass} href="/dashboard">กลับหน้าหลัก</Link>
    </div>
  </section></main></div>;
}
