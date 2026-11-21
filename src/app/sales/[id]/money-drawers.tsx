import type { ComponentType, ReactNode } from "react";
import { taskLabels, type TaskName } from "@/lib/sales/tasks";
import type { TaskData } from "./tasks/task-data";
import { AcceptanceTask, WithdrawPaymentTask } from "./tasks/money-tasks";
import { ConfirmPaymentTask } from "./tasks/confirm-payment-task";
import { DecideRefundTask, PayRefundTask, RequestRefundTask } from "./tasks/exception-tasks";
import { Drawer } from "@/components/drawer";
import { buttonVariants } from "@/components/ui/button";

type Variant = "default" | "outline";
// staffId only matters to decide-refund (own request vs. someone else's); callers without it never open that drawer.
export type MoneyDrawerData = Pick<TaskData, "sale" | "finance" | "agreement" | "refunds" | "work"> & { staffId?: string };
const views = { "confirm-payment": ConfirmPaymentTask, "withdraw-payment": WithdrawPaymentTask, acceptance: AcceptanceTask,
  "request-refund": RequestRefundTask, "decide-refund": DecideRefundTask, "pay-refund": PayRefundTask } satisfies Partial<Record<TaskName, ComponentType<Omit<MoneyDrawerData, "staffId"> & { staffId: string; row?: string; isDrawer?: boolean }>>>;
export type MoneyDrawerTask = keyof typeof views;

/** One short money form as a drawer (`?drawer=<task>-<row>` opens it on load; `request-refund` has no row). */
export function MoneyDrawer({ task, row, data, label, variant = "outline" }: {
  task: MoneyDrawerTask; row?: string; data: MoneyDrawerData; label: ReactNode; variant?: Variant;
}) {
  const View = views[task];
  return <Drawer name={row ? `${task}-${row}` : task} title={taskLabels[task]}
    trigger={<button type="button" className={buttonVariants({ variant, size: "auto" })}>{label}</button>}>
    <View {...data} staffId={data.staffId ?? ""} row={row} isDrawer key={`${data.sale.version}:${data.finance?.version ?? 0}:${row ?? ""}`} />
  </Drawer>;
}
