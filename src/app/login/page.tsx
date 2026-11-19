import { formErrorClass } from "@/components/form-feedback";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Suspense } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { AuthShell, AuthSkeleton } from "./auth-shell";
import { login } from "./actions";
import { formHintClass } from "@/components/form-card";

export const metadata = { title: "เข้าสู่ระบบ · Taraville Group", robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  return <Suspense fallback={<AuthSkeleton />}><LoginContent searchParams={searchParams} /></Suspense>;
}
async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  const query = await searchParams;
  return <AuthShell>
    <h1>เข้าสู่ระบบ</h1>
    {query.error === "staff" && <p className={formErrorClass} role="alert">บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแล</p>}
    {query.password === "changed" && <p className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary bg-muted px-4 py-3 font-semibold" role="status">เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่</p>}
    <ActionForm action={login} label="เข้าสู่ระบบ">
      <div className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="username">ชื่อผู้ใช้</FieldLabel>
          <Input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} placeholder="เช่น sale1" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
        </Field>
      </div>
    </ActionForm>
    <p className={formHintClass}><a href="/login/help">ลืมรหัสผ่าน</a></p>
  </AuthShell>;
}
