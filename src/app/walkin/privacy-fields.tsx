"use client";

import { useState, type ReactNode } from "react";
import { PRIVACY_NOTICE } from "@/lib/walkin/privacy";
import styles from "./walkin.module.css";

export function PrivacyFields({ notice, contact, survey, isNew, choice }: {
  notice: ReactNode; contact: ReactNode; survey: ReactNode; isNew: boolean; choice: boolean | null;
}) {
  const [selection, setSelection] = useState("");
  const isSurveyAllowed = isNew ? selection === "yes" : choice !== false;
  return <>
    {isNew && <section className={styles.card}><h2>ก่อนกรอกข้อมูล</h2>
      <details><summary>อ่านประกาศฉบับที่จะบันทึกเป็นหลักฐาน</summary>{notice}</details>
      <label className={styles.option}><input type="checkbox" name="notice_presented" required /><span>{PRIVACY_NOTICE.choices.notice_presented}</span></label>
      <label className={styles.option}><input type="checkbox" name="followup_requested" required /><span>{PRIVACY_NOTICE.choices.followup_requested}</span></label>
      <p>หากต้องการเพียงข้อมูลทั่วไป ไม่ต้องสร้างรายการผู้สนใจ</p>
    </section>}
    {contact}
    <section className={styles.card}><h2>แบบสอบถามเพิ่มเติม</h2>
      {isNew ? <fieldset className={styles.formFields}><legend>{PRIVACY_NOTICE.choices.survey_consent}</legend>
        <label className={styles.option}><input type="radio" name="survey_consent" value="yes" required checked={selection === "yes"} onChange={() => setSelection("yes")} /><span>เลือกให้ข้อมูลเพิ่มเติม</span></label>
        <label className={styles.option}><input type="radio" name="survey_consent" value="no" required checked={selection === "no"} onChange={() => setSelection("no")} /><span>ไม่ให้ข้อมูลเพิ่มเติม — บันทึกคำขอติดต่อกลับได้</span></label>
      </fieldset> : <p>{choice === null ? "รายการทดสอบเดิมยังไม่มีหลักฐานตัวเลือก ไม่ถือว่าได้ให้ความยินยอม" : choice ? "ตัวเลือกปัจจุบัน: ให้ข้อมูลเพิ่มเติม" : "ตัวเลือกปัจจุบัน: ไม่ให้ข้อมูลเพิ่มเติม"} · เปลี่ยนตัวเลือกได้จากหน้ารายละเอียด</p>}
      {!isSurveyAllowed && <p role="status">ยังไม่เปิดคำถามเพิ่มเติม คำตอบในส่วนนี้จะไม่ถูกส่งเมื่อบันทึก</p>}
      <fieldset className={styles.formFields} disabled={!isSurveyAllowed}>{survey}</fieldset>
    </section>
  </>;
}
