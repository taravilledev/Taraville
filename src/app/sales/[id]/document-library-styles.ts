// Utility class sets for the BKP document library (was document-library.module.css).
export const library = "grid min-w-0 gap-4 [&_:is(h2,h3,p)]:m-0"
export const heading = "flex flex-wrap items-start justify-between gap-3 [&_h2]:text-lg [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"
export const filters = "grid grid-cols-[2fr_1fr] gap-3 max-[640px]:grid-cols-1"
export const group = "rounded-md border bg-card p-4 [&_h3]:text-md [&_h3_span]:font-normal [&_h3_span]:text-muted-foreground"
export const list =
  "m-0 list-none p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:border-b [&>li]:py-4 [&>li:last-child]:border-b-0 " +
  "max-[640px]:[&>li]:items-start max-[640px]:[&>li]:gap-2 [&_button]:min-h-11 [&_button]:shrink-0"
export const info = "min-w-0 [overflow-wrap:anywhere] [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"
export const rowHeading = "flex flex-wrap items-center gap-2"
export const binding = "text-primary!"
export const amount = "font-semibold text-foreground!"
export const actions = "flex flex-wrap gap-3 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-sm"
export const history = "group/hist mt-2 border-t [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-3 [&_summary]:text-muted-foreground"
export const empty = "rounded-md border border-dashed p-6 text-muted-foreground"
export const dialog =
  "m-auto h-[calc(100dvh-32px)] max-h-none w-[min(1040px,calc(100vw-32px))] max-w-none rounded-lg border bg-card p-0 text-foreground backdrop:bg-backdrop " +
  "open:flex open:flex-col max-[640px]:h-[calc(100dvh-16px)] max-[640px]:w-[calc(100vw-16px)]"
export const previewHeader =
  "flex items-center justify-between gap-3 border-b p-4 max-[640px]:items-start [&_h2]:text-md [&_h2]:[overflow-wrap:anywhere] [&_p]:text-sm [&_p]:text-muted-foreground " +
  "[&_button]:min-h-11 [&_button]:shrink-0"
export const previewActions = "flex flex-wrap justify-end gap-2"
export const frame = "min-h-0 w-full flex-1 border-0 bg-accent"
