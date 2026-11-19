"use client";

import { noticeLinkClass } from "@/components/action-link-styles";
import { formHasDraft } from "./form-draft";

// The privacy notice belongs to one company, so a brand change discards what was typed.
export function ChangeBrandLink({ formId }: { formId: string }) {
  return <a className={noticeLinkClass} href="/walkin" onClick={event => {
    if (formHasDraft(formId) && !window.confirm("เปลี่ยนแบรนด์แล้วข้อมูลที่กรอกไว้จะหาย ต้องการเปลี่ยนหรือไม่?")) event.preventDefault();
  }}>เปลี่ยนแบรนด์</a>;
}
