const successMessages = {
  saved: "บันทึกข้อมูลแล้ว",
  lead_created: "บันทึกผู้สนใจรายใหม่แล้ว",
  lead_updated: "บันทึกข้อมูลผู้สนใจแล้ว",
  lead_reassigned: "เปลี่ยนผู้ดูแลแล้ว",
  contact_recorded: "บันทึกการติดต่อแล้ว",
  survey_choice_saved: "บันทึกตัวเลือกแบบสอบถามแล้ว",
  unit_enabled: "เปิดใช้งานบ้าน/แปลงแล้ว",
  unit_disabled: "ปิดใช้งานบ้าน/แปลงแล้ว",
  sales_create_case: "เปิดโครงการแล้ว",
  sales_save_case: "บันทึกข้อมูลโครงการแล้ว",
  sales_assign_case: "เปลี่ยนผู้รับผิดชอบโครงการแล้ว",
  sales_save_house_brief: "บันทึกความต้องการบ้านแล้ว",
  sales_save_design_plan: "บันทึกแพ็กเกจค่าออกแบบแล้ว",
  sales_save_development: "บันทึกโครงการหมู่บ้านแล้ว",
  sales_save_unit: "บันทึกบ้าน/แปลงแล้ว",
  sales_set_capability: "บันทึกสิทธิ์แล้ว",
  sales_save_issuer: "บันทึกข้อมูลผู้ออกเอกสารแล้ว",
  sales_save_booking_summary: "บันทึกสรุปการจองแล้ว",
  sales_confirm_reservation: "ยืนยันการจองแล้ว",
  sales_release_reservation: "ปล่อยแปลงที่จองแล้ว",
  sales_change_reserved_unit: "เปลี่ยนแปลงที่จองแล้ว",
  sales_change_signed_plot: "บันทึกการเปลี่ยนแปลงตามสัญญาแล้ว",
  sales_close_case: "ปิดรายการขายแล้ว",
  sales_issue_quotation: "ออกใบเสนอราคาแล้ว",
  sales_accept_quotation: "บันทึกว่าลูกค้ายอมรับใบเสนอราคาแล้ว",
  sales_save_contract_draft: "บันทึกร่างสัญญาแล้ว",
  sales_lock_contract: "ล็อกและออกเลขสัญญาแล้ว",
  sales_unlock_contract: "ปลดล็อกสัญญาแล้ว",
  sales_sign_property_contract: "บันทึกการลงนามสัญญาแล้ว",
  sales_sign_contract: "บันทึกการลงนามสัญญาแล้ว",
  sales_amend_contract: "บันทึกการแก้ไขสัญญาแล้ว",
  sales_add_contract_addendum: "บันทึกเอกสารแนบท้ายสัญญาแล้ว",
  sales_record_acceptance: "บันทึกการตรวจรับงานแล้ว",
  sales_record_acceptance_dated: "บันทึกการตรวจรับงานแล้ว",
  sales_issue_invoice: "ออกใบแจ้งชำระแล้ว",
  sales_issue_design_invoice: "ออกใบแจ้งชำระค่าออกแบบแล้ว",
  sales_cancel_design_invoice: "ยกเลิกใบแจ้งชำระค่าออกแบบแล้ว",
  sales_prepare_design_payment: "บันทึกยอดรับค่าออกแบบ · รอยืนยัน",
  sales_prepare_payment: "บันทึกรายการรับเงิน · รอยืนยัน",
  sales_confirm_payment: "ยืนยันรับเงินแล้ว",
  sales_reject_pending_payment: "ถอนรายการรับเงินรอยืนยันแล้ว",
  sales_correct_payment: "บันทึกการแก้ไขรายการรับเงินแล้ว",
  sales_correct_receipt: "บันทึกการแก้ไขใบเสร็จแล้ว",
  sales_request_refund: "บันทึกคำขอคืนเงินแล้ว",
  sales_decide_refund: "บันทึกผลพิจารณาคืนเงินแล้ว",
  sales_pay_refund: "บันทึกการจ่ายเงินคืนแล้ว",
} as const;

export const feedbackParam = "feedback";

export function successMessage(code: string | null): string | undefined {
  if (code && Object.hasOwn(successMessages, code)) return successMessages[code as keyof typeof successMessages];
}

export function withSuccessFeedback(href: string, code: string) {
  const url = new URL(href, "http://local.invalid");
  if (!successMessage(url.searchParams.get(feedbackParam))) {
    url.searchParams.set(feedbackParam, successMessage(code) ? code : "saved");
  }
  return url.pathname + url.search + url.hash;
}
