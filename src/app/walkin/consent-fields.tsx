"use client";

import { useEffect, useRef, useState } from "react";
import { PRIVACY_NOTICE } from "@/lib/walkin/privacy";
import { NoticeLink } from "./notice-dialog";
import styles from "./walkin.module.css";

const hasSurveyAnswer = (form: HTMLFormElement) => Array.from(new FormData(form)).some(([key, value]) =>
  key.startsWith("survey.") && key !== "survey.sales_staff" && typeof value === "string" && value.trim() !== "");

export function ConsentFields() {
  const root = useRef<HTMLElement>(null);
  const [isConsent, setIsConsent] = useState(false);
  const [hasAnswers, setHasAnswers] = useState(false);
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const update = () => setHasAnswers(hasSurveyAnswer(form));
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => { form.removeEventListener("input", update); form.removeEventListener("change", update); };
  }, []);
  return <section ref={root} className={styles.card} aria-labelledby="confirm-title">
    <h2 id="confirm-title">ยืนยันก่อนบันทึก</h2>
    <div className={styles.confirmList}>
      <label className={styles.option}><input type="checkbox" name="intake_confirmed" required />
        <span className={styles.optionLines}><span>{PRIVACY_NOTICE.choices.notice_presented}</span><span>{PRIVACY_NOTICE.choices.followup_requested}</span></span></label>
      <label className={styles.option}><input type="checkbox" name="survey_consent" value="yes" onChange={event => setIsConsent(event.target.checked)} /><span>{PRIVACY_NOTICE.choices.survey_consent}</span></label>
    </div>
    {hasAnswers && !isConsent && <p className={styles.warn} role="status">คำตอบแบบสอบถามจะไม่ถูกบันทึก เพราะยังไม่ได้ติ๊กยินยอมให้ใช้คำตอบ</p>}
    <p className={styles.hint}>การยินยอมให้ใช้คำตอบแบบสอบถามไม่บังคับ ไม่ติ๊กก็บันทึกคำขอติดต่อกลับได้ · <NoticeLink /></p>
  </section>;
}
