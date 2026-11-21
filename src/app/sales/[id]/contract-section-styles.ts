// Utility class sets for the BKP contract tab: the sub-step list, in-advance blockers and the lock readiness checklist.
export const steps = "m-0 grid list-none p-0"
export const step = "flex items-start gap-3 border-t py-4 first:border-t-0"
export const stepBody = "grid min-w-0 flex-1 gap-2 [&_p]:m-0"
export const stepRow = "flex flex-wrap items-center justify-between gap-3"
export const stepTitle = "grid min-w-0 gap-0.5 [&_small]:text-sm [&_small]:text-muted-foreground"
export const stepActions = "flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:[&>*]:w-full"
export const badge =
  "grid size-6 flex-none place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground " +
  "data-[state=done]:bg-success data-[state=done]:text-primary-foreground data-[state=now]:bg-primary data-[state=now]:text-primary-foreground " +
  "data-[state=blocked]:bg-warn-tint data-[state=blocked]:text-warn-ink"
export const blocker =
  "flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn-line bg-warn-tint px-3 py-2 text-sm text-warn-ink [&_a]:font-semibold [&_a]:underline"
export const checklist = "m-0 grid list-none p-0"
export const checkItem = "flex items-start gap-3 border-t py-3 first:border-t-0 [&_p]:m-0 [&_small]:text-sm [&_small]:text-muted-foreground data-[ok=false]:[&_small]:text-warn-ink"
export const preview = "max-h-[32rem] overflow-auto rounded-md border bg-background p-4"
