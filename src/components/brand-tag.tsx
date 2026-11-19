import { brandLabels } from "@/lib/sales/models"
import type { Brand } from "@/lib/walkin/survey-questions"

// The brand mark alone (sidebar logo); BrandTag is the chip used in lists and headers.
export function BrandMark({ brand }: { brand: Brand }) {
  return brand === "TARAVILLE"
    ? <span className="relative size-3 shrink-0 overflow-hidden rounded-xs bg-brand-tv" aria-hidden="true"><span className="absolute inset-x-0 top-0 h-1 bg-brand-tv-accent" /></span>
    : <span className="relative size-3 shrink-0 overflow-hidden rounded-xs bg-brand-bk" aria-hidden="true"><span className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 bg-brand-bk-accent" /></span>
}

export function BrandTag({ brand }: { brand: Brand }) {
  return <span data-slot="brand-tag" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
    <BrandMark brand={brand} />
    {brandLabels[brand]}
  </span>
}
