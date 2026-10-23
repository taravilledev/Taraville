import { z } from "zod";
import type { Lead } from "./models";

export const PAGE_SIZE = 50;

export const filtersSchema = z.object({
  q: z.string().trim().max(50).optional(),
  brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]).optional(), owner: z.uuid().optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  stage: z.enum(["received", "contacted", "closed"]).optional(), closed: z.literal("show").optional(),
  sort: z.enum(["created", "contact"]).default("created"), dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to);
export type LeadFilters = z.infer<typeof filtersSchema>;

/** Closed leads are hidden unless asked for; a text search always includes them so returning customers are found (ADR 0008). */
export const hidesClosed = (filters: LeadFilters) => !filters.q && !filters.stage && filters.closed !== "show";

const DEFAULTS: Partial<Record<keyof LeadFilters, unknown>> = { sort: "created", dir: "desc", page: 1 };

/** URL for the list with `changes` applied; defaults and empty values are left out so URLs stay short. */
export function listHref(filters: LeadFilters, changes: Partial<Record<keyof LeadFilters, string | number | undefined>> = {}) {
  const params = new URLSearchParams();
  const merged: Partial<Record<keyof LeadFilters, unknown>> = { ...filters, ...changes };
  for (const key of ["q", "brand", "owner", "from", "to", "stage", "closed", "sort", "dir", "page"] as const) {
    const value = merged[key];
    if (value === undefined || value === "" || value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}

const bangkokDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const dayNumber = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86_400_000;

/** "วันนี้" / "N วันก่อน" / "N เดือนก่อน" by Asia/Bangkok calendar day; null means never. */
export function relativeDays(iso: string | null, now = new Date()) {
  if (!iso) return "ยังไม่มี";
  const days = Math.max(0, dayNumber(bangkokDay(now)) - dayNumber(bangkokDay(new Date(iso))));
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 30) return `${days} วันก่อน`;
  return days < 365 ? `${Math.floor(days / 30)} เดือนก่อน` : `${Math.floor(days / 365)} ปีก่อน`;
}

export function budgetOf(lead: Pick<Lead, "survey">) {
  const value = lead.survey.budget_range;
  return typeof value === "string" && value ? value : "—";
}

/** Page numbers to show: first, last and two either side of the current page; null is a gap. */
export function pageWindow(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, ...[-2, -1, 0, 1, 2].map(step => page + step)]);
  const shown = [...pages].filter(number => number >= 1 && number <= totalPages).sort((a, b) => a - b);
  return shown.flatMap((number, index) => {
    const gap = index > 0 ? number - shown[index - 1] : 1;
    // A gap of one page shows that page instead of an ellipsis.
    return gap > 2 ? [null, number] : gap === 2 ? [number - 1, number] : [number];
  });
}
