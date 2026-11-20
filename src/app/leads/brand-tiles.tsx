import Link from "next/link";
import { listHref, type LeadFilters } from "@/lib/walkin/lead-list";

type Counts = { all: number; taraville: number; baanKunapap: number };

// Counts follow every filter except brand; each tile is also the brand filter. The survey filters are per brand, so they reset with it.
export function BrandTiles({ filters, counts }: { filters: LeadFilters; counts: Counts }) {
  const tiles = [
    { brand: undefined, label: "ทั้งหมด", count: counts.all },
    { brand: "TARAVILLE", label: "ธาราวิลล์", count: counts.taraville },
    { brand: "BAAN_KUNAPAP", label: "บ้านคุณภาพ", count: counts.baanKunapap },
  ] as const;
  return <nav className="inline-flex gap-0.5 rounded-md bg-muted p-[3px]" aria-label="กรองตามแบรนด์">
    {tiles.map(tile => <Link key={tile.label} className="inline-flex min-h-9 items-center gap-2 rounded-sm px-3 font-semibold text-muted-foreground no-underline hover:text-foreground [&_span]:font-medium [&_span]:tabular-nums aria-[current]:bg-card aria-[current]:text-foreground aria-[current]:shadow-xs" prefetch={false}
      href={listHref(filters, { brand: tile.brand, budget: undefined, channel: undefined, page: undefined })} aria-current={filters.brand === tile.brand ? "page" : undefined}>
      {tile.label}<span>{tile.count.toLocaleString("th-TH")}</span>
    </Link>)}
  </nav>;
}
