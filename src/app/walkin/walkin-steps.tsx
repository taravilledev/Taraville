"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { textActionClass } from "@/components/action-link-styles";
import { formCardClass, formHintClass, sectionHeadingClass } from "@/components/form-card";
import { dialablePhone } from "@/lib/walkin/phone";
import type { Staff } from "@/lib/walkin/models";
import { ActionForm, type ActionState } from "./action-form";
import { ContactFields, type ContactErrors } from "./contact-fields";
import { SurveyConsent } from "./consent-fields";
import { formHasDraft } from "./form-draft";

const STEPS = ["ข้อมูลติดต่อ", "แบบสอบถาม", "ตรวจและบันทึก"] as const;
type Step = 1 | 2 | 3;
type Snapshot = { name: string; phone: string; ownerId: string; answered: number; isConsent: boolean };
const EMPTY: Snapshot = { name: "", phone: "", ownerId: "", answered: 0, isConsent: false };

const formOf = (formId: string) => document.getElementById(formId) as HTMLFormElement;
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function readForm(formId: string): Snapshot {
  const data = new FormData(formOf(formId));
  const answered = new Set(Array.from(data).filter(([key, value]) => key.startsWith("survey.") && !key.endsWith("_other")
    && key !== "survey.sales_staff" && String(value).trim()).map(([key]) => key));
  return { name: [text(data, "name_title"), text(data, "first_name"), text(data, "last_name")].filter(Boolean).join(" "),
    phone: text(data, "phone"), ownerId: text(data, "owner_id"), answered: answered.size, isConsent: data.get("survey_consent") === "yes" };
}

function contactErrors(formId: string, isExecutive: boolean): ContactErrors {
  const data = new FormData(formOf(formId));
  return {
    ...(text(data, "first_name") ? {} : { first_name: "กรุณากรอกชื่อผู้สนใจ" }),
    ...(dialablePhone(String(data.get("phone") ?? "")) ? {} : { phone: "เบอร์โทรไม่ถูกต้อง กรุณาตรวจเบอร์ให้ครบ" }),
    ...(isExecutive && !text(data, "owner_id") ? { owner_id: "เลือกฝ่ายขาย" } : {}),
  };
}

// The server names the field it rejected; the step that holds it must be visible before ActionForm focuses it.
const stepOfField = (field: string): Step => field === "intake_confirmed" ? 3 : field.startsWith("survey") ? 2 : 1;

