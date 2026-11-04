import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import type { ActionState } from "@/app/walkin/action-form";

export function salesError(code: string, message?: string): string {
  if (code === "22023" && message === "payment_exceeds_agreed_total") return "ยอดรับเกินยอดที่ตกลงไว้ หรือยังไม่ได้บันทึกยอดตามข้อตกลงฉบับปัจจุบัน";
  if (code === "22023" && message === "current_summary_required") return "กรุณาเลือกสรุปการจองที่ตรงกับแปลงและราคาปัจจุบัน";
  if (code === "22023" && message === "refund_exceeds_signed_closeout") return "ยอดคืนเกินยอดค้างคืนตามข้อตกลงปิดงาน";
  if (code === "42501") return "คุณไม่มีสิทธิ์ทำรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดหน้าใหม่";
  if (code === "PT409" || code === "40P01") return "ข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึกอีกครั้ง";
  if (code === "23505") return "มีรายการนี้แล้ว หรือบ้าน/แปลงถูกจองไปแล้ว กรุณาตรวจสอบรายการล่าสุด";
  if (["22023", "22003", "23514", "23502"].includes(code)) return "ข้อมูลหรือยอดเงินไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก";
  return "บันทึกไม่ได้ กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้บริหาร";
}

export async function salesMutation(session: Awaited<ReturnType<typeof requireStaff>>, name: string,
  input: Record<string, unknown>, destination: "case" | "/sales/admin" | "/sales/catalog" | "/sales/admin/issuers"): Promise<ActionState> {
  const { data, error } = await session.supabase.rpc(name, input);
  if (error) return { error: salesError(error.code, error.message) };
  const result = z.object({ id: z.uuid().optional() }).safeParse(data);
  if (!result.success || (destination === "case" && !result.data.id)) return { error: "บันทึกแล้วแต่โหลดรายการไม่ได้ กรุณาเปิดหน้ารายการงานใหม่" };
  revalidatePath("/sales", "layout");
  redirect(destination === "case" ? `/sales/${result.data.id}` : destination);
}
