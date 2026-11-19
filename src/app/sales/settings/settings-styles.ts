// Utility class sets for the settings screens (was settings.module.css).
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

export const workspaceClass = "grid grid-cols-[minmax(180px,220px)_minmax(0,1fr)] items-start gap-6 max-[850px]:grid-cols-1"
export const sidebarClass = "rounded-lg border bg-card p-2"
export const sidebarNavClass = "grid gap-1 max-[850px]:flex max-[850px]:flex-wrap"
export const sidebarLinkClass =
  "flex min-h-(--tap-min) items-center rounded-sm px-3 py-2 text-muted-foreground no-underline hover:bg-accent hover:text-primary " +
  `aria-[current]:bg-accent aria-[current]:text-primary ${focusRing}`
export const contentClass = "grid min-w-0 gap-6"
export const headerClass = "grid gap-3 rounded-lg border bg-card p-6"
export const titleRowClass = "flex flex-wrap items-center justify-between gap-4 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere]"
export const cardListClass = "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-4 p-0"
export const cardLinkClass =
  "grid h-full gap-2 rounded-lg border bg-card p-6 text-foreground no-underline [overflow-wrap:anywhere] hover:border-primary " +
  `[&_span]:text-muted-foreground [&_strong]:text-primary ${focusRing}`
export const focusRingClass = focusRing

export const editorClass = "grid min-w-0 max-w-[900px] gap-6 [&_fieldset]:min-w-0 [&_textarea[name^=contract]]:min-h-[240px]"
export const filtersClass =
  "flex flex-wrap items-end gap-3 [&>[data-slot=field]]:shrink [&>[data-slot=field]]:basis-[165px] " +
  "[&>[data-slot=field]:first-of-type]:grow [&>[data-slot=field]:first-of-type]:basis-[200px] " +
  "max-[640px]:[&>[data-slot=field]]:basis-full max-[640px]:[&>[data-slot=field]:first-of-type]:basis-full"
export const tableWrapClass = "overflow-hidden rounded-lg border bg-card max-[640px]:overflow-x-auto"
export const tableClass =
  "w-full border-collapse text-start max-[640px]:min-w-[600px] [&_:is(th,td)]:border-b [&_:is(th,td)]:p-3 [&_:is(th,td)]:text-start [&_:is(th,td)]:align-middle " +
  "[&_:is(th,td)]:[overflow-wrap:anywhere] [&_small]:block [&_small]:font-normal [&_small]:text-muted-foreground [&_thead]:bg-accent [&_thead]:text-muted-foreground " +
  "[&_tr:last-child>:is(td,th[scope=row])]:border-b-0"
export const amountClass = "text-end! whitespace-nowrap tabular-nums"
export const statusCellClass = "whitespace-nowrap"
export const unitStateClass = { available: "text-primary", reserved: "text-warn-ink", inactive: "" } as const
export const rowActionsClass = "flex flex-wrap items-start gap-2"
export const footerClass = "flex flex-wrap items-center justify-between gap-3"

export const permissionHelpClass = "rounded-sm border bg-accent px-4 py-3 text-foreground [&_p]:m-0 [&_p+p]:mt-2"
export const permissionGroupClass = "@container grid [&_h2]:mb-3"
export const permissionRowClass =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4 border-t py-4 last:pb-0 @max-[600px]:grid-cols-1 @max-[600px]:gap-3 " +
  "[&>form]:grid [&>form]:grid-cols-[minmax(0,1fr)_auto] [&>form]:[grid-template-areas:'fields_save'] [&>form]:items-end [&>form]:gap-x-3 [&>form]:gap-y-2 " +
  "[&>form>fieldset]:[grid-area:fields] [&>form>div]:[grid-area:save] [&>form>[role=alert]]:col-span-full [&>form>[role=alert]]:m-0 " +
  "@max-[420px]:[&>form]:grid-cols-1 @max-[420px]:[&>form]:[grid-template-areas:'fields'_'save'] @max-[420px]:[&>form>div]:justify-self-end"
export const permissionTitleClass = "grid justify-items-start gap-1 [&_h3]:m-0 [&_h3]:text-[length:inherit] [&_h3]:font-semibold"
export const permissionSourceClass = "rounded-sm bg-accent px-2 py-1 text-muted-foreground data-[custom=true]:text-primary"
export const permissionFieldsClass = "grid grid-cols-2 gap-3 @max-[260px]:grid-cols-1"
