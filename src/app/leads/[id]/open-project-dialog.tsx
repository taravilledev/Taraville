"use client";

import { textActionClass, primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useRef, type ReactNode } from "react";

export function OpenProjectDialog({ children, label = "เปิดโครงการ", isText = false }: { children: ReactNode; label?: string; isText?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={isText ? textActionClass : primaryActionClass} aria-haspopup="dialog" aria-controls="open-project-dialog"
      onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog id="open-project-dialog" ref={dialog} className={nativeDialogClass} aria-labelledby="open-project-title">
      <div className={nativeDialogHeaderClass}><h2 id="open-project-title">เปิดโครงการใหม่</h2>
        <button type="button" className={textActionClass} onClick={() => dialog.current?.close()}>ปิด</button></div>
      <div className={nativeDialogBodyClass}>{children}</div>
    </dialog>
  </>;
}

// A second way into the same dialog (the empty project card), so the form is never rendered twice.
export function OpenProjectTrigger() {
  return <button type="button" className={secondaryActionClass} aria-haspopup="dialog" aria-controls="open-project-dialog"
    onClick={() => document.querySelector<HTMLDialogElement>("#open-project-dialog")?.showModal()}>เปิดโครงการ</button>;
}
