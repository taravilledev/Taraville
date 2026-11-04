import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SalesCase } from "@/lib/sales/models";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import { paymentKinds, paymentMethods } from "@/lib/sales/financial-models";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { ActionForm } from "@/app/walkin/action-form";
import { confirmPayment, correctPayment, correctReceipt, preparePayment, saveDesign, withdrawPayment } from "../money-actions";
import { EvidenceUpload } from "../evidence-upload";
import styles from "../sales.module.css";

type Props = { sale: SalesCase; finance: FinancialDetail };
const identityOf = (sale: SalesCase, finance: FinancialDetail) => () => ({ id: sale.id, version: finance.version, requestId: randomUUID() });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function DesignPanel({ sale, finance }: Props) {
  const identity = identityOf(sale, finance);
  const plan = finance.design_plan;
  const canPrepare = sale.permissions["financial.prepare"];
  if (sale.brand !== "BAAN_KUNAPAP") return null;
  return <>
    <section className={styles.panel} id="design"><h2>ข้อตกลงค่าออกแบบ</h2>
      {plan && <><p>รวม {formatMoney(plan.total_cents)} บาท · {plan.usable_area ? `${plan.usable_area} ตร.ม.` : "เลือกตามช่วงพื้นที่"}</p><p className={styles.muted}>{plan.instalments.map((amount, index) => `งวด ${index + 1}: ${formatMoney(amount)} บาท`).join(" · ")}</p></>}
      {canPrepare && finance.can_change_design && <details open={!plan}><summary>{plan ? "แก้ข้อตกลงค่าออกแบบ" : "กำหนดค่าออกแบบ"}</summary>
        <ActionForm action={saveDesign.bind(null, identity())} label="บันทึกค่าออกแบบ"><div className={styles.grid}>
          <label className={styles.field}>พื้นที่ใช้สอยจริง (ตร.ม.)<input name="usable_area" inputMode="decimal" defaultValue={plan?.usable_area ?? String(sale.details?.usable_area ?? "")} /><small className={styles.muted}>ถ้ากรอกพื้นที่ ระบบใช้พื้นที่จริงเลือกช่วงราคา</small></label>
          <label className={styles.field}>ช่วงพื้นที่เมื่อยังไม่ทราบขนาด<select name="tier" defaultValue={plan?.tier ?? "under150"}><option value="under150">น้อยกว่า 150 · 12,000 บาท</option><option value="under200">150–น้อยกว่า 200 · 25,000 บาท</option><option value="under250">200–น้อยกว่า 250 · 30,000 บาท</option><option value="upto300">250–300 · 40,000 บาท</option><option value="custom">มากกว่า 300 / กำหนดเอง</option></select></label>
          <label className={`${styles.check} ${styles.full}`}><input type="checkbox" name="custom" />กำหนดยอด 3 งวดเอง (ต้องกรอกเมื่อพื้นที่มากกว่า 300)</label>
          {[1, 2, 3].map((index) => <label className={styles.field} key={index}>ค่าออกแบบงวด {index} (บาท)<input name={`instalment_${index}`} inputMode="decimal" defaultValue={plan ? formatMoney(plan.instalments[index - 1]).replaceAll(",", "") : ""} /></label>)}
          <label className={`${styles.field} ${styles.full}`}>หมายเหตุ<textarea name="note" maxLength={3000} defaultValue={plan?.note} /></label>
        </div></ActionForm>
      </details>}
    </section>
  </>;
}

export function PreparePayment({ sale, finance }: Props) {
  const identity = identityOf(sale, finance);
  const plan = finance.design_plan;
  const max = today();
  if (!sale.permissions["financial.prepare"]) return null;
  return <>
    <section className={styles.panel} id="prepare"><h2>บันทึกเงินเข้า (รอยืนยัน)</h2><p className={styles.muted}>ขั้นนี้ยังไม่ลงยอดรับเงินจริง ผู้มีสิทธิ์ต้องตรวจและยืนยันพร้อมออกใบเสร็จอีกครั้ง</p>
      {sale.brand === "TARAVILLE" && sale.status === "reserved" && <p className={styles.muted}>ก่อนเตรียมรับเงินจอง ให้บันทึกยอดจองในสรุปการจองของแปลงและราคาปัจจุบัน</p>}
      <ActionForm action={preparePayment.bind(null, identity())} label="บันทึกเงินเข้า"><div className={styles.grid}>
        <label className={styles.field}>รายการ<select name="kind" defaultValue={sale.brand === "BAAN_KUNAPAP" && plan ? "design_fee" : "unallocated"}>
          {sale.brand === "BAAN_KUNAPAP" && plan && <option value="design_fee">ค่าออกแบบ</option>}
          {sale.brand === "TARAVILLE" && sale.status === "reserved" && <option value="booking">เงินจอง</option>}
          <option value="unallocated">เงินเข้าที่ยังไม่ระบุงวด</option></select></label>
        <label className={styles.field}>จำนวนเงิน (บาท)<input name="amount" inputMode="decimal" required /></label>
        <label className={styles.field}>วิธีรับเงิน<select name="method"><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option><option value="cheque">เช็คที่เรียกเก็บแล้ว</option></select></label>
        <label className={styles.field}>วันที่ได้รับเงินจริง<input type="date" name="paid_date" required defaultValue={max} max={max} /></label>
        <label className={styles.field}>ชื่อผู้ชำระ<input name="payer_name" required maxLength={300} defaultValue={sale.customer_name} /></label>
        <label className={styles.field}>รายละเอียดในใบเสร็จ<input name="description" required maxLength={1000} /></label>
        <EvidenceUpload caseId={sale.id} /><input type="hidden" name="invoice_id" value="" />
      </div><p className={styles.muted}>โอนเงินและเช็คต้องแนบหลักฐาน และตรวจว่าเงินเข้าจริงแล้วก่อนยืนยัน</p></ActionForm>
    </section>
  </>;
}

