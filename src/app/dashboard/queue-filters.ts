import type { workQueueKinds } from "@/lib/sales/models";

type Kind = keyof typeof workQueueKinds;

// The four queue cards double as filters (?kind=<key>); both refund kinds sit under one card.
export const QUEUE_FILTERS = [
  { key: "payment", label: "เงินเข้ารอยืนยัน", kinds: ["payment_pending"] },
  { key: "acceptance", label: "รอตรวจรับงาน", kinds: ["acceptance"] },
  { key: "refund", label: "คำขอคืนเงิน", kinds: ["refund_pending", "refund_approved"] },
  { key: "design", label: "ค่าแบบค้าง", kinds: ["design_fee"] },
] as const satisfies readonly { key: string; label: string; kinds: readonly Kind[] }[];

export type QueueFilter = (typeof QUEUE_FILTERS)[number]["key"];
export const queueFilterOf = (value: string) => QUEUE_FILTERS.find(({ key }) => key === value)?.key ?? null;
