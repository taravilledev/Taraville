"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import styles from "./walkin.module.css";

export type ActionState = { error: string; field?: string };
export function ActionForm({ action, children, label = "บันทึกข้อมูล", id, sticky = false, inline = false, secondaryAction }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode; label?: string; id?: string; sticky?: boolean; inline?: boolean;
  secondaryAction?: { label: string; onClick: () => void } | { label: string; href: string };
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, submit, isPending] = useActionState(async (previous: ActionState, data: FormData) => {
    const result = await action(previous, data);
    for (const element of Array.from(form.current?.elements ?? [])) {
      if (element instanceof HTMLInputElement && element.type === "password") element.value = "";
    }
    return result;
  }, { error: "" });
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!state.error || isPending) return;
    const field = state.field && form.current?.elements.namedItem(state.field);
    if (field instanceof HTMLElement) {
      field.focus();
    } else {
      error.current?.focus();
    }
  }, [state, isPending]);
  // Successful actions redirect; a rejected save must not reset the entered data.
  return <form id={id} action={submit} ref={form} className={inline ? styles.inlineAction : undefined} onReset={event => event.preventDefault()}>
    <fieldset className={styles.formFields} disabled={isPending}>{children}</fieldset>
    {state.error && <p ref={error} className={styles.error} role="alert" tabIndex={-1}>{state.error}</p>}
    <div className={inline ? undefined : sticky ? `${styles.footer} ${styles.stickyFooter}` : styles.footer}>
      {secondaryAction && ("href" in secondaryAction
        ? <a className={styles.secondaryLink} href={isPending ? undefined : secondaryAction.href} aria-disabled={isPending || undefined}>{secondaryAction.label}</a>
        : <button type="button" className={styles.secondaryLink} disabled={isPending} onClick={secondaryAction.onClick}>{secondaryAction.label}</button>)}
      <button className={inline ? styles.secondaryLink : styles.primaryButton} disabled={isPending} type="submit">
      {isPending ? "กำลังดำเนินการ…" : label}
    </button></div>
  </form>;
}
