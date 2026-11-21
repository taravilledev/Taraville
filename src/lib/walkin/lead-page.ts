import type { LeadWork } from "../sales/lead-work";
import type { StageGroup } from "./lead-stage";
import type { Project } from "./models";

/** The one primary action of the Lead page: open a Project, or continue the only live one; none when several are live or the Lead is closed. */
export function primaryAction(group: StageGroup, liveCount: number): "open" | "continue" | null {
  if (group === "closed") return null;
  if (group === "open") return "open";
  return liveCount === 1 ? "continue" : null;
}

export type WorkItem = LeadWork["cases"][number];
/** A Project of the Lead (BKP) or a sale (Taraville), with where its card leads. A BKP Project without a sale is half open. */
export type WorkRow = { code: string; item?: WorkItem; project?: Project; href?: string; isFinished: boolean; isHalfOpen: boolean };
const isDone = (item: WorkItem) => item.status === "completed" || item.status === "cancelled";
const caseHref = (item: WorkItem) => (item.id && item.can_open ? `/sales/${item.id}` : undefined);

/** Live work first, finished last; the order inside each group is the query's (newest first). */
export function workRows(leadId: string, brand: "BAAN_KUNAPAP" | "TARAVILLE", projects: Project[], work: LeadWork): WorkRow[] {
  const rows: WorkRow[] = brand === "TARAVILLE"
    ? work.cases.map(item => ({ code: item.code, item, href: caseHref(item), isFinished: isDone(item), isHalfOpen: false }))
    : projects.map(project => {
      const item = work.cases.find(row => row.project_id === project.id);
      const isCancelled = project.status === "cancelled";
      const isHalfOpen = !item && !isCancelled;
      return { code: project.code, item, project, isFinished: isCancelled || (item ? isDone(item) : false), isHalfOpen,
        // The recovery path of a half-open Project is the sale form, prefilled with the Project.
        href: item ? caseHref(item) : isHalfOpen && work.canCreate ? `/sales/new?lead=${leadId}&project=${project.id}` : undefined };
    });
  return [...rows.filter(row => !row.isFinished), ...rows.filter(row => row.isFinished)];
}
