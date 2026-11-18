import assert from "node:assert/strict";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { nextStep, type NextStepInput } from "./case-progress.ts";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { availableTasks, findTask, taskLabels, taskNames, type TaskContext } from "./tasks.ts";

const keys = ["financial.prepare", "financial.confirm", "receipt.issue", "receipt.cancel", "contract.sign", "contract.cancel", "contract.amend",
  "billing.issue", "acceptance.record", "refund.request", "refund.approve", "refund.pay"];
const everything = Object.fromEntries(keys.map(key => [key, true]));
const nothing = Object.fromEntries(keys.map(key => [key, false]));
const ID = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

const ctxBase: TaskContext = { brand: "TARAVILLE", status: "draft", can: everything, canAssign: false, hasNetPrice: true, design: { canChange: true },
  summaryCount: 0, hasPayments: false, plotHeld: false, unitOptions: 0, pendingPaymentIds: [], receipts: [], quotations: [], contracts: [],
  instalments: [], workAcceptance: [], refunds: [] };
const stepBase: NextStepInput = { brand: "TARAVILLE", status: "draft", can: everything, hasNetPrice: true, hasSummary: false, hasBookingReceipt: false,
  isBookingDue: true, hasDesignPlan: false, pendingPayments: 0, refundsToAct: 0, plotHeld: false, isSettled: false,
  quotations: { offered: 0, accepted: 0 }, contract: "none", instalment: null };
const row = { id: ID(9), needsAcceptance: true, accepted: false, hasInvoice: false, canReceive: false };
const stepRow = { id: ID(9), label: "งวดงาน 1", needsAcceptance: true, accepted: false, hasInvoice: false, outstanding: true, isCreditCovered: false };

type Scenario = [string, Partial<NextStepInput>, Partial<TaskContext>];
const bk = { brand: "BAAN_KUNAPAP" as const };
const scenarios: Scenario[] = [
  ["TV draft without price", { hasNetPrice: false }, { hasNetPrice: false }],
  ["TV draft", {}, {}],
  ["TV reserved without summary", { status: "reserved" }, { status: "reserved" }],
  ["TV reserved booking due", { status: "reserved", hasSummary: true }, { status: "reserved", summaryCount: 1 }],
  ["TV reserved ready to sign", { status: "reserved", hasSummary: true, hasBookingReceipt: true }, { status: "reserved", summaryCount: 1 }],
  ["TV cancelled plot held", { status: "cancelled", plotHeld: true }, { status: "cancelled", plotHeld: true }],
  ["BK design", { ...bk }, { brand: "BAAN_KUNAPAP" }],
  ["BK quotation", { ...bk, hasDesignPlan: true }, { brand: "BAAN_KUNAPAP" }],
  ["BK offered", { ...bk, hasDesignPlan: true, quotations: { offered: 1, accepted: 0, offeredId: ID(2) } },
    { brand: "BAAN_KUNAPAP", quotations: [{ id: ID(2), state: "offered" }] }],
  ["BK accepted", { ...bk, quotations: { offered: 0, accepted: 1 } }, { brand: "BAAN_KUNAPAP", quotations: [{ id: ID(2), state: "accepted" }] }],
  ["BK awaiting signature", { ...bk, contract: "awaiting", contractId: ID(3), quotations: { offered: 0, accepted: 1 } },
    { brand: "BAAN_KUNAPAP", contracts: [{ id: ID(3), state: "awaiting_signature" }] }],
  ["BK acceptance", { ...bk, status: "contracted", instalment: stepRow }, { brand: "BAAN_KUNAPAP", status: "contracted", instalments: [row] }],
  ["BK invoice", { ...bk, status: "contracted", instalment: { ...stepRow, accepted: true } },
    { brand: "BAAN_KUNAPAP", status: "contracted", instalments: [{ ...row, accepted: true }] }],
  ["BK receive", { ...bk, status: "contracted", instalment: { ...stepRow, accepted: true, hasInvoice: true } },
    { brand: "BAAN_KUNAPAP", status: "contracted", instalments: [{ ...row, accepted: true, hasInvoice: true, canReceive: true }] }],
];
for (const [name, stepPatch, ctxPatch] of scenarios) {
  const step = nextStep({ ...stepBase, ...stepPatch });
  const tasks = availableTasks({ ...ctxBase, ...ctxPatch });
  assert.ok(step, `${name}: a step exists`);
  assert.ok(step.task, `${name}: the step names a task`);
  assert.ok(taskNames.includes(step.task), `${name}: ${step.task} is registered`);
  assert.ok(findTask(tasks, step.task, step.row), `${name}: ${step.task}${step.row ? ` row ${step.row}` : ""} must be available when the step is`);
  // Without permissions the step is not allowed and the task is hidden, so no link can lead to a refused view.
  const denied = nextStep({ ...stepBase, ...stepPatch, can: nothing });
  assert.equal(denied?.allowed, false, `${name}: denied step`);
  assert.equal(findTask(availableTasks({ ...ctxBase, ...ctxPatch, can: nothing }), step.task, step.row), undefined, `${name}: hidden without permission`);
}

