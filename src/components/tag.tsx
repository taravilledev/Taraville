import * as React from "react"

import { cn } from "@/lib/utils"

// Neutral status pill (was .tag in sales.module.css).
export const tagClass = "inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm text-foreground"

export function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="tag" className={cn(tagClass, className)} {...props} />
}
