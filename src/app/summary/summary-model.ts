import { z } from "zod";
import { formatMoney } from "../../lib/sales/money";
import { bkpOverviewStages } from "../../lib/sales/bkp-workflow";
import { csvCell } from "../../lib/walkin/lead-csv";
import type { ExecutiveProject } from "../../lib/sales/executive";

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const MAX_CENTS = BigInt("9223372036854775807");
const THAI_NUMBER = new Intl.NumberFormat("th-TH");

const calendarDate = z.iso.date().refine(value => !value.startsWith("0000"));
export const periodSchema = z.object({ from: calendarDate.optional(), to: calendarDate.optional() })
  .refine(({ from, to }) => !from || !to || from <= to);

type ReportInstalment = {
  outstanding: string | null;
  reference: boolean;
  billed: boolean;
  due: string | null;
};

export function currentBalance(row: ReportInstalment) {
  return row.reference || row.outstanding === null ? ZERO : BigInt(row.outstanding);
}

export function isOverdue(row: ReportInstalment, today: string) {
  return row.billed && row.due !== null && row.due < today && currentBalance(row) > ZERO;
}

export function collectionTotals(rows: ReportInstalment[], today: string) {
  return rows.reduce((totals, row) => {
    const balance = currentBalance(row);
    if (row.billed) totals.billed += balance;
    else totals.unbilled += balance;
    if (isOverdue(row, today)) totals.overdue += balance;
    return totals;
  }, { billed: ZERO, unbilled: ZERO, overdue: ZERO });
}

export const collectionFilters = {
  overdue: "ค้างเกินกำหนด",
  pending: "เงินรอยืนยัน",
  billed: "ค้างตามบิล",
  unbilled: "ยังไม่ออกบิล",
  closeout: "ค้างตามข้อตกลงปิดงาน",
} as const;

export const summaryStages = { ...bkpOverviewStages, cancelled: "ปิดงาน / ยกเลิก", unknown: "ยังไม่มีข้อมูลขั้น" };
export const SUMMARY_PAGE_SIZE = 25;
const amountKeys = ["value", "received", "period", "billed", "unbilled", "overdue", "pending", "closeout"] as const;
const sortKeys = ["code", "stage", ...amountKeys] as const;
type SortKey = typeof sortKeys[number];
const codeOrder = new Intl.Collator("th", { numeric: true });
const stageOrder = Object.values(summaryStages);

export function summaryQuery(raw: Record<string, string | string[] | undefined>) {
  const isPeriodView = raw.view === "period" || Boolean(raw.from || raw.to);
  const period = periodSchema.safeParse({ from: raw.from || undefined, to: raw.to || undefined });
  const from = period.data?.from ?? null;
  const to = period.data?.to ?? null;
  const filters = {
    query: typeof raw.q === "string" ? raw.q.trim().slice(0, 150) : "",
    stage: typeof raw.stage === "string" && Object.hasOwn(summaryStages, raw.stage) ? raw.stage : "",
    money: typeof raw.money === "string" && Object.hasOwn(collectionFilters, raw.money) ? raw.money : "",
    owner: typeof raw.owner === "string" ? raw.owner.trim().slice(0, 150) : "",
  };
  const params = new URLSearchParams();
  const [sortKey, direction, extra] = typeof raw.sort === "string" ? raw.sort.split(".") : [];
  const key = sortKeys.find(candidate => candidate === sortKey);
  const sort = key && extra === undefined && (direction === "asc" || direction === "desc") && (key !== "period" || from || to)
    ? { key, direction } as const : null;
  if (sort) params.set("sort", `${sort.key}.${sort.direction}`);
  if (isPeriodView) params.set("view", "period");
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (filters.query) params.set("q", filters.query);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.money) params.set("money", filters.money);
  if (filters.owner) params.set("owner", filters.owner);
  const page = typeof raw.page === "string" && /^\d+$/.test(raw.page) ? Number(raw.page) : 1;
  return { from, to, filters, params, page, sort, isPeriodView, isPeriodValid: period.success };
}

