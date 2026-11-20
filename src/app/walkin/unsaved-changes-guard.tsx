"use client";

import { useEffect, useRef } from "react";
import { useConfirm } from "@/components/confirm-dialog";

const snapshot = (form: HTMLFormElement) => JSON.stringify(Array.from(new FormData(form).entries()));

// Dirty = the form's current values differ from the values it loaded with, so retyping the same text is not a change.
export function UnsavedChangesGuard({ formId }: { formId: string }) {
  const { confirm, confirmDialog } = useConfirm();
  const isLeaving = useRef(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const baseline = snapshot(form);
    const isDirty = () => snapshot(form) !== baseline;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!isLeaving.current && isDirty()) { event.preventDefault(); event.returnValue = ""; } };
    const leave = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (link && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && link.getAttribute("target") !== "_blank" && !isLeaving.current && isDirty()) {
        event.preventDefault(); event.stopPropagation();
        void confirm({ title: "ออกโดยไม่บันทึก?", description: "ข้อมูลที่แก้ไว้จะหาย และกู้คืนไม่ได้", cancelLabel: "อยู่ต่อ", confirmLabel: "ออกโดยไม่บันทึก" })
          .then(isConfirmed => { if (isConfirmed) { isLeaving.current = true; link.click(); } });
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leave, true); };
  }, [formId, confirm]);

  return confirmDialog;
}
