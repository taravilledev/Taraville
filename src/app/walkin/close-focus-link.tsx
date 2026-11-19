"use client";

import { X } from "lucide-react";
import { formHasDraft } from "./form-draft";

// The ✕ of the focus header looks the form up by id at click time, so it works from outside the page body.
export function CloseFocusLink({ formId }: { formId: string }) {
  return <a href="/dashboard" aria-label="ปิดและกลับหน้าหลัก" className="inline-grid size-(--tap-min) place-items-center rounded-sm text-foreground no-underline hover:bg-muted" onClick={event => {
    if (formHasDraft(formId) && !window.confirm("ข้อมูลที่กรอกไว้จะหาย ต้องการปิดหรือไม่?")) event.preventDefault();
  }}><X size={20} aria-hidden="true" /></a>;
}
