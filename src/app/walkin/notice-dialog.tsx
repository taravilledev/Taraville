"use client";

import { textActionClass } from "@/components/action-link-styles";
import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useRef, type ReactNode } from "react";

const DIALOG_ID = "notice-dialog";

export function NoticeLink({ label = "อ่านประกาศ" }: { label?: string }) {
  return <button type="button" className={textActionClass}
    onClick={() => (document.getElementById(DIALOG_ID) as HTMLDialogElement | null)?.showModal()}>{label}</button>;
}

export function NoticeDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <dialog id={DIALOG_ID} ref={dialog} className={nativeDialogClass} aria-labelledby="notice-dialog-title"
    onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
    <div className={nativeDialogHeaderClass}><h2 id="notice-dialog-title">ประกาศความเป็นส่วนตัว</h2>
      <button type="button" className={textActionClass} onClick={() => dialog.current?.close()}>ปิด</button></div>
    <div className={nativeDialogBodyClass}>{children}</div>
  </dialog>;
}
