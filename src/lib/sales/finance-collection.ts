import type { FinancialDetail } from "./financial-models";
import type { AgreementDetail } from "./agreement-models";
import { findTask, taskHref, type Task } from "./tasks";
import { formatMoney } from "./money";
import { formatDate } from "./date";

export type CollectionFilter = "ready" | "payment" | "acceptance" | "complete";
export type CollectionLink = { label: string; href: string };
export type CollectionRow = {
  id: string; group: "design" | "contract"; label: string; amountCents: string; outstandingCents: string | null;
  status: string; filter: CollectionFilter | null; note: string; dueDate: string | null; acceptanceDate: string | null;
  isReference?: boolean;
  primaryAction?: CollectionLink; links: CollectionLink[]; history: (CollectionLink & { cancelled: boolean })[];
};
const designLabels = ["ส่งมอบแบบแปลน", "ส่งมอบ 3D", "ส่งมอบครบ"];
const positive = (value: bigint) => value > BigInt(0) ? value : BigInt(0);
const hasDesignIncludedInSignedContract = (agreement: AgreementDetail) =>
  agreement.documents.some(doc => doc.kind === "contract" && doc.state === "signed" && doc.payload.design_fee_separate !== true);

export function collectionRows(caseId: string, finance: FinancialDetail, agreement: AgreementDetail, tasks: Task[], isClosed = false): CollectionRow[] {
  const action = (name: Task["name"], row: string, label: string): CollectionLink | undefined => {
    const task = findTask(tasks, name, row);
    return task ? { label, href: taskHref(caseId, task.name, task.row) } : undefined;
  };
  const legacy = finance.design_legacy_has_payments || BigInt(finance.design_legacy_received_cents) > BigInt(0);
  const isDesignIncluded = !isClosed && hasDesignIncludedInSignedContract(agreement);
  const design: CollectionRow[] = finance.design_plan?.instalments.map((amount, index) => {
    const position = index + 1;
    const history = finance.design_bills.filter(bill => bill.position === position);
    const bill = history.find(item => item.state === "issued");
    const isZero = amount === "0";
    const isPaid = !!bill && bill.received_cents === bill.amount_cents;
    const isAdjusted = !!bill?.has_confirmed_payment && !isPaid;
    const hasPending = !!bill?.pending_id;
    const status = isZero ? "ไม่มีเรียกเก็บ" : isPaid ? "รับครบแล้ว" : isAdjusted ? "มีการปรับยอด" : hasPending ? "รอยืนยันรับเงิน" : legacy ? "รอตรวจเงินค่าแบบเดิม" : bill ? "รอชำระ" : "ยังไม่ออกบิล";
    const primaryAction = isZero || isPaid || isAdjusted ? undefined : hasPending ? { label: "ตรวจเงินรอยืนยัน", href: "#pending" }
      : legacy || isDesignIncluded ? undefined : bill ? action("prepare-design-payment", bill.id, "บันทึกรับเงิน") : action("issue-design-invoice", String(position), "ออกใบแจ้งชำระ");
    const links: CollectionLink[] = [];
    if (bill) links.push({ label: "ดูบิล", href: `/sales/documents/${bill.document_id}` });
    if (bill?.receipt_document_id) links.push({ label: "ดูใบเสร็จ", href: `/sales/documents/${bill.receipt_document_id}` });
    if (isAdjusted) links.push({ label: "ดูประวัติรับเงิน", href: "#receipts" });
    const cancel = !isDesignIncluded && bill && action("cancel-design-invoice", bill.id, "ยกเลิกบิล");
    if (cancel) links.push(cancel);
    return { id: `design-${position}`, group: "design", label: `งวดที่ ${position} · ${designLabels[index]}`, amountCents: amount,
      outstandingCents: isZero || isPaid ? "0" : legacy || isDesignIncluded ? null : bill ? positive(BigInt(bill.amount_cents) - BigInt(bill.received_cents)).toString() : amount,
      status: isDesignIncluded && !isZero && !isPaid && !isAdjusted && !hasPending ? "รวมในราคาสัญญาแล้ว" : status,
      isReference: isDesignIncluded,
      filter: isZero || isPaid ? "complete" : isAdjusted || legacy || (isDesignIncluded && !hasPending) ? null : bill ? "payment" : primaryAction ? "ready" : null,
      primaryAction, links, dueDate: isDesignIncluded && !isPaid ? null : bill?.due_date ?? null, acceptanceDate: null,
      note: legacy ? "เงินค่าแบบเดิมยังไม่ระบุว่าชำระบิลใด" : isAdjusted ? "ตรวจประวัติรับเงินและคืนเงินก่อนดำเนินการ"
        : isDesignIncluded ? "ดูยอดที่ต้องชำระในงวดตามสัญญา" : "รับเต็มยอดบิลครั้งเดียว",
      history: history.filter(item => item.id !== bill?.id).map(item => ({ label: `ใบแจ้งชำระ · ครบกำหนด ${formatDate(item.due_date)}`, href: `/sales/documents/${item.document_id}`, cancelled: item.state === "cancelled" })),
    };
  }) ?? [];
  const contract: CollectionRow[] = agreement.instalments.filter(row => row.is_active).sort((a, b) => a.position - b.position).map(row => {
    const isPaid = !!row.invoice_id && row.balance?.is_active === true && row.balance.outstanding_cents === "0";
    const needsAcceptance = row.needs_acceptance && !row.accepted_at;
    const isCreditOnly = row.net_cents === "0";
    const next = findTask(tasks, "acceptance", row.id) ?? findTask(tasks, "issue-invoice", row.id) ?? findTask(tasks, "prepare-instalment", row.id);
    const primaryAction = next && !(isCreditOnly && next.name === "prepare-instalment") ? { label: next.name === "acceptance" ? "บันทึกตรวจรับ" : next.name === "issue-invoice"
      ? isCreditOnly ? "บันทึกสรุปเครดิตงวดนี้" : "ออกใบแจ้งชำระ" : "บันทึกเงินเข้างวดนี้", href: taskHref(caseId, next.name, next.row) } : undefined;
    return { id: row.id, group: "contract", label: row.label, amountCents: row.net_cents,
      outstandingCents: row.balance?.is_active ? row.balance.outstanding_cents : row.net_cents,
      status: isPaid ? "ครบยอดแล้ว" : needsAcceptance ? "รอตรวจรับงาน" : row.invoice_id ? "รอรับชำระ" : isCreditOnly ? "รอบันทึกสรุปเครดิต" : "ยังไม่ออกบิล",
      filter: isPaid ? "complete" : needsAcceptance ? "acceptance" : row.invoice_id ? "payment" : "ready", primaryAction,
      links: row.invoice_document_id ? [{ label: "ดูบิล / เครดิต", href: `/sales/documents/${row.invoice_document_id}` }] : [], history: [],
      acceptanceDate: row.acceptance_date ?? null, dueDate: row.due_date ?? null,
      note: `ยอดงวด ${formatMoney(row.gross_cents)} · เครดิต ${formatMoney(row.credit_cents)} บาท${row.needs_acceptance ? "" : " · มัดจำไม่ต้องตรวจรับ"}`,
    };
  });
  return [...design, ...contract].map(row => !isClosed ? row : { ...row, isReference: true,
    outstandingCents: row.filter === "complete" ? row.outstandingCents : null,
    status: row.filter === "complete" ? row.status : "อ้างอิงก่อนปิดงาน", filter: row.filter === "complete" ? "complete" : null,
    note: `ข้อมูลอ้างอิงก่อนปิดงาน · ${row.note}` });
}

export function collectionSummary(finance: FinancialDetail, agreement: AgreementDetail, received: string | undefined,
  closeoutRemaining?: string, isClosed = false) {
  const designReceived = finance.payments.filter(payment => payment.kind === "design_fee")
    .reduce((sum, payment) => sum + BigInt(payment.amount_cents) - BigInt(payment.totals.refunded_cents ?? "0"), BigInt(0));
  const active = agreement.instalments.filter(row => row.is_active);
  const isDesignIncluded = !isClosed && hasDesignIncludedInSignedContract(agreement);
  return { received: received ?? null,
    pending: finance.pending.reduce((sum, payment) => sum + BigInt(payment.amount_cents), BigInt(0)).toString(),
    isDesignIncluded,
    designRemaining: !isClosed && !isDesignIncluded && finance.design_plan ? positive(BigInt(finance.design_plan.total_cents) - designReceived).toString() : null,
    contractRemaining: isClosed ? closeoutRemaining ?? null : closeoutRemaining ?? (active.length ? active.reduce((sum, row) =>
      sum + BigInt(row.balance?.is_active ? row.balance.outstanding_cents : row.net_cents), BigInt(0)).toString() : null),
  };
}
