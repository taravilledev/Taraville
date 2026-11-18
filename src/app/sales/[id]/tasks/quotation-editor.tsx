"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ActionForm, type ActionState } from "@/app/walkin/action-form";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SalesCase } from "@/lib/sales/models";
import { formatMoney, parseMoney } from "@/lib/sales/money";
import styles from "../../sales.module.css";
import local from "./quotation-editor.module.css";
import { quotationPaperSchema } from "@/lib/sales/agreement-inputs";
import { TaskHeader } from "./task-header";
import { QuotationBrand, QuotationPreview } from "./quotation-sheet";
import { QuotationPaperFields, type QuotationPaper } from "./quotation-paper-fields";

const houseFields = [
  { key: "model", label: "แบบบ้าน" }, { key: "stories", label: "จำนวนชั้น" },
  { key: "bedrooms", label: "ห้องนอน" }, { key: "kitchens", label: "ห้องครัว" },
  { key: "bathrooms", label: "ห้องน้ำ" }, { key: "usable_area", label: "พื้นที่ใช้สอย (ตร.ม.)" },
] as const;
type House = Record<(typeof houseFields)[number]["key"], string>;
type Spec = { item: string; detail: string; note: string };
type Defaults = { house?: Partial<House>; details?: Record<string, unknown>; total_cents?: string; design_fee_separate?: boolean;
  price_set?: boolean; spec_rows?: Spec[]; exclusions?: string[]; description?: string; paper?: QuotationPaper };
const materialItems = ["ระบบกำจัดปลวก", "โครงสร้างฐานราก", "พื้นรอบบ้าน", "วัสดุมุงหลังคา",
  "ระดับความสูงของตัวบ้าน", "ผนัง", "พื้น", "วัสดุต่างๆ", "งานฝ้า", "สีภายนอก", "สีภายใน", "งานไฟ หน้ากากปลั๊ก สวิตช์",
  "ตู้ Load", "ระบบน้ำภายนอก", "งานประตู-หน้าต่าง-อลูมิเนียม", "งานประตูภายนอก และภายใน", "งานอลูมิเนียม", "ราวระเบียงกันตก"];

function initialHouse(brief: Record<string, string>, payload?: Defaults, designArea?: string | null): House {
  return Object.fromEntries(houseFields.map(({ key }) => {
    const saved = payload?.house?.[key] ?? payload?.details?.[key];
    return [key, typeof saved === "string" || typeof saved === "number" ? String(saved)
      : (key === "usable_area" && designArea) || brief[key] || (key === "stories" ? "1" : ["bedrooms", "kitchens", "bathrooms"].includes(key) ? "0" : "")];
  })) as House;
}

