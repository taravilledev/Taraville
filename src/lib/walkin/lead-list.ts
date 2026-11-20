import { z } from "zod";
import { STAGE_GROUPS, stageGroupOf, stageSchema, type StageGroup } from "./lead-stage";
import { SURVEY_QUESTIONS, type Brand } from "./survey-questions";
import type { Lead } from "./models";

export const PAGE_SIZE = 50;

// A repeated query key (?budget=a&budget=b) arrives as an array, a single one as a string.
const multi = z.preprocess(value => value === undefined || Array.isArray(value) ? value : [value], z.array(z.string().max(60)).max(12).optional());

export const filtersSchema = z.object({
  q: z.string().trim().max(50).optional(),
  brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]).optional(), owner: z.union([z.uuid(), z.literal("all")]).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(), range: z.enum(["week", "month", "custom"]).optional(),
  // Old ?stage=<code> links still work: a code maps to its group (received and contacted both land in "open").
  stage: z.union([z.enum(["all", ...STAGE_GROUPS]), stageSchema.transform(stageGroupOf)]).optional(),
  budget: multi, channel: multi,
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to);
export type LeadFilters = z.infer<typeof filtersSchema>;

export type StageTab = "all" | StageGroup;
/** No stage picked: the work list shows open Leads, but a text search covers every stage so returning customers are found (ADR 0008). */
export const stageTab = (filters: LeadFilters): StageTab => filters.stage ?? (filters.q ? "all" : "open");

const DEFAULTS: Partial<Record<keyof LeadFilters, unknown>> = { dir: "desc", page: 1 };

/** URL for the list with `changes` applied; defaults and empty values are left out so URLs stay short. */
export function listHref(filters: LeadFilters, changes: Partial<Record<keyof LeadFilters, string | string[] | number | undefined>> = {}) {
  const params = new URLSearchParams();
  const merged: Partial<Record<keyof LeadFilters, unknown>> = { ...filters, ...changes };
  for (const key of ["q", "brand", "owner", "from", "to", "range", "stage", "budget", "channel", "dir", "page"] as const) {
    const value = merged[key];
    if (value === undefined || value === "" || value === DEFAULTS[key]) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}

/** The registration range as dates: "week" is today and the six days before, "month" starts on the 1st (Asia/Bangkok). */
export function registrationRange(filters: Pick<LeadFilters, "from" | "to" | "range">, now = new Date()) {
  if (!filters.range || filters.range === "custom") return { from: filters.from, to: filters.to };
  const today = bangkokDay(now);
  const from = filters.range === "month" ? `${today.slice(0, 8)}01` : new Date((dayNumber(today) - 6) * 86_400_000).toISOString().slice(0, 10);
  return { from, to: undefined };
}

// Taraville keeps the monthly instalment as free digits in a JSON string, so a bucket is a regex over the text (each core is tried as
// whole digits and as digits plus decimals). Brackets only, no commas or parentheses, so it survives PostgREST or() syntax.
// ponytail: assumes no leading zeros — a numeric column would need a migration.
const INSTALMENT_BUCKETS: readonly { label: string; cores: readonly string[] }[] = [
  { label: "ต่ำกว่า 10,000", cores: ["^[0-9][0-9]?[0-9]?[0-9]?"] },
  { label: "10,000-19,999", cores: ["^1[0-9][0-9][0-9][0-9]"] },
  { label: "20,000-29,999", cores: ["^2[0-9][0-9][0-9][0-9]"] },
  { label: "30,000 ขึ้นไป", cores: ["^[3-9][0-9][0-9][0-9][0-9]", "^[0-9][0-9][0-9][0-9][0-9][0-9]+"] },
];

const choices = (brand: Brand, key: string) => {
  const question = SURVEY_QUESTIONS[brand].find(item => item.key === key);
  return question && "options" in question ? question.options : [];
};

/** Survey filters exist per brand because the two surveys ask different questions; none without a brand. */
export function surveyFilterOptions(brand: Brand | undefined) {
  if (!brand) return null;
  return {
    budgetLabel: brand === "TARAVILLE" ? "ค่างวดที่สะดวกต่อเดือน" : "ราคาที่คาดว่าจะสร้าง", budgetChip: brand === "TARAVILLE" ? "ค่างวด" : "งบ",
    budget: brand === "TARAVILLE" ? INSTALMENT_BUCKETS.map(bucket => bucket.label) : choices(brand, "budget_range"),
    channel: choices(brand, "channel"),
  };
}

/** Selected survey values that the brand's survey actually offers; anything else in the URL is ignored. */
export function activeSurveyFilters(filters: Pick<LeadFilters, "brand" | "budget" | "channel">) {
  const options = surveyFilterOptions(filters.brand);
  const keep = (values: string[] | undefined, allowed: readonly string[] | undefined) => (values ?? []).filter(value => allowed?.includes(value));
  return { budget: keep(filters.budget, options?.budget), channel: keep(filters.channel, options?.channel) };
}

/** The or() clause that matches any of the chosen instalment buckets. */
export const instalmentClause = (labels: readonly string[]) => INSTALMENT_BUCKETS.filter(bucket => labels.includes(bucket.label))
  .flatMap(bucket => bucket.cores).flatMap(core => [`${core}$`, `${core}[.][0-9]*$`])
  .map(pattern => `survey->>monthly_installment.match.${pattern}`).join(",");

/** Filters set in the "ตัวกรอง" panel: registration range plus the survey values; this is the badge number. */
export const panelFilterCount = (filters: LeadFilters) => {
  const { budget, channel } = activeSurveyFilters(filters);
  return (filters.range === "week" || filters.range === "month" || filters.from || filters.to ? 1 : 0) + budget.length + channel.length;
};

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

/** Baan Kunapap shows the build budget, Taraville the monthly instalment (what each survey asks). */
export function budgetOf(lead: Pick<Lead, "survey" | "brand">) {
  if (lead.brand === "TARAVILLE") {
    const amount = Number(lead.survey.monthly_installment);
    return Number.isFinite(amount) && amount > 0 ? `ผ่อน ${amount.toLocaleString("en-US")}/เดือน` : "—";
  }
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
