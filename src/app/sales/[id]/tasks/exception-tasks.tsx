import { useId } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { changeReservedUnit, saveAdjustment, saveReservation } from "../../adjustment-actions";
import { decideRefund, payRefund, requestRefund } from "../../refund-actions";
import { EvidenceUpload } from "../../evidence-upload";
import { checkRowClass } from "@/components/check-row";
import { idOf, type TaskData } from "./task-data";
import { noticeClass } from "@/components/notice";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

function AgreementFields({ caseId }: { caseId: string }) {
  const id = useId();
  return <>
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผล</FieldLabel><Textarea id={`${id}-reason`} name="reason" required maxLength={1000} /></Field>
    <Field><FieldLabel htmlFor={`${id}-agreement`}>รายละเอียดข้อตกลงที่ลงนาม</FieldLabel><Textarea id={`${id}-agreement`} name="agreement" required maxLength={100000} /></Field>
    <EvidenceUpload caseId={caseId} category="agreement" />
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจสอบยอดและหลักฐานข้อตกลงที่ลงนามแล้ว</label>
  </>;
}
const Effect = ({ children }: { children: string }) => <p className={noticeClass} role="note">{children}</p>;

export function ChangeUnitTask({ sale, reservation }: TaskData) {
  const id = useId();
  return <ActionForm action={changeReservedUnit.bind(null, idOf(sale))} label="ยืนยันเปลี่ยนแปลง">
    <Effect>แปลงเดิมจะถูกปล่อย และแปลงใหม่จะถูกกันไว้ให้ลูกค้ารายนี้</Effect>
    <Field><FieldLabel htmlFor={`${id}-unit`}>แปลงใหม่</FieldLabel><NativeSelect id={`${id}-unit`} name="unit" required defaultValue=""><option value="" disabled>เลือกแปลง</option>
      {(reservation?.options ?? []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </NativeSelect></Field>
    {sale.status === "contracted"
      ? <Field><FieldLabel htmlFor={`${id}-signed_agreement`}>ข้อตกลงเปลี่ยนแปลงที่ลงนามแล้ว</FieldLabel><Textarea id={`${id}-signed_agreement`} aria-describedby={`${id}-signed_agreement-hint`} name="signed_agreement" maxLength={100000} required /><FieldDescription id={`${id}-signed_agreement-hint`}>หากต้องแก้ยอด ให้บันทึกข้อตกลงแก้ไขยอดงวดแยก</FieldDescription></Field>
      : <Field><FieldLabel htmlFor={`${id}-price`}>ราคาสุทธิที่ตกลงใหม่ (บาท)</FieldLabel><Input id={`${id}-price`} name="price" inputMode="decimal" required /></Field>}
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผล</FieldLabel><Textarea id={`${id}-reason`} name="reason" maxLength={1000} required /></Field>
    <EvidenceUpload caseId={sale.id} category="agreement" />
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจสอบข้อตกลงกับลูกค้าแล้ว</label>
  </ActionForm>;
}

export function AmendTask({ sale, agreement }: TaskData) {
  const id = useId();
  const rows = agreement?.instalments.filter(row => row.is_active) ?? [];
  return <ActionForm action={saveAdjustment.bind(null, "amend", idOf(sale))} label="บันทึกข้อตกลงแก้ไข">
    <Effect>ยอดงวดตามสัญญาจะถูกแทนด้วยข้อตกลงนี้ ใบเสร็จและเงินรับเดิมยังอยู่</Effect>
    {rows.map(row => <fieldset key={row.id} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"><legend>{row.label}</legend>
      <input type="hidden" name="instalment_id" value={row.id} />
      <Field><FieldLabel htmlFor={`${id}-gross_${row.id}`}>ยอดเต็ม (บาท)</FieldLabel><Input id={`${id}-gross_${row.id}`} name={`gross_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.gross_cents).replaceAll(",", "")} /></Field>
      <Field><FieldLabel htmlFor={`${id}-credit_${row.id}`}>เครดิตที่ใช้ (บาท)</FieldLabel><Input id={`${id}-credit_${row.id}`} name={`credit_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.credit_cents).replaceAll(",", "")} /></Field>
    </fieldset>)}
    <label className={checkRowClass}><input type="checkbox" name="work_changed" />ขอบเขตงานเปลี่ยน ต้องตรวจรับงานใหม่และยกเลิกใบแจ้งชำระงวดงานเดิม</label>
    <AgreementFields caseId={sale.id} />
  </ActionForm>;
}

export function CloseTask({ sale }: TaskData) {
  const id = useId();
  return <ActionForm action={saveAdjustment.bind(null, "close", idOf(sale))} label="ยืนยันปิดงานตามข้อตกลง">
    <Effect>ข้อตกลงปิดงานแทนใบแจ้งชำระเดิมและหยุดออกงวดใหม่ ประวัติเงินรับ ใบเสร็จ และการคืนเงินยังอยู่ ย้อนกลับไม่ได้</Effect>
    <Field><FieldLabel htmlFor={`${id}-retained`}>ยอดรวมที่บริษัทมีสิทธิ์ได้รับหลังปิดงาน (บาท)</FieldLabel><Input id={`${id}-retained`} name="retained" inputMode="decimal" required /></Field>
    <AgreementFields caseId={sale.id} />
  </ActionForm>;
}

export function ReleaseTask({ sale }: TaskData) {
  const id = useId();
  return <ActionForm action={saveReservation.bind(null, "release", idOf(sale))} label="ปล่อยแปลง">
    <Effect>แปลงจะเปิดให้ลูกค้ารายอื่นจองได้ทันที</Effect>
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผล</FieldLabel><Textarea id={`${id}-reason`} name="reason" required maxLength={1000} /></Field>
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ยืนยันเปิดแปลงให้ลูกค้ารายอื่นจองได้</label>
  </ActionForm>;
}

export function RequestRefundTask({ sale, finance }: TaskData) {
  const id = useId();
  return <ActionForm action={requestRefund.bind(null, idOf(sale))} label="ส่งคำขอคืนเงิน"><div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
    <p className="text-sm text-muted-foreground col-span-full">คำขอและการอนุมัติยังไม่ใช่การจ่ายคืน ต้องมีผู้ใช้อีกคนอนุมัติและบันทึกการจ่ายจริงพร้อมหลักฐาน เงินที่เป็นเครดิตสัญญาแล้วต้องแก้ข้อตกลงเครดิตก่อนจ่ายคืน</p>
    <Field className="col-span-full"><FieldLabel htmlFor={`${id}-payment_id`}>คืนจากยอดรับ</FieldLabel><NativeSelect id={`${id}-payment_id`} name="payment_id" required defaultValue="">
      <option value="" disabled>เลือกยอดรับ</option>
      {(finance?.payments ?? []).map(payment => <option key={payment.id} value={payment.id}>
        {formatMoney(payment.amount_cents)} บาท · {formatDate(payment.paid_date)} · คืนแล้ว {formatMoney(payment.totals.refunded_cents)} · รอดำเนินการ {formatMoney(payment.totals.reserved_refund_cents)}
      </option>)}
    </NativeSelect></Field>
    <Field><FieldLabel htmlFor={`${id}-amount`}>ยอดขอคืน (บาท)</FieldLabel><Input id={`${id}-amount`} name="amount" inputMode="decimal" required /></Field>
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผลและข้อตกลงคืนเงิน</FieldLabel><Textarea id={`${id}-reason`} name="reason" maxLength={3000} required /></Field>
  </div></ActionForm>;
}

export function DecideRefundTask({ sale, refunds, staffId, row }: TaskData) {
  const id = useId();
  const refund = refunds.find(item => item.id === row);
  if (!refund) return null;
  const mine = refund.requested_by === staffId;
  return <ActionForm action={decideRefund.bind(null, idOf(sale, refund.id))} label={mine ? "ถอนคำขอคืนเงิน" : "บันทึกผลพิจารณา"}>
    <p>{formatMoney(refund.amount_cents)} บาท · {refund.requested_by_name}</p><p>{refund.reason}</p>
    {mine ? <input type="hidden" name="decision" value="withdrawn" /> : <Field><FieldLabel htmlFor={`${id}-decision`}>ผลพิจารณา</FieldLabel><NativeSelect id={`${id}-decision`} name="decision"><option value="approved">อนุมัติ</option><option value="rejected">ไม่อนุมัติ</option></NativeSelect></Field>}
    <Field><FieldLabel htmlFor={`${id}-note`}>เหตุผลประกอบ</FieldLabel><Textarea id={`${id}-note`} name="note" maxLength={3000} required /></Field>
  </ActionForm>;
}

export function PayRefundTask({ sale, refunds, row }: TaskData) {
  const id = useId();
  const refund = refunds.find(item => item.id === row);
  if (!refund) return null;
  return <ActionForm action={payRefund.bind(null, idOf(sale, refund.id))} label="ยืนยันจ่ายคืนเงินจริง">
    <p>{formatMoney(refund.amount_cents)} บาท · อนุมัติแล้ว</p>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"><Field><FieldLabel htmlFor={`${id}-paid_date`}>วันที่จ่ายเงินจริง</FieldLabel><Input id={`${id}-paid_date`} type="date" name="paid_date" required /></Field>
      <Field><FieldLabel htmlFor={`${id}-method`}>วิธีจ่าย</FieldLabel><NativeSelect id={`${id}-method`} name="method"><option value="transfer">โอนเงิน</option><option value="cash">เงินสด</option><option value="cheque">เช็คที่เรียกเก็บแล้ว</option></NativeSelect></Field><EvidenceUpload caseId={sale.id} category="refund" /></div>
    <label className={checkRowClass}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบว่าจ่ายเงินจริงตามยอดอนุมัติและมีหลักฐานแล้ว</label>
  </ActionForm>;
}
