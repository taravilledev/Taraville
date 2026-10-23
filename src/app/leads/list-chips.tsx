import Link from "next/link";
import { listHref, type LeadFilters } from "@/lib/walkin/lead-list";
import styles from "./leads.module.css";

export function ListChips({ filters, ownerName }: { filters: LeadFilters; ownerName: Map<string, string> }) {
  const chips = [
    filters.brand && { key: "brand", label: filters.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ" },
    filters.owner && { key: "owner", label: ownerName.get(filters.owner) ?? "ผู้ดูแล" },
    filters.from && { key: "from", label: `ตั้งแต่ ${filters.from}` },
    filters.to && { key: "to", label: `ถึง ${filters.to}` },
  ].filter(chip => chip !== undefined && chip !== "") as { key: keyof LeadFilters; label: string }[];
  if (!chips.length) return null;
  return <div className={styles.chips}>
    {chips.map(chip => <Link key={chip.key} className={styles.chip} prefetch={false} href={listHref(filters, { [chip.key]: undefined, page: undefined })}
      aria-label={`ลบตัวกรอง ${chip.label}`}>{chip.label} ×</Link>)}
    <Link className={styles.clearAll} prefetch={false} href="/leads">ล้างทั้งหมด</Link>
  </div>;
}
