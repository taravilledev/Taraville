"use client";

import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { shellClass, shellMainClass } from "@/components/app-shell-styles";
import { formCardClass } from "@/components/form-card";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div data-slot="app-shell" className={shellClass} lang="th"><main className={shellMainClass}><section className={formCardClass}>
    <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
    <p>กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้ดูแล</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <button className={primaryActionClass} onClick={reset}>ลองใหม่</button>
      <a className={secondaryActionClass} href="/login">กลับหน้าเข้าสู่ระบบ</a>
    </div>
  </section></main></div>;
}