export function summaryPageRange(rowCount: number, requested: number) {
  const totalPages = Math.max(1, Math.ceil(rowCount / SUMMARY_PAGE_SIZE));
  const page = Math.min(Math.max(requested, 1), totalPages);
  return { page, totalPages, start: (page - 1) * SUMMARY_PAGE_SIZE, end: Math.min(page * SUMMARY_PAGE_SIZE, rowCount) };
}

type ReportFilters = { query: string; stage: string; money: string; owner?: string };
type CollectionAmounts = Record<keyof typeof collectionFilters, bigint>;

function matchesReportFilters(row: { code: string; customer: string; owner?: string }, stage: string, amounts: CollectionAmounts,
  query: string, filters: ReportFilters) {
  if (query && !row.code.toLowerCase().includes(query) && !row.customer.toLowerCase().includes(query)) return false;
  if (filters.stage && stage !== filters.stage) return false;
  if (filters.owner && row.owner !== filters.owner) return false;
  return !Object.hasOwn(collectionFilters, filters.money) || amounts[filters.money as keyof CollectionAmounts] > ZERO;
}

export function summaryEntries<T extends {
  code: string; customer: string; owner?: string; stage: string; pending: string; closeout: string; rows: ReportInstalment[];
}>(projects: T[], today: string, filters: ReportFilters) {
  const query = filters.query.trim().toLowerCase();
  const entries = projects.map(project => ({ project, balance: collectionTotals(project.rows, today) }));
  const visible = entries.filter(({ project, balance }) => matchesReportFilters(project, project.stage,
    { ...balance, pending: BigInt(project.pending), closeout: BigInt(project.closeout) }, query, filters));
  const priority = ({ project, balance }: typeof entries[number]) =>
    balance.overdue > ZERO ? 2 : BigInt(project.pending) > ZERO ? 1 : 0;
  visible.sort((a, b) => priority(b) - priority(a));
  return { entries, visible };
}

// Stage-tab counts and the closeout chip ignore the money filter (and the stage filter for the counts) so they stay clickable.
export function summaryFacets<T extends Parameters<typeof summaryEntries>[0][number]>(projects: T[], today: string, filters: ReportFilters) {
  const { visible } = summaryEntries(projects, today, { ...filters, stage: "", money: "" });
  const stageCounts: Record<string, number> = {};
  let closeout = ZERO;
  for (const { project } of visible) {
    stageCounts[project.stage] = (stageCounts[project.stage] ?? 0) + 1;
    if (!filters.stage || project.stage === filters.stage) closeout += BigInt(project.closeout);
  }
  const owners = [...new Set(projects.flatMap(project => project.owner ? [project.owner] : []))].sort(codeOrder.compare);
  return { total: visible.length, stageCounts, closeout, owners };
}

// Same-page link with some params replaced (null removes one); the page number always resets.
export function summaryHref(params: URLSearchParams, patch: Record<string, string | null> = {}, hash = "") {
  const next = new URLSearchParams(params);
  next.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return `${next.size ? `/summary?${next}` : "/summary"}${hash}`;
}

const isoDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
const monthLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", { month: "short", year: "numeric", timeZone: "UTC" });

// Calendar periods around `today` (YYYY-MM-DD, Bangkok); the picker writes their from/to into the URL.
export function periodPresets(today: string) {
  const [year, month] = today.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3) * 3 + 1;
  const thisMonth = isoDate(year, month, 1);
  const lastMonth = isoDate(year, month - 1, 1);
  return [
    { value: "thisMonth", label: `เดือนนี้ (${monthLabel(thisMonth)})`, from: thisMonth, to: isoDate(year, month + 1, 0) },
    { value: "lastMonth", label: `เดือนที่แล้ว (${monthLabel(lastMonth)})`, from: lastMonth, to: isoDate(year, month, 0) },
    { value: "quarter", label: "ไตรมาสนี้", from: isoDate(year, quarter, 1), to: isoDate(year, quarter + 3, 0) },
    { value: "year", label: `ปีนี้ (${year + 543})`, from: isoDate(year, 1, 1), to: isoDate(year, 12, 31) },
  ];
}

