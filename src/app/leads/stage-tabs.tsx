import Link from "next/link";
import { listHref, stageTab, type LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_GROUPS, STAGE_GROUP_LABELS } from "@/lib/walkin/lead-stage";
import { tabLinksClass } from "@/components/tab-links";

type Counts = Record<"all" | (typeof STAGE_GROUPS)[number], number>;

// Counts follow every filter except stage. Without a stage in the URL the tab is the default (open, or all while searching).
export function StageTabs({ filters, counts }: { filters: LeadFilters; counts: Counts }) {
  const current = stageTab(filters);
  const tabs = [["all", "ทั้งหมด"], ...STAGE_GROUPS.map(group => [group, STAGE_GROUP_LABELS[group]] as const)] as const;
  return <nav className={tabLinksClass} aria-label="ขั้นของ Lead">
    {tabs.map(([stage, label]) => <Link key={stage} href={listHref(filters, { stage, page: undefined })} prefetch={false} aria-current={stage === current ? "page" : undefined}>
      {label}<span className="ml-2 rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{counts[stage].toLocaleString("th-TH")}</span>
    </Link>)}
  </nav>;
}
