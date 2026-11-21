import { formErrorClass } from "@/components/form-feedback";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/password-input";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/supabase/next-path";
import { staffSchema } from "@/lib/walkin/models";
import { ActionForm } from "@/app/walkin/action-form";
import { AuthShell, AuthSkeleton } from "./auth-shell";
import { login } from "./actions";
import { formHintClass } from "@/components/form-card";

type Query = { error?: string; password?: string; next?: string };
const bannerClass = "mb-4 rounded-sm border px-4 py-3 text-sm";

export const metadata = { title: "เข้าสู่ระบบ · Taraville Group", robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <Suspense fallback={<AuthSkeleton />}><LoginContent searchParams={searchParams} /></Suspense>;
}
async function LoginContent({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const next = safeNextPath(query.next);
  // An active staff session skips the form; a signed-in non-staff account stays here, or /dashboard would bounce it back.
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("staff").select("id,full_name,role,is_active").eq("id", user.id).eq("is_active", true).maybeSingle();
    if (staffSchema.safeParse(data).success) redirect(next ?? "/dashboard");
  }
  return <AuthShell>
    <h1>เข้าสู่ระบบ</h1>
    {next && <p className={`${bannerClass} border-primary/30 bg-accent text-primary`} role="status">หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง · เข้าแล้วจะพากลับไปหน้าที่เปิดค้างไว้</p>}
    {query.error === "staff" && <p className={formErrorClass} role="alert">บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้บริหารฝ่ายขาย</p>}
    {query.password === "changed" && <p className={`${bannerClass} border-l-4 border-l-primary bg-muted font-semibold`} role="status">เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่</p>}
    <ActionForm action={login} label="เข้าสู่ระบบ" pendingLabel="กำลังเข้าสู่ระบบ…">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="username">ชื่อผู้ใช้</FieldLabel>
          <Input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} placeholder="เช่น sale1" aria-describedby="username-rule" />
          <FieldDescription id="username-rule">ขึ้นต้นด้วยภาษาอังกฤษ ใช้ตัวเล็ก ตัวเลข _ หรือ - เช่น sale1</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="current-password" required maxLength={1024} />
        </Field>
      </div>
    </ActionForm>
    <p className={formHintClass}><a href="/login/help">ลืมรหัสผ่าน</a></p>
  </AuthShell>;
}
