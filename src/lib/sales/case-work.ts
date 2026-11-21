import { nextStep, projectProgress, projectSteps, type NextStep } from "./case-progress";
import type { CaseFacts, SalesCase } from "./models";
import type { StageTrackStatus } from "./stage-track";
import { taskHref } from "./tasks";

type CaseRef = { id: string; brand: SalesCase["brand"]; status: SalesCase["status"] };

// Stage, next task and follow-ups for one list row; shared by the executive and sale lists so both read the same rules.
export function caseWork(row: CaseRef, { input: facts, ...counts }: CaseFacts, can: Record<string, boolean>) {
  const input = { ...facts, brand: row.brand, status: row.status, can,
    contractId: facts.contractId ?? undefined, quotations: { ...facts.quotations, offeredId: facts.quotations.offeredId ?? undefined } };
  const designRemaining = (row.status === "completed" || (row.status === "contracted" && facts.isSettled)) && counts.designOutstanding;
  const progress = projectProgress(designRemaining ? { ...input, status: "contracted", isSettled: false } : input);
  const current = nextStep(input);
  const step: NextStep | null = designRemaining && current?.kind === "done"
    ? { title: "ติดตามค่าออกแบบ", tab: "money", anchor: "design-fees", allowed: true } : current;
  const caseHref = `/sales/${row.id}`;
  const href = step?.task ? taskHref(row.id, step.task, step.row)
    : step ? `${caseHref}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}` : caseHref;
  const isPreContract = row.status === "draft" || row.status === "reserved";
  const quotation = Number(row.brand === "BAAN_KUNAPAP" && isPreContract && facts.contract === "none" &&
    facts.quotations.accepted === 0 && facts.quotations.offered > 0);
  const signature = Number(isPreContract && facts.contract === "awaiting");
  const followUp = {
    quotation: quotation && input.quotations.offeredId ? taskHref(row.id, "accept-quotation", input.quotations.offeredId) : undefined,
    signature: signature && input.contractId ? taskHref(row.id, "sign-contract", input.contractId) : undefined,
    acceptance: counts.acceptance > 0 ? `${caseHref}?tab=money#schedule` : undefined,
  };
  const status: StageTrackStatus = !progress ? "cancelled" : progress.complete ? "done" : "active";
  return { ...counts, quotation, signature, followUp, stage: progress ? progress.steps[progress.current] : "ปิดงาน / ยกเลิก",
    track: { steps: projectSteps(row.brand), current: progress?.current ?? 0, status },
    action: step?.kind === "done" ? null : step ? { title: step.title, href, allowed: step.allowed } : null };
}
