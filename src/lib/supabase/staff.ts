import "server-only";
import { redirect } from "next/navigation";
import { serverClient } from "./server";
import { staffSchema } from "@/lib/walkin/models";

export async function requireStaff(isWritable = false) {
  const supabase = await serverClient(isWritable);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data, error } = await supabase.from("staff")
    .select("id,full_name,role,is_active").eq("id", user.id).eq("is_active", true).maybeSingle();
  if (error) throw new Error("ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองใหม่");
  const parsed = staffSchema.safeParse(data);
  if (!parsed.success) redirect("/login?error=staff");
  return { supabase, staff: parsed.data };
}
