import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "success" | "waiting" | "fix" | "progress" | "inactive"

const toneClass: Record<StatusTone, string> = {
  success: "bg-success-tint text-success-ink",
  waiting: "bg-warn-tint text-warn-ink",
  fix: "bg-danger-tint text-danger-ink",
  progress: "bg-primary-tint text-primary",
  inactive: "bg-secondary text-muted-foreground",
}

// One pill for every status on screen; the tone is the meaning, never the colour (design-system.md).
export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span data-slot="status" data-tone={tone} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", toneClass[tone])}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {children}
  </span>
}
