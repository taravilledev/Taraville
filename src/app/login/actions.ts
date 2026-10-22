"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { staffSchema } from "@/lib/walkin/models";
import { usernameSchema, usernameEmail } from "@/lib/supabase/username";
import type { ActionState } from "@/app/walkin/action-form";

export async function login(_state: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ username: usernameSchema, password: z.string().min(1).max(1024) })
    .safeParse({ username: form.get("username"), password: form.get("password") });
  if (!input.success) return { error: "กรุณากรอกชื่อผู้ใช้ภาษาอังกฤษและรหัสผ่านให้ครบ" };
  const supabase = await serverClient(true);
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameEmail(input.data.username), password: input.data.password });
  if (error || !data.user) return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจชื่อผู้ใช้และรหัสผ่าน หรือลองใหม่ภายหลัง" };
  const result = await supabase.from("staff").select("id,full_name,role,is_active")
    .eq("id", data.user.id).eq("is_active", true).maybeSingle();
  if (result.error || !staffSchema.safeParse(result.data).success) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแล" };
  }
  redirect("/walkin");
}

export async function logout() {
  const supabase = await serverClient(true);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่");
  redirect("/login");
}
