import { Suspense } from "react";
import { requireStaff } from "@/lib/supabase/staff";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ActionForm } from "@/app/walkin/action-form";
import { changePassword } from "./actions";
import { formCardClass } from "@/components/form-card";
import { PasswordFields } from "./password-fields";

export const metadata = { title: "ตั้ง / เปลี่ยนรหัสผ่าน · Taraville Group", robots: { index: false, follow: false } };
export default function PasswordPage() {
  return <Suspense fallback={<PageSkeleton />}><PasswordContent /></Suspense>;
}
async function PasswordContent() {
  const { staff } = await requireStaff();
  return <AppShell staff={staff}><section className={formCardClass}>
    <h1>ตั้ง / เปลี่ยนรหัสผ่าน</h1>
    <p>เลือกคำหลายคำที่จำได้ หรือใช้ตัวจัดการรหัสผ่าน · หลีกเลี่ยงชื่อและรหัสที่ใช้กับระบบอื่น</p>
    <ActionForm action={changePassword} label="ยืนยันเปลี่ยนรหัสผ่าน">
      <PasswordFields />
    </ActionForm>
    <a href="/dashboard">กลับหน้าหลัก</a>
  </section></AppShell>;
}
