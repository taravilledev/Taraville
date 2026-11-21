import Link from "next/link";
import type { NextStep } from "@/lib/sales/case-progress";
import { taskHref, taskLabels } from "@/lib/sales/tasks";
import { buttonVariants } from "@/components/ui/button";
import { StepBlockedNotice } from "./step-blocked-notice";

/** The single next-step card of a BKP project, shown under the stage bar on every tab. */
export function BkpNextStep({ caseId, step, isExecutive }: { caseId: string; step: NextStep | null; isExecutive: boolean }) {
  if (!step) return null;
  if (step.kind === "done") return <p className="m-0 text-sm text-muted-foreground">{step.title}</p>;
  const href = step.task ? taskHref(caseId, step.task, step.row) : `/sales/${caseId}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}`;
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-primary-tint p-5" aria-labelledby="next-step">
    <div className="grid max-w-[720px] gap-1">
      <span id="next-step" className="text-xs font-semibold text-primary">งานถัดไป</span>
      <strong className="text-lg">{step.title}</strong>
      {step.hint && <span className="text-sm text-muted-foreground">{step.hint}</span>}
      {!step.allowed && <StepBlockedNotice isExecutive={isExecutive} />}
    </div>
    {step.allowed && <Link className={buttonVariants({ size: "auto" })} href={href} prefetch={false}>{step.task ? taskLabels[step.task] : "ไปทำขั้นนี้"}</Link>}
  </section>;
}