export function periodPresetValue(presets: ReturnType<typeof periodPresets>, query: { from: string | null; to: string | null; isPeriodView: boolean }) {
  if (!query.isPeriodView) return "none";
  return presets.find(preset => preset.from === query.from && preset.to === query.to)?.value ?? "custom";
}

export function displayAmount(amount: string | bigint | null): string {
  if (amount === null) return "—";
  const value = BigInt(amount);
  const absolute = value < ZERO ? -value : value;
  const digits = absolute <= MAX_CENTS ? formatMoney(absolute.toString())
    : `${THAI_NUMBER.format(absolute / HUNDRED)}.${(absolute % HUNDRED).toString().padStart(2, "0")}`;
  return value < ZERO ? `−${digits}` : digits;
}

export function summaryReport(projects: ExecutiveProject[], today: string, query: ReturnType<typeof summaryQuery>) {
  const { visible } = summaryEntries(projects, today, query.filters);
  const rows = visible.map(({ project, balance }) => ({
    id: project.id, code: project.code, customer: project.customer, owner: project.owner, stage: summaryStages[project.stage], stageKey: project.stage,
    hasUnknownBalance: project.rows.some(row => !row.reference && row.outstanding === null),
    amounts: {
      value: project.value === null ? null : BigInt(project.value),
      received: project.receivedTotal === null ? null : BigInt(project.receivedTotal),
      billed: balance.billed, unbilled: balance.unbilled, overdue: balance.overdue, pending: BigInt(project.pending),
      closeout: BigInt(project.closeout), period: BigInt(project.received),
    },
  }));
  const columns = [
    { key: "value", label: "มูลค่าโครงการ", description: "ราคาโครงการที่ระบุในระบบ ช่องขีด (—) หมายถึงยังไม่มีมูลค่า" },
    { key: "received", label: "รับสุทธิสะสม", description: "เงินที่ยืนยันว่ารับแล้วทั้งหมดของโครงการ หักเงินที่คืนไปแล้ว" },
    { key: "period", label: "รับสุทธิในช่วง", description: "เงินที่ยืนยันว่ารับแล้ว ลบเงินที่คืนจริง โดยนับตามวันที่เกิดรายการในช่วงที่เลือก" },
    { key: "billed", label: collectionFilters.billed, description: "ยอดที่ออกบิลแล้วและลูกค้ายังจ่ายไม่ครบ รวมบิลที่ยังไม่ถึงกำหนดด้วย" },
    { key: "unbilled", label: collectionFilters.unbilled, description: "ค่าออกแบบหรืองวดงานที่มียอดให้เรียกเก็บ แต่ยังไม่ได้ออกบิล รวมงวดที่ยังไม่ถึงขั้นออกบิล" },
    { key: "overdue", label: collectionFilters.overdue, description: "ยอดค้างที่เลยวันครบกำหนด ส่วนนี้รวมอยู่ในช่อง «ค้างตามบิล» แล้ว" },
    { key: "pending", label: collectionFilters.pending, description: "รายการรับเงินที่บันทึกเข้ามาแล้วและยังรอยืนยัน ระบบจะนับในยอดรับเมื่อยืนยัน" },
    { key: "closeout", label: collectionFilters.closeout, description: "ยอดที่ยังต้องรับตามข้อตกลงปิดงานของโครงการ" },
  ] as const;
  const totals = columns.map(({ key }) => sumReportColumn(rows, key));
  const shownColumns = columns.flatMap((column, index) => {
    if (column.key === "closeout" && !totals[index]) return [];
    if (column.key === "period" && !query.from && !query.to) return [];
    return [{ ...column, total: totals[index] }];
  });
  if (query.sort && (query.sort.key === "code" || query.sort.key === "stage" || shownColumns.some(col => col.key === query.sort?.key))) {
    const { key, direction } = query.sort;
    const factor = direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (key === "code") return factor * codeOrder.compare(a.code, b.code);
      if (key === "stage") return factor * (stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
      const left = a.amounts[key];
      const right = b.amounts[key];
      if (left === right) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return factor * (left < right ? -1 : 1);
    });
  }
  return { rows, columns: shownColumns, periodLabel: query.from || query.to ? `${query.from ?? "เริ่มต้น"} ถึง ${query.to ?? "ปัจจุบัน"}` : null };
}

