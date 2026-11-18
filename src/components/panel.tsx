import * as React from "react"

import { cn } from "@/lib/utils"

// Bordered white surface (was .panel in sales.module.css). Use `panelClass` when the host element is not a <section>.
export const panelClass =
  "rounded-lg border bg-card p-6 max-[640px]:p-4 [&_h2]:mb-4 [&_h2]:text-lg [&_details>summary]:min-h-(--tap-min) [&_details>summary]:cursor-pointer [&_details>summary]:py-3 [&_details>summary_h2]:m-0 [&_details>summary_h2]:inline"

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="panel" className={cn(panelClass, className)} {...props} />
}
