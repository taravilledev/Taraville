
// Decorative: the input's own `required` attribute is what assistive tech announces.
export function RequiredMark() {
  return <span className="font-bold text-destructive" aria-hidden="true"> *</span>;
}
