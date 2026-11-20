import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { Lead } from "@/lib/walkin/models";
import { CLOSE_REASON_LABELS, closeReasonsFor } from "@/lib/walkin/lead-stage";
import { ActionForm } from "./action-form";
import { CloseLeadDialog } from "./close-lead-dialog";
import { closeLead, reopenLead } from "./status-actions";
import { formatDate } from "./privacy-controls";
import { formCardClass, formHintClass } from "@/components/form-card";
import { noticeClass } from "@/components/notice";
import { cn } from "@/lib/utils";

type CloseInfo = { text: string | null; by: string | null } | null;
type Blocker = { code: string; href?: string };
const context = (lead: Lead) => ({ id: lead.id, version: lead.version, requestId: randomUUID() });
const bottomSectionClass = cn(formCardClass, "mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4");
const bottomHeadingClass = "m-0 text-md font-bold";

/** Grey band at the top of a closed Lead: reason, who and when. */
export function ClosedBand({ lead, info }: { lead: Lead; info: CloseInfo }) {
  if (!lead.closed_at || !lead.closed_reason) return null;
  return <p role="note" className="m-0 rounded-md border bg-secondary p-3 text-muted-foreground">
    Lead นี้ปิดแล้ว · เหตุผล: {CLOSE_REASON_LABELS[lead.closed_reason]}{info?.text ? ` · ${info.text}` : ""} · โดย {info?.by ?? "เจ้าหน้าที่อื่น"} · {formatDate(lead.closed_at)}
  </p>;
}

/** Bottom section of a closed Lead. One click reopens it; the hidden field is the confirmation the action still requires. */
export function ReopenLead({ lead }: { lead: Lead }) {
  return <section className={bottomSectionClass}>
    <div><h2 className={bottomHeadingClass}>Lead นี้ปิดอยู่</h2><p className={cn(formHintClass, "mb-0")}>เปิดกลับได้ทันที · ข้อมูลและประวัติยังอยู่ครบ</p></div>
    <ActionForm action={reopenLead.bind(null, context(lead))} label="เปิด Lead อีกครั้ง" inline>
      <input type="hidden" name="confirm_operation" value="on" />
    </ActionForm>
  </section>;
}

/** Bottom section of an open Lead. An active Project blocks closing, so it says why and where to go (ADR 0008). */
export function CloseLead({ lead, blockers, openWorkCount }: { lead: Lead; blockers: Blocker[]; openWorkCount: number }) {
  return <section className={bottomSectionClass}>
    <div><h2 className={bottomHeadingClass}>ปิด Lead</h2>
      <p className={cn(formHintClass, "mb-0")}>ย้ายไปแท็บ “ปิด” เมื่อลูกค้าไม่ไปต่อ · ข้อมูลไม่ถูกลบ เปิดกลับได้ภายหลัง</p></div>
    {!blockers.length && <CloseLeadDialog action={closeLead.bind(null, context(lead))} name={`${lead.first_name} ${lead.last_name}`}
      openWorkCount={openWorkCount} reasons={closeReasonsFor(lead.brand).map(code => ({ code, label: CLOSE_REASON_LABELS[code] }))} />}
    {blockers.length > 0 && <div className={`${noticeClass} basis-full`} role="note"><strong>ยังปิด Lead นี้ไม่ได้</strong>
      <p className="m-0 mt-1 text-sm">มีโครงการที่ยังดำเนินการอยู่ ต้องยกเลิกโครงการก่อน (ผู้บริหารเป็นผู้ยกเลิก)</p>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-3 p-0">{blockers.map(({ code, href }) => <li key={code}>
        {href ? <Link href={href} prefetch={false} className="font-bold underline underline-offset-4">ไปที่โครงการ {code}</Link> : <strong>{code}</strong>}</li>)}</ul>
    </div>}
  </section>;
}