export function QuotationEditor({ sale, agreement, designArea, action }: {
  sale: SalesCase; agreement: AgreementDetail | null;
  designArea?: string | null;
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const latest = agreement?.documents.filter(doc => doc.kind === "quotation")
    .sort((a, b) => b.revision - a.revision)[0];
  const previous = latest?.payload as Defaults | undefined;
  const brief = sale.house_brief ?? {};
  const [paper, setPaper] = useState<QuotationPaper>(() => ({
    schema_version: 1, customer_name: previous?.paper?.customer_name ?? sale.customer_snapshot?.full_name ?? sale.customer_name,
    customer_phone: previous?.paper?.customer_phone ?? sale.customer_snapshot?.phone ?? "",
    customer_address: previous?.paper?.customer_address ?? sale.customer_snapshot?.address ?? "",
    site_address: previous?.paper?.site_address ?? String(sale.details?.site_address ?? ""),
    salesperson: previous?.paper?.salesperson ?? (sale.customer_snapshot?.salesperson || sale.responsible_name),
    manager: previous?.paper?.manager ?? "", work_type: previous?.paper?.work_type ?? "",
    document_date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }), footnote: previous?.paper?.footnote ?? "",
  }));
  const [house, setHouse] = useState(() => initialHouse(brief, previous, designArea));
  const [priceUnset, setPriceUnset] = useState(!previous?.total_cents || previous.price_set === false || previous.total_cents === "0");
  const [price, setPrice] = useState(() => previous?.design_fee_separate && previous.total_cents && previous.total_cents !== "0"
    ? formatMoney(previous.total_cents).replaceAll(",", "") : "");
  const [specs, setSpecs] = useState<Spec[]>(() => previous?.spec_rows ?? materialItems.map(item => ({ item, detail: "", note: "" })));
  const [exclusions, setExclusions] = useState<string[]>(() => previous?.exclusions ?? []);
  const [description, setDescription] = useState(previous?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isReview, setIsReview] = useState(false);
  const [canLeave, setCanLeave] = useState(false);
  const editForm = useRef<HTMLFormElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const addSpecButton = useRef<HTMLButtonElement>(null);
  const addExclusionButton = useRef<HTMLButtonElement>(null);
  const didReview = useRef(false);
  const [baseline] = useState(() => JSON.stringify({ house, priceUnset, price, specs, exclusions, description, paper }));
  const isDirty = baseline !== JSON.stringify({ house, priceUnset, price, specs, exclusions, description, paper });

  useEffect(() => {
    if (isReview) { reviewHeading.current?.focus(); didReview.current = true; }
    else if (didReview.current) editForm.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
  }, [isReview]);
  useEffect(() => {
    if (Object.keys(errors).length) editForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  useEffect(() => {
    if (!isDirty || canLeave) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const leave = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && link.getAttribute("target") !== "_blank" && !window.confirm("มีข้อมูลใบเสนอราคาที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leave, true); };
  }, [isDirty, canLeave]);

  let totalCents: string | null = null;
  if (!priceUnset) { try { totalCents = parseMoney(price); } catch { /* Reviewed before submission. */ } }
  const input = { house, total_cents: totalCents, spec_rows: specs, exclusions, description, paper };
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!house.model.trim()) next.model = "ระบุแบบบ้าน";
    if (!paper.customer_name.trim()) next.customer_name = "ระบุชื่อลูกค้า";
    if (!quotationPaperSchema.safeParse(paper).success) next.paper = "ตรวจชื่อ วันที่ และข้อมูลบนใบเสนอราคา";
    for (const key of ["stories", "bedrooms", "kitchens", "bathrooms"] as const) {
      if (!/^\d{1,3}$/.test(house[key]) || (key === "stories" && Number(house[key]) < 1)) next[key] = key === "stories" ? "ระบุจำนวนชั้นตั้งแต่ 1 ขึ้นไป" : "ระบุจำนวนเต็มตั้งแต่ 0 ถึง 999";
    }
    if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(house.usable_area) || Number(house.usable_area) <= 0) next.usable_area = "ระบุพื้นที่มากกว่า 0 และทศนิยมไม่เกิน 3 ตำแหน่ง";
    if (!priceUnset && (!totalCents || totalCents === "0")) next.price = "ระบุราคามากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง";
    specs.forEach((row, index) => { if (!row.item.trim()) next[`spec-${index}`] = "ระบุชื่อรายการ"; });
    exclusions.forEach((text, index) => { if (!text.trim()) next[`exclusion-${index}`] = "ระบุข้อความ หรือลบแถวที่ไม่ใช้"; });
    setErrors(next);
    if (!Object.keys(next).length) setIsReview(true);
  }
  const message = (key: string) => errors[key] && <span className={local.error} id={`quote-error-${key}`}>{errors[key]}</span>;
  const updateSpec = (index: number, key: keyof Spec, value: string) => setSpecs(rows => rows.map((row, at) => at === index ? { ...row, [key]: value } : row));
  const submit = async (state: ActionState, data: FormData) => {
    setCanLeave(true);
    try { const result = await action(state, data); setCanLeave(false); return result; }
    catch (error) { setCanLeave(false); throw error; }
  };

  return <div className={local.editor}>
    <TaskHeader sale={sale} title="จัดทำใบเสนอราคา" backTab="quotation" backLabel="กลับรายการใบเสนอราคา"
      phase={isReview ? "ใบเสนอราคา · ตรวจตัวอย่าง" : "ใบเสนอราคา · กำลังแก้ไข"}
      status={<p>{latest ? `เริ่มจากฉบับที่ ${latest.revision} · บันทึกเป็นฉบับใหม่` : "ฉบับใหม่ · ยังไม่บันทึก"}{isDirty && " · มีการแก้ไข"}</p>} />
    {isReview ? <ActionForm action={submit} label="บันทึกเป็นฉบับใหม่"
      secondaryAction={{ label: "กลับไปแก้บนเอกสาร", onClick: () => setIsReview(false) }}>
      <input type="hidden" name="quotation_input" value={JSON.stringify(input)} />
      <h3 tabIndex={-1} ref={reviewHeading} className={local.reviewTitle}>ตรวจใบเสนอราคาก่อนบันทึก</h3>
      <QuotationPreview input={input} />
    </ActionForm> : <form ref={editForm} onSubmit={review} noValidate className={local.sections} aria-label="แก้ไขใบเสนอราคาแบบ A4">
      <p className={local.editHint}>กดช่องบนเอกสารเพื่อแก้ไข · เพิ่ม/ลบรายการได้ · ดูตัวอย่างก่อนบันทึกเป็นฉบับใหม่</p>
      {Object.keys(errors).length > 0 && <p className={local.error} role="alert">กรุณาตรวจช่องที่ระบุด้านล่าง</p>}
      <article className={local.paper}>
        <QuotationBrand />
        <div className={local.documentTitle}><h2>ใบเสนอราคา</h2><span>ฉบับใหม่ · ยังไม่ออกเลข</span></div>
        <fieldset className={local.section}><legend>ข้อมูลลูกค้าและงานที่เสนอ</legend>
          <QuotationPaperFields value={paper} onChange={setPaper} error={errors.customer_name} />{message("paper")}
        </fieldset>
        <fieldset className={`${local.section} ${local.house}`}><legend>ข้อมูลบ้าน</legend>
          <div className={local.houseFields}>{houseFields.map(({ key, label }) => {
            const current = brief[key];
            return <div key={key} className={styles.field}><label htmlFor={`quote-${key}`}>{label}</label>
              <input id={`quote-${key}`} name={key} value={house[key]} maxLength={key === "model" ? 200 : key === "usable_area" ? 13 : 3}
                inputMode={key === "model" ? undefined : key === "usable_area" ? "decimal" : "numeric"}
                aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `quote-error-${key}` : undefined}
                onChange={event => setHouse({ ...house, [key]: event.target.value })} />
              {message(key)}
              {current && current !== house[key] && <span className={local.import}>
                ความต้องการล่าสุด {current}
                <button className={styles.link} type="button" onClick={() => setHouse({ ...house, [key]: current })}>ใช้ค่าล่าสุด</button>
              </span>}
            </div>;
          })}</div>
        </fieldset>
        <fieldset className={local.section}><legend>ราคาก่อสร้างที่เสนอ</legend>
          <p className={styles.muted}>{previous?.total_cents && previous.price_set !== false && !previous.design_fee_separate
            ? "กรอกราคาก่อสร้างสำหรับฉบับใหม่ ค่าออกแบบเรียกเก็บแยก"
            : "ค่าออกแบบเรียกเก็บแยกจากราคานี้"}</p>
          <label className={styles.check}><input type="checkbox" checked={priceUnset} onChange={event => setPriceUnset(event.target.checked)} />ยังไม่ระบุราคา · ฉบับประมาณราคา</label>
          {!priceUnset && <label className={`${styles.field} ${local.price}`}>ราคาก่อสร้าง (บาท)<input name="quotation_price" inputMode="decimal" value={price} maxLength={20}
            aria-invalid={!!errors.price} aria-describedby={errors.price ? "quote-error-price" : undefined} onChange={event => setPrice(event.target.value)} />{message("price")}</label>}
          {priceUnset && <p className={styles.muted}>ต้องเพิ่มราคาในฉบับถัดไปก่อนบันทึกลูกค้ายอมรับและเตรียมสัญญา</p>}
        </fieldset>
        <fieldset className={local.section}><legend>รายละเอียดวัสดุและขอบเขตงาน</legend>
          <div className={local.tableHead} aria-hidden="true"><span>รายการ</span><span>ประมาณราคา / รายละเอียด</span><span>หมายเหตุ</span><span /></div>
          <div className={local.rows}>{specs.map((row, index) => <div key={index} className={local.row}>
            <label className={styles.field}><span>รายการที่ {index + 1}</span><textarea value={row.item} maxLength={200} aria-label={`รายการที่ ${index + 1}`} aria-invalid={!!errors[`spec-${index}`]}
              aria-describedby={errors[`spec-${index}`] ? `quote-error-spec-${index}` : undefined} onChange={event => updateSpec(index, "item", event.target.value)} />{message(`spec-${index}`)}</label>
            <label className={styles.field}><span>รายละเอียดที่ {index + 1}</span><textarea value={row.detail} maxLength={3000} aria-label={`รายละเอียดที่ ${index + 1}`} onChange={event => updateSpec(index, "detail", event.target.value)} /></label>
            <label className={styles.field}><span>หมายเหตุที่ {index + 1}</span><textarea value={row.note} maxLength={1000} aria-label={`หมายเหตุที่ ${index + 1}`} onChange={event => updateSpec(index, "note", event.target.value)} /></label>
            <button type="button" className={local.remove} aria-label={`ลบรายการที่ ${index + 1}`} onClick={() => {
              setSpecs(rows => rows.filter((_, at) => at !== index)); setErrors({}); addSpecButton.current?.focus();
            }}>ลบ</button>
          </div>)}</div>
          <button ref={addSpecButton} type="button" className={styles.link} disabled={specs.length >= 50} onClick={() => setSpecs(rows => [...rows, { item: "", detail: "", note: "" }])}>+ เพิ่มรายการสเปก</button>
        </fieldset>
        <fieldset className={local.section}><legend>เงื่อนไขเพิ่มเติม</legend>
          <p className={local.note}>ตรวจข้อความและขอบเขตงานให้ตรงกับข้อตกลงของโครงการนี้</p>
          <ol className={local.conditions}>{exclusions.map((text, index) => <li key={index}>
            <div className={local.exclusion}><label className={styles.field}><span className={styles.srOnly}>เงื่อนไขข้อที่ {index + 1}</span><textarea value={text} maxLength={2000} aria-label={`เงื่อนไขข้อที่ ${index + 1}`} aria-invalid={!!errors[`exclusion-${index}`]}
              aria-describedby={errors[`exclusion-${index}`] ? `quote-error-exclusion-${index}` : undefined}
              onChange={event => setExclusions(rows => rows.map((value, at) => at === index ? event.target.value : value))} />{message(`exclusion-${index}`)}</label>
              <button type="button" className={local.remove} aria-label={`ลบเงื่อนไขข้อที่ ${index + 1}`} onClick={() => {
                setExclusions(rows => rows.filter((_, at) => at !== index)); setErrors({}); addExclusionButton.current?.focus();
              }}>ลบ</button></div>
          </li>)}</ol>
          <button ref={addExclusionButton} type="button" className={styles.link} disabled={exclusions.length >= 50} onClick={() => setExclusions(rows => [...rows, ""])}>+ เพิ่มเงื่อนไข</button>
          <label className={styles.field}>รายละเอียดขอบเขตงานเพิ่มเติม<textarea value={description} maxLength={10000} onChange={event => setDescription(event.target.value)} /></label>
          <label className={styles.field}>หมายเหตุท้ายใบเสนอราคา<textarea value={paper.footnote} maxLength={3000} onChange={event => setPaper({ ...paper, footnote: event.target.value })} /></label>
        </fieldset>
        <div className={local.signatures}>
          <label className={styles.field}>ผู้จัดการ<input value={paper.manager} maxLength={200} placeholder="เว้นว่างหากยังไม่ยืนยันชื่อ" onChange={event => setPaper({ ...paper, manager: event.target.value })} /></label>
          <label className={styles.field}>ผู้เสนอราคา<input value={paper.salesperson} maxLength={200} onChange={event => setPaper({ ...paper, salesperson: event.target.value })} /></label>
        </div>
      </article>
      <div className={local.footer}><p>ตรวจตัวอย่างก่อนออกใบเสนอราคาฉบับใหม่</p><button className={styles.primary} type="submit">ดูตัวอย่างใบเสนอราคา</button></div>
    </form>}
  </div>;
}
