// Three-up grid of bordered stat cards, each a <div><dt/><dd/></div> in a <dl> (was .summary in sales.module.css).
export const statCardsClass =
  "m-0 grid grid-cols-3 gap-3 max-[640px]:grid-cols-1 [&_div]:min-w-0 [&_div]:rounded-md [&_div]:border [&_div]:bg-card [&_div]:p-4 [&_div]:[overflow-wrap:anywhere] " +
  "[&_dd]:m-0 [&_dd]:mt-1 [&_dd]:text-lg [&_dd]:font-bold [&_dt]:text-sm [&_dt]:text-muted-foreground"
