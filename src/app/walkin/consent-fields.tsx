"use client";

import { useState, type ReactNode } from "react";
import { PRIVACY_NOTICE } from "@/lib/walkin/privacy";
import { NoticeLink } from "./notice-dialog";
import styles from "./walkin.module.css";

export function SurveyConsent({ children }: { children: ReactNode }) {
  const [isConsent, setIsConsent] = useState(false);
  return <>
    <label className={styles.option}>
      <input type="checkbox" name="survey_consent" value="yes" checked={isConsent}
        aria-controls="survey-questions" onChange={event => setIsConsent(event.target.checked)} />
      <span>{PRIVACY_NOTICE.choices.survey_consent}</span>
    </label>
    <fieldset id="survey-questions" disabled={!isConsent} hidden={!isConsent}>{children}</fieldset>
  </>;
}

export function ConsentFields() {
  return <section className={styles.card} aria-labelledby="confirm-title">
    <h2 id="confirm-title">ยืนยันก่อนบันทึก</h2>
    <div className={styles.confirmList}>
      <label className={styles.option}><input type="checkbox" name="intake_confirmed" required />
        <span className={styles.optionLines}><span>{PRIVACY_NOTICE.choices.notice_presented}</span><span>{PRIVACY_NOTICE.choices.followup_requested}</span></span></label>
    </div>
    <p className={styles.hint}>การยินยอมให้ใช้คำตอบแบบสอบถามไม่บังคับ ไม่ติ๊กก็บันทึกคำขอติดต่อกลับได้ · <NoticeLink /></p>
  </section>;
}
