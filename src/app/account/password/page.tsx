import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Suspense } from "react";
import { requireStaff } from "@/lib/supabase/staff";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ActionForm } from "@/app/walkin/action-form";
import { changePassword } from "./actions";
import { formCardClass, formHintClass } from "@/components/form-card";

export const metadata = { title: "ตั้ง / เปลี่ยนรหัสผ่าน · Taraville Group", robots: { index: false, follow: false } };
export default function PasswordPage() {
  return <Suspense fallback={<PageSkeleton />}><PasswordContent /></Suspense>;
}
async function PasswordContent() {
  const { staff } = await requireStaff();
  return <AppShell staff={staff}><section className={formCardClass}>
    <h1>ตั้ง / เปลี่ยนรหัสผ่าน</h1>
    <p>รหัสใหม่ 6–128 ตัวอักษร เลือกคำหลายคำที่จำได้หรือใช้ตัวจัดการรหัสผ่าน หลีกเลี่ยงชื่อและรหัสที่ใช้กับระบบอื่น</p>
    <ActionForm action={changePassword} label="ยืนยันเปลี่ยนรหัสผ่าน">
      <div className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="current_password">รหัสผ่านปัจจุบัน</FieldLabel>
          <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required maxLength={1024} />
        </Field>
        <Field>
          <FieldLabel htmlFor="new_password">รหัสผ่านใหม่</FieldLabel>
          <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่</FieldLabel>
          <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} />
        </Field>
      </div>
      <p className={formHintClass}>เมื่อบันทึกสำเร็จ ให้เข้าสู่ระบบใหม่ด้วยรหัสใหม่</p>
    </ActionForm>
    <a href="/dashboard">กลับหน้าหลัก</a>
  </section></AppShell>;
}
