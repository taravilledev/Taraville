// Utility class sets for DashboardOverview (was overview.module.css).
const card = "min-w-0 rounded-lg border bg-card p-5 max-[480px]:p-3"
const header = "flex items-start justify-between gap-3 max-[480px]:flex-wrap"
const linkFocus = "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
const row = `flex min-h-(--tap-min) items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${linkFocus}`

export const metrics = "grid grid-cols-4 gap-3 max-[820px]:grid-cols-2"
export const metric =
  `group/metric flex flex-col ${card} [&_h2]:m-0 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground ` +
  "[&>:last-child]:mt-auto [&>:last-child]:pt-2"
export const panel = `${card} [&_h2]:m-0 [&_h2]:text-lg`
export const metricHeader = "flex items-center justify-between gap-3"
export const sectionHeader = `${header} mb-3`
export const icon =
  "grid flex-none place-items-center rounded-md bg-success-tint p-1.5 text-success-ink " +
  "group-data-[tone=blue]/metric:bg-primary-tint group-data-[tone=blue]/metric:text-primary " +
  "group-data-[tone=warning]/metric:bg-warn-tint group-data-[tone=warning]/metric:text-warn-ink"
export const metricAmount =
  "m-0 mt-2 text-2xl font-bold tabular-nums [overflow-wrap:anywhere] [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"
export const action =
  `inline-flex min-h-(--tap-min) items-center text-sm font-semibold text-primary no-underline underline-offset-4 hover:underline ${linkFocus}`
export const columns = "grid grid-cols-[minmax(0,1fr)_380px] items-stretch gap-4 max-[1100px]:grid-cols-[minmax(0,1fr)]"
export const list = "m-0 mt-3 grid list-none gap-2 p-0"
export const followRow = `${row} text-foreground no-underline hover:bg-accent`
export const emptyRow = `${row} border-dashed text-muted-foreground`
export const pill = "whitespace-nowrap rounded-full bg-primary-tint px-2 py-px text-xs font-semibold text-primary"
export const leadRow = "flex items-center justify-between gap-3 border-t py-2 first:border-t-0"
export const meta = "m-0 text-sm text-muted-foreground"
export const empty = "m-0 mt-3 text-muted-foreground"
