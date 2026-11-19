import type { CaseTab } from "@/lib/sales/case-progress";
import type { TaskName } from "@/lib/sales/tasks";

// One table for every code the sales and walk-in functions raise (ADR 0055). The coverage check in
// src/lib/sales/error-map.check.mts fails when a new code has no entry here.
type FixTask = Extract<TaskName, "close" | "amend" | "design" | "reserve">;
type FixTab = Extract<CaseTab, "design" | "quotation" | "contract" | "money">;
export type FixKind = "issuer" | "permissions" | "lead-project" | `task:${FixTask}` | `tab:${FixTab}`;
export type Fix = { label: string; href: string };
export type FixContext = { caseId?: string; leadId?: string; brand?: string; staffId?: string; isExecutive: boolean };
export type ErrorScope = "sales" | "walkin";
type Group = { codes: string[]; message: string; fix?: FixKind; walkin?: string };

const staleCase = "ข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึกอีกครั้ง";
const staleLead = "ข้อมูลถูกแก้ไขไปแล้ว กรุณาเปิดรายการล่าสุดก่อนแก้ไขอีกครั้ง";
const badData = "ข้อมูลหรือยอดเงินไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก";
const badRequest = "คำขอนี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาเปิดหน้าใหม่แล้วลองอีกครั้ง หากยังไม่ได้ให้แจ้งผู้บริหาร";
const askExecutive = "ให้ผู้บริหารตั้งค่าก่อน หากคุณไม่ใช่ผู้บริหารกรุณาแจ้งผู้บริหาร";
// Codes users cannot reach through the UI (guards, filters, hidden request fields) share a group message.
const groups: Group[] = [
  { codes: ["invalid_input", "invalid_survey", "unknown_survey_key", "invalid_other"], message: "คำตอบหรือข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจทุกช่องแล้วบันทึกใหม่" },
  { codes: ["invalid_contact"], message: "ตรวจชื่อ เบอร์โทร และไอดีไลน์ให้ถูกต้องก่อนบันทึก" },
  { codes: ["invalid_phone"], message: "เบอร์โทรไม่ถูกต้อง กรุณาตรวจเบอร์ให้ครบแล้วบันทึกใหม่" },
  { codes: ["invalid_owner"], message: "ข้อมูลหรือผู้ดูแลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่" },
  { codes: ["access_denied"], message: "คุณไม่มีสิทธิ์แก้ไขรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดรายการใหม่" },
  { codes: ["request_conflict"], message: "หน้านี้เปิดค้างไว้และข้อมูลเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่ก่อนบันทึกอีกครั้ง",
    walkin: "คำขอนี้ถูกบันทึกไปแล้วด้วยข้อมูลต่างกัน กรุณาตรวจรายการก่อนเริ่มใหม่" },
  { codes: ["stale_lead", "stale_project"], message: staleLead },
  { codes: ["stale_case", "stale_development", "stale_unit", "stale_issuer", "stale_document"], message: staleCase },
  { codes: ["invalid_lead_state"], message: "สถานะรายการเปลี่ยนไปแล้ว กรุณาเปิดรายการล่าสุดก่อนดำเนินการ" },
  { codes: ["invalid_project_state"], message: "โครงการนี้ไม่อยู่ในสถานะที่ดำเนินการได้ กรุณาเปิดรายการล่าสุด" },
  { codes: ["invalid_close_reason"], message: "เหตุผลการปิดรายการไม่ถูกต้อง หากเลือก “อื่นๆ” ต้องระบุรายละเอียด" },
  { codes: ["invalid_cancel_reason"], message: "กรุณาระบุเหตุผลการยกเลิก (ไม่เกิน 500 ตัวอักษร)" },
  { codes: ["survey_consent_required"], message: "ลูกค้ายังไม่ยินยอมให้เก็บแบบสอบถาม จึงบันทึกคำตอบไม่ได้ กรุณาตรวจการยินยอมก่อน" },
  { codes: ["invalid_privacy_choice"], message: "ตัวเลือกความยินยอมไม่ถูกต้อง กรุณาเลือกใหม่แล้วบันทึกอีกครั้ง" },
  { codes: ["legacy_request_no_evidence"], message: "รายการเก่านี้ไม่มีหลักฐานความยินยอมเดิม จึงบันทึกซ้ำไม่ได้ กรุณาเริ่มรายการใหม่" },
  { codes: ["immutable_privacy_event", "document_history_preserved", "issued_document_immutable", "cancelled_document_immutable", "money_history_preserved"],
    message: "เอกสารและประวัติที่ออกแล้วแก้ตรงๆ ไม่ได้ ให้ใช้ขั้นตอนแก้ไขหรือยกเลิกในระบบแทน" },
  { codes: ["invalid_brand", "invalid_status", "invalid_report_filter", "invalid_date_range", "invalid_version", "invalid_request", "request_id_required",
    "invalid_case_reference", "invalid_house_brief_case", "approved_case_required", "lead_not_found", "lead_has_project"], message: badRequest },
  { codes: ["active_staff_required"], message: "บัญชีผู้ใช้นี้ถูกปิดใช้งานแล้ว กรุณาแจ้งผู้บริหารให้ตรวจสอบ" },
  { codes: ["executive_required"], message: "ทำรายการนี้ได้เฉพาะผู้บริหาร กรุณาแจ้งผู้บริหาร" },
  { codes: ["sales_permission_denied"], fix: "permissions", message: "บัญชีของคุณยังไม่มีสิทธิ์ทำรายการนี้ กรุณาแจ้งผู้บริหารให้เปิดสิทธิ์ หรือให้ผู้ที่มีสิทธิ์ทำแทน" },
  { codes: ["case_unavailable", "customer_unavailable", "document_unavailable"], message: "ไม่พบรายการนี้ หรือบัญชีของคุณไม่มีสิทธิ์เปิดดู กรุณากลับไปเลือกจากรายการงานใหม่" },
  { codes: ["lead_unavailable"], fix: "lead-project", message: "ผู้สนใจรายนี้เปิดโครงการไม่ได้ในตอนนี้ (อาจถูกปิดรายการหรือเปลี่ยนผู้ดูแลแล้ว) กรุณาตรวจที่หน้าผู้สนใจ" },
  { codes: ["active_project_required"], fix: "lead-project", message: "โครงการที่เลือกไม่ได้เปิดอยู่แล้ว (อาจถูกยกเลิก) กรุณาเปิดโครงการใหม่จากหน้าผู้สนใจ" },
  { codes: ["active_unit_required"], message: "บ้านหรือแปลงที่เลือกไม่ว่างแล้วหรือถูกปิดใช้งาน กรุณาเลือกบ้านหรือแปลงอื่น" },
  { codes: ["invalid_money", "invalid_payment", "invalid_design_credit", "credit_exceeds_contract", "credit_exceeds_available_money"], message: badData },
  { codes: ["signed_amendment_required"], fix: "task:amend", message: "สัญญาลงนามแล้ว แก้ข้อมูลนี้ตรงๆ ไม่ได้ ให้บันทึกข้อตกลงแก้ไขสัญญา" },
  { codes: ["invalid_case_input", "invalid_customer_snapshot"], message: "ข้อมูลลูกค้าหรือรายละเอียดงานไม่ถูกต้อง กรุณาตรวจทุกช่องแล้วบันทึกใหม่" },
  { codes: ["discount_exceeds_price"], message: "ส่วนลดมากกว่าราคา กรุณาลดส่วนลดหรือตรวจราคาอีกครั้ง" },
  { codes: ["contract_price_bound_to_quotation"], message: "ราคาผูกกับใบเสนอราคาที่ใช้ทำสัญญาแล้ว กรุณาแก้ผ่านร่างสัญญาและเลือกฉบับที่ลูกค้ายอมรับ" },
  { codes: ["active_responsible_required"], message: "ผู้รับผิดชอบที่เลือกต้องเป็นพนักงานที่ยังใช้งานอยู่ กรุณาเลือกคนอื่น" },
  { codes: ["development_unavailable", "unit_unavailable"], message: "ไม่พบหมู่บ้านหรือบ้าน/แปลงนี้ หรือถูกลบไปแล้ว กรุณาเปิดหน้าจัดการใหม่" },
  { codes: ["unit_development_immutable"], message: "บ้าน/แปลงที่ผูกกับหมู่บ้านแล้วย้ายหมู่บ้านไม่ได้ ให้สร้างบ้าน/แปลงใหม่แทน" },
  { codes: ["issuer_configuration_required"], fix: "issuer", message: `ยังไม่ได้ตั้งค่าบริษัทผู้ออกเอกสาร จึงออกเอกสารไม่ได้ ${askExecutive}` },
  { codes: ["approved_contract_text_required"], fix: "issuer", message: `ข้อความสัญญาของบริษัทยังไม่ได้รับการอนุมัติ จึงล็อกสัญญาไม่ได้ ${askExecutive}` },
  { codes: ["invalid_issuer"], message: "ข้อมูลบริษัทผู้ออกเอกสารไม่ครบหรือไม่ถูกต้อง กรุณาตรวจชื่อ ที่อยู่ และเลขผู้เสียภาษี" },
  { codes: ["evidence_required"], message: "กรุณาแนบหลักฐานก่อนบันทึก" },
  { codes: ["invalid_area"], message: "กรอกพื้นที่ใช้สอยจริงมากกว่า 0 ตร.ม. และทศนิยมไม่เกิน 3 ตำแหน่ง" },
  { codes: ["design_plan_required"], fix: "task:design", message: "กรุณาบันทึกแพ็กเกจค่าออกแบบก่อนออกใบแจ้งชำระ" },
  { codes: ["design_billing_locked"], fix: "tab:design",
    message: "แพ็กเกจถูกล็อก กรุณายกเลิกบิลที่ยังไม่รับเงินทั้งหมดก่อนแก้ หากมีเงินรอยืนยันหรือเคยรับเงินจริงแล้วจะเปลี่ยนแพ็กเกจไม่ได้" },
  { codes: ["legacy_design_review_required"], message: "มีรายการรับค่าออกแบบเดิมที่ยังไม่ได้ผูกบิล กรุณาตรวจประวัติรับเงินก่อนดำเนินการ" },
  { codes: ["design_payment_pending"], fix: "tab:design", message: "มีรายการค่าออกแบบรอยืนยันแล้ว กรุณาตรวจหรือถอนรายการเดิมก่อน" },
  { codes: ["design_invoice_already_issued"], message: "งวดนี้มีใบแจ้งชำระแล้ว กรุณาเปิดรายการล่าสุด" },
  { codes: ["design_invoice_zero_amount"], message: "งวดนี้ไม่มียอดเรียกเก็บ จึงไม่ต้องออกบิล" },
  { codes: ["design_invoice_required"], fix: "tab:design", message: "กรุณาออกใบแจ้งชำระค่าออกแบบ แล้วบันทึกรับเงินจากบิลรายงวด" },
  { codes: ["design_invoice_has_payment", "design_invoice_already_paid"], message: "บิลนี้มีเงินรอยืนยันหรือเคยรับเงินจริงแล้ว จึงยกเลิกหรือรับซ้ำไม่ได้" },
  { codes: ["design_bill_full_amount_required", "design_bill_amount_locked"], message: "ค่าออกแบบรับเต็มยอดบิลครั้งเดียว ไม่รองรับการแก้ยอดหรือแบ่งจ่าย" },
  { codes: ["design_invoice_unavailable", "design_payment_unavailable", "invalid_design_invoice"], message: "รายการนี้ยังดำเนินการไม่ได้ กรุณาตรวจสถานะบิลและเงื่อนไขค่าออกแบบในสัญญา" },
  { codes: ["case_cancelled"], message: "งานนี้ถูกยกเลิกแล้ว จึงรับเงินเพิ่มไม่ได้" },
  { codes: ["invoice_unavailable"], message: "ไม่พบใบแจ้งชำระนี้ หรือสถานะเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่" },
  { codes: ["payment_exceeds_outstanding"], message: "ยอดรับมากกว่ายอดค้างชำระของงวดนี้ กรุณาตรวจยอดที่รับ" },
  { codes: ["payment_exceeds_agreed_total"], message: "ยอดรับเกินยอดที่ตกลงไว้ หรือยังไม่ได้บันทึกยอดตามข้อตกลงฉบับปัจจุบัน" },
  { codes: ["confirmed_reservation_required"], fix: "task:reserve", message: "ต้องยืนยันจองแปลงก่อน จึงรับเงินจองได้" },
  { codes: ["payment_already_processed", "payment_not_pending", "payment_no_longer_current", "receipt_already_replaced_or_cancelled"],
    message: "รายการนี้ถูกดำเนินการไปแล้วหรือสถานะเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่เพื่อดูรายการล่าสุด" },
  { codes: ["actual_funds_confirmation_required"], message: "กรุณาติ๊กยืนยันว่าเงินเข้าบัญชีจริงแล้วก่อนยืนยันรับเงิน" },
  { codes: ["confirmed_payment_immutable"], fix: "tab:money", message: "รายการรับเงินที่ยืนยันแล้วแก้ไขตรงๆ ไม่ได้ หากบันทึกผิดให้แก้ที่ใบเสร็จ หรือขอคืนเงิน" },
  { codes: ["payment_withdrawal_reason_required"], message: "กรุณาระบุเหตุผลที่ถอนรายการรับเงินก่อนบันทึก" },
  { codes: ["invalid_receipt_correction"], message: "ข้อมูลที่แก้ใบเสร็จไม่ถูกต้อง กรุณาตรวจยอด วันที่ และเหตุผล" },
  { codes: ["resolve_pending_design_refund", "resolve_pending_booking_refund"], fix: "tab:money",
    message: "มีคำขอคืนเงินค้างอยู่ กรุณาดำเนินการคืนเงินให้เรียบร้อยก่อน แล้วค่อยทำรายการนี้" },
  { codes: ["quotation_not_offered"], fix: "tab:quotation", message: "ใบเสนอราคาฉบับนี้ไม่ได้อยู่ในสถานะรอลูกค้ายอมรับแล้ว กรุณาเปิดหน้าใบเสนอราคาใหม่" },
  { codes: ["positive_quotation_price_required"], message: "กรุณาระบุราคาในใบเสนอราคาฉบับใหม่ก่อนยืนยันว่าลูกค้ายอมรับ" },
  { codes: ["quotation_unavailable", "invalid_quotation", "invalid_quotation_scope", "invalid_quotation_paper"], fix: "tab:quotation",
    message: "ข้อมูลใบเสนอราคาไม่ครบหรือไม่ถูกต้อง กรุณาตรวจรายการ ราคา และข้อมูลลูกค้าในใบเสนอราคาแล้วบันทึกใหม่" },
  { codes: ["invalid_quotation_house"], fix: "task:design",
    message: "ข้อมูลบ้านยังไม่ครบ (รุ่น จำนวนชั้น ห้องนอน ห้องน้ำ และพื้นที่ใช้สอย) กรุณากรอกความต้องการบ้านให้ครบก่อนออกใบเสนอราคา" },
  { codes: ["accepted_quotation_required"], fix: "tab:quotation", message: "ต้องบันทึกว่าลูกค้ายอมรับใบเสนอราคาก่อน จึงทำสัญญาได้" },
  { codes: ["contract_unavailable", "contract_not_draft", "live_contract_exists"], fix: "tab:contract",
    message: "ร่างสัญญานี้ไม่อยู่ในสถานะที่ทำรายการได้ (อาจมีสัญญาฉบับใช้งานอยู่แล้ว) กรุณาเปิดหน้าสัญญาใหม่" },
  { codes: ["invalid_schedule", "invalid_progress"], message: "ตรวจเปอร์เซ็นต์ของงวดและความคืบหน้างานให้ถูกต้องก่อนบันทึก" },
  { codes: ["schedule_must_total_100_percent"], message: "เปอร์เซ็นต์ของทุกงวดต้องรวมกันได้ 100%" },
  { codes: ["contract_not_awaiting_signature"], fix: "tab:contract", message: "สัญญาฉบับนี้ไม่ได้อยู่ในสถานะรอลงนามแล้ว กรุณาเปิดหน้าสัญญาใหม่" },
  { codes: ["contract_quotation_changed", "contract_schedule_changed"], message: "ข้อมูลสัญญาไม่ตรงกับใบเสนอราคาหรืองวด กรุณาปลดล็อกและตรวจร่างอีกครั้ง" },
  { codes: ["credit_changed_prepare_new_contract"], message: "ยอดเครดิตค่าออกแบบเปลี่ยน กรุณาปลดล็อก ตรวจร่าง และล็อกสัญญาใหม่ก่อนลงนาม" },
  { codes: ["credit_allocation_failed", "refund_allocation_failed"], message: "แบ่งยอดเงินไม่สำเร็จ กรุณาเปิดหน้าใหม่แล้วตรวจยอดอีกครั้ง" },
  { codes: ["signed_contract_required"], fix: "tab:contract", message: "ต้องบันทึกลงนามสัญญาก่อน จึงทำรายการนี้ได้" },
  { codes: ["customer_acceptance_required"], fix: "tab:money", message: "ต้องบันทึกผลตรวจรับงานของงวดนี้ก่อน จึงออกใบแจ้งชำระได้" },
  { codes: ["inspection_and_acceptance_required"], message: "กรุณาติ๊กว่าตรวจงานแล้วและลูกค้ายอมรับ พร้อมบันทึกหมายเหตุก่อนบันทึกผลตรวจรับ" },
  { codes: ["invalid_acceptance_date"], message: "ระบุวันที่ตรวจรับจริงที่ไม่เกินวันนี้ก่อนบันทึก" },
  { codes: ["acceptance_due_date_required"], message: "วันครบกำหนดต้องตรงกับวันที่ตรวจรับจริงบวก 30 วัน กรุณาเปิดบิลจากงวดล่าสุด" },
  { codes: ["complete_contract_draft_required"], message: "กรุณากลับไปแก้ร่างและกรอกชื่อผู้ลงนาม โทรศัพท์ สถานที่ก่อสร้าง และวันเริ่มสัญญาให้ครบก่อนล็อก" },
  { codes: ["complete_contract_paper_required"], message: "กรอกข้อมูลคู่สัญญาและระยะเวลาก่อสร้างให้ครบก่อนออกเลขสัญญา" },
  { codes: ["invalid_contract_paper", "invalid_contract_draft", "invalid_contract_customer"], message: "ตรวจข้อมูลคู่สัญญา วันที่ และข้อตกลงเพิ่มเติม" },
  { codes: ["invalid_contract_additional_terms"], message: "ข้อตกลงเพิ่มเติมต้องเป็นข้อความไม่เกิน 10,000 ตัวอักษร" },
  { codes: ["refund_exceeds_available_money"], message: "ยอดคืนเกินเงินที่รับไว้และยังคืนได้ กรุณาตรวจยอดคืน" },
  { codes: ["refund_exceeds_signed_closeout"], message: "ยอดคืนเกินยอดค้างคืนตามข้อตกลงปิดงาน" },
  { codes: ["invalid_refund_decision"], message: "กรุณาเลือกผลพิจารณาคำขอคืนเงินและระบุเหตุผลให้ครบ" },
  { codes: ["independent_refund_approval_required"], message: "ผู้ขอคืนเงินอนุมัติคำขอของตัวเองไม่ได้ กรุณาให้ผู้บริหารหรือผู้มีสิทธิ์อนุมัติคนอื่นพิจารณาแทน" },
  { codes: ["approved_actual_refund_required"], fix: "tab:money", message: "คำขอคืนเงินนี้ยังไม่ได้รับอนุมัติ กรุณาให้ผู้มีสิทธิ์อนุมัติก่อนบันทึกจ่ายคืน" },
  { codes: ["credit_amendment_required_before_refund"], fix: "task:amend", message: "ต้องบันทึกข้อตกลงแก้ไขสัญญาเรื่องเครดิตก่อน จึงจ่ายคืนเงินได้" },
  { codes: ["invalid_amendment", "invalid_amendment_row"], message: "ข้อมูลข้อตกลงแก้ไขสัญญาไม่ถูกต้อง กรุณาตรวจยอดทุกงวดแล้วบันทึกใหม่" },
  { codes: ["all_active_instalments_required"], message: "ต้องกรอกยอดของทุกงวดที่ยังใช้งานอยู่ให้ครบ" },
  { codes: ["instalment_unavailable"], message: "ไม่พบงวดนี้ หรืองวดถูกเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่" },
  { codes: ["invalid_closeout"], message: "ข้อมูลปิดงานไม่ถูกต้อง กรุณาตรวจยอดเงินที่เก็บไว้และเหตุผลแล้วบันทึกใหม่" },
  { codes: ["closeout_conflicts_with_pending_refunds"], fix: "tab:money", message: "ยังมีคำขอคืนเงินค้างอยู่ กรุณาพิจารณาหรือจ่ายคืนให้เสร็จก่อนปิดงาน" },
  { codes: ["sales_closeout_required"], fix: "task:close", message: "ยกเลิกโครงการนี้ไม่ได้ เพราะงานขายของโครงการยังไม่ปิดงาน กรุณาบันทึกข้อตกลงปิดงานของงานขายก่อน" },
  { codes: ["reservation_unavailable", "active_reservation_required"], message: "ไม่พบการจองแปลงที่ใช้งานอยู่ หรือสถานะเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่" },
  { codes: ["cancel_before_release"], fix: "task:close", message: "ต้องบันทึกปิดงานก่อน จึงปล่อยแปลงได้" },
  { codes: ["summary_unavailable", "property_contract_unavailable"], message: "ไม่พบสรุปการจองหรือสัญญาขายนี้ หรือสถานะเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่" },
  { codes: ["invalid_summary_terms", "invalid_downpayment_count", "booking_credit_exceeds_agreement"], message: "เงื่อนไขการจองหรืองวดดาวน์ไม่ถูกต้อง กรุณาตรวจยอดและจำนวนงวดแล้วบันทึกใหม่" },
  { codes: ["current_summary_required"], message: "กรุณาเลือกสรุปการจองที่ตรงกับแปลงและราคาปัจจุบัน" },
  { codes: ["booking_payment_requires_unsigned_reservation"], message: "รับเงินจองได้เฉพาะก่อนลงนามสัญญาขาย" },
  { codes: ["invalid_unit_change", "invalid_signed_plot_change"], message: "ข้อมูลการเปลี่ยนบ้าน/แปลงไม่ถูกต้อง กรุณาตรวจแปลงใหม่ ราคา และเหตุผลแล้วบันทึกใหม่" },
  { codes: ["invalid_house_brief"], message: "ตรวจข้อมูลความต้องการบ้านก่อนบันทึก" },
];

