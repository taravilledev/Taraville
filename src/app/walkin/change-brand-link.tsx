"use client";

import styles from "./walkin.module.css";

// The privacy notice belongs to one company, so a brand change discards what was typed.
export function ChangeBrandLink({ formId }: { formId: string }) {
  return <a className={styles.noticeLink} href="/walkin" onClick={event => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    // The hidden owner value is assigned automatically for sales staff.
    if (!form.querySelector('select[name="owner_id"]')) data.delete("owner_id");
    const hasDraft = Array.from(data).some(([key, value]) =>
      !key.startsWith("$ACTION_") && typeof value === "string" && value.trim() !== "");
    if (hasDraft && !window.confirm("เปลี่ยนแบรนด์แล้วข้อมูลที่กรอกไว้จะหาย ต้องการเปลี่ยนหรือไม่?")) event.preventDefault();
  }}>เปลี่ยนแบรนด์</a>;
}