export type SummaryReport = ReturnType<typeof summaryReport>;

function sumReportColumn(rows: { amounts: Record<typeof amountKeys[number], bigint | null> }[], key: typeof amountKeys[number]) {
  return rows.reduce<bigint | null>((sum, row) => {
    const amount = row.amounts[key];
    return amount === null ? sum : (sum ?? ZERO) + amount;
  }, null);
}

export function filterSummaryReportRows(rows: SummaryReport["rows"], filters: ReportFilters) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(row => matchesReportFilters(row, row.stageKey, row.amounts, query, filters));
}

export function updateSummarySelection(current: ReadonlySet<string>, ids: Iterable<string>, isSelected: boolean) {
  const next = new Set(current);
  for (const id of ids) {
    if (isSelected) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function selectSummaryReport(report: SummaryReport, selected: ReadonlySet<string>): SummaryReport {
  const rows = report.rows.filter(row => selected.has(row.id));
  const columns = report.columns.map(column => ({ ...column, total: sumReportColumn(rows, column.key) }));
  return { ...report, rows, columns };
}

export function amountState(key: typeof amountKeys[number], amount: bigint | null) {
  if (amount === null || amount === ZERO) return "quiet";
  if (amount < ZERO || key === "overdue") return "overdue";
  if (key === "received" || key === "period") return "received";
  if (key === "billed" || key === "closeout") return "billed";
  return key === "pending" ? "pending" : undefined;
}

export type SummarySortKey = SortKey;

function csvAmount(amount: bigint | null) {
  return amount === null ? "" : displayAmount(amount).replaceAll(",", "").replace("−", "-");
}

export function summaryCsv({ rows, columns, periodLabel }: SummaryReport, totalsFirst = false) {
  const text = (value: string) => csvCell(/^[\s]*[=+\-@＝＋－＠]/u.test(value) ? `'${value}` : value);
  const header = ["รหัสโครงการ", "ลูกค้า", "ผู้ดูแล", "ขั้นปัจจุบัน", ...columns.map(column =>
    column.key === "period" ? `${column.label} (${periodLabel})` : column.label), "หมายเหตุ"];
  const body = rows.map(row => [
    ...[row.code, row.customer, row.owner, row.stage].map(text),
    ...columns.map(column => csvAmount(row.amounts[column.key])),
    row.hasUnknownBalance ? "มียอดที่ยังระบุไม่ได้" : "",
  ]);
  const notes = [rows.some(row => row.hasUnknownBalance) && "รวมเฉพาะยอดค้างที่ระบุได้",
    rows.some(row => row.amounts.value === null) && "รวมเฉพาะมูลค่าโครงการที่ระบุได้"].filter(Boolean).join(" · ");
  const total = ["รวม", "", "", "", ...columns.map(column => csvAmount(column.total)), csvCell(notes)];
  return "\uFEFF" + [header.map(csvCell), ...(totalsFirst ? [total, ...body] : [...body, total])]
    .map(row => row.join(",")).join("\r\n") + "\r\n";
}
