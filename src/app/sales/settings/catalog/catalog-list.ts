import type { SalesBootstrap } from "@/lib/sales/models";

export function matchesQuery(query: string, values: unknown[]) {
  const term = query.trim().toLocaleLowerCase();
  return values.some(value => typeof value === "string" && value.toLocaleLowerCase().includes(term));
}

export function unitStatus(developmentActive: boolean, unit: { is_active: boolean; is_available: boolean }) {
  if (!developmentActive || !unit.is_active) return "inactive";
  return unit.is_available ? "available" : "reserved";
}

export function catalogPage<T>(rows: T[], requestedPage: string) {
  const size = 20;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = /^\d+$/.test(requestedPage) ? Math.min(pages, Math.max(1, Number(requestedPage))) : 1;
  return { page, pages, rows: rows.slice((page - 1) * size, page * size) };
}

export function unitActivityFields(unit: SalesBootstrap["developments"][number]["units"][number], active: boolean) {
  return {
    p_code: unit.code,
    p_details: unit.details,
    p_list_price_cents: unit.list_price_cents,
    p_is_active: active,
  };
}
