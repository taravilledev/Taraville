"use client";

import { textActionClass } from "@/components/action-link-styles";
import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useRef, type ReactNode } from "react";

export function AmountGuideDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={textActionClass} aria-haspopup="dialog" aria-controls="summary-amount-guide"
      onClick={() => dialog.current?.showModal()}>แต่ละยอดหมายถึงอะไร</button>
    <dialog id="summary-amount-guide" ref={dialog} className={nativeDialogClass} aria-labelledby="summary-amount-guide-title">
      <div className={nativeDialogHeaderClass}>
        <h2 id="summary-amount-guide-title">แต่ละยอดหมายถึงอะไร</h2>
        <button type="button" className={textActionClass} onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      <div className={nativeDialogBodyClass}>{children}</div>
    </dialog>
  </>;
}
