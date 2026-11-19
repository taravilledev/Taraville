import "server-only";
import { redirect } from "next/navigation";
import { withSuccessFeedback } from "@/lib/action-feedback";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import type { ActionState } from "@/app/walkin/action-form";

export function salesError(code: string, message?: string): string {
  if (message === "invalid_acceptance_date") return "ระบุวันที่ตรวจรับจริงที่ไม่เกินวันนี้ก่อนบันทึก";
  if (message === "acceptance_due_date_required") return "วันครบกำหนดต้องตรงกับวันที่ตรวจรับจริงบวก 30 วัน กรุณาเปิดบิลจากงวดล่าสุด";
  if (message === "invalid_area") return "กรอกพื้นที่ใช้สอยจริงมากกว่า 0 ตร.ม. และทศนิยมไม่เกิน 3 ตำแหน่ง";
  if (message === "invalid_contract_additional_terms") return "ข้อตกลงเพิ่มเติมต้องเป็นข้อความไม่เกิน 10,000 ตัวอักษร";
  if (message === "design_plan_required") return "กรุณาบันทึกแพ็กเกจค่าออกแบบก่อนออกใบแจ้งชำระ";
  if (message === "legacy_design_review_required") return "มีรายการรับค่าออกแบบเดิมที่ยังไม่ได้ผูกบิล กรุณาตรวจประวัติรับเงินก่อนดำเนินการ";
  if (message === "design_payment_pending") return "มีรายการค่าออกแบบรอยืนยันแล้ว กรุณาตรวจหรือถอนรายการเดิมก่อน";
  if (message === "design_invoice_already_issued") return "งวดนี้มีใบแจ้งชำระแล้ว กรุณาเปิดรายการล่าสุด";
  if (message === "design_invoice_zero_amount") return "งวดนี้ไม่มียอดเรียกเก็บ จึงไม่ต้องออกบิล";
  if (message === "design_invoice_required") return "กรุณาออกใบแจ้งชำระค่าออกแบบ แล้วบันทึกรับเงินจากบิลรายงวด";
  if (message === "design_invoice_has_payment" || message === "design_invoice_already_paid") return "บิลนี้มีเงินรอยืนยันหรือเคยรับเงินจริงแล้ว จึงยกเลิกหรือรับซ้ำไม่ได้";
  if (message === "design_bill_full_amount_required" || message === "design_bill_amount_locked") return "ค่าออกแบบรับเต็มยอดบิลครั้งเดียว ไม่รองรับการแก้ยอดหรือแบ่งจ่าย";
  if (message === "design_billing_locked" || message === "design_amendment_required") return "แพ็กเกจถูกล็อก กรุณายกเลิกบิลที่ยังไม่รับเงินทั้งหมดก่อนแก้ หากมีเงินรอยืนยันหรือเคยรับเงินจริงแล้วจะเปลี่ยนแพ็กเกจไม่ได้";
  if (message === "design_invoice_unavailable" || message === "design_payment_unavailable") return "รายการนี้ยังดำเนินการไม่ได้ กรุณาตรวจสถานะบิลและเงื่อนไขค่าออกแบบในสัญญา";
  if (message === "complete_contract_draft_required") return "กรุณากลับไปแก้ร่างและกรอกชื่อผู้ลงนาม โทรศัพท์ สถานที่ก่อสร้าง และวันเริ่มสัญญาให้ครบก่อนล็อก";
  if (message === "credit_changed_prepare_new_contract") return "ยอดเครดิตค่าออกแบบเปลี่ยน กรุณาปลดล็อก ตรวจร่าง และล็อกสัญญาใหม่ก่อนลงนาม";
  if (message === "contract_quotation_changed" || message === "contract_schedule_changed") return "ข้อมูลสัญญาไม่ตรงกับใบเสนอราคาหรืองวด กรุณาปลดล็อกและตรวจร่างอีกครั้ง";
  if (message === "contract_price_bound_to_quotation") return "ราคาผูกกับใบเสนอราคาที่ใช้ทำสัญญาแล้ว กรุณาแก้ผ่านร่างสัญญาและเลือกฉบับที่ลูกค้ายอมรับ";
  if (message === "invalid_contract_paper") return "ตรวจข้อมูลคู่สัญญา วันที่ และข้อตกลงเพิ่มเติม";
  if (message === "complete_contract_paper_required") return "กรอกข้อมูลคู่สัญญาและระยะเวลาก่อสร้างให้ครบก่อนออกเลขสัญญา";
  if (message === "approved_contract_text_required") return "กรุณาตั้งค่าข้อความสัญญาของบริษัทก่อนล็อกสัญญาเพื่อเซ็น";
  if (message === "positive_quotation_price_required") return "กรุณาระบุราคาในใบเสนอราคาฉบับใหม่ก่อนยืนยันว่าลูกค้ายอมรับ";
  if (message === "resolve_pending_design_refund") return "มีคำขอคืนค่าออกแบบค้างอยู่ กรุณาดำเนินการคืนเงินให้เรียบร้อยก่อนทบทวนเครดิตสัญญา";
  if (code === "22023" && message === "payment_exceeds_agreed_total") return "ยอดรับเกินยอดที่ตกลงไว้ หรือยังไม่ได้บันทึกยอดตามข้อตกลงฉบับปัจจุบัน";
  if (code === "22023" && message === "current_summary_required") return "กรุณาเลือกสรุปการจองที่ตรงกับแปลงและราคาปัจจุบัน";
  if (code === "22023" && message === "refund_exceeds_signed_closeout") return "ยอดคืนเกินยอดค้างคืนตามข้อตกลงปิดงาน";
  if (code === "22023" && message === "request_conflict") return "หน้านี้เปิดค้างไว้และข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึกอีกครั้ง";
  if (code === "42501") return "คุณไม่มีสิทธิ์ทำรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดหน้าใหม่";
  if (code === "PT409" || code === "40P01") return "ข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึกอีกครั้ง";
  if (code === "23505") return "มีรายการนี้แล้ว หรือบ้าน/แปลงถูกจองไปแล้ว กรุณาตรวจสอบรายการล่าสุด";
  if (["22023", "22003", "23514", "23502"].includes(code)) return "ข้อมูลหรือยอดเงินไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก";
  return "บันทึกไม่ได้ กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้บริหาร";
}

export async function salesMutation(session: Awaited<ReturnType<typeof requireStaff>>, name: string,
  input: Record<string, unknown>, destination: "case" | "design" | "finance" | `/sales/settings/${string}` | `/sales/${string}?tab=${"quotation" | "contract" | "money"}`, nextTask?: "design" | "reserve"): Promise<ActionState> {
  const { data, error } = await session.supabase.rpc(name, input);
  if (error) return { error: salesError(error.code, error.message) };
  const result = z.object({ id: z.uuid().optional() }).safeParse(data);
  if (!result.success || (["case", "design", "finance"].includes(destination) && !result.data.id)) return { error: "บันทึกแล้วแต่โหลดรายการไม่ได้ กรุณาเปิดหน้ารายการงานใหม่" };
  revalidatePath("/sales", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/summary");
  const href = destination === "design" ? `/sales/${result.data.id}?tab=design#design-fees`
    : destination === "finance" ? `/sales/${result.data.id}?tab=money`
    : destination === "case" ? `/sales/${result.data.id}${nextTask ? `?task=${nextTask}` : ""}` : destination;
  redirect(withSuccessFeedback(href, name));
}
