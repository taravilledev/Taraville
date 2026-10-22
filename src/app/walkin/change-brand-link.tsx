"use client";

import styles from "./walkin.module.css";

// The privacy notice belongs to one company, so a brand change discards what was typed.
export function ChangeBrandLink({ formId }: { formId: string }) {
  return <a className={styles.noticeLink} href="/walkin" onClick={event => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const isTyped = ["first_name", "last_name", "phone", "line_id"].some(key => String(data.get(key) ?? "").trim());
    if (isTyped && !window.confirm("เปลี่ยนแบรนด์แล้วข้อมูลที่กรอกไว้จะหาย ต้องการเปลี่ยนหรือไม่?")) event.preventDefault();
  }}>เปลี่ยนแบรนด์</a>;
}
