export type StageTrackStatus = "active" | "done" | "cancelled"
export type StageSegment = "done" | "current" | "todo"

export type StageTrack = { badge: string; label: string; position: number | null; segments: StageSegment[] }

// Stage track view (boards SaleHome, SalesList): `current` is the 0-based index from projectProgress().
export function stageTrack(steps: readonly string[], current: number, status: StageTrackStatus): StageTrack {
  if (status === "cancelled") return { badge: "×", label: "ปิดงาน / ยกเลิก", position: null, segments: steps.map(() => "todo") }
  if (status === "done") return { badge: "✓", label: "ชำระครบ", position: null, segments: steps.map(() => "done") }
  const at = Math.min(Math.max(current, 0), steps.length - 1)
  return {
    badge: String(at + 1),
    label: steps[at],
    position: at + 1,
    segments: steps.map((_, index) => index < at ? "done" : index === at ? "current" : "todo"),
  }
}
