"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, type ActionState } from "@/app/walkin/action-form";
import { contractAddendumSchema } from "@/lib/sales/contract-paper";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import { ContractAddendumContent } from "../../documents/[id]/photo-contract-content";
import { EvidenceUpload } from "../../evidence-upload";
import { ContractClauses } from "./contract-party-fields";
import shared from "../../sales.module.css";
import styles from "./contract-paper.module.css";
import { buttonVariants } from "@/components/ui/button";

type Contract = AgreementDetail["documents"][number];
export function ContractAddendumForm({ contract, caseId, action }: {
  contract: Contract; caseId: string; action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }));
  const [clauses, setClauses] = useState<string[]>([]);
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);
  useEffect(() => { if (error) errorMessage.current?.focus(); }, [error]);
  const input = { date, extra_clauses: clauses.map(value => value.trim()).filter(Boolean), conditions: conditions.trim(), notes: notes.trim() };
  const payload = { contract_number: contract.number, contract_paper: contract.payload.contract_paper,
    customer: contract.payload.customer ?? (contract.customer_snapshot ? { full_name: contract.customer_snapshot.full_name, phone: contract.customer_snapshot.phone, site_address: "" } : undefined),
    text_addendum: input };
  return <div className={styles.pages}>
    <p>อ้างอิงสัญญาเลขที่ {contract.number} · ใช้เพิ่มข้อความเท่านั้น หากเปลี่ยนราคาหรือยอดงวด ให้ใช้เมนูแก้ไขสัญญา</p>
    {review ? <>
      <h3 tabIndex={-1} ref={reviewHeading}>ตรวจตัวอย่างก่อนพิมพ์และนำไปลงนาม</h3>
      <div className={styles.printAddendum}><ContractAddendumContent payload={payload} /></div>
      <div className={styles.toolbar}>
        <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => setReview(false)}>กลับไปแก้ข้อความ</button>
        <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => window.print()}>พิมพ์ตัวอย่างสำหรับลงนาม</button>
      </div>
      <ActionForm action={action} label="บันทึกเอกสารแนบท้ายที่ลงนามแล้ว">
        <input type="hidden" name="addendum_input" value={JSON.stringify(input)} />
        <EvidenceUpload caseId={caseId} category="agreement" />
        <label className={shared.check}><input type="checkbox" name="confirmed" required />เอกสารตรงกับตัวอย่างและลงนามเรียบร้อยแล้ว</label>
      </ActionForm>
    </> : <form className={styles.pages} onSubmit={event => {
      event.preventDefault();
      if (!contractAddendumSchema.safeParse(input).success) { setError("เลือกวันที่และกรอกข้อตกลงอย่างน้อยหนึ่งส่วน โดยไม่เกินความยาวที่กำหนด"); return; }
      setError(""); setReview(true);
    }}>
      {error && <p ref={errorMessage} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      <article className={styles.sheet}><h3>บันทึกข้อตกลงแนบท้ายสัญญา</h3>
        <label>วันที่ทำข้อตกลง<input type="date" value={date} required onChange={event => setDate(event.target.value)} /></label>
        <h4>ข้อเพิ่มเติม</h4><ContractClauses clauses={clauses} onChange={setClauses} start={1} />
        <label>เงื่อนไข<textarea maxLength={10000} value={conditions} onChange={event => setConditions(event.target.value)} /></label>
        <label>หมายเหตุ<textarea maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      </article>
      <div className={styles.footer}><p>ยังไม่ออกเลขและไม่เปลี่ยนยอดสัญญา</p><button className={buttonVariants({ size: "auto" })}>ดูตัวอย่างเอกสารแนบท้าย</button></div>
    </form>}
  </div>;
}
