import type { ReactNode } from "react";
import Link from "next/link";
import type { Fix } from "@/lib/errors/error-map";
import * as styles from "./contract-section-styles";

export type ContractStep = {
  title: string; detail: string; state: "done" | "now" | "todo"; actions?: ReactNode;
  blocker?: { label: string; text: string; fixes: Fix[] };
};

/** The four contract sub-steps in order; the current one is highlighted and blockers sit under the step they stop. */
export function ContractSteps({ steps }: { steps: ContractStep[] }) {
  return <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title} className={styles.step} aria-current={step.state === "now" ? "step" : undefined}>
    <span className={styles.badge} data-state={step.blocker ? "blocked" : step.state} aria-hidden="true">{step.state === "done" ? "✓" : step.blocker ? "!" : index + 1}</span>
    <div className={styles.stepBody}>
      <div className={styles.stepRow}>
        <span className={styles.stepTitle}><strong>{step.title}</strong><small>{step.detail}</small></span>
        {step.actions && <div className={styles.stepActions}>{step.actions}</div>}
      </div>
      {step.blocker && <div role="note" className={styles.blocker}>
        <span><strong>{step.blocker.label}</strong> {step.blocker.text}</span>
        {step.blocker.fixes.map(fix => <Link key={fix.href} href={fix.href} prefetch={false}>{fix.label}</Link>)}
      </div>}
    </div>
  </li>)}</ol>;
}
