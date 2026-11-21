import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SalesCase } from "@/lib/sales/models";
import { contractPaperMissing } from "@/lib/sales/contract-paper";
import { missingContractPrerequisite } from "@/lib/sales/contract-template";
import { guidance, type Fix } from "@/lib/errors/error-map";
import type { TaskData } from "./tasks/task-data";

type Document = AgreementDetail["documents"][number];
export type ReadinessItem = { id: string; title: string; detail: string; isOk: boolean; fix?: Fix };

const pendingClause = "ข้อสัญญาเพิ่มเติมที่รอตรวจต้นฉบับ";

/** Pre-lock checklist for a contract draft; each blocker comes from a rule the lock action already enforces. Company-level
 * items need the contract template, so without it only the document-level items are returned. */
export function contractReadiness({ sale, agreement, draft, template, isExecutive }: {
  sale: Pick<SalesCase, "id" | "brand">; agreement: AgreementDetail; draft: Document; template: TaskData["contractTemplate"]; isExecutive: boolean;
}): ReadinessItem[] {
  const editFix: Fix = { label: "แก้ในร่างสัญญา ›", href: `/sales/${sale.id}?task=edit-contract&row=${draft.id}` };
  const context = { brand: sale.brand, isExecutive };
  const isSynthetic = !!template?.is_synthetic;
  const paper = draft.payload.contract_paper;
  const missing = [...(paper ? contractPaperMissing(paper, isSynthetic) : []), ...(!draft.payload.start_date ? ["วันเริ่มก่อสร้าง"] : [])];
  const fields = missing.filter(label => label !== pendingClause);
  const reference = agreement.documents.find(doc => doc.id === draft.parent_id && doc.kind === "quotation" && doc.state === "accepted");
  const schedule = draft.payload.schedule_input;
  const items: ReadinessItem[] = [];
  if (reference) items.push({ id: "quotation", title: "ใบเสนอราคาที่ลูกค้ายอมรับ", isOk: true, detail: `${reference.number ?? "ใบเสนอราคา"} · ฉบับที่ ${reference.revision}` });
  if (schedule) {
    const isFull = schedule.reduce((sum, row) => sum + row.basis_points, 0) === 10000;
    items.push({ id: "schedule", title: "ตารางงวดรวม 100%", isOk: isFull, detail: isFull ? `${schedule.length} งวด` : "สัดส่วนงวดยังไม่รวม 100%", fix: isFull ? undefined : editFix });
  }
  const isPaperMissing = fields.length > 0 || (!paper && !isSynthetic);
  items.push({ id: "paper", title: "ข้อมูลคู่สัญญาและวันที่ครบ", isOk: !isPaperMissing,
    detail: isPaperMissing ? `ยังไม่กรอก: ${fields.length ? fields.join(" · ") : "ข้อมูลสัญญา"}` : "ข้อมูลที่จำเป็นครบ", fix: isPaperMissing ? editFix : undefined });
  const hasPending = missing.includes(pendingClause);
  items.push({ id: "clauses", title: "ไม่มีข้อสัญญาที่รอตรวจต้นฉบับ", isOk: !hasPending, detail: hasPending ? "ยังมีข้อสัญญาเพิ่มเติมที่เป็นข้อความ “รอตรวจต้นฉบับ”" : "ไม่มีข้อที่ค้างตรวจ",
    fix: hasPending ? editFix : undefined });
  if (!template) return items;
  const prerequisite = missingContractPrerequisite(template);
  const issuer = prerequisite === "issuer_configuration_required" ? guidance(prerequisite, context) : null;
  items.push({ id: "issuer", title: "ตั้งค่าบริษัทผู้ออกเอกสาร", isOk: !issuer, detail: issuer?.message ?? "ชื่อและที่อยู่บริษัทครบ", fix: issuer?.fix });
  const isUnapproved = !isSynthetic && !template.contract_text_approved;
  const isStale = (!isSynthetic && draft.payload.contract_text !== template.contract_text) || !draft.payload.contract_text?.trim();
  const approval = isUnapproved ? guidance("approved_contract_text_required", context) : null;
  items.push({ id: "approval", title: "ข้อความสัญญาของบริษัทอนุมัติแล้ว", isOk: !approval && !isStale,
    detail: approval?.message ?? (isStale ? "บันทึกร่างอีกครั้งเพื่อใช้ข้อความสัญญาที่อนุมัติล่าสุด" : "ร่างใช้ข้อความฉบับที่อนุมัติล่าสุด"),
    fix: approval ? approval.fix : isStale ? editFix : undefined });
  return items;
}
