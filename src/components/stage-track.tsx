import { cn } from "@/lib/utils"
import { stageTrack, type StageSegment, type StageTrackStatus } from "@/lib/sales/stage-track"

const segmentClass: Record<StageSegment, string> = {
  done: "bg-success",
  current: "bg-primary",
  todo: "bg-border",
}

// Stage pill plus 5 segments (boards SaleHome, SalesList); colour follows the meaning, the label carries it in text.
export function StageTrack({ steps, current, status, className }: { steps: readonly string[]; current: number; status: StageTrackStatus; className?: string }) {
  const track = stageTrack(steps, current, status)
  return <span data-slot="stage-track" data-status={status} className={cn("inline-flex flex-col items-start gap-1.5", className)}>
    <span className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold",
      status === "done" ? "bg-success-tint text-success-ink" : status === "cancelled" ? "bg-secondary text-muted-foreground" : "border border-line-strong bg-card text-primary",
    )}>
      <span className={cn(
        "grid size-[18px] place-items-center rounded-full text-[11px] font-bold text-primary-foreground",
        status === "done" ? "bg-success" : status === "cancelled" ? "bg-muted-foreground" : "bg-primary",
      )} aria-hidden="true">{track.badge}</span>
      {track.position && <span className="sr-only">ขั้นที่ {track.position} จาก {steps.length}:</span>}
      {track.label}
    </span>
    <span className="flex w-23 gap-0.5" aria-hidden="true">
      {track.segments.map((segment, index) => <span key={index} className={cn("h-1 flex-1 rounded-full", segmentClass[segment])} />)}
    </span>
  </span>
}
