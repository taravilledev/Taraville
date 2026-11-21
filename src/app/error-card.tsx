"use client";

import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { shellClass, shellMainClass } from "@/components/app-shell-styles";
import { formCardClass } from "@/components/form-card";

// Never prints error.message: only the opaque digest is safe to show.
export function ErrorCard({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return <div data-slot="app-shell" className={shellClass} lang="th"><main className={shellMainClass}><section className={formCardClass}>
    <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
    <p>{digest ? "กรุณาลองใหม่ หากยังไม่ได้ ให้ติดต่อผู้ดูแลพร้อมแจ้งรหัสอ้างอิงด้านล่าง" : "กรุณาลองใหม่ หากยังไม่ได้ ให้ติดต่อผู้ดูแล"}</p>
    {digest && <p className="text-sm text-muted-foreground">รหัสอ้างอิง <strong>{digest}</strong> · แจ้งรหัสนี้กับผู้ดูแลได้เลย</p>}
    <div className="mt-6 flex flex-wrap gap-3">
      <button className={primaryActionClass} onClick={retry}>ลองใหม่</button>
      <a className={secondaryActionClass} href="/dashboard">กลับหน้าหลัก</a>
    </div>
  </section></main></div>;
}
