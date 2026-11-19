// Utility class sets for the BKP quotation section (was quotation-section.module.css).
const surface = "rounded-md border bg-card p-6 [overflow-wrap:anywhere] max-[640px]:p-4"
export const section = "grid min-w-0 gap-4 [&_:is(h2,h3,p)]:m-0"
export const header = "flex flex-wrap items-center justify-between gap-3 [&_p]:mt-2 [&>a]:py-2 [&>a]:text-primary"
export const latest = `${surface} grid gap-6 border-t-[3px] border-t-primary`
export const accepted = `${surface} flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary [&_p]:mt-2`
export const history =
  `${surface} [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-semibold [&_summary:focus-visible]:outline-2 [&_summary:focus-visible]:outline-offset-4 [&_summary:focus-visible]:outline-primary ` +
  "[&_ul]:m-0 [&_ul]:mt-3 [&_ul]:list-none [&_ul]:p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-3 [&_li]:border-t [&_li]:py-4 " +
  "[&_h3]:text-md [&_p]:mt-2 [&_p]:text-muted-foreground"
export const eyebrow = "mb-2! text-sm text-muted-foreground"
export const facts = "m-0 grid grid-cols-3 gap-4 max-[640px]:grid-cols-1 [&_dd]:m-0 [&_dt]:mb-2 [&_dt]:text-sm [&_dt]:text-muted-foreground"
export const amount = "text-lg font-bold"
export const next = "grid gap-3 border-t pt-4"
export const actions = "flex flex-wrap gap-3 max-[640px]:w-full max-[640px]:[&_a]:w-full"
