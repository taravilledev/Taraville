"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ActionForm, type ActionState } from "@/app/walkin/action-form";
import { formatMoney, parseMoney } from "@/lib/sales/money";
import { paymentMethods } from "@/lib/sales/financial-models";
import { formatDate } from "@/lib/sales/date";
import { EvidenceUpload } from "../../evidence-upload";
import { ReceiptPaper } from "../../documents/[id]/receipt-paper";
import { checkRowClass } from "@/components/check-row";
import styles from "./payment-paper.module.css";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;
type Method = keyof typeof paymentMethods;
export type PaymentPaperPreviewProps = {
  mode: "invoice" | "receipt"; brand?: "BAAN_KUNAPAP" | "TARAVILLE"; customerName: string; customerAddress?: string; label: string; amountCents: string;
  date?: string; method?: Method; payerName?: string; description?: string; grossCents?: string; creditCents?: string;
  acceptanceDate?: string; customerPhone?: string; salesperson?: string; receiptKind?: string;
};
type Props = PaymentPaperPreviewProps & {
  action: Action; caseId: string; finalLabel: string; hiddenFields?: Record<string, string>;
  amountEditable?: boolean; kindOptions?: { value: string; label: string }[]; initialKind?: string;
  fixedDueDate?: string;
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const displayDate = (value?: string) => value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${value}T00:00:00+07:00`)) : "ยังไม่ระบุ";

function Letterhead({ mode, brand = "BAAN_KUNAPAP" }: { mode: Props["mode"]; brand?: Props["brand"] }) {
  return <header className={styles.letterhead}>{brand === "BAAN_KUNAPAP" ? <Image src="/brand/baan-kunapap-logo.jpg" alt="บ้านคุณภาพ" width={80} height={61} /> : <strong>ธาราวิลล์</strong>}
    <h3>{mode === "invoice" ? "ใบแจ้งชำระ" : "ใบเสร็จรับเงิน"}</h3><p>ตัวอย่าง · ยังไม่ออกเลขเอกสาร</p></header>;
}
export function PaymentPaperPreview({ mode, brand, customerName, customerAddress, customerPhone, salesperson, label, amountCents, date, method, payerName, description, grossCents, creditCents, acceptanceDate, receiptKind }: PaymentPaperPreviewProps) {
  if (brand !== "TARAVILLE") return <ReceiptPaper isPreview
    notice={mode === "invoice" ? "ตัวอย่างใบแจ้งชำระ · ยังไม่ออกเลข · ยังไม่เรียกเก็บ" : "ตัวอย่างใบเสร็จ · ยังไม่ออกเลข · ยังไม่ยืนยันรับเงินจริง"}
    customer={{ full_name: customerName, address: customerAddress, phone: customerPhone, salesperson }}
    label={label} description={description} amountCents={amountCents}
    paidDate={mode === "receipt" ? date : undefined} method={mode === "receipt" ? method : undefined} payerName={mode === "receipt" ? payerName : undefined}
    invoice={mode === "invoice" ? { dueDate: date, grossCents: grossCents ?? amountCents, creditCents, acceptanceDate,
      isCreditSettled: amountCents === "0" && !!creditCents && creditCents !== "0" } : undefined}
    isInstalment={mode === "invoice" || receiptKind === "instalment" || receiptKind === "design_fee"} />;
  return <article className={styles.paper} aria-label={mode === "invoice" ? "ตัวอย่างใบแจ้งชำระ" : "ตัวอย่างใบเสร็จ"}>
    <p className={styles.notice}>{mode === "invoice" ? "ตัวอย่างใบแจ้งชำระ · ยังไม่ออกเลข · ยังไม่เรียกเก็บ" : "ตัวอย่างใบเสร็จ · ยังไม่ออกเลข · ยังไม่ยืนยันรับเงินจริง"}</p>
    <Letterhead mode={mode} brand={brand} />
    <dl className={styles.facts}><div><dt>ลูกค้า</dt><dd>{customerName}</dd></div>{customerAddress && <div><dt>ที่อยู่</dt><dd>{customerAddress}</dd></div>}
      <div><dt>{mode === "invoice" ? "วันครบกำหนดชำระ" : "วันที่ได้รับเงินจริง"}</dt><dd>{displayDate(date)}</dd></div>
      {mode === "invoice" && acceptanceDate && <div><dt>วันที่ตรวจรับจริง · ชำระภายใน 30 วัน</dt><dd>{displayDate(acceptanceDate)}</dd></div>}
      {mode === "receipt" && <><div><dt>ผู้ชำระ</dt><dd>{payerName}</dd></div><div><dt>วิธีรับเงิน</dt><dd>{method ? paymentMethods[method] : "ยังไม่ระบุ"}</dd></div></>}
    </dl>
    <table className={styles.table}><thead><tr><th scope="col">รายการ</th><th scope="col">จำนวนเงิน (บาท)</th></tr></thead>
      <tbody><tr><td>{description || label}</td><td>{formatMoney(grossCents ?? amountCents)}</td></tr>
        {creditCents && creditCents !== "0" && <tr><td>หักเครดิตเงินที่รับไว้แล้ว</td><td>{formatMoney(creditCents)}</td></tr>}</tbody>
      <tfoot><tr><th scope="row">{mode === "invoice" ? "ยอดเรียกเก็บ" : "ยอดรับที่รอยืนยัน"}</th><td>{formatMoney(amountCents)}</td></tr></tfoot>
    </table>
    <p className={styles.note}>{mode === "invoice" ? "การออกใบแจ้งชำระยังไม่ใช่การรับเงิน และยังไม่ออกใบเสร็จ" : "ส่งรายการให้ผู้มีสิทธิ์ตรวจสอบก่อน ยอดนี้จะนับเป็นเงินรับจริงและออกใบเสร็จเมื่อยืนยันแล้วเท่านั้น"}</p>
  </article>;
}

export function PaymentPaper({ mode, brand, action, caseId, customerName, customerAddress, customerPhone, salesperson, label, amountCents, finalLabel,
  grossCents, creditCents, hiddenFields = {}, amountEditable = false, kindOptions, initialKind = "unallocated", description: initialDescription = label,
  fixedDueDate, acceptanceDate }: Props) {
  const [isReview, setIsReview] = useState(false);
  const [date, setDate] = useState(mode === "invoice" ? fixedDueDate ?? "" : today());
  const [method, setMethod] = useState<Method>("cash");
  const [payerName, setPayerName] = useState(customerName);
  const [description, setDescription] = useState(initialDescription);
  const [amount, setAmount] = useState(amountCents === "0" && amountEditable ? "" : formatMoney(amountCents).replaceAll(",", ""));
  const [kind, setKind] = useState(initialKind);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (isReview) heading.current?.focus(); }, [isReview]);
  let previewAmount = amountCents;
  if (amountEditable) { try { previewAmount = parseMoney(amount); } catch { previewAmount = "0"; } }
  async function submit(state: ActionState, data: FormData): Promise<ActionState> {
    if (isReview) return action(state, data);
    const submittedDate = String(data.get(mode === "invoice" ? "due_date" : "paid_date") ?? "");
    if (mode === "invoice" && fixedDueDate && submittedDate !== fixedDueDate) return { error: "วันครบกำหนดต้องตรงกับวันที่ตรวจรับจริงบวก 30 วัน" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedDate) || (mode === "receipt" && submittedDate > today())) return { error: "ตรวจวันที่ในเอกสารให้ถูกต้อง" };
    if (mode === "receipt" && (!payerName.trim() || !description.trim())) return { error: "กรอกชื่อผู้ชำระและรายละเอียดให้ครบ" };
    if (mode === "receipt" && method !== "cash" && !data.get("proof_path")) return { error: "แนบหลักฐานเงินโอนหรือเช็คก่อนดูตัวอย่าง" };
    if (amountEditable && previewAmount === "0") return { error: "กรอกยอดรับมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง" };
    setDate(submittedDate);
    setIsReview(true);
    return { error: "" };
  }
  const currentLabel = kindOptions?.find(option => option.value === kind)?.label ?? label;
  return <div className={styles.editor}><p className={styles.hint}>แก้ช่องบนเอกสาร แล้วตรวจตัวอย่างก่อนยืนยัน</p>
    <ActionForm action={submit} label={isReview ? finalLabel : "ดูตัวอย่างเอกสาร"}
      secondaryAction={isReview ? { label: "กลับไปแก้บนเอกสาร", onClick: () => setIsReview(false) } : undefined}>
      {Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {isReview ? <><h3 ref={heading} tabIndex={-1}>ตรวจเอกสารก่อน{mode === "invoice" ? "ออกใบแจ้งชำระ" : "ส่งตรวจยืนยัน"}</h3>
        <PaymentPaperPreview mode={mode} brand={brand} customerName={customerName} customerAddress={customerAddress} customerPhone={customerPhone} salesperson={salesperson}
          label={currentLabel} amountCents={previewAmount} receiptKind={hiddenFields.kind ?? kind}
          date={date} method={method} payerName={payerName} description={description} grossCents={grossCents} creditCents={creditCents} acceptanceDate={acceptanceDate} />
        <input type="hidden" name={mode === "invoice" ? "due_date" : "paid_date"} value={date} />
        {mode === "receipt" && <><input type="hidden" name="method" value={method} /><input type="hidden" name="payer_name" value={payerName} />
          <input type="hidden" name="description" value={description} /></>}
        {amountEditable && <input type="hidden" name="amount" value={amount} />}{kindOptions && <input type="hidden" name="kind" value={kind} />}
        {mode === "invoice" && <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจงวด ยอดเงิน และวันครบกำหนดแล้ว</label>}
      </> : <article className={styles.paper} aria-label={mode === "invoice" ? "แก้ไขใบแจ้งชำระบนเอกสาร" : "เตรียมใบเสร็จบนเอกสาร"}>
        <Letterhead mode={mode} brand={brand} /><dl className={styles.facts}><div><dt>ลูกค้า</dt><dd>{customerName}</dd></div>
          {customerAddress && <div><dt>ที่อยู่</dt><dd>{customerAddress}</dd></div>}</dl>
        <div className={styles.fields}><label>{mode === "invoice" ? "วันครบกำหนดชำระ" : "วันที่ได้รับเงินจริง"}<input type="date" name={mode === "invoice" ? "due_date" : "paid_date"} required value={date} readOnly={mode === "invoice" && !!fixedDueDate} max={mode === "receipt" ? today() : undefined} onChange={event => setDate(event.target.value)} />
          {mode === "invoice" && fixedDueDate && acceptanceDate && <small>คำนวณจากวันที่ตรวจรับจริง {formatDate(acceptanceDate)} + 30 วันปฏิทิน ตามสัญญา</small>}</label>
          {mode === "receipt" && <><label>ชื่อผู้ชำระ<input name="payer_name" value={payerName} required maxLength={300} onChange={event => setPayerName(event.target.value)} /></label>
            <label>วิธีรับเงิน<select name="method" value={method} onChange={event => setMethod(event.target.value as Method)}>{Object.entries(paymentMethods).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></>}
        </div>
        <table className={styles.table}><thead><tr><th scope="col">รายการ</th><th scope="col">จำนวนเงิน (บาท)</th></tr></thead><tbody><tr><td>
          {kindOptions && <label>ประเภทเงินรับ<select name="kind" value={kind} onChange={event => setKind(event.target.value)}>{kindOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
          {mode === "receipt" ? <label>รายละเอียดในใบเสร็จ<textarea name="description" required maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} /></label> : label}
        </td><td>{amountEditable ? <label>จำนวนเงินรับ (บาท)<input name="amount" inputMode="decimal" required value={amount} maxLength={20} onChange={event => setAmount(event.target.value)} /></label> : formatMoney(grossCents ?? amountCents)}</td></tr>
          {creditCents && creditCents !== "0" && <tr><td>หักเครดิตเงินที่รับไว้แล้ว</td><td>{formatMoney(creditCents)}</td></tr>}</tbody>
          <tfoot><tr><th scope="row">{mode === "invoice" ? "ยอดเรียกเก็บ" : "ยอดรับที่รอยืนยัน"}</th><td>{amountEditable ? amount || "—" : formatMoney(amountCents)}</td></tr></tfoot></table>
        <p className={styles.note}>{mode === "invoice" ? fixedDueDate ? "วันครบกำหนดคำนวณตามเงื่อนไขสัญญา · ยังไม่นับเป็นเงินรับจริง" : "เลือกวันครบกำหนดก่อนออกบิล · ยังไม่นับเป็นเงินรับจริง" : amountEditable ? "ยังไม่นับเป็นเงินรับจริง ต้องให้ผู้มีสิทธิ์ยืนยันก่อนออกใบเสร็จ" : "รับเต็มยอดบิลครั้งเดียวและแก้ยอดไม่ได้ · ยังไม่นับเป็นเงินรับจริง"}</p>
      </article>}
      {mode === "receipt" && <aside className={styles.evidence} hidden={isReview}><h3>หลักฐานการรับเงิน</h3><EvidenceUpload caseId={caseId} />
        <p>โอนเงินและเช็คต้องแนบหลักฐานก่อนส่งตรวจยืนยัน</p></aside>}
    </ActionForm>
  </div>;
}