export function WalkinSteps({ formId, staff, owners, action, survey, attestation }: {
  formId: string; staff: Staff; owners: Staff[]; survey: ReactNode; attestation: ReactNode;
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const isExecutive = staff.role === "executive";
  const revealField = useCallback((field: string) => setStep(stepOfField(field)), []);

  // Browser prompt for tab close and reload; the in-app links ask through their own dialogs (ChangeBrandLink, CloseFocusLink).
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (formHasDraft(formId)) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [formId]);

  const goTo = (next: Step) => { setSnapshot(readForm(formId)); setStep(next); window.scrollTo({ top: 0 }); };
  const goNext = () => {
    if (step === 3) return;
    if (step === 2) return goTo(3);
    const found = contactErrors(formId, isExecutive);
    setErrors(found);
    const first = (["first_name", "phone", "owner_id"] as const).find(name => found[name]);
    if (!first) return goTo(2);
    const field = formOf(formId).elements.namedItem(first);
    if (field instanceof HTMLElement) field.focus();
  };
  const onChange = (event: ChangeEvent<HTMLElement>) => {
    const { name } = event.target as HTMLInputElement;
    setErrors(previous => previous[name as keyof ContactErrors] ? { ...previous, [name]: undefined } : previous);
    setSnapshot(readForm(formId));
  };
  const backToConsent = () => {
    goTo(2);
    requestAnimationFrame(() => formOf(formId).querySelector<HTMLInputElement>("input[name=survey_consent]")?.focus());
  };

  const ownerName = isExecutive ? owners.find(owner => owner.id === snapshot.ownerId)?.full_name ?? "-" : `${staff.full_name} (คุณ)`;
  const isDiscarding = snapshot.answered > 0 && !snapshot.isConsent;
  return <>
    <ol aria-label="ขั้นของแบบฟอร์ม" className="m-0 mb-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const isCurrent = number === step;
        return <li key={label} aria-current={isCurrent ? "step" : undefined}
          className={`flex items-center gap-2 ${isCurrent ? "font-bold text-foreground" : "text-muted-foreground"}`}>
          <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full border text-xs ${number <= step ? "border-primary bg-primary text-primary-foreground" : ""}`}>{number < step ? "✓" : number}</span>
          {label}
        </li>;
      })}
    </ol>
    <ActionForm id={formId} sticky action={action} onFieldError={revealField}
      next={step === 3 ? undefined : { label: step === 1 ? "ถัดไป · แบบสอบถาม" : "ถัดไป · ตรวจและบันทึก", onClick: goNext }}
      secondaryAction={step === 1 ? undefined : { label: "← ย้อนกลับ", onClick: () => goTo((step - 1) as Step) }}>
      <div onChange={onChange}>
        <div hidden={step !== 1}><ContactFields staff={staff} owners={owners} errors={errors} isStepped /></div>
        <section hidden={step !== 2} id="survey" className={formCardClass} aria-labelledby="survey-title">
          <h2 id="survey-title">แบบสอบถามความต้องการ</h2>
          <SurveyConsent isConsent={snapshot.isConsent} />
          <p className="mb-6 mt-4 text-sm text-muted-foreground">ไม่บังคับ ข้อที่ลูกค้าไม่ตอบ เว้นว่างได้ · ตอบแล้ว {snapshot.answered} ข้อ</p>
          {survey}
        </section>
        <div hidden={step !== 3}>
          <section className={formCardClass} aria-labelledby="review-contact-title">
            <div className={sectionHeadingClass}><h2 id="review-contact-title">ข้อมูลติดต่อ</h2>
              <button type="button" className={textActionClass} onClick={() => goTo(1)}>แก้ข้อมูลติดต่อ</button></div>
            <dl className="m-0 grid grid-cols-[7rem_1fr] gap-y-2 text-sm [&_dd]:m-0 [&_dt]:text-muted-foreground">
              <dt>ชื่อ</dt><dd>{snapshot.name}</dd><dt>เบอร์โทร</dt><dd>{snapshot.phone}</dd><dt>ผู้ดูแล</dt><dd>{ownerName}</dd>
            </dl>
          </section>
          <section className={formCardClass} aria-labelledby="review-survey-title">
            <div className={sectionHeadingClass}><h2 id="review-survey-title">แบบสอบถาม</h2>
              <button type="button" className={textActionClass} onClick={() => goTo(2)}>แก้แบบสอบถาม</button></div>
            <p className={`${formHintClass} mb-0`}>{snapshot.answered
              ? `ตอบ ${snapshot.answered} ข้อ · ${snapshot.isConsent ? "ลูกค้ายินยอมแล้ว" : "ลูกค้ายังไม่ยินยอม"}`
              : "ไม่มีแบบสอบถาม · บันทึกคำขอติดต่อกลับอย่างเดียว"}</p>
            {isDiscarding && <div role="note" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warn-line bg-warn-tint px-4 py-3 text-sm text-warn-ink">
              <span>คำตอบ {snapshot.answered} ข้อจะไม่ถูกบันทึก · ลูกค้ายังไม่ได้ยินยอมให้ใช้คำตอบแบบสอบถาม · ถ้าลูกค้ายินยอม กลับไปติ๊กที่ขั้นแบบสอบถาม</span>
              <button type="button" className={textActionClass} onClick={backToConsent}>กลับไปติ๊กยินยอม</button>
            </div>}
          </section>
          {attestation}
        </div>
      </div>
    </ActionForm>
  </>;
}
