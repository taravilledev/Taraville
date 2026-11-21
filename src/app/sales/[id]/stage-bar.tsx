import Link from "next/link";
import { projectSteps, type CaseTab } from "@/lib/sales/case-progress";
import { bkpCaseTabs } from "@/lib/sales/case-navigation";
import type { SalesCase } from "@/lib/sales/models";
import * as styles from "./stage-bar-styles";

type Brand = SalesCase["brand"];
type Props = { caseId: string; brand: Brand; current: number; selected: CaseTab; designNote?: string | null };

/** The tab each stage opens. Taraville has no tab per stage: two stages share a tab (ADR 0065). */
export const stageTabs: Record<Brand, readonly CaseTab[]> = {
  BAAN_KUNAPAP: bkpCaseTabs,
  TARAVILLE: ["overview", "overview", "documents", "documents", "money"],
};

/** Stage bar: five stage tabs plus the documents utility tab. `current` is -1 when the project has no live stage (cancelled), 5 when complete. */
export function StageBar({ caseId, brand, current, selected, designNote }: Props) {
  const steps = projectSteps(brand);
  const tabs = stageTabs[brand];
  const href = (tab: CaseTab) => `/sales/${caseId}?tab=${tab}`;
  // Stages sharing the selected tab (ADR 0065): highlight the one nearest the current stage, i.e. the current one when it shares the tab.
  const sharing = tabs.flatMap((tab, index) => tab === selected ? [index] : []);
  const highlighted = sharing.reduce((best, index) => best === -1 || Math.abs(index - current) < Math.abs(best - current) ? index : best, -1);
  return <nav className={styles.bar} aria-label="ขั้นของโครงการ">
    {tabs.map((tab, index) => {
      const state = index < current ? "done" : index === current ? "now" : "todo";
      return <Link key={index} className={styles.tab} href={href(tab)} prefetch={false} aria-current={index === highlighted ? "page" : undefined}>
        <span className={styles.badge} data-state={state} aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
        <span className="grid leading-tight"><span>{steps[index]}</span>
          {state === "now" && <small className={styles.note} data-now>กำลังทำ{brand === "BAAN_KUNAPAP" && index === 1 && designNote ? ` · ${designNote}` : ""}</small>}</span>
      </Link>;
    })}
    <Link className={styles.utility} href={href("documents")} prefetch={false} aria-current={highlighted === -1 && selected === "documents" ? "page" : undefined}>
      <span className={styles.badge} data-state="util" aria-hidden="true">≡</span><span>เอกสาร</span>
    </Link>
  </nav>;
}