// Row tasks need their row; a different row is not that task.
const received = availableTasks({ ...ctxBase, brand: "BAAN_KUNAPAP", status: "contracted", instalments: [{ ...row, accepted: true, hasInvoice: true, canReceive: true }] });
assert.equal(findTask(received, "prepare-instalment", ID(8)), undefined);
assert.equal(findTask(received, "prepare-instalment", undefined), undefined);
assert.ok(findTask(received, "prepare-instalment", ID(9)));

// Receipts: replacing needs receipt.issue once cancelled; correcting the amount needs all four rights on an issued receipt.
const receipts = (can: Record<string, boolean>, state: string) => availableTasks({ ...ctxBase, can, receipts: [{ id: ID(5), state }] });
assert.ok(findTask(receipts({ ...nothing, "receipt.cancel": true }, "issued"), "fix-receipt", ID(5)));
assert.equal(findTask(receipts({ ...nothing, "receipt.cancel": true }, "cancelled"), "fix-receipt", ID(5)), undefined);
assert.ok(findTask(receipts({ ...nothing, "receipt.cancel": true, "receipt.issue": true }, "cancelled"), "fix-receipt", ID(5)));

// Exceptions sit in their own group and respect status and rights.
for (const [status, permission] of [["reserved", "financial.prepare"], ["contracted", "contract.amend"]] as const) {
  assert.ok(findTask(availableTasks({ ...ctxBase, status, unitOptions: 1, can: { ...nothing, [permission]: true } }), "change-unit", undefined), `${status}: ${permission} allows plot change`);
  assert.equal(findTask(availableTasks({ ...ctxBase, status, unitOptions: 1, can: { ...nothing, "contract.cancel": true } }), "change-unit", undefined), undefined, `${status}: cancellation alone does not allow plot change`);
}
const exceptions = availableTasks({ ...ctxBase, status: "contracted", canAssign: true, hasPayments: true, unitOptions: 2,
  instalments: [{ ...row, accepted: true, hasInvoice: true }], refunds: [{ id: ID(6), state: "pending", isMine: false }, { id: ID(7), state: "approved", isMine: false }] });
for (const name of ["change-unit", "amend", "close", "assign", "request-refund"]) assert.equal(exceptions.find(task => task.name === name)?.group, "exception", name);
assert.ok(findTask(exceptions, "decide-refund", ID(6)) && findTask(exceptions, "pay-refund", ID(7)));
assert.equal(availableTasks({ ...ctxBase, status: "cancelled" }).some(task => task.name === "close"), false, "A cancelled case cannot be closed again");
assert.equal(availableTasks({ ...ctxBase, refunds: [{ id: ID(6), state: "pending", isMine: true }], can: { ...nothing, "refund.approve": true } })
  .some(task => task.name === "decide-refund"), false, "Only the requester can withdraw their own request");
assert.ok(taskNames.every(name => taskLabels[name].length > 0));
console.log("tasks ok");

const estimateTasks = availableTasks({ ...ctxBase, ...bk, quotations: [{ id: ID(2), state: "offered", hasPrice: false }] });
assert.equal(findTask(estimateTasks, "accept-quotation", ID(2)), undefined, "Unpriced estimate has no acceptance action");
const draftTasks = availableTasks({ ...ctxBase, ...bk, quotations: [{ id: ID(2), state: "accepted", hasPrice: true }],
  contracts: [{ id: ID(3), state: "draft" }] });
