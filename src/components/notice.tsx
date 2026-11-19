import * as React from "react"

import { cn } from "@/lib/utils"

// Warning-tinted message (was .notice in sales.module.css). Use `noticeClass` to keep an existing host element such as <p>.
export const noticeClass = "rounded-sm bg-warn-tint p-4 text-warn-ink"

export function Notice({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="notice" className={cn(noticeClass, className)} {...props} />
}
