import Link from "next/link";
import { projectSteps, type CaseTab } from "@/lib/sales/case-progress";
import { bkpCaseTabs } from "@/lib/sales/case-navigation";
import * as styles from "./bkp-stage-bar-styles";

type Props = { caseId: string; current: number; selected: CaseTab; designNote?: string | null };

/** BKP stage bar: five stage tabs plus the documents utility tab. `current` is -1 when the project has no live stage (cancelled). */
export function BkpStageBar({ caseId, current, selected, designNote }: Props) {
  const steps = projectSteps("BAAN_KUNAPAP");
  const href = (tab: CaseTab) => `/sales/${caseId}?tab=${tab}`;
  return <nav className={styles.bar} aria-label="ขั้นของโครงการ">
    {bkpCaseTabs.map((tab, index) => {
      const state = index < current ? "done" : index === current ? "now" : "todo";
      return <Link key={tab} className={styles.tab} href={href(tab)} prefetch={false} aria-current={tab === selected ? "page" : undefined}>
        <span className={styles.badge} data-state={state} aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
        <span className="grid leading-tight"><span>{steps[index]}</span>
          {state === "now" && <small className={styles.note} data-now>กำลังทำ{index === 1 && designNote ? ` · ${designNote}` : ""}</small>}</span>
      </Link>;
    })}
    <Link className={styles.utility} href={href("documents")} prefetch={false} aria-current={selected === "documents" ? "page" : undefined}>
      <span className={styles.badge} data-state="util" aria-hidden="true">≡</span><span>เอกสาร</span>
    </Link>
  </nav>;
}
