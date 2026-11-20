"use client";

import { noticeLinkClass } from "@/components/action-link-styles";
import { useConfirm } from "@/components/confirm-dialog";
import { formHasDraft } from "./form-draft";

// The privacy notice belongs to one company, so a brand change discards what was typed.
export function ChangeBrandLink({ formId }: { formId: string }) {
  const { confirm, confirmDialog } = useConfirm();
  return <>
    <a className={noticeLinkClass} href="/walkin" onClick={event => {
      if (!formHasDraft(formId)) return;
      event.preventDefault();
      const { href } = event.currentTarget;
      void confirm({ title: "เปลี่ยนแบรนด์?", description: "ข้อมูลที่กรอกไว้ของลูกค้ารายนี้จะหาย และกู้คืนไม่ได้", cancelLabel: "กรอกต่อ", confirmLabel: "ล้างข้อมูลและเปลี่ยนแบรนด์" })
        .then(isConfirmed => { if (isConfirmed) window.location.assign(href); });
    }}>เปลี่ยนแบรนด์</a>
    {confirmDialog}
  </>;
}
