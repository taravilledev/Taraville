"use client";

import { useActionState, useRef, type ReactNode } from "react";
import styles from "./walkin.module.css";

export type ActionState = { error: string };
export function ActionForm({ action, children, label = "บันทึกข้อมูล", id, sticky = false }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode; label?: string; id?: string; sticky?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, submit, isPending] = useActionState(async (previous: ActionState, data: FormData) => {
    const result = await action(previous, data);
    for (const element of Array.from(form.current?.elements ?? [])) {
      if (element instanceof HTMLInputElement && element.type === "password") element.value = "";
    }
    return result;
  }, { error: "" });
  // Successful actions redirect; a rejected save must not reset the entered data.
  return <form id={id} action={submit} ref={form} onReset={event => event.preventDefault()}>
    <fieldset className={styles.formFields} disabled={isPending}>{children}</fieldset>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    <div className={sticky ? `${styles.footer} ${styles.stickyFooter}` : styles.footer}><button className={styles.primaryButton} disabled={isPending} type="submit">
      {isPending ? "กำลังดำเนินการ…" : label}
    </button></div>
  </form>;
}
