// Utility class sets for the BKP overview flow (was bkp-workflow.module.css).
export const flow = "rounded-lg border bg-card p-4"
export const stages =
  "m-0 grid list-none grid-cols-5 gap-2 p-0 max-[640px]:grid-cols-1 max-[640px]:gap-1 " +
  "[&_li]:flex [&_li]:min-h-[68px] [&_li]:gap-2 [&_li]:rounded-sm [&_li]:border [&_li]:px-2 [&_li]:py-3 [&_li]:text-muted-foreground [&_li]:no-underline " +
  "[&_li[aria-current=step]]:border-primary [&_li[aria-current=step]]:bg-accent [&_li[aria-current=step]]:text-primary " +
  "[&_strong]:text-sm [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:font-normal " +
  "max-[640px]:[&_li]:min-h-11 max-[640px]:[&_li]:items-center max-[640px]:[&_li]:p-2 " +
  "max-[640px]:[&_li>span:last-child]:flex max-[640px]:[&_li>span:last-child]:flex-1 max-[640px]:[&_li>span:last-child]:items-baseline max-[640px]:[&_li>span:last-child]:justify-between max-[640px]:[&_li>span:last-child]:gap-2 " +
  "max-[640px]:[&_small]:m-0"
export const number = "grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs"
export const context = "flex flex-wrap items-center justify-between gap-4 [&_h2]:m-0 [&_p]:my-1"
