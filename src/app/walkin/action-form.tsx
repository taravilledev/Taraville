"use client";

import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { formErrorClass } from "@/components/form-feedback";
import { useActionState, useEffect, useRef, type ReactNode } from "react";

const actionFooterClass = "mt-4 flex items-center justify-between gap-6 pt-2 pb-3 max-[640px]:flex-col max-[640px]:items-stretch";
const stickyActionFooterClass =
  "sticky bottom-0 z-[5] -mx-3 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] " +
  "max-[640px]:-mx-2 max-[640px]:px-2 [&>button[type=submit]]:w-full";

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
  return <form id={id} action={submit} ref={form} className={inline ? "inline-flex flex-col items-start" : undefined} onReset={event => event.preventDefault()}>
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={isPending}>{children}</fieldset>
    {state.error && <p ref={error} className={formErrorClass} role="alert" tabIndex={-1}>{state.error}</p>}
    <div className={inline ? undefined : sticky ? `mt-4 flex items-center justify-between gap-6 max-[640px]:flex-col max-[640px]:items-stretch ${stickyActionFooterClass}` : actionFooterClass}>
      {secondaryAction && ("href" in secondaryAction
        ? <a className={secondaryActionClass} href={isPending ? undefined : secondaryAction.href} aria-disabled={isPending || undefined}>{secondaryAction.label}</a>
        : <button type="button" className={secondaryActionClass} disabled={isPending} onClick={secondaryAction.onClick}>{secondaryAction.label}</button>)}
      <button className={inline ? secondaryActionClass : primaryActionClass} disabled={isPending} type="submit">
      {isPending ? "กำลังดำเนินการ…" : label}
    </button></div>
  </form>;
}
