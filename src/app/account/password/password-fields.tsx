"use client";

import { useState, type FormEvent } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/password-input";
import { formHintClass } from "@/components/form-card";

// Mirrors passwordChangeSchema in src/lib/supabase/password.ts; the server still validates.
function rules(current: string, next: string, confirmation: string) {
  const hasNext = next !== "";
  return [
    { label: "ยาว 6–128 ตัวอักษร", isTouched: hasNext, isOk: next.length >= 6 && next.length <= 128 },
    { label: "ตรงกับช่องยืนยัน", isTouched: confirmation !== "", isOk: next === confirmation },
    { label: "ต่างจากรหัสปัจจุบัน", isTouched: hasNext && current !== "", isOk: next !== current },
  ].map(rule => ({ ...rule, isOk: rule.isTouched && rule.isOk }));
}

// Uncontrolled on purpose: ActionForm empties password inputs in the DOM after a submit, and a
// controlled value would put the old passwords back on the next render. ActionForm fires `input` after clearing.
export function PasswordFields() {
  const [values, setValues] = useState({ current: "", next: "", confirmation: "" });
  const read = (event: FormEvent<HTMLDivElement>) => {
    const field = (name: string) => event.currentTarget.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? "";
    setValues({ current: field("current_password"), next: field("new_password"), confirmation: field("confirm_password") });
  };
  return <>
    <div className="flex flex-col gap-6" onInput={read}>
      <Field>
        <FieldLabel htmlFor="current_password">รหัสผ่านปัจจุบัน</FieldLabel>
        <PasswordInput id="current_password" name="current_password" autoComplete="current-password" required maxLength={1024} />
        <p className={formHintClass}>ถ้าได้รหัสชั่วคราวจากผู้ดูแล ใส่รหัสนั้นตรงนี้</p>
      </Field>
      <Field>
        <FieldLabel htmlFor="new_password">รหัสผ่านใหม่</FieldLabel>
        <PasswordInput id="new_password" name="new_password" autoComplete="new-password" required minLength={6} maxLength={128} />
      </Field>
      <Field>
        <FieldLabel htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่</FieldLabel>
        <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" required minLength={6} maxLength={128} />
      </Field>
      <ul aria-label="เงื่อนไขรหัสผ่านใหม่" className="m-0 flex list-none flex-col gap-1.5 rounded-sm bg-muted p-3 text-sm">
        {rules(values.current, values.next, values.confirmation).map(({ label, isTouched, isOk }) =>
          <li key={label} className={`flex gap-2 ${isOk ? "text-primary" : isTouched ? "text-destructive" : "text-muted-foreground"}`}>
            <span aria-hidden className="w-4 text-center font-bold">{isOk ? "✓" : isTouched ? "!" : "·"}</span>
            <span className="sr-only">{isOk ? "ผ่าน" : "ยังไม่ผ่าน"}</span>{label}
          </li>)}
      </ul>
    </div>
    <p role="note" className={formHintClass}>บันทึกแล้วระบบจะออกจากระบบทุกเครื่องที่ใช้บัญชีนี้ ให้เข้าใหม่ด้วยรหัสใหม่</p>
  </>;
}