const table = new Map(groups.flatMap(group => group.codes.map(code => [code, group] as const)));
export const errorCodes = [...table.keys()];

const fallbacks: Record<ErrorScope, { stale: string[]; denied: string; data: string[]; dataMessage: string; other: string }> = {
  sales: { stale: ["PT409", "40P01"], denied: "คุณไม่มีสิทธิ์ทำรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดหน้าใหม่",
    data: ["22023", "22003", "23514", "23502"], dataMessage: badData, other: "บันทึกไม่ได้ กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้บริหาร" },
  walkin: { stale: ["PT409", "40001"], denied: "คุณไม่มีสิทธิ์แก้ไขรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดรายการใหม่",
    data: ["22023"], dataMessage: "ข้อมูลหรือผู้ดูแลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
    other: "บันทึกไม่สำเร็จ กรุณาลองส่งซ้ำจากฟอร์มเดิม หากยังไม่ได้ให้ติดต่อผู้ดูแล" },
};

/** Thai message (and the fix kind, when someone can act on it) for a raised code; unknown codes fall back by SQLSTATE and never echo backend text. */
export function describeError(scope: ErrorScope, sqlstate?: string, code?: string): { message: string; fix?: FixKind } {
  const entry = code === undefined ? undefined : table.get(code);
  if (entry) return { message: scope === "walkin" && entry.walkin ? entry.walkin : entry.message, fix: entry.fix };
  const fallback = fallbacks[scope];
  if (sqlstate && fallback.stale.includes(sqlstate)) return { message: scope === "walkin" ? staleLead : staleCase };
  if (sqlstate === "42501") return { message: fallback.denied };
  if (scope === "sales" && sqlstate === "23505") return { message: "มีรายการนี้แล้ว หรือบ้าน/แปลงถูกจองไปแล้ว กรุณาตรวจสอบรายการล่าสุด" };
  if (sqlstate && fallback.data.includes(sqlstate)) return { message: fallback.dataMessage };
  return { message: fallback.other };
}

