"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/staff";
import { passwordChangeSchema } from "@/lib/supabase/password";
import type { ActionState } from "@/app/walkin/action-form";

export async function changePassword(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, staff } = await requireStaff(true);
  const input = passwordChangeSchema.safeParse({
    current: form.get("current_password"), password: form.get("new_password"), confirmation: form.get("confirm_password"),
  });
  if (!input.success) return { error: "กรอกรหัสปัจจุบัน และรหัสใหม่ 6–128 ตัวอักษรให้ตรงกัน โดยต้องต่างจากรหัสเดิม" };
  let isChanged = false;
  try {
    const identity = await supabase.auth.getUser();
    if (identity.error || identity.data.user?.id !== staff.id || !identity.data.user.email) {
      return { error: "ตรวจสอบบัญชีไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่" };
    }
    const verified = await supabase.auth.signInWithPassword({ email: identity.data.user.email, password: input.data.current });
    if (verified.error || verified.data.user?.id !== staff.id) {
      return { error: "ยืนยันรหัสปัจจุบันไม่สำเร็จ กรุณาตรวจสอบแล้วลองใหม่" };
    }
    const updated = await supabase.auth.updateUser({ password: input.data.password, current_password: input.data.current });
    if (updated.error || updated.data.user?.id !== staff.id) {
      return { error: "เปลี่ยนรหัสไม่สำเร็จ กรุณาใช้รหัสที่เดายาก หากยังไม่ได้ให้ติดต่อผู้ดูแล" };
    }
    isChanged = true;
    const signedOut = await supabase.auth.signOut({ scope: "global" });
    if (signedOut.error) return { error: "เปลี่ยนรหัสสำเร็จแล้ว แต่ออกจากระบบไม่สำเร็จ กรุณากดออกจากระบบ แล้วเข้าสู่ระบบด้วยรหัสใหม่" };
  } catch {
    return { error: isChanged
      ? "เปลี่ยนรหัสสำเร็จแล้ว แต่ออกจากระบบไม่สำเร็จ กรุณากดออกจากระบบ แล้วเข้าสู่ระบบด้วยรหัสใหม่"
      : "ยังยืนยันผลการเปลี่ยนรหัสไม่ได้ กรุณาลองเข้าสู่ระบบด้วยรหัสใหม่ก่อน หากไม่ได้ให้ใช้รหัสเดิมหรือติดต่อผู้ดูแล" };
  }
  redirect("/login?password=changed");
}
