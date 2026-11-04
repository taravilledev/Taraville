import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { documentSchema, savedDocumentSchema, paymentKinds, paymentMethods } from "@/lib/sales/financial-models";
import { scheduleRowSchema } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { PrintButton } from "@/app/leads/report/print-button";
import styles from "./document.module.css";

export const metadata = { title: "เอกสารการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
export default function DocumentPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Document {...props} /></Suspense>; }
async function Document({ params }: Props) {
  const { id } = await params; const { supabase } = await requireStaff();
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await supabase.rpc("sales_document_detail", { p_document_id: id });
  if (result.error?.code === "42501") notFound();
  if (result.error) throw new Error("โหลดเอกสารไม่ได้ กรุณาลองใหม่");
  const doc = savedDocumentSchema.parse(result.data); const issuer = doc.issuer_snapshot;
  const receipt = doc.kind === "receipt" ? documentSchema.parse(result.data).payload : null;
  if (!["receipt", "quotation", "contract", "invoice", "refund", "amendment", "closeout", "summary"].includes(doc.kind)) notFound();
  const isSynthetic = z.boolean().parse(doc.payload.is_synthetic);
  const agreement = ["quotation", "contract"].includes(doc.kind) ? z.object({ description: z.string(), total_cents: z.string().regex(/^\d+$/),
    contract_text: z.string().optional(), credit_cents: z.string().regex(/^\d+$/).optional(), schedule: scheduleRowSchema.array().optional() }).parse(doc.payload) : null;
  const invoice = doc.kind === "invoice" ? z.object({ label: z.string(), gross_cents: z.string().regex(/^\d+$/), credit_cents: z.string().regex(/^\d+$/),
    net_cents: z.string().regex(/^\d+$/), due_date: z.string(), credit_settled: z.boolean() }).parse(doc.payload) : null;
  const refund = doc.kind === "refund" ? z.object({ amount_cents: z.string().regex(/^\d+$/), reason: z.string(),
    method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.string() }).parse(doc.payload) : null;
  const adjustment = ["amendment", "closeout"].includes(doc.kind) ? z.object({
    reason: z.string(), agreement_text: z.string(), total_cents: z.string().optional(),
    contract_number: z.string().optional(), development: z.string().optional(), plot: z.string().optional(),
    retained_cents: z.string().optional(), received_cents: z.string().optional(),
    remaining_cents: z.string().optional(), refund_due_cents: z.string().optional(),
  }).parse(doc.payload) : null;
  const summary = doc.kind === "summary" ? z.object({
    development: z.string(), plot: z.string(), total_cents: z.string(), booking_cents: z.string().nullish(),
    contract_cents: z.string().nullish(), down_cents: z.string().nullish(), balance_cents: z.string(), conditions: z.string(), freebies: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
    list_cents: z.string().nullish(), promotion_cents: z.string().nullish(), discount_cents: z.string().nullish(),
    mortgage_cents: z.string().nullish(), booking_date: z.string().nullish(), contract_date: z.string().nullish(), down_date: z.string().nullish(),
  }).parse(doc.payload) : null;
  const title = summary ? "สรุปการจอง" : doc.kind === "amendment" ? "ข้อตกลงแก้ไขสัญญา" : doc.kind === "closeout" ? "ข้อตกลงปิดงาน"
    : receipt ? "ใบเสร็จรับเงิน" : refund ? "เอกสารจ่ายคืนเงิน" : doc.kind === "quotation" ? "ใบเสนอราคา" : doc.kind === "contract" ? (issuer.brand === "TARAVILLE" ? "สัญญาขาย" : "สัญญาก่อสร้าง") : invoice?.credit_settled ? "สรุปชำระด้วยเครดิตเดิม" : "ใบแจ้งชำระ";
  return <main className={styles.page}>
    <nav className={styles.controls}><Link href={`/sales/${doc.case_id}`} prefetch={false}>กลับงาน/รายการขาย</Link><PrintButton /></nav>
    <article className={summary ? `${styles.paper} ${styles.summary}` : styles.paper}>
      {isSynthetic && <p className={styles.watermark}>ข้อมูลทดสอบ · ไม่ใช่เอกสารธุรกรรมจริง</p>}
      {doc.state === "cancelled" && <p className={styles.watermark}>ยกเลิกเอกสาร · {doc.cancel_reason}</p>}
      {doc.state === "awaiting_signature" && <p className={styles.watermark}>รอลงนาม · ยังไม่เป็นสัญญาที่ลงนามแล้ว</p>}
      <div className={styles.header}><div><h1>{issuer.legal_name}</h1><p>{issuer.address}</p>{issuer.tax_id && <p>เลขประจำตัวผู้เสียภาษี {issuer.tax_id}</p>}<p>{issuer.contact}</p></div>
        <div><h2>{title}</h2><p>เลขที่ {doc.number}</p><p>วันที่ {doc.document_date}</p></div></div>
      <section className={styles.customer}><p><strong>ลูกค้า</strong> {doc.customer_snapshot.full_name}</p><p><strong>ที่อยู่</strong> {doc.customer_snapshot.address || "—"}</p>
        <p><strong>โทรศัพท์</strong> {doc.customer_snapshot.phone || "—"}</p>{receipt && <p><strong>ผู้ชำระ</strong> {receipt.payer_name}</p>}</section>
      {receipt && <>{receipt.replaces_number && <p>ออกแทนใบเสร็จเลขที่ {receipt.replaces_number}{receipt.replacement_reason ? ` · ${receipt.replacement_reason}` : ""}</p>}
        <table className={styles.table}><thead><tr><th>รายการ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody><tr><td>{paymentKinds[receipt.kind]}<br />{receipt.description}</td><td>{formatMoney(receipt.amount_cents)}</td></tr></tbody>
        <tfoot><tr><th>รวมรับชำระ</th><td>{formatMoney(receipt.amount_cents)}</td></tr></tfoot></table>
        <p>รับเงินโดย {paymentMethods[receipt.method]} · วันที่รับเงินจริง {receipt.paid_date}</p>
        <div className={styles.signatures}><div><p>ผู้ชำระเงิน</p><p>________________________</p><p>{receipt.payer_name}</p></div><div><p>ผู้รับเงิน / ผู้ออกเอกสาร</p><p>________________________</p><p>{receipt.confirmed_by_name}</p></div></div></>}
      {agreement && <><p className={styles.content}>{agreement.description}</p><p><strong>ราคารวม {formatMoney(agreement.total_cents)} บาท</strong></p>
        {agreement.schedule && <><p>เงินที่รับไว้และนำมาเป็นเครดิต {formatMoney(agreement.credit_cents ?? "0")} บาท</p><table className={styles.table}><thead><tr><th>งวด</th><th>ยอดเต็ม</th><th>เครดิตเดิม</th><th>สุทธิ (บาท)</th></tr></thead>
          <tbody>{agreement.schedule.map(row => <tr key={row.position}><td>{row.label}{row.progress_percent != null ? ` (${row.progress_percent}%)` : ""}</td><td>{formatMoney(row.gross_cents)}</td><td>{formatMoney(row.credit_cents)}</td><td>{formatMoney(row.net_cents)}</td></tr>)}</tbody></table></>}
        {agreement.contract_text && <p className={styles.content}>{agreement.contract_text}</p>}
        <div className={styles.signatures}><div><p>{issuer.brand === "TARAVILLE" ? "ผู้ซื้อ" : "ผู้ว่าจ้าง / ลูกค้า"}</p><p>________________________</p><p>{doc.customer_snapshot.full_name}</p></div><div><p>{issuer.brand === "TARAVILLE" ? "ผู้ขาย" : "ผู้รับจ้าง / บริษัท"}</p><p>________________________</p><p>{issuer.legal_name}</p></div></div>
      </>}
      {invoice && <><table className={styles.table}><thead><tr><th>รายการ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody><tr><td>{invoice.label}</td><td>{formatMoney(invoice.gross_cents)}</td></tr><tr><td>หักเครดิตจากเงินที่รับไว้</td><td>{formatMoney(invoice.credit_cents)}</td></tr></tbody>
        <tfoot><tr><th>ยอดต้องชำระตามเอกสาร</th><td>{formatMoney(invoice.net_cents)}</td></tr></tfoot></table><p>ครบกำหนด {invoice.due_date}</p>
        {invoice.credit_settled && doc.adjustments.length === 0 && <p>งวดนี้ชำระครบด้วยเครดิตเงินเดิม ไม่มีการรับเงินใหม่หรือออกใบเสร็จใหม่</p>}
      </>}
      {invoice && doc.adjustments.length > 0 && <section>
        <h3>การปรับยอดตามข้อตกลงภายหลัง</h3>
        <ul>{doc.adjustments.map(item => <li key={item.document_id}>
          <Link href={`/sales/documents/${item.document_id}`} prefetch={false}>{item.number}</Link>
          {" · "}{item.amount_cents.startsWith("-") ? "ลดยอด " : "เพิ่มยอด "}{formatMoney(item.amount_cents.replace(/^-/, ""))} บาท
        </li>)}</ul>
        <p>ยอดสุทธิหลังปรับ {formatMoney(doc.adjustments.reduce((total, item) => total + BigInt(item.amount_cents), BigInt(invoice.net_cents)).toString())} บาท</p>
      </section>}
      {refund && <><p className={styles.content}>{refund.reason}</p><p><strong>จ่ายคืน {formatMoney(refund.amount_cents)} บาท</strong></p><p>วันที่จ่ายคืน {refund.paid_date} · {paymentMethods[refund.method]}</p><p>อ้างอิงการรับเงินและการอนุมัติคืนเงินที่บันทึกไว้ในระบบ</p></>}
      {adjustment && <>
        {adjustment.contract_number && <p>อ้างอิงสัญญา {adjustment.contract_number} · โครงการ {adjustment.development} · แปลงใหม่ {adjustment.plot}</p>}
        <p className={styles.content}>{adjustment.reason}</p><p className={styles.content}>{adjustment.agreement_text}</p>
        {adjustment.total_cents && <p>ยอดสัญญาหลังแก้ไข {formatMoney(adjustment.total_cents)} บาท</p>}
        {adjustment.retained_cents && <p>ยอดตามข้อตกลงปิดงาน {formatMoney(adjustment.retained_cents)} บาท</p>}
        {adjustment.received_cents && <p>รับสุทธิ ณ วันปิดงาน {formatMoney(adjustment.received_cents)} บาท</p>}
        {adjustment.remaining_cents && <p>ยอดคงต้องรับ ณ วันปิดงาน {formatMoney(adjustment.remaining_cents)} บาท</p>}
        {adjustment.refund_due_cents && <p>ยอดคงต้องคืน ณ วันปิดงาน {formatMoney(adjustment.refund_due_cents)} บาท</p>}
      </>}
      {summary && <>
        <p>โครงการ {summary.development} · แปลง {summary.plot}</p>
        <p>ชื่อเล่น {doc.customer_snapshot.nickname || "—"} · ฝ่ายขาย {doc.customer_snapshot.salesperson || "—"}</p>
        <table className={styles.table}><tbody>{[
          ["แบบบ้าน", "model"], ["จำนวนชั้น", "stories"], ["ห้องนอน", "bedrooms"], ["ห้องน้ำ", "bathrooms"],
          ["พื้นที่ใช้สอย (ตร.ม.)", "usable_area"], ["เนื้อที่ดิน (ตร.ว.)", "land_area"],
        ].map(([label, key]) => {
          const value = summary.details[key];
          return <tr key={key}><th>{label}</th><td>{typeof value === "number" || (typeof value === "string" && value) ? value : "—"}</td></tr>;
        })}</tbody></table>
        <table className={styles.table}><tbody>{[
          ["ราคาขาย", summary.list_cents], ["ราคาโปรโมชั่น", summary.promotion_cents], ["ส่วนลด", summary.discount_cents],
          ["ราคาสุทธิ", summary.total_cents], ["จอง", summary.booking_cents], ["วันทำสัญญา", summary.contract_cents],
          ["ดาวน์รวม", summary.down_cents], ["ยอดคงเหลือ", summary.balance_cents], ["ยอดยื่นกู้", summary.mortgage_cents],
        ].map(([label, value]) => <tr key={label}><th>{label}</th><td>{value == null ? "—" : `${formatMoney(value)} บาท`}</td></tr>)}</tbody></table>
        <p>วันนัดจอง {summary.booking_date || "—"} · วันนัดทำสัญญา {summary.contract_date || "—"} · วันนัดดาวน์งวดแรก {summary.down_date || "—"}</p>
        <p className={styles.content}>เงื่อนไข {summary.conditions || "—"}</p>
        <p className={styles.content}>ของแถม {summary.freebies || "—"}</p>
      </>}
    </article>
  </main>;
}
