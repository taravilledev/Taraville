// Utility class sets for BkpProgress (was bkp-progress.module.css).
export const card =
  "grid min-w-0 gap-6 rounded-lg border bg-card p-6 max-[640px]:gap-4 max-[640px]:p-4 [&_:is(h2,h3,h4,p)]:m-0 [&_h2]:text-lg [&_:is(h3,h4)]:text-md"
export const compact =
  "flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm [&_p]:m-0 [&_span]:text-muted-foreground " +
  "[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-primary"
export const heading = "[&_p]:mb-1 [&_p]:text-sm"
export const stages =
  "m-0 grid list-none grid-cols-5 gap-2 p-0 max-[640px]:grid-cols-1 max-[640px]:gap-0 " +
  "[&_li]:flex [&_li]:min-w-0 [&_li]:flex-col [&_li]:items-center [&_li]:gap-2 [&_li]:border-t-[3px] [&_li]:border-border [&_li]:px-2 [&_li]:py-3 [&_li]:text-center [&_li]:text-sm [&_li]:text-muted-foreground " +
  "[&_li>span:last-child]:w-full [&_li[data-done=true]]:border-success [&_li[data-done=true]]:text-foreground [&_li[data-done=true]>span:first-child]:text-success " +
  "[&_li[aria-current=step]]:rounded-b-sm [&_li[aria-current=step]]:border-primary [&_li[aria-current=step]]:bg-accent [&_li[aria-current=step]]:font-bold [&_li[aria-current=step]]:text-primary " +
  "[&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:font-normal " +
  "max-[640px]:[&_li]:flex-row max-[640px]:[&_li]:border-t-0 max-[640px]:[&_li]:border-l-[3px] max-[640px]:[&_li]:px-3 max-[640px]:[&_li]:py-2 max-[640px]:[&_li]:text-left " +
  "max-[640px]:[&_li>span:last-child]:flex max-[640px]:[&_li>span:last-child]:flex-1 max-[640px]:[&_li>span:last-child]:items-baseline max-[640px]:[&_li>span:last-child]:justify-between max-[640px]:[&_li>span:last-child]:gap-2 " +
  "max-[640px]:[&_small]:m-0"
export const marker = "grid size-6 shrink-0 place-items-center rounded-full border border-current"
export const action =
  "flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 border-primary bg-accent p-4 max-[640px]:items-stretch [&_h3]:mt-1 [&_a]:shrink-0 " +
  "max-[640px]:[&_a]:w-full max-[640px]:[&_a]:text-center"
export const body = "grid gap-4 [&_:is(h3,h4)+p]:mt-1 [&_:is(h3,h4)+p]:text-sm"
export const checks =
  "m-0 mt-3 grid list-none gap-2 p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-start [&_li]:gap-2 [&_li]:rounded-sm [&_li]:border-l-[3px] [&_li]:border-transparent [&_li]:px-3 [&_li]:py-2 [&_li]:text-muted-foreground " +
  "[&_li[aria-current=step]]:border-primary [&_li[aria-current=step]]:bg-accent [&_li[aria-current=step]]:font-bold [&_li[aria-current=step]]:text-primary " +
  "[&_li[data-done=true]]:text-foreground [&_svg]:mt-1 [&_svg]:shrink-0 [&_li[data-done=true]_svg]:text-success " +
  "[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-[3px] [&_small]:block [&_small]:text-xs"
export const documentLink = "ml-2 min-h-6! text-sm text-primary! "
export const details = "border-t pt-3 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-semibold [&_summary]:text-primary"
export const rows = "mb-0 grid gap-4 pl-6 [&>li]:py-3"
export const shortcuts = "flex flex-wrap gap-3"
