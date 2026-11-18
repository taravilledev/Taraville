import type { CaseTab } from "./case-progress";
import type { TaskName } from "./tasks";

export const bkpCaseTabs = ["overview", "design", "quotation", "contract", "money"] as const;

const legacyFlowTabs: Record<string, CaseTab> = { intake: "overview", design: "design", fees: "money", quotation: "quotation", contract: "contract" };

export function resolveCaseTab(tabs: readonly CaseTab[], tab?: string, flow?: string): CaseTab {
  const requested = tab === "overview" && flow && tabs.includes("quotation") && Object.hasOwn(legacyFlowTabs, flow) ? legacyFlowTabs[flow] : tab;
  return tabs.find(item => item === requested) ?? "overview";
}

export function taskReturnTab(name: TaskName, isBkp: boolean, isDesignPayment = false): CaseTab {
  void isDesignPayment;
  switch (name) {
    case "design": return "design";
    case "issue-design-invoice": case "prepare-design-payment": case "cancel-design-invoice": return isBkp ? "money" : "design";
    case "confirm-payment": case "withdraw-payment": return "money";
    case "prepare-payment": case "prepare-instalment": case "fix-receipt": case "issue-invoice":
    case "request-refund": case "decide-refund": case "pay-refund": return "money";
    case "acceptance": return isBkp ? "money" : "overview";
    case "issue-quotation": case "accept-quotation": return isBkp ? "quotation" : "overview";
    case "prepare-contract": case "edit-contract": case "lock-contract": case "unlock-contract":
    case "sign-contract": case "contract-addendum": case "amend": return isBkp ? "contract" : "overview";
    default: return "overview";
  }
}
