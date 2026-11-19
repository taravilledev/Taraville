export const shellClass = "flex min-h-dvh flex-col"

export const shellMainClass =
  "mx-auto w-[min(100%-48px,var(--content-w))] flex-1 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] " +
  "min-[1180px]:w-[min(100%-80px,1040px)] max-[640px]:w-[calc(100%-28px)] max-[640px]:pt-4"

export const shellFooterClass = "border-t bg-card p-4 text-center text-xs text-muted-foreground"

export const accountMenuClass =
  "absolute top-[calc(100%+0.5rem)] right-0 z-20 min-w-[230px] rounded-md border bg-card p-2 shadow-[var(--shadow-menu)] " +
  "[&_:is(a,button)]:flex [&_:is(a,button)]:min-h-12 [&_:is(a,button)]:w-full [&_:is(a,button)]:cursor-pointer " +
  "[&_:is(a,button)]:items-center [&_:is(a,button)]:gap-3 [&_:is(a,button)]:rounded-sm [&_:is(a,button)]:border-0 " +
  "[&_:is(a,button)]:bg-transparent [&_:is(a,button)]:px-3 [&_:is(a,button)]:text-foreground " +
  "[&_:is(a,button)]:no-underline [&_:is(a,button)]:[font:inherit] [&_:is(a,button):hover]:bg-muted " +
  "[&_form]:mt-1 [&_form]:border-t [&_form]:pt-1 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
