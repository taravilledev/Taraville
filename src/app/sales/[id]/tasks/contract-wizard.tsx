"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ActionForm, type ActionState } from "@/app/walkin/action-form";
import { useConfirm } from "@/components/confirm-dialog";
import { NativeSelect } from "@/components/ui/native-select";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import { ContractField, ContractClauses, partyFields, photoDraftClauses } from "./contract-party-fields";
import { contractEndDate, contractPaperMissing, emptyContractPaper, type ContractPaper } from "@/lib/sales/contract-paper";
import { ContractSignatures } from "../../documents/[id]/photo-contract-content";
import { contractInputSchema } from "@/lib/sales/agreement-inputs";
import type { SalesCase } from "@/lib/sales/models";
import { formatMoney, installmentAmounts } from "@/lib/sales/money";
import { AgreementContent } from "../../documents/[id]/agreement-content";
import paper from "./contract-paper.module.css";
import { TaskHeader } from "./task-header";
import { buttonVariants } from "@/components/ui/button";

type Row = { id: string; label: string; percent: string; progress: string; work_description: string };
type Customer = { full_name: string; phone: string; site_address: string };
type Quotation = AgreementDetail["documents"][number];
const percentPattern = /^(?:100|\d{1,2})(?:\.\d{1,2})?$/;
function basisPoints(value: string) {
  if (!percentPattern.test(value)) return 0;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
function percentText(points: number) { return (points / 100).toFixed(2).replace(/\.?0+$/, ""); }
function quoteCustomer(quotation: Quotation | undefined, sale: SalesCase): Customer {
  return { full_name: quotation?.payload.paper?.customer_name ?? sale.customer_snapshot?.full_name ?? sale.customer_name,
    phone: quotation?.payload.paper?.customer_phone ?? sale.customer_snapshot?.phone ?? "",
    site_address: quotation?.payload.paper?.site_address ?? String(sale.details?.site_address ?? "") };
}
function initialRows(draft?: Quotation): Row[] {
  if (draft?.payload.schedule_input?.length) return draft.payload.schedule_input.map((row, index) => ({ id: `saved-${index}`,
    label: row.label, percent: percentText(row.basis_points), progress: row.progress_percent == null ? "" : String(row.progress_percent), work_description: row.work_description ?? "" }));
  if (draft?.payload.schedule?.length && draft.payload.total_cents && BigInt(draft.payload.total_cents) > BigInt(0)) {
    const total = BigInt(draft.payload.total_cents); let remaining = 10000;
    return draft.payload.schedule.map((row, index, schedule) => {
      const points = index === schedule.length - 1 ? remaining : Number((BigInt(row.gross_cents) * BigInt(10000) + total / BigInt(2)) / total);
      remaining -= points;
      return { id: `legacy-${index}`, label: row.label, percent: percentText(points), progress: row.progress_percent == null ? "" : String(row.progress_percent), work_description: row.work_description ?? "" };
    });
  }
  return Array.from({ length: 6 }, (_, index) => ({ id: `initial-${index}`, label: index ? `งวดงาน ${index}` : "เงินมัดจำวันเซ็นสัญญา",
    percent: index ? "18" : "10", progress: index ? String(index * 20) : "", work_description: "" }));
}

export function ContractWizard({ sale, agreement, draftId, action, creditCents: availableDesignCredit = "0", contractText, contractDefaults, contractTextApproved = false }: {
  sale: SalesCase; agreement: AgreementDetail; draftId?: string; creditCents?: string; contractText?: string; contractDefaults?: Partial<ContractPaper>; contractTextApproved?: boolean;
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const draft = agreement.documents.find(document => document.id === draftId && document.state === "draft");
  const quotations = agreement.documents.filter(document => document.kind === "quotation" && document.state === "accepted"
    && document.payload.price_set !== false && document.payload.total_cents && BigInt(document.payload.total_cents) > BigInt(0));
  const [quotationId, setQuotationId] = useState(draft?.parent_id ?? quotations[0]?.id ?? "");
  const quotation = quotations.find(document => document.id === quotationId);
  const [customer, setCustomer] = useState<Customer>(() => draft?.payload.customer ?? {
    ...quoteCustomer(quotation, sale), full_name: draft?.customer_snapshot?.full_name ?? quoteCustomer(quotation, sale).full_name,
    phone: draft?.customer_snapshot?.phone ?? quoteCustomer(quotation, sale).phone,
  });
  const [startDate, setStartDate] = useState(draft?.payload.start_date ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }));
  const [rows, setRows] = useState<Row[]>(() => initialRows(draft));
  const quoteAddress = (doc?: Quotation) => doc?.payload.paper?.customer_address || sale.customer_snapshot?.address || "";
  const [details, setDetails] = useState<ContractPaper>(() => draft?.payload.contract_paper ?? {
    ...emptyContractPaper, ...contractDefaults, employer_address: draft?.customer_snapshot?.address || quoteAddress(quotation), conditions: draft?.payload.additional_terms ?? "",
    ...(!draft ? { payment_due_days: 30 as const, extra_clauses: photoDraftClauses } : {}),
  });
  const [showAnnex, setShowAnnex] = useState(() => !!(details.conditions || details.notes));
  const missing = [...contractPaperMissing(details), ...(!startDate ? ["วันเริ่มก่อสร้าง"] : [])];
  const editDetail = (key: keyof ContractPaper, value: string | string[]) => setDetails(current => ({ ...current, [key]: value }));
  const [isReview, setIsReview] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const leaving = useRef(false);
  const { confirm, confirmDialog } = useConfirm();
  const total = quotation?.payload.total_cents ?? "0";
  const hasSeparateDesignFee = quotation?.payload.design_fee_separate === true;
  const creditCents = hasSeparateDesignFee ? "0" : availableDesignCredit;
  const standardText = contractText ?? draft?.payload.contract_text ?? "";
  const schedule = rows.map((row, index) => ({ label: row.label.trim(), basis_points: basisPoints(row.percent),
    progress_percent: index === 0 ? null : /^\d{1,3}$/.test(row.progress) ? Number(row.progress) : null,
    work_description: row.work_description.trim() }));
  const input = { customer, start_date: startDate, schedule, contract_paper: { ...details, extra_clauses: details.extra_clauses.map(value => value.trim()).filter(Boolean) } };
  const state = JSON.stringify({ quotationId, input });
  const [initialState] = useState(state);
  const isDirty = state !== initialState;
  const sum = schedule.reduce((value, row) => value + row.basis_points, 0);
  let amounts: ReturnType<typeof installmentAmounts> = [];
  try { amounts = installmentAmounts(total, schedule.map(row => row.basis_points), creditCents); } catch { /* Review displays invalid totals. */ }
  const preview = { ...quotation?.payload, customer, start_date: startDate, contract_paper: input.contract_paper, contract_text_approved: contractTextApproved, contract_text: standardText,
    total_cents: total, credit_cents: creditCents, schedule: schedule.map((row, index) => ({ ...row, position: index,
      gross_cents: amounts[index]?.gross ?? "0", credit_cents: amounts[index]?.credit ?? "0", net_cents: amounts[index]?.net ?? "0", needs_acceptance: index > 0 })) };

  useEffect(() => { if (isReview) reviewHeading.current?.focus(); }, [isReview]);
  useEffect(() => { if (error) root.current?.querySelector<HTMLElement>('[role="alert"]')?.focus(); }, [error]);
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) {
      if (isDirty && !leaving.current) { event.preventDefault(); event.returnValue = ""; }
    }
    function followLink(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!isDirty || leaving.current || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.getAttribute("target") === "_blank") return;
      event.preventDefault(); event.stopPropagation();
      void confirm({ title: "ออกจากหน้านี้?", description: "ข้อมูลสัญญาที่ยังไม่ได้บันทึกจะหาย และกู้คืนไม่ได้", cancelLabel: "แก้ไขต่อ", confirmLabel: "ออกโดยไม่บันทึก" })
        .then(isConfirmed => { if (isConfirmed) { leaving.current = true; link.click(); } });
    }
    window.addEventListener("beforeunload", unload); document.addEventListener("click", followLink, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", followLink, true); };
  }, [isDirty, confirm]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer.full_name.trim() || !customer.phone.trim() || !customer.site_address.trim()) { setError("กรอกชื่อผู้ลงนาม เบอร์โทร และสถานที่ก่อสร้างให้ครบในหน้า 1"); return; }
    if (!quotation) { setError("เลือกใบเสนอราคาที่มีราคาและลูกค้ายอมรับก่อนเตรียมสัญญา"); return; }
    const result = contractInputSchema.safeParse(input);
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      setError(field === "start_date" ? "เลือกวันเริ่มสัญญาที่ถูกต้องในหน้า 1"
        : sum !== 10000 ? "สัดส่วนงวดในหน้า 3 ต้องรวมเป็น 100%"
        : field === "contract_paper" ? "ตรวจข้อมูลคู่สัญญา: เลขบัตรใช้ตัวเลข 13 หลักหรือเว้นว่าง ระยะเวลาก่อสร้างใช้จำนวนเต็ม 1–9999 วัน"
        : field === "schedule" ? "ตรวจชื่องวด สัดส่วน และความคืบหน้า 0–100% ที่ไม่ลดลงจากงวดก่อนในหน้า 3"
        : "ตรวจข้อมูลผู้ลงนามและข้อตกลงเพิ่มเติมให้ครบและไม่เกินความยาวที่กำหนด");
      return;
    }
    if (!amounts.length) { setError("ตรวจสัดส่วนรวม 100% และเครดิตค่าออกแบบต้องไม่เกินราคาสัญญา"); return; }
    setError(""); setIsReview(true);
  }
  function changeRow(id: string, key: keyof Omit<Row, "id">, value: string) {
    setRows(current => current.map(row => row.id === id ? { ...row, [key]: value } : row)); setError("");
  }
  const header = <TaskHeader sale={sale} title={draft ? "แก้ไขร่างสัญญา" : "จัดทำร่างสัญญา"} backTab="contract" backLabel={`กลับขั้นสัญญา · ${sale.code} · ${sale.customer_name}`} hasContext={false}
      phase={isReview ? "สัญญา · ตรวจตัวอย่าง" : "สัญญา · กำลังแก้ไข"}
      status={<p>{isDirty ? "มีการแก้ไขที่ยังไม่บันทึก" : draft ? "ร่างที่บันทึกไว้" : "ฉบับใหม่ · ยังไม่บันทึก"}</p>} />;
  if (!quotations.length) return <div className={paper.editor}>{header}<p role="status">ต้องมีใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับก่อนเตรียมสัญญา</p></div>;
  return <div ref={root} className={paper.editor}>
    {header}
    {isReview ? <ActionForm action={async (previous, data) => {
      leaving.current = true; try { const result = await action(previous, data); leaving.current = false; return result; } catch (error) { leaving.current = false; throw error; }
    }} label="บันทึกร่างสัญญา" secondaryAction={{ label: "กลับไปแก้บนสัญญา", onClick: () => setIsReview(false) }}>
      <input type="hidden" name="quotation_id" value={quotationId} /><input type="hidden" name="contract_input" value={JSON.stringify(input)} />
      <h3 ref={reviewHeading} tabIndex={-1}>ตัวอย่างร่างสัญญา · ยังไม่ลงนาม</h3>
      <AgreementContent payload={preview} />
    </ActionForm> : <form onSubmit={review} className={paper.pages} aria-label="แก้ไขสัญญาบนเอกสาร" noValidate>
      <p className={paper.hint}>กดช่องบนเอกสารเพื่อแก้ไข · ข้อสัญญามาตรฐานและราคาตามใบเสนอราคาไม่เปลี่ยนจากหน้านี้</p>
      {error && <p className={paper.error} role="alert" tabIndex={-1}>{error}</p>}
      <article className={paper.sheet} aria-label="แก้ไขสัญญา หน้า 1"><p className={paper.pageNumber}>หน้า 1</p><h3>สัญญารับเหมาก่อสร้าง</h3>
        <p className={paper.notice}>ร่างสัญญา · ยังไม่ออกเลขและยังไม่ลงนาม</p>
        {!contractTextApproved && <p className={paper.notice}>รอตรวจข้อความบริษัท · ยังไม่พร้อมใช้กับธุรกรรมจริง</p>}
        <label>ใบเสนอราคาที่ลูกค้ายอมรับ<NativeSelect wrapperClassName="w-full" className="pr-9!" value={quotationId} onChange={event => {
          const next = quotations.find(document => document.id === event.target.value);
          setQuotationId(event.target.value); setCustomer(quoteCustomer(next, sale)); editDetail("employer_address", quoteAddress(next)); setError("");
        }}>{quotations.map(document => <option key={document.id} value={document.id}>{document.number ?? "ใบเสนอราคา"} · ฉบับ {document.revision} · {formatMoney(document.payload.total_cents!)} บาท</option>)}</NativeSelect></label>
        <div className={paper.fields}>
          <label>ชื่อผู้ลงนาม<input required maxLength={200} value={customer.full_name} autoComplete="name" onChange={event => setCustomer({ ...customer, full_name: event.target.value })} /></label>
          <label>เบอร์โทร<input required type="tel" maxLength={80} value={customer.phone} autoComplete="tel" onChange={event => setCustomer({ ...customer, phone: event.target.value })} /></label>
          <label className={paper.full}>สถานที่ก่อสร้าง<textarea required maxLength={2000} value={customer.site_address} onChange={event => setCustomer({ ...customer, site_address: event.target.value })} /></label>
          {partyFields.map(([key, label, max, kind]) => <ContractField key={key} name={key} label={label} max={max} kind={kind} value={details[key]} onChange={editDetail} />)}
          <label>วันเริ่มสัญญา<input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
          <ContractField name="duration_days" label="ระยะเวลาก่อสร้าง (วัน)" max={4} kind="numeric" value={details.duration_days} onChange={editDetail} />
          <p>วันสิ้นสุดก่อสร้าง: {contractEndDate(startDate, details.duration_days) || "—"}</p>
        </div>
        <h4>{hasSeparateDesignFee ? "ราคาสัญญาค่าก่อสร้าง" : "ราคาสัญญารวมค่าออกแบบ"} {formatMoney(total)} บาท</h4>
        <p>{hasSeparateDesignFee ? "ค่าออกแบบเรียกเก็บแยกในแท็บการเงิน" : `เครดิตค่าออกแบบที่รับแล้ว ${formatMoney(creditCents)} บาท`}</p>
        {quotation?.payload.house && <p>{quotation.payload.house.model} · {quotation.payload.house.usable_area} ตร.ม.</p>}
        <p className={paper.hint}>สเปกและข้อยกเว้นใช้ตามใบเสนอราคาฉบับนี้ เปลี่ยนราคาผ่านใบเสนอราคาฉบับใหม่เท่านั้น</p>
        <p><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?task=issue-quotation`} prefetch={false}>จัดทำใบเสนอราคาฉบับใหม่</Link></p>
        {details.payment_due_days === 30 && <p className={paper.notice}>งวดงานที่ต้องตรวจรับ: ชำระภายใน 30 วันปฏิทินหลังวันที่ตรวจรับงานจริงที่ระบุ · มัดจำและค่าออกแบบคงตามเงื่อนไขรายการ</p>}
        <h4>ข้อสัญญามาตรฐาน</h4><p className={paper.text}>{standardText || "[ข้อความสัญญาข้อ 3–14 — รอบริษัทส่งและตรวจข้อความต้นฉบับ]"}</p>
      </article>
      <article className={paper.sheet} aria-label="แก้ไขสัญญา หน้า 2"><p className={paper.pageNumber}>หน้า 2</p><h3>ข้อสัญญาเพิ่มเติมและลายมือชื่อ</h3>
        {details.extra_clauses.some(clause => clause.includes("รอตรวจต้นฉบับ")) && <p className={paper.notice}>ข้อความข้อ 15–16 ที่เติมจากภาพเป็นร่าง มีจุดรอตรวจต้นฉบับ แก้ไขหรือเพิ่มข้อที่ตกลงกันได้ก่อนบันทึก</p>}
        <ContractClauses clauses={details.extra_clauses} onChange={value => editDetail("extra_clauses", value)} />
        <div className={paper.fields}>
          <ContractField name="witness_1" label="พยานฝ่ายผู้ว่าจ้าง (ถ้ามี)" max={200} value={details.witness_1} onChange={editDetail} />
          <ContractField name="witness_2" label="พยานฝ่ายผู้รับจ้าง (ถ้ามี)" max={200} value={details.witness_2} onChange={editDetail} />
        </div>
        <ContractSignatures employer={customer.full_name} paper={details} />
      </article>
      <article className={paper.sheet} aria-label="แก้ไขสัญญา หน้า 3"><p className={paper.pageNumber}>หน้า 3</p><h3>บันทึกข้อตกลงแนบท้ายสัญญา · ตารางงวดงาน</h3>
        {quotation?.payload.house && <p>{quotation.payload.house.model} · {quotation.payload.house.usable_area} ตร.ม. · {customer.site_address}</p>}
        <p className={paper.hint}>สัดส่วนค่าจ้างใช้คำนวณยอดงวด ความคืบหน้างานใช้ตรวจรับ ช่องวันที่จ่ายเว้นไว้เขียนบนกระดาษ</p>
        <p className={sum === 10000 ? paper.hint : paper.error} aria-live="polite">รวมสัดส่วน {sum / 100}% จาก 100%</p>
        {rows.map((row, index) => <fieldset key={row.id} className={paper.row}><legend>{index === 0 ? "งวด 0 · มัดจำวันลงนาม" : `งวดงาน ${index}`}</legend>
          <div className={paper.fields}>
            <label>ชื่องวด {index + 1}<input required maxLength={300} value={row.label} onChange={event => changeRow(row.id, "label", event.target.value)} /></label>
            <label>สัดส่วนงวด {index + 1} (%)<input required inputMode="decimal" value={row.percent} maxLength={6} onChange={event => changeRow(row.id, "percent", event.target.value)} /></label>
            {index > 0 && <label>ความคืบหน้างวด {index + 1} (%)<input required inputMode="numeric" value={row.progress} maxLength={3} onChange={event => changeRow(row.id, "progress", event.target.value)} /></label>}
            <label className={paper.full}>รายละเอียดงานงวด {index + 1}<textarea maxLength={3000} value={row.work_description} onChange={event => changeRow(row.id, "work_description", event.target.value)} /></label>
          </div>
          {amounts[index] && <p>ยอดงวด {formatMoney(amounts[index].gross)} · เครดิต {formatMoney(amounts[index].credit)} · ชำระเพิ่ม {formatMoney(amounts[index].net)} บาท</p>}
          {index > 0 && <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); setError(""); }}>นำงวด {index + 1} ออก</button>}
        </fieldset>)}
        <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} disabled={rows.length >= 100} onClick={() => setRows(current => [...current, { id: crypto.randomUUID(), label: "งวดงานเพิ่มเติม", percent: "", progress: "", work_description: "" }])}>เพิ่มงวดงาน</button>
        <p className={paper.hint}>เศษสตางค์อยู่ในงวดสุดท้าย เครดิตที่รับจริงหักจากงวดท้ายย้อนขึ้น และตรวจอีกครั้งเมื่อล็อกและลงนาม</p>
      </article>
      {showAnnex ? <article className={paper.sheet} aria-label="แก้ไขสัญญา หน้า 4"><p className={paper.pageNumber}>หน้า 4</p><h3>บันทึกข้อตกลงแนบท้ายสัญญา · เงื่อนไขและหมายเหตุ</h3>
        <label>เงื่อนไข<textarea value={details.conditions} maxLength={10000} onChange={event => editDetail("conditions", event.target.value)} /></label>
        <label>หมายเหตุ<textarea value={details.notes} maxLength={10000} onChange={event => editDetail("notes", event.target.value)} /></label>
        <p className={paper.hint}>แสดงหน้านี้ในตัวอย่างเมื่อกรอกเงื่อนไขหรือหมายเหตุ</p>
      </article> : <button type="button" className={paper.textButton} onClick={() => setShowAnnex(true)}>เพิ่มเงื่อนไขหรือหมายเหตุแนบท้าย</button>}
      {missing.length > 0 && <p className={paper.notice}>บันทึกร่างได้ · ก่อนล็อกให้กรอก: {missing.join(" · ")}</p>}
      <div className={paper.footer}><p>ตรวจตัวอย่างก่อนบันทึกร่าง · ยังไม่ออกเลขสัญญา</p><button type="submit" className={buttonVariants({ size: "auto" })}>ดูตัวอย่างสัญญา</button></div>
    </form>}
    {confirmDialog}
  </div>;
}
