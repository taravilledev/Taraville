// Utility class sets for DashboardOverview (was overview.module.css).
const card = "min-w-0 rounded-lg border bg-card p-6 max-[480px]:p-3"
const row = "min-w-0 rounded-md border bg-background p-3"
const header = "flex items-start justify-between gap-3 max-[480px]:flex-wrap"
const badge = "rounded-full px-2 py-1 text-xs font-bold"
const linkFocus = "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"

export const metrics = "grid grid-cols-4 gap-4 max-[820px]:grid-cols-2"
export const metric =
  `group/metric flex flex-col ${card} [&_h2]:m-0 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-muted-foreground ` +
  "[&>:last-child]:mt-auto [&>:last-child]:pt-2"
export const panel = `${card} [&_h2]:m-0 [&_h2]:text-lg`
export const metricHeader = `${header} max-[480px]:flex-col-reverse max-[480px]:gap-1`
export const sectionHeader = header
export const icon =
  "grid flex-none place-items-center rounded-md bg-success-tint p-2 text-success-ink " +
  "group-data-[tone=blue]/metric:bg-primary-tint group-data-[tone=blue]/metric:text-primary " +
  "group-data-[tone=warning]/metric:bg-warn-tint group-data-[tone=warning]/metric:text-warn-ink"
export const metricAmount =
  "m-0 mt-3 text-title/[1.35] font-extrabold tabular-nums [overflow-wrap:anywhere] [&_small]:text-sm [&_small]:font-semibold " +
  "group-data-[tone=positive]/metric:text-success-ink group-data-[tone=warning]/metric:text-warn-ink"
export const action =
  `inline-flex min-h-(--tap-min) items-center gap-1 text-sm font-bold text-primary no-underline underline-offset-4 hover:underline ${linkFocus} [&_svg]:flex-none`
export const columns = "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-stretch gap-4 max-[820px]:grid-cols-[minmax(0,1fr)]"
export const main = "grid min-w-0 content-start gap-4"
const list = "m-0 mt-3 grid list-none gap-3 p-0"
export const groups = `${list} grid-cols-3 max-[1100px]:grid-cols-1`
export const items = list
export const group = row
export const groupLink =
  `flex min-h-(--tap-min) flex-col gap-1 font-bold text-primary no-underline underline-offset-4 hover:underline ${linkFocus} [&_svg]:flex-none ` +
  "[&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:gap-1 [&>span:last-child]:text-sm " +
  "max-[1100px]:flex-row max-[1100px]:items-center max-[1100px]:justify-between"
export const itemText = "min-w-0 [overflow-wrap:anywhere]"
export const leadText = `${itemText} flex-[1_1_9rem]`
export const dueText = `${itemText} flex-[1_1_10rem] max-[480px]:basis-full`
export const itemTitle = `m-0 font-bold text-foreground no-underline underline-offset-4 [a&]:hover:underline ${linkFocus}`
const tapTitle = `${itemTitle} inline-flex min-h-(--tap-min) items-center`
export const groupTitle = `${tapTitle} text-sm`
export const leadTitle = tapTitle
export const meta = "m-0 text-sm text-muted-foreground [ul+&]:mt-3"
export const leadRow = `${row} flex flex-wrap items-start justify-between gap-3`
export const dueRow = `${row} flex flex-wrap items-center gap-3`
export const dueBadge = `${badge} bg-primary-tint text-primary data-[overdue=true]:bg-danger-tint data-[overdue=true]:text-danger-ink`
export const duePayment =
  "ml-auto grid justify-items-end tabular-nums [overflow-wrap:anywhere] " +
  "max-[480px]:w-full max-[480px]:grid-cols-[minmax(0,1fr)_auto] max-[480px]:items-center max-[480px]:justify-items-start max-[480px]:gap-2"
export const empty = "m-0 mt-3 text-muted-foreground"
