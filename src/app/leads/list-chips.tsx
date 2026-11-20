import Link from "next/link";
import { listHref, type LeadFilters, type surveyFilterOptions } from "@/lib/walkin/lead-list";

const chipClass = "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/25 bg-primary-tint px-3 text-sm text-primary no-underline";
const thaiDay = (day: string) => new Date(`${day}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

type Props = { filters: LeadFilters; survey: ReturnType<typeof surveyFilterOptions>; selected: { budget: string[]; channel: string[] } };

// One chip per panel filter value; each is a link that drops just that value.
export function ListChips({ filters, survey, selected }: Props) {
  const clearRange = { range: undefined, from: undefined, to: undefined, page: undefined };
  const chips: { key: string; label: string; href: string }[] = [];
  if (filters.range === "week" || filters.range === "month") chips.push({ key: "range", label: `ลงทะเบียน ${filters.range === "week" ? "7 วันล่าสุด" : "เดือนนี้"}`, href: listHref(filters, clearRange) });
  else if (filters.from || filters.to) chips.push({ key: "range", label: `ลงทะเบียน ${filters.from ? thaiDay(filters.from) : "…"} – ${filters.to ? thaiDay(filters.to) : "…"}`, href: listHref(filters, clearRange) });
  for (const value of selected.budget) chips.push({ key: `budget-${value}`, label: `${survey?.budgetChip} ${value}`, href: listHref(filters, { budget: selected.budget.filter(item => item !== value), page: undefined }) });
  for (const value of selected.channel) chips.push({ key: `channel-${value}`, label: `ช่องทาง ${value}`, href: listHref(filters, { channel: selected.channel.filter(item => item !== value), page: undefined }) });
  if (!chips.length) return null;
  return <div className="flex basis-full flex-wrap items-center gap-1.5" role="group" aria-label="ตัวกรองที่ใช้อยู่">
    {chips.map(chip => <Link key={chip.key} className={chipClass} prefetch={false} href={chip.href} aria-label={`ลบตัวกรอง ${chip.label}`}>{chip.label} <span aria-hidden="true">×</span></Link>)}
    <Link className="inline-flex min-h-8 items-center px-2 text-sm font-semibold text-primary no-underline" prefetch={false}
      href={listHref(filters, { ...clearRange, budget: undefined, channel: undefined })}>ล้างทั้งหมด</Link>
  </div>;
}
