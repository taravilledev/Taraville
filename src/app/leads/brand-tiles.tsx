import Link from "next/link";
import { Building2, Home, Users } from "lucide-react";
import { listHref, type LeadFilters } from "@/lib/walkin/lead-list";
import styles from "./leads.module.css";

type Counts = { all: number; taraville: number; baanKunapap: number };

// Counts follow every filter except brand; each tile is also the brand filter.
export function BrandTiles({ filters, counts }: { filters: LeadFilters; counts: Counts }) {
  const tiles = [
    { brand: undefined, label: "ทั้งหมด", count: counts.all, Icon: Users, tone: styles.toneAll },
    { brand: "TARAVILLE", label: "ธาราวิล", count: counts.taraville, Icon: Home, tone: styles.toneTv },
    { brand: "BAAN_KUNAPAP", label: "บ้านคุณภาพ", count: counts.baanKunapap, Icon: Building2, tone: styles.toneBk },
  ] as const;
  return <nav className={styles.tiles} aria-label="กรองตามแบรนด์">
    {tiles.map(tile => <Link key={tile.label} className={`${styles.tile} ${tile.tone}`} prefetch={false}
      href={listHref(filters, { brand: tile.brand, page: undefined })} aria-current={filters.brand === tile.brand ? "page" : undefined}>
      <span><small>{tile.label}</small><strong>{tile.count.toLocaleString("th-TH")}</strong></span>
      <tile.Icon size={20} aria-hidden="true" />
    </Link>)}
  </nav>;
}
