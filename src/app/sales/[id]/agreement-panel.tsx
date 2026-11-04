import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SalesCase } from "@/lib/sales/models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import { ActionForm } from "@/app/walkin/action-form";
import { acceptQuotation, issueInvoice, issueQuotation, prepareContract, signContract } from "../agreement-actions";
import { AcceptanceForm } from "./acceptance-form";
import { preparePayment } from "../money-actions";
import { EvidenceUpload } from "../evidence-upload";
import { ScheduleFields } from "./schedule-fields";
import styles from "../sales.module.css";

type Props = { sale: SalesCase; agreement: AgreementDetail };
const identityOf = (sale: SalesCase) => (id = sale.id) => ({ id, version: sale.version, requestId: randomUUID() });
const isPreContract = (sale: SalesCase) => ["draft", "reserved"].includes(sale.status);

export function QuotationPanel({ sale, agreement }: Props) {
  const identity = identityOf(sale);
  const preContract = isPreContract(sale);
  const canPrepare = sale.permissions["financial.prepare"];
  const accepted = agreement.documents.filter(doc => doc.kind === "quotation" && doc.state === "accepted");
  if (sale.brand !== "BAAN_KUNAPAP") return null;
  return <>
    <section className={styles.panel} id="contract"><h2>ใบเสนอราคาและสัญญาก่อสร้าง</h2>
      {canPrepare && preContract && <details><summary>ออกใบเสนอราคาฉบับใหม่</summary><ActionForm action={issueQuotation.bind(null, identity())} label="ออกใบเสนอราคา">
        <label className={styles.field}>รายละเอียดขอบเขตงาน<textarea name="description" required maxLength={10000} /></label>
        <p className={styles.muted}>ใช้ราคาสุทธิและข้อมูลการขายที่บันทึกไว้ในขณะออกเอกสาร</p>
      </ActionForm></details>}
      {agreement.documents.map(doc => <details key={doc.id}><summary>{doc.kind === "quotation" ? "ใบเสนอราคา" : "สัญญา"} {doc.number} · {({ offered: "รอลูกค้ายอมรับ", accepted: "ลูกค้ายอมรับแล้ว", awaiting_signature: "รอลงนาม", signed: "ลงนามแล้ว" } as Record<string, string>)[doc.state] ?? doc.state}</summary>
        <p><Link href={`/sales/documents/${doc.id}`} prefetch={false}>เปิด / พิมพ์เอกสาร</Link></p>
        {canPrepare && preContract && doc.kind === "quotation" && doc.state === "offered" && <ActionForm action={acceptQuotation.bind(null, identity(doc.id))} label="บันทึกลูกค้ายอมรับใบเสนอราคาฉบับนี้">
          <EvidenceUpload caseId={sale.id} category="agreement" /><label className={styles.check}><input type="checkbox" name="confirmed" required />มีหลักฐานว่าลูกค้ายอมรับฉบับนี้แล้ว</label>
        </ActionForm>}
        {sale.permissions["contract.sign"] && preContract && doc.kind === "contract" && doc.state === "awaiting_signature" && <ActionForm action={signContract.bind(null, identity(doc.id))} label="บันทึกลงนามสัญญาฉบับนี้">
          <EvidenceUpload caseId={sale.id} category="agreement" /><label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบสัญญาลงนามและตารางชำระฉบับนี้แล้ว</label>
        </ActionForm>}
      </details>)}
      {canPrepare && preContract && accepted.length > 0 && <details><summary>เตรียมสัญญาจากใบเสนอราคาที่ลูกค้ายอมรับ</summary><ActionForm action={prepareContract.bind(null, identity())} label="เตรียมสัญญาสำหรับลงนาม">
        <label className={styles.field}>ใบเสนอราคาที่ตกลงใช้<select name="quotation_id" required defaultValue=""><option value="" disabled>เลือกฉบับที่ตกลงกับลูกค้า</option>{accepted.map(doc => <option key={doc.id} value={doc.id}>{doc.number} · {doc.payload.total_cents ? `${formatMoney(doc.payload.total_cents)} บาท` : ""}</option>)}</select></label>
        <ScheduleFields />
      </ActionForm></details>}
    </section>
  </>;
}

