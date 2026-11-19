import type { FinancialDetail } from "./financial-models";
import type { AgreementDetail } from "./agreement-models";

export const bkpFlowStages = [
  { id: "intake", label: "รับลูกค้า", hint: "ข้อมูลลูกค้าและความต้องการบ้าน" },
  { id: "design", label: "ออกแบบ", hint: "พื้นที่จริงและแพ็กเกจค่าออกแบบ" },
  { id: "fees", label: "รับค่าแบบ", hint: "ออกบิล ตรวจเงินเข้า และใบเสร็จ" },
  { id: "quotation", label: "ใบเสนอราคา", hint: "แก้บนเอกสารและบันทึกลูกค้ายอมรับ" },
  { id: "contract", label: "สัญญาและงวด", hint: "ร่างสัญญา ลงนาม และรับชำระตามงวด" },
] as const;
export type BkpFlowStage = typeof bkpFlowStages[number]["id"];
export const bkpOverviewStages = {
  intake: "เปิดโครงการ",
  design: "ออกแบบและรับค่าแบบ",
  quotation: "ใบเสนอราคา",
  contract: "สัญญา",
  money: "การเงิน",
} as const;

export function bkpOverviewStage(flow: ReturnType<typeof bkpWorkflow>): keyof typeof bkpOverviewStages {
  if (flow.contract?.state === "signed") return "money";
  return flow.current === "fees" ? "design" : flow.current;
}

export function bkpWorkflow(finance: FinancialDetail, agreement: AgreementDetail, requested?: string) {
  const quotations = agreement.documents.filter(doc => doc.kind === "quotation" && doc.state !== "cancelled");
  const contract = agreement.documents.findLast(doc => doc.kind === "contract" && ["draft", "awaiting_signature", "signed"].includes(doc.state));
  const hasAccepted = quotations.some(doc => doc.state === "accepted" && doc.payload.price_set !== false && BigInt(doc.payload.total_cents ?? "0") > BigInt(0));
  const received = finance.payments.filter(payment => payment.kind === "design_fee").reduce((sum, payment) =>
    sum + BigInt(payment.amount_cents) - BigInt(payment.totals.refunded_cents ?? "0"), BigInt(0));
  const feesPaid = !!finance.design_plan && received >= BigInt(finance.design_plan.total_cents);
  const current: BkpFlowStage = contract || hasAccepted ? "contract" : quotations.length || feesPaid ? "quotation" : finance.design_plan ? "fees" : "design";
  const selected = bkpFlowStages.find(stage => stage.id === requested)?.id ?? current;
  const done: Record<BkpFlowStage, boolean> = { intake: true, design: !!finance.design_plan, fees: feesPaid, quotation: hasAccepted,
    contract: contract?.state === "signed" && agreement.is_settled };
  return { selected, current, done, received: received.toString(), contract, quotations };
}
