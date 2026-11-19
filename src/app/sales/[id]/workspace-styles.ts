// Utility class sets shared by the case workspace sections (was workspace-section.module.css).

export const section = "grid min-w-0 gap-4"
export const header =
  "flex flex-wrap items-start justify-between gap-3 [&_h2]:m-0 [&_h2]:text-lg [&_p]:m-0 [&_p]:mt-2 [&_p]:text-sm [&_p]:text-muted-foreground " +
  `[&_a]:py-2 [&_a]:text-primary [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-primary`
const surface = "min-w-0 rounded-md border bg-card p-6 [overflow-wrap:anywhere] max-[640px]:p-4"
export const card = `${surface} grid gap-4 [&_:is(h3,p)]:m-0`
export const current = "border-t-[3px] border-t-primary"
export const history =
  `${surface} [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-semibold [&_summary:focus-visible]:outline-2 [&_summary:focus-visible]:outline-offset-3 [&_summary:focus-visible]:outline-primary ` +
  "[&_ul]:m-0 [&_ul]:mt-3 [&_ul]:list-none [&_ul]:p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-3 [&_li]:border-t [&_li]:py-3 " +
  "[&_li_p]:m-0 [&_li_p]:mt-1 [&_li_p]:text-sm [&_li_p]:text-muted-foreground"
export const rowHeading = "flex flex-wrap items-start justify-between gap-3 [&_h3]:text-md"
export const eyebrow = "text-sm text-muted-foreground"
export const status =
  "inline-flex rounded-full bg-accent px-3 py-1 text-sm text-muted-foreground data-[done=true]:text-primary data-[pending=true]:bg-warn-tint data-[pending=true]:text-warn-ink"
export const facts =
  "m-0 grid grid-cols-3 gap-4 max-[640px]:grid-cols-1 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere] [&_dt]:mb-1 [&_dt]:text-sm [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:tabular-nums"
export const amount = "text-lg font-bold"
export const next = "grid gap-3 border-t pt-4 max-[640px]:[&>div]:w-full max-[640px]:[&>div>a]:w-full"
export const actions = "flex flex-wrap items-center gap-3 max-[640px]:gap-2"
export const rows = "m-0 grid list-none gap-3 p-0"
export const note = "m-0 text-sm text-muted-foreground"
