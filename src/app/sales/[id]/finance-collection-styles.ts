// Utility class sets for the money collection list and pending payments (was finance-collection.module.css).
export const collection = "grid min-w-0 gap-3"
export const heading = "[&_:is(h3,p)]:m-0 [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"
export const result = "m-0 text-sm text-muted-foreground"
export const note = result
export const filters =
  "flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:rounded-full [&_button]:border [&_button]:bg-card [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:text-foreground " +
  "[&_button[aria-pressed=true]]:border-primary [&_button[aria-pressed=true]]:bg-accent [&_button[aria-pressed=true]]:font-semibold [&_button[aria-pressed=true]]:text-primary " +
  `[&_span]:ml-1 [&_span]:tabular-nums [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-primary`
export const group = `grid min-w-0 scroll-mt-4 gap-3 [&_h4]:m-0 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-primary`
export const groupHeading =
  "flex flex-wrap items-center justify-between gap-2 [&_a]:py-2 [&_a]:text-sm [&_a]:text-primary [&_span]:font-normal [&_span]:text-muted-foreground"
// One table at every width (a drawer must exist once): below 760px each row stacks into a card.
export const table =
  "w-full bg-card text-sm [&_:is(th,td)]:text-left [&_:is(th,td)]:align-top [&_:is(th,td)]:[overflow-wrap:anywhere] [&_tbody_th]:font-normal [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground " +
  "min-[761px]:table-fixed min-[761px]:border-collapse min-[761px]:[&_:is(th,td)]:border-b min-[761px]:[&_:is(th,td)]:p-3 min-[761px]:[&_thead_th]:bg-accent min-[761px]:[&_thead_th]:font-semibold min-[761px]:[&_thead_th]:text-muted-foreground " +
  "min-[761px]:[&_th:first-child]:w-1/4 min-[761px]:[&_th:nth-child(2)]:w-[18%] min-[761px]:[&_th:nth-child(3)]:w-[16%] min-[761px]:[&_th:nth-child(4)]:w-[18%] min-[761px]:[&_th:last-child]:w-[23%] " +
  "max-[760px]:block max-[760px]:[&_thead]:sr-only max-[760px]:[&_tbody]:grid max-[760px]:[&_tbody]:gap-2 max-[760px]:[&_tr]:grid max-[760px]:[&_tr]:min-w-0 max-[760px]:[&_tr]:gap-2 " +
  "max-[760px]:[&_tr]:rounded-md max-[760px]:[&_tr]:border max-[760px]:[&_tr]:p-3 max-[760px]:[&_:is(th,td)]:block"
export const amount =
  "[&_strong]:block [&_strong]:text-sm [&_strong]:font-bold [&_strong]:tabular-nums [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground"
export const dates = "text-xs text-muted-foreground [&_span]:block"
export const actions = "flex flex-wrap items-center gap-2 [&>a]:min-h-11 [&>a]:p-2 [&>a]:text-xs"
export const history = "w-full text-xs [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:text-muted-foreground [&_ul]:m-0 [&_ul]:pl-4 [&_li+li]:mt-2"
export const empty = "m-0 rounded-md border bg-card p-4 text-sm text-muted-foreground"
export const srOnly = "sr-only"
export const summary =
  "m-0 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2 [&>div]:min-w-0 [&>div]:rounded-md [&>div]:border [&>div]:bg-card [&>div]:p-3 [&>div]:[overflow-wrap:anywhere] " +
  "[&_dt]:text-sm [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:text-lg [&_dd]:font-bold [&_dd]:tabular-nums max-[760px]:[&_dd]:text-md"
export const pendingRows = "m-0 grid list-none gap-2 p-0"
export const pendingItem =
  "flex flex-wrap items-center justify-between gap-3 rounded-md border border-warn-line bg-card p-3 max-[760px]:items-start [&_:is(h3,p)]:m-0 [&_h3]:text-sm " +
  "[&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_strong]:tabular-nums"
