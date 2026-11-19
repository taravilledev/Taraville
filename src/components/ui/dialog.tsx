"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { nativeDialogClass } from "@/components/native-dialog-styles"

// Native <dialog> (focus trap, ESC and top layer come from the browser) with a shadcn-like API (ADR 0031).
const DialogContext = React.createContext<{ ref: React.RefObject<HTMLDialogElement | null>; id: string } | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("Dialog parts must be rendered inside <Dialog>")
  return context
}

function Dialog({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const id = React.useId()
  return <DialogContext.Provider value={{ ref, id }}>{children}</DialogContext.Provider>
}

function DialogTrigger({ asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { ref, id } = useDialog()
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      type="button"
      data-slot="dialog-trigger"
      aria-haspopup="dialog"
      aria-controls={id}
      onClick={() => ref.current?.showModal()}
      {...props}
    />
  )
}

function DialogClose({ asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { ref } = useDialog()
  const Comp = asChild ? Slot.Root : "button"
  return <Comp type="button" data-slot="dialog-close" onClick={() => ref.current?.close()} {...props} />
}

function DialogContent({
  title,
  description,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"dialog">, "title"> & { title: string; description?: string }) {
  const { ref, id } = useDialog()
  return (
    <dialog
      ref={ref}
      id={id}
      data-slot="dialog-content"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      // Click on the backdrop (the dialog element itself, not its children) closes it.
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}
      className={cn(nativeDialogClass, className)}
      {...props}
    >
      <div className="sticky top-0 flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
        <h2 id={`${id}-title`} className="text-md font-bold">{title}</h2>
        <DialogClose asChild><Button variant="ghost" size="sm">ปิด</Button></DialogClose>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {description && <p id={`${id}-description`} className="text-muted-foreground">{description}</p>}
        {children}
      </div>
    </dialog>
  )
}

export { Dialog, DialogClose, DialogContent, DialogTrigger }
