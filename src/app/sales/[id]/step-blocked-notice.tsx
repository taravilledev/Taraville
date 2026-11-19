import { FixNotice } from "@/components/fix-notice";
import { guidance } from "@/lib/errors/error-map";

/** Shown on a next-step card the viewer has no right to run: Sales are told whom to ask, executives get the permissions link. */
export function StepBlockedNotice({ isExecutive }: { isExecutive: boolean }) {
  return <FixNotice {...guidance("sales_permission_denied", { isExecutive })} />;
}