export function SchedulePanel({ sale, agreement }: Props) {
  const identity = identityOf(sale);
  const canPrepare = sale.permissions["financial.prepare"];
  const rows = agreement.instalments.filter(row => row.is_active);
  const current = rows.find(row => row.balance?.outstanding_cents !== "0");
  if (!rows.length) return null;
  return <>
    <section className={styles.panel} id="schedule"><h2>งวดชำระตามสัญญา</h2>
      {rows.map(row => <details key={row.id} open={row.id === current?.id}><summary>{row.label} · สุทธิ {formatMoney(row.net_cents)} บาท{row.balance ? row.balance.outstanding_cents === "0" ? " · ครบยอดแล้ว" : ` · ค้าง ${formatMoney(row.balance.outstanding_cents)} บาท` : ""}</summary>
        <p>ยอดงวด {formatMoney(row.gross_cents)} · หักเงินที่รับไว้ {formatMoney(row.credit_cents)} · สุทธิ {formatMoney(row.net_cents)} บาท</p>
        <p className={styles.muted}>{row.needs_acceptance ? row.accepted_at ? "บันทึกตรวจรับและลูกค้ายอมรับแล้ว" : "รอตรวจรับงานและหลักฐานลูกค้ายอมรับ" : "เงินมัดจำวันเซ็น ไม่ต้องตรวจรับงานก่อสร้าง"}</p>
        {sale.status === "contracted" && row.needs_acceptance && !row.accepted_at && sale.permissions["acceptance.record"] && <AcceptanceForm caseId={sale.id} identity={identity(row.id)} />}
        {sale.status === "contracted" && !row.invoice_id && (!row.needs_acceptance || row.accepted_at) && sale.permissions["billing.issue"] && <ActionForm action={issueInvoice.bind(null, identity(row.id))} label={row.net_cents === "0" ? "บันทึกงวดที่ชำระครบด้วยเครดิตเดิม" : "ออกใบแจ้งชำระ"}>
          <label className={styles.field}>วันครบกำหนด<input type="date" name="due_date" required /></label>
          {row.net_cents === "0" && <p className={styles.muted}>ไม่รับเงินใหม่และไม่ออกใบเสร็จซ้ำ</p>}
        </ActionForm>}
        {row.invoice_document_id && <p><Link href={`/sales/documents/${row.invoice_document_id}`} prefetch={false}>เปิดใบแจ้งชำระ / สรุปเครดิต</Link></p>}
        {row.balance && <p>รับจัดสรรแล้ว {formatMoney(row.balance.allocated_cents)} · คงเหลือ {formatMoney(row.balance.outstanding_cents)} บาท</p>}
        {row.balance?.is_active && row.balance.outstanding_cents !== "0" && canPrepare && <ActionForm action={preparePayment.bind(null, identity())} label="บันทึกเงินเข้างวดนี้ (รอยืนยัน)">
          <input type="hidden" name="kind" value="instalment" /><input type="hidden" name="invoice_id" value={row.invoice_id ?? ""} />
          <div className={styles.grid}><label className={styles.field}>จำนวนเงินรับ (บาท)<input name="amount" inputMode="decimal" required defaultValue={formatMoney(row.balance.outstanding_cents).replaceAll(",", "")} /></label>
            <label className={styles.field}>วันที่ได้รับเงินจริง<input name="paid_date" type="date" required /></label>
            <label className={styles.field}>วิธีรับเงิน<select name="method"><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option><option value="cheque">เช็คที่เรียกเก็บแล้ว</option></select></label>
            <label className={styles.field}>ชื่อผู้ชำระ<input name="payer_name" required maxLength={300} defaultValue={sale.customer_name} /></label>
            <label className={styles.field}>รายละเอียดในใบเสร็จ<input name="description" required maxLength={1000} defaultValue={row.label} /></label><EvidenceUpload caseId={sale.id} />
          </div>
        </ActionForm>}
      </details>)}
    </section>
  </>;
}