assert.ok(findTask(draftTasks, "edit-contract", ID(3)));
assert.ok(findTask(draftTasks, "lock-contract", ID(3)));
assert.equal(findTask(draftTasks, "prepare-contract", undefined), undefined, "Existing live draft cannot start a parallel contract");
const lockedTasks = availableTasks({ ...ctxBase, ...bk, contracts: [{ id: ID(3), state: "awaiting_signature" }] });
assert.ok(findTask(lockedTasks, "unlock-contract", ID(3)));
assert.equal(findTask(lockedTasks, "edit-contract", ID(3)), undefined);
assert.equal(findTask(lockedTasks, "issue-quotation", undefined), undefined);

const designContext = { ...ctxBase, ...bk, design: { canChange: true, amounts: ["350000", "350000", "500000"], bills: [] } };
const designBill = { id: ID(10), position: 1, state: "issued", pendingId: null, received: "0", hasConfirmed: false };
const designTasks = availableTasks(designContext);
assert.ok(findTask(designTasks, "issue-design-invoice", "1"));
assert.ok(findTask(designTasks, "issue-design-invoice", "3"));
assert.equal(findTask(designTasks, "issue-design-invoice", "4"), undefined);
const activeDesignTasks = availableTasks({ ...designContext, design: { ...designContext.design, canChange: false, bills: [designBill] } });
assert.equal(findTask(activeDesignTasks, "issue-design-invoice", "1"), undefined);
assert.equal(findTask(activeDesignTasks, "design", undefined), undefined);
assert.ok(findTask(activeDesignTasks, "prepare-design-payment", ID(10)));
assert.ok(findTask(activeDesignTasks, "cancel-design-invoice", ID(10)));
for (const patch of [{ pendingId: ID(11) }, { received: "350000", hasConfirmed: true }, { received: "0", hasConfirmed: true }]) {
  const blocked = availableTasks({ ...designContext, design: { ...designContext.design, bills: [{ ...designBill, ...patch }] } });
  assert.equal(findTask(blocked, "prepare-design-payment", ID(10)), undefined);
  assert.equal(findTask(blocked, "cancel-design-invoice", ID(10)), undefined);
}
for (const patch of [{ status: "contracted" as const }, { status: "cancelled" as const }, { can: nothing }, { brand: "TARAVILLE" as const },
  { design: { ...designContext.design, legacyReceived: "1" } }]) {
  const blocked = availableTasks({ ...designContext, ...patch });
  assert.equal(blocked.some(task => ["issue-design-invoice", "prepare-design-payment", "cancel-design-invoice"].includes(task.name)), false);
}
assert.equal(availableTasks({ ...designContext, design: { canChange: true, amounts: ["0", "350000", "500000"] } })
  .some(task => task.name === "issue-design-invoice" && task.row === "1"), false, "Zero design instalment has no bill");
const separateSigned: TaskContext = { ...designContext, status: "contracted",
  contracts: [{ id: ID(15), state: "signed", hasSeparateDesignFee: true }],
  design: { ...designContext.design, bills: [designBill] } };
for (const status of ["contracted", "completed"] as const) {
  const separateTasks = availableTasks({ ...separateSigned, status });
  assert.ok(findTask(separateTasks, "issue-design-invoice", "2"));
  assert.ok(findTask(separateTasks, "prepare-design-payment", designBill.id));
  assert.ok(findTask(separateTasks, "cancel-design-invoice", designBill.id));
}
for (const context of [{ ...separateSigned, status: "cancelled" as const },
  { ...separateSigned, contracts: [{ id: ID(15), state: "signed" }] }]) {
  assert.equal(findTask(availableTasks(context), "issue-design-invoice", "2"), undefined);
}
console.log("design billing task guards ok");

const signedBkp: TaskContext = { ...ctxBase, brand: "BAAN_KUNAPAP", status: "contracted",
  can: { "financial.view": true, "contract.amend": true }, contracts: [{ id: ID(15), state: "signed" }] };
assert.ok(findTask(availableTasks(signedBkp), "contract-addendum", ID(15)));
const addendumDeniedContexts: TaskContext[] = [
  { ...signedBkp, can: { "financial.view": true } },
  { ...signedBkp, can: { "contract.amend": true } },
  { ...signedBkp, brand: "TARAVILLE" as const },
  { ...signedBkp, status: "cancelled" as const },
  { ...signedBkp, contracts: [{ id: ID(15), state: "awaiting_signature" }] },
];
for (const denied of addendumDeniedContexts) assert.equal(findTask(availableTasks(denied), "contract-addendum", ID(15)), undefined);
console.log("Contract addendum requires a signed BKP contract and both capabilities");
