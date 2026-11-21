"use client"

import { useCallback, useId, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { nativeDialogClass } from "@/components/native-dialog-styles"

type ConfirmOptions = { title: string; description: string; cancelLabel: string; confirmLabel: string; isDestructive?: boolean }

// Reads like window.confirm: `if (await confirm({ ... })) ...`. Render `confirmDialog` once next to the caller.
// Destructive by default (data loss); pass isDestructive: false to review a save, e.g. a permission diff. Cancel comes first in the DOM to take initial focus.
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const resolver = useRef<((isConfirmed: boolean) => void) | null>(null)
  // The walk-in page renders two of these at once (header ✕ and change-brand link).
  const id = useId()

  const settle = (isConfirmed: boolean) => { resolver.current?.(isConfirmed); resolver.current = null }
  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current = resolve
    setOptions(next)
    dialog.current?.showModal()
  }), [])

  const confirmDialog = (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      // Esc and the dialog's own close fire "close"; a backdrop click is the dialog element itself.
      onClose={() => settle(false)}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}
      className={cn(nativeDialogClass, "w-[min(100%-2rem,28rem)]")}
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={`${id}-title`} className="text-md font-bold">{options?.title}</h2>
        <p id={`${id}-description`} className="text-muted-foreground">{options?.description}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>{options?.cancelLabel}</Button>
          <Button type="button" variant={options?.isDestructive === false ? "default" : "destructive"} onClick={() => { settle(true); dialog.current?.close() }}>{options?.confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  )

  return { confirm, confirmDialog }
}
