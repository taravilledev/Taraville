import type { AgreementDetail } from "./agreement-models";
import type { TaskName } from "./tasks";

type Document = AgreementDetail["documents"][number];
type Instalment = AgreementDetail["instalments"][number];
type Source = {
  hasDesignPlan: boolean;
  documents: (Pick<Document, "id" | "kind" | "state" | "parent_id"> & { payload: Pick<Document["payload"], "price_set" | "total_cents"> })[];
  instalments: Pick<Instalment, "id" | "position" | "label" | "needs_acceptance" | "accepted_at" | "invoice_id" | "invoice_document_id" | "net_cents" | "is_active" | "balance">[];
};
export type ChecklistItem = { label: string; done: boolean; task?: TaskName; row?: string; documentId?: string };

export function bkpChecklist({ hasDesignPlan, documents, instalments }: Source) {
  const contract = documents.find(doc => doc.kind === "contract" && ["draft", "awaiting_signature", "signed"].includes(doc.state));
  const quotations = documents.filter(doc => doc.kind === "quotation" && doc.state !== "cancelled");
  const priced = (doc: Source["documents"][number]) => doc.payload.price_set !== false && BigInt(doc.payload.total_cents ?? "0") > BigInt(0);
  const quote = contract?.parent_id ? quotations.find(doc => doc.id === contract.parent_id)
    : quotations.findLast(doc => doc.state === "accepted" && priced(doc)) ?? quotations.at(-1);
  const hasAcceptedQuote = quote?.state === "accepted" && priced(quote);
  const isSigned = contract?.state === "signed";
  const preparation: ChecklistItem[] = [
    { label: "กำหนดค่าออกแบบ", done: hasDesignPlan, task: "design" },
    { label: "จัดทำใบเสนอราคาที่มีราคา", done: !!quote && priced(quote), task: "issue-quotation", documentId: quote?.id },
    { label: "ลูกค้ายอมรับใบเสนอราคา", done: !!hasAcceptedQuote, task: "accept-quotation", row: quote?.id, documentId: quote?.id },
    { label: "จัดทำร่างสัญญา", done: !!contract, task: "prepare-contract", documentId: contract?.id },
    { label: "ล็อกและออกเลขสัญญา", done: contract?.state === "awaiting_signature" || isSigned, task: "lock-contract", row: contract?.id, documentId: contract?.id },
    { label: "บันทึกลงนามสัญญา", done: isSigned, task: "sign-contract", row: contract?.id, documentId: contract?.id },
  ];
  const rows = instalments.filter(row => row.is_active).sort((a, b) => a.position - b.position).map(row => {
    const isPaid = !!row.invoice_id && row.balance?.is_active === true && row.balance.outstanding_cents === "0";
    const checks: ChecklistItem[] = [
      ...(row.needs_acceptance ? [{ label: "ตรวจรับงานและลูกค้ายอมรับ", done: !!row.accepted_at, task: "acceptance" as const, row: row.id }] : []),
      { label: row.net_cents === "0" ? "บันทึกสรุปเครดิตงวดนี้" : "ออกใบแจ้งชำระ", done: !!row.invoice_id,
        task: "issue-invoice", row: row.id, documentId: row.invoice_document_id ?? undefined },
      { label: row.net_cents === "0" ? "ชำระครบด้วยเครดิตเดิม" : "รับชำระครบตามยอดงวด", done: isPaid,
        task: row.net_cents === "0" ? undefined : "prepare-instalment", row: row.id },
    ];
    return { id: row.id, label: row.label, net: row.net_cents, outstanding: row.balance?.outstanding_cents ?? row.net_cents,
      done: checks.every(item => item.done), checks };
  });
  return { preparation, rows, currentRow: rows.find(row => !row.done) ?? rows.at(-1),
    milestones: [true, hasDesignPlan, !!hasAcceptedQuote, isSigned, rows.length > 0 && rows.every(row => row.done)] };
}
