const actionClass =
  "inline-flex min-h-(--control-h) cursor-pointer items-center justify-center rounded-sm border border-primary " +
  "px-6 py-2 text-sm font-bold no-underline"

export const primaryActionClass = `${actionClass} bg-primary text-primary-foreground disabled:cursor-wait disabled:opacity-60`
export const secondaryActionClass = `${actionClass} bg-transparent text-primary disabled:cursor-wait disabled:opacity-60`
// Only for an irreversible action (design-system §8).
export const destructiveActionClass = `${actionClass} border-destructive bg-destructive text-primary-foreground disabled:cursor-wait disabled:opacity-60`
export const textActionClass = "inline-flex min-h-(--tap-min) cursor-pointer items-center border-0 bg-transparent p-0 text-primary underline underline-offset-4"
export const noticeLinkClass = "inline-flex min-h-(--tap-min) items-center text-primary underline-offset-4"