const executiveOnly = new Set<FixKind>(["issuer", "permissions"]);
const taskLabels: Record<FixTask, string> = { close: "บันทึกข้อตกลงปิดงาน", amend: "บันทึกข้อตกลงแก้ไขสัญญา", design: "กำหนดค่าออกแบบ", reserve: "ยืนยันจองแปลง" };
const tabLabels: Record<FixTab, string> = { design: "ออกแบบ", quotation: "ใบเสนอราคา", contract: "สัญญา", money: "การเงิน" };

/** Turns a fix kind into a link; undefined when the place is closed to this actor or the id it needs is unknown. */
export function resolveFix(kind: FixKind | undefined, context: FixContext): Fix | undefined {
  if (!kind || (executiveOnly.has(kind) && !context.isExecutive)) return undefined;
  if (kind === "issuer") return { label: "ไปตั้งค่าบริษัทผู้ออกเอกสาร", href: `/sales/settings/issuers${context.brand ? `?brand=${context.brand}` : ""}` };
  if (kind === "permissions") return { label: "ไปตั้งค่าสิทธิ์", href: `/sales/settings/permissions${context.staffId ? `?staff=${context.staffId}` : ""}` };
  if (kind === "lead-project") return context.leadId ? { label: "ไปที่หน้าผู้สนใจ", href: `/leads/${context.leadId}` } : undefined;
  if (!context.caseId) return undefined;
  const [type, name] = kind.split(":");
  return type === "task"
    ? { label: `ไปที่ ${taskLabels[name as FixTask]}`, href: `/sales/${context.caseId}?task=${name}` }
    : { label: `ไปที่แท็บ${tabLabels[name as FixTab]}`, href: `/sales/${context.caseId}?tab=${name}` };
}

/** Message and fix link for a prerequisite shown before the user submits, from the same table as the rejection. */
export function guidance(code: string, context: FixContext): { message: string; fix?: Fix } {
  const { message, fix } = describeError("sales", undefined, code);
  return { message, fix: resolveFix(fix, context) };
}

/** What an action returns for a rejected call: the message plus the resolved fix link. */
export function errorState(scope: ErrorScope, error: { code?: string; message?: string }, context: FixContext): { error: string; fix?: Fix } {
  const { message, fix } = describeError(scope, error.code, error.message);
  return { error: message, fix: resolveFix(fix, context) };
}
