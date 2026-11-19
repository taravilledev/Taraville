const walkinControlClass =
  "[&_:is(input,select)]:w-full [&_:is(input,select)]:min-w-0 [&_:is(input,select)]:min-h-(--control-h) " +
  "[&_:is(input,select)]:rounded-sm [&_:is(input,select)]:border [&_:is(input,select)]:border-input " +
  "[&_:is(input,select)]:bg-card [&_:is(input,select)]:px-3 [&_:is(input,select)]:py-2 " +
  "[&_:is(input,select)]:text-md/[1.4] [&_:is(input,select)]:font-normal [&_:is(input,select)]:text-foreground " +
  "[&_input::placeholder]:text-muted-foreground";

export const walkinFieldClass = `flex min-w-0 flex-col gap-2 text-sm font-semibold ${walkinControlClass}`;
export const walkinOtherFieldClass = `mt-3 flex flex-col gap-2 text-xs text-muted-foreground ${walkinControlClass}`;
export const walkinTitleClass = "m-0 text-title/[1.5] font-bold";

export const walkinOptionClass =
  "flex min-h-(--control-h) cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-sm " +
  "hover:border-primary has-checked:border-primary has-checked:bg-muted " +
  "[&_input]:m-0 [&_input]:size-5 [&_input]:shrink-0 [&_input]:accent-primary";
