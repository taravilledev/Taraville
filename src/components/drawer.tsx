"use client"

import { useEffect, useRef, type ReactElement, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

// Side drawer from 768px, bottom sheet below. The body scrolls under a sticky header; `footer` sticks to the bottom.
const drawerClass =
  // max-w-none: the browser's own dialog max-width would otherwise leave a gap beside the bottom sheet.
  "m-0 ml-auto h-dvh max-h-dvh w-[min(28rem,100vw)] max-w-none rounded-none border-0 border-l open:flex open:flex-col [&>div:last-child]:flex-1 " +
  "max-md:mt-auto max-md:h-auto max-md:max-h-[85dvh] max-md:w-full max-md:rounded-t-lg max-md:border-l-0 max-md:border-t"

/** `?drawer=<name>` opens it on load; closing drops the param so a reload does not reopen it. */
export function Drawer({ name, title, trigger, footer, children }: {
  name: string; title: string; trigger: ReactElement; footer?: ReactNode; children: ReactNode;
}) {
  const opener = useRef<HTMLButtonElement>(null)
  const query = useSearchParams().toString()
  const lastQuery = useRef(query)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("drawer") === name) opener.current?.click()
  }, [name])
  // A saved form redirects back to this page with other params; the drawer closes with it.
  useEffect(() => {
    if (lastQuery.current === query) return
    lastQuery.current = query
    const dialog = document.getElementById(opener.current?.getAttribute("aria-controls") ?? "")
    if (dialog instanceof HTMLDialogElement) dialog.close()
  }, [query])
  const dropParam = () => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("drawer") !== name) return
    url.searchParams.delete("drawer")
    window.history.replaceState(null, "", url)
  }
  return (
    <Dialog>
      <DialogTrigger asChild ref={opener}>{trigger}</DialogTrigger>
      <DialogContent title={title} className={drawerClass} onClose={dropParam}>
        {children}
        {footer && <div className="sticky bottom-0 mt-auto -mx-5 -mb-5 flex justify-end gap-2 border-t bg-card px-5 py-3">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
