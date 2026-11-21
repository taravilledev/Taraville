"use client";

import { X } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { formHasDraft } from "./form-draft";

// The ✕ of the focus header looks the form up by id at click time, so it works from outside the page body.
export function CloseFocusLink({ formId }: { formId: string }) {
  const { confirm, confirmDialog } = useConfirm();
  return <>
    <a href="/dashboard" aria-label="ปิดและกลับหน้าหลัก" className="inline-grid size-(--tap-min) place-items-center rounded-sm text-foreground no-underline hover:bg-muted" onClick={event => {
      if (!formHasDraft(formId)) return;
      event.preventDefault();
      const { href } = event.currentTarget;
      void confirm({ title: "ปิดแบบฟอร์ม?", description: "ข้อมูลที่กรอกไว้ของลูกค้ารายนี้จะหาย และกู้คืนไม่ได้", cancelLabel: "กรอกต่อ", confirmLabel: "ล้างข้อมูลและปิด" })
        .then(isConfirmed => { if (isConfirmed) window.location.assign(href); });
    }}><X size={20} aria-hidden="true" /></a>
    {confirmDialog}
  </>;
}
