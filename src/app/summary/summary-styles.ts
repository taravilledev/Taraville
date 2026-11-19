// Utility class sets for /summary screens (was summary.module.css); paper output stays in summary-print.module.css.
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

export const page = "grid min-w-0 gap-6"
export const actions = "flex flex-wrap items-center gap-2"
export const filters =
  "flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 " +
  "[&>[data-slot=field]]:min-w-0 [&>[data-slot=field]]:flex-[1_1_8rem] [&>[data-slot=field]:first-of-type]:flex-[2_1_12rem]"
export const mobileSort = "hidden max-[850px]:flex"
export const scope =
  "mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground [overflow-wrap:anywhere] [&_p]:m-0"
export const notes = "pt-1"
export const glossary =
  "mx-0 my-2 grid gap-2 [&>div]:grid [&>div]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] [&>div]:gap-2 " +
  "[&_dt]:font-bold [&_dt]:text-foreground [&_dd]:m-0 max-[850px]:[&>div]:grid-cols-1 max-[850px]:[&>div]:gap-0"
export const noteExample = "mt-2! [&_strong]:font-bold [&_strong]:text-foreground"

export const tableWrap = "min-w-0 rounded-lg border bg-card"
export const table =
  "w-full border-separate border-spacing-0 text-sm " +
  "[&_:is(th,td)]:border-b [&_:is(th,td)]:p-3 [&_th]:text-start [&_:is(th,td)]:align-middle [&_:is(th,td)]:[overflow-wrap:anywhere] " +
  "[&_thead]:bg-accent [&_thead_th]:text-xs [&_thead_th]:text-muted-foreground [&_thead_th:nth-child(n+3)]:text-end " +
  "[&_thead_th:first-child]:min-w-36 [&_thead_th:first-child]:rounded-ss-lg [&_thead_th:last-child]:rounded-se-lg " +
  "[&_tbody_th]:font-semibold [&_th_small]:block [&_th_small]:font-normal [&_th_small]:text-muted-foreground"
// Below 850px the on-screen table becomes one card per row; the paper table keeps its columns.
export const screenTableWrap = `${tableWrap} max-[850px]:border-0 max-[850px]:bg-transparent`
export const screenTable =
  `${table} max-[850px]:block ` +
  "max-[850px]:[&_thead]:absolute max-[850px]:[&_thead]:size-px max-[850px]:[&_thead]:overflow-hidden max-[850px]:[&_thead]:[clip-path:inset(50%)] " +
  "max-[850px]:[&_tbody]:grid max-[850px]:[&_tbody]:gap-3 max-[850px]:[&_tbody]:bg-transparent max-[850px]:[&_tbody:first-of-type]:mb-3 " +
  "max-[850px]:[&_tr]:grid max-[850px]:[&_tr]:grid-cols-2 max-[850px]:[&_tr]:gap-x-3 max-[850px]:[&_tr]:gap-y-2 max-[850px]:[&_tr]:rounded-lg " +
  "max-[850px]:[&_tr]:border max-[850px]:[&_tr]:bg-card max-[850px]:[&_tr]:p-3 " +
  "max-[850px]:[&_:is(th,td)]:min-w-0 max-[850px]:[&_:is(th,td)]:border-0 max-[850px]:[&_:is(th,td)]:p-0 max-[850px]:[&_td]:text-start"
export const totalsRow = "bg-accent [&_:is(th,td)]:font-bold! max-[850px]:[&>th]:col-span-full"
export const projectLink =
  `inline-block text-primary underline underline-offset-[0.18em] ${focusRing} max-[850px]:inline-flex max-[850px]:min-h-(--tap-min) max-[850px]:items-center`
export const stage = "max-[850px]:justify-self-end"
export const stageBadge = "inline-block rounded-sm bg-accent px-2 py-1 text-primary"
export const money =
  "tabular-nums data-[state=received]:text-success-ink data-[state=billed]:text-primary " +
  "data-[state=pending]:font-bold data-[state=pending]:text-warn-ink data-[state=overdue]:font-bold data-[state=overdue]:text-danger-ink " +
  "data-[state=quiet]:text-muted-foreground"
export const moneyCell = `${money} text-end`
export const sortLink = `inline-flex items-center gap-1 hover:text-primary [[aria-sort]_&]:text-primary ${focusRing}`
export const mobileLabel = "hidden text-xs font-medium text-muted-foreground max-[850px]:block"
export const pager =
  "mt-3 flex flex-wrap items-center justify-between gap-2 text-sm [&_p]:m-0 " +
  "[&_[aria-current=page]]:border-primary [&_[aria-current=page]]:bg-accent [&_[aria-current=page]]:text-primary"
export const empty = "rounded-lg border bg-card p-6 text-muted-foreground"

// The dialog renders inside the page header, whose [&_p]:mt-1 would otherwise reach its paragraphs.
export const selectionDialog =
  "open:grid open:h-[min(100dvh-2rem,54rem)] open:max-h-none open:w-[min(100%-2rem,900px)] open:grid-rows-[auto_minmax(0,1fr)_auto] open:overflow-hidden [&_p]:mt-0!"
export const selectionBody = "flex min-h-0 flex-col overflow-auto max-[620px]:p-3 [&>:not(fieldset)]:shrink-0"
export const selectionCount = "m-0 mb-2 font-bold"
export const selectionTotals =
  "m-0 mb-3 grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 [&>div]:rounded-sm [&>div]:bg-accent [&>div]:p-2 " +
  "[&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:font-bold [&_dd]:[overflow-wrap:anywhere]"
export const selectionGroup =
  "m-0 flex min-h-0 min-w-0 flex-[1_1_0] flex-col border-0 p-0 [&>:not(:last-child)]:shrink-0 [&_legend]:p-0 [&_legend]:font-semibold"
export const selectionFilters =
  "my-2 flex flex-wrap items-end gap-2 [&>[data-slot=field]]:min-w-0 [&>[data-slot=field]]:flex-[1_1_8rem] " +
  "[&>[data-slot=field]:first-child]:flex-[2_1_13rem] max-[620px]:[&>[data-slot=field]:first-child]:basis-full"
export const selectionTools = "flex flex-wrap items-center justify-between gap-2 [&_p]:m-0 [&_p]:text-sm [&_p]:text-muted-foreground"
export const selectionList = "min-h-20 flex-[1_1_auto] overflow-auto rounded-sm border"
export const selectionOption =
  "flex min-h-(--tap-min) cursor-pointer items-center gap-3 px-3 py-2 [&+&]:border-t " +
  "[&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground [&_small]:[overflow-wrap:anywhere] [&_input]:accent-primary"
export const selectionActions = "flex justify-end border-t bg-card px-6 py-3 max-[620px]:p-3"
export const selectionEmpty ="m-0 p-3 text-sm text-muted-foreground"
