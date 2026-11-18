import type { AgreementDetail } from "./agreement-models";
import type { FinancialDetail } from "./financial-models";

export const documentGroups = { quotation: "ใบเสนอราคา", agreement: "สัญญาและข้อตกลง", invoice: "ใบแจ้งชำระ / สรุปเครดิต", receipt: "ใบเสร็จ / เอกสารคืนเงิน" };
export type DocumentGroup = keyof typeof documentGroups;
const kinds: Record<string, { title: string; group: DocumentGroup }> = {
  quotation: { title: "ใบเสนอราคา", group: "quotation" }, contract: { title: "สัญญาก่อสร้าง", group: "agreement" },
  amendment: { title: "ข้อตกลงแก้ไขสัญญา", group: "agreement" }, closeout: { title: "ข้อตกลงปิดงาน", group: "agreement" },
  summary: { title: "สรุปการจอง", group: "agreement" }, invoice: { title: "ใบแจ้งชำระ / สรุปเครดิต", group: "invoice" },
  receipt: { title: "ใบเสร็จรับเงิน", group: "receipt" }, refund: { title: "เอกสารจ่ายคืนเงิน", group: "receipt" },
};
const states: Record<string, string> = { draft: "ร่าง · ยังไม่ออกเลข", cancelled: "ยกเลิกแล้ว", offered: "รอลูกค้ายอมรับ", accepted: "ลูกค้ายอมรับแล้ว",
  awaiting_signature: "รอลงนาม", signed: "ลงนามแล้ว", issued: "ออกเอกสารแล้ว" };
export type LibraryDocument = { id: string; title: string; group: DocumentGroup; number: string | null; date: string;
  revision?: number; state: string; status: string; amount: string | null; note: string; history: boolean };

type AgreementSource = { documents: (Pick<AgreementDetail["documents"][number], "id" | "kind" | "state" | "number" | "parent_id" | "revision"> & {
  payload: Pick<AgreementDetail["documents"][number]["payload"], "price_set" | "total_cents" | "text_addendum" | "contract_number"> })[] };
export function documentLibrary(finance: Pick<FinancialDetail, "documents">, agreement: AgreementSource): LibraryDocument[] {
  const live = agreement.documents.findLast(doc => doc.kind === "contract" && ["draft", "awaiting_signature", "signed"].includes(doc.state));
  const quotes = agreement.documents.filter(doc => doc.kind === "quotation" && doc.state !== "cancelled");
  const selectedQuote = live?.parent_id ?? quotes.findLast(doc => doc.state === "accepted")?.id ?? quotes.at(-1)?.id;
  const documents = new Map(finance.documents.map(doc => [doc.id, doc]));
  for (const doc of agreement.documents) if (!documents.has(doc.id)) documents.set(doc.id, {
    id: doc.id, kind: doc.kind, number: doc.number, state: doc.state, document_date: "", amount_cents: null,
  });
  return [...documents.values()].flatMap(doc => {
    const kind = kinds[doc.kind];
    if (!kind) return [];
    const detail = agreement.documents.find(item => item.id === doc.id);
    const estimate = doc.kind === "quotation" && (detail?.payload.price_set === false || detail?.payload.total_cents === "0");
    const history = doc.state === "cancelled" || (doc.kind === "contract" && doc.id !== live?.id && !["signed", "awaiting_signature"].includes(doc.state))
      || (doc.kind === "quotation" && doc.id !== selectedQuote);
    return [{ id: doc.id, title: detail?.payload.text_addendum ? "บันทึกข้อตกลงแนบท้ายสัญญา" : kind.title, group: kind.group, number: doc.number, date: doc.document_date,
      revision: detail?.revision, state: doc.state, status: doc.state === "cancelled" ? states.cancelled : estimate ? "ประมาณราคา · ยังไม่ระบุราคา" : states[doc.state] ?? "ดูสถานะในเอกสาร",
      amount: estimate ? null : detail?.payload.total_cents ?? doc.amount_cents,
      note: detail?.payload.text_addendum ? `อ้างอิงสัญญา ${detail.payload.contract_number ?? "—"}` : doc.kind === "quotation" && doc.id === live?.parent_id ? `ใช้กับสัญญา ${live.number ?? "ร่างที่ยังไม่ออกเลข"}` : "", history }];
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.revision ?? 0) - (a.revision ?? 0) || b.id.localeCompare(a.id));
}
