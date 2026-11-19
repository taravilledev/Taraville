import Link from "next/link";
import { listHref, type LeadFilters } from "@/lib/walkin/lead-list";

type Counts = { all: number; taraville: number; baanKunapap: number };

// Counts follow every filter except brand; each tile is also the brand filter.
export function BrandTiles({ filters, counts }: { filters: LeadFilters; counts: Counts }) {
  const tiles = [
    { brand: undefined, label: "ทั้งหมด", count: counts.all },
    { brand: "TARAVILLE", label: "ธาราวิลล์", count: counts.taraville },
    { brand: "BAAN_KUNAPAP", label: "บ้านคุณภาพ", count: counts.baanKunapap },
  ] as const;
  return <nav className="flex flex-wrap gap-2" aria-label="กรองตามแบรนด์">
    {tiles.map(tile => <Link key={tile.label} className="inline-flex min-h-(--tap-min) items-center gap-2 rounded-sm border px-3 py-1 text-muted-foreground no-underline hover:bg-accent [&_strong]:text-foreground [&_strong]:tabular-nums aria-[current]:border-primary aria-[current]:bg-accent aria-[current]:font-bold aria-[current]:text-primary" prefetch={false}
      href={listHref(filters, { brand: tile.brand, page: undefined })} aria-current={filters.brand === tile.brand ? "page" : undefined}>
      <span>{tile.label}</span><strong>{tile.count.toLocaleString("th-TH")}</strong>
    </Link>)}
  </nav>;
}
