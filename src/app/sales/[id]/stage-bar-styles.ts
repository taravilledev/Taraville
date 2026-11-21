// Utility class sets for the project stage bar; chips scroll sideways on narrow screens.
export const bar = "flex min-w-0 items-stretch gap-1 overflow-x-auto rounded-xl border bg-card p-1"
export const tab =
  "flex min-h-14 flex-1 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-foreground no-underline hover:bg-muted " +
  "aria-[current=page]:bg-primary-tint aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:shadow-[inset_0_-2px_0_var(--primary)] " +
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
export const utility = `${tab} ml-2 flex-none`
export const badge =
  "grid size-6 flex-none place-items-center rounded-full text-xs font-bold bg-muted text-muted-foreground " +
  "data-[state=done]:bg-success data-[state=done]:text-primary-foreground data-[state=now]:bg-primary data-[state=now]:text-primary-foreground"
export const note = "text-xs font-normal text-muted-foreground data-now:font-semibold data-now:text-primary"