export function PendingPayments({ sale, finance }: Props) {
  if (!finance.pending.length) return null;
  return <>
    <section className={styles.panel} id="pending"><h2>เงินเข้ารอยืนยัน ({finance.pending.length})</h2>
            {finance.pending.map(payment => <div key={payment.id} className={styles.capability}>
        {sale.permissions["financial.prepare"] && <details><summary>ถอนรายการที่เตรียมไว้</summary>
          <ActionForm action={withdrawPayment.bind(null, { id: payment.id, version: finance.version, requestId: randomUUID() })} label="ถอนรายการรับเงิน">
            <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
            <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันถอนรายการนี้จากคิวรอตรวจ</label>
          </ActionForm>
        </details>}
        <p><strong>{paymentKinds[payment.kind]} · {formatMoney(payment.amount_cents)} บาท</strong></p>
        <p>{paymentMethods[payment.method]} · {formatDate(payment.paid_date)} · {payment.payer_name}</p><p>{payment.description}</p>
        {payment.proof_path && <Link href={`/sales/${sale.id}/evidence?path=${encodeURIComponent(payment.proof_path)}`} target="_blank" prefetch={false}>เปิดหลักฐาน</Link>}
        {sale.permissions["financial.confirm"] && sale.permissions["receipt.issue"] && finance.issuer_ready && <ActionForm action={confirmPayment.bind(null, { id: payment.id, version: finance.version, requestId: randomUUID() })} label="ยืนยันรับเงินจริงและออกใบเสร็จ">
          <label className={styles.check}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบแล้วว่าได้รับเงินจริงตามยอดและวิธีข้างต้น</label>
        </ActionForm>}
      </div>)}
    </section>
  </>;
}

export function Receipts({ sale, finance }: Props) {
  return <>
    <section className={styles.panel}><h2>ใบเสร็จรับเงิน</h2>{!finance.documents.some(doc => doc.kind === "receipt") && <p className={styles.muted}>ยังไม่มีใบเสร็จ</p>}
      <ul className={styles.list}>{finance.documents.filter(doc => doc.kind === "receipt").map(doc => <li key={doc.id}>
        <Link href={`/sales/documents/${doc.id}`} prefetch={false}>{doc.number} · {formatDate(doc.document_date)} · {doc.amount_cents ? `${formatMoney(doc.amount_cents)} บาท` : "—"}{doc.state === "cancelled" ? " · ยกเลิก" : ""}</Link>
        {sale.permissions["receipt.cancel"] && (doc.state === "issued" || sale.permissions["receipt.issue"]) && <details className={styles.menu}><summary>แก้ไขใบเสร็จ</summary>
        {sale.permissions["receipt.cancel"] && (doc.state === "issued" || sale.permissions["receipt.issue"]) && <details>
          <summary>ยกเลิกหรือออกเอกสารทดแทน</summary>
          <ActionForm action={correctReceipt.bind(null, { id: doc.id, version: sale.version, requestId: randomUUID() })} label="บันทึกการแก้ไขใบเสร็จ">
            <p>ยอดรับเงินจริงและยอดจัดสรรจะคงเดิม</p>
            <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
            {sale.permissions["receipt.issue"] && <label className={styles.field}>รายละเอียดในใบเสร็จทดแทน
              <textarea name="description" maxLength={1000} required={doc.state === "cancelled"} />
              {doc.state === "issued" && <small>เว้นว่างเพื่อยกเลิกใบเสร็จอย่างเดียว</small>}
            </label>}
            <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันการแก้ไขเอกสารฉบับนี้</label>
          </ActionForm>
        </details>}
        {doc.state === "issued" && ["financial.prepare", "financial.confirm", "receipt.cancel", "receipt.issue"].every(key => sale.permissions[key]) && <details>
          <summary>แก้ยอดรับเงินจริงที่บันทึกผิด</summary>
          <ActionForm action={correctPayment.bind(null, { id: doc.id, version: sale.version, requestId: randomUUID() })} label="ยืนยันยอดรับจริงที่ถูกต้อง">
            <label className={styles.field}>ยอดที่รับจริง (บาท)<input name="amount" inputMode="decimal" required /></label>
            <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
            <EvidenceUpload caseId={sale.id} category="payment" />
            <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบหลักฐานยอดรับจริงแล้ว รายการนี้เป็นการแก้บันทึก</label>
          </ActionForm>
        </details>}
        </details>}
      </li>)}</ul>
    </section>
  </>;
}
