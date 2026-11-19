import Link from "next/link";
import { hidesClosed, listHref, type LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";

const chipClass = "inline-flex min-h-(--tap-min) items-center rounded-full border border-line-strong bg-tint px-4 text-sm no-underline";

export function ListChips({ filters, ownerName }: { filters: LeadFilters; ownerName: Map<string, string> }) {
  const chips = [
    filters.owner && { key: "owner", label: ownerName.get(filters.owner) ?? "ผู้ดูแล" },
    filters.stage && { key: "stage", label: STAGE_LABELS[filters.stage] },
    filters.from && { key: "from", label: `ตั้งแต่ ${filters.from}` },
    filters.to && { key: "to", label: `ถึง ${filters.to}` },
  ].filter(chip => chip !== undefined && chip !== "") as { key: keyof LeadFilters; label: string }[];
  const isHidingClosed = hidesClosed(filters);
  if (!chips.length && !isHidingClosed) return null;
  return <div className="flex flex-wrap items-center gap-2">
    {chips.map(chip => <Link key={chip.key} className={chipClass} prefetch={false} href={listHref(filters, { [chip.key]: undefined, page: undefined })}
      aria-label={`ลบตัวกรอง ${chip.label}`}>{chip.label} ×</Link>)}
    {isHidingClosed && <Link className={chipClass} prefetch={false} href={listHref(filters, { closed: "show", page: undefined })}
      aria-label="แสดงรายการที่ปิดแล้วด้วย">ไม่รวมที่ปิดแล้ว ×</Link>}
    {chips.length > 0 && <Link className="inline-flex min-h-(--tap-min) items-center px-2 text-sm text-primary" prefetch={false} href="/leads">ล้างทั้งหมด</Link>}
  </div>;
}
