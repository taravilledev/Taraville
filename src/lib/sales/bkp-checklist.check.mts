import assert from "node:assert/strict";
// @ts-expect-error node runs this check directly
import { bkpChecklist } from "./bkp-checklist.ts";

const quote = { id: "q1", kind: "quotation", state: "accepted", parent_id: null, payload: { total_cents: "10000", price_set: true } };
const contract = { id: "c1", kind: "contract", state: "draft", parent_id: "q1", payload: {} };
const row = { id: "r1", position: 1, label: "Deposit", needs_acceptance: false, accepted_at: null, invoice_id: null,
  invoice_document_id: null, net_cents: "10000", is_active: true, balance: null };
const empty = bkpChecklist({ hasDesignPlan: false, documents: [], instalments: [] });
assert.deepEqual(empty.milestones, [true, false, false, false, false]);
assert.equal(empty.preparation.some(item => item.done), false);
const draft = bkpChecklist({ hasDesignPlan: true, documents: [quote, contract], instalments: [] });
assert.deepEqual(draft.milestones, [true, true, true, false, false]);
assert.deepEqual(draft.preparation.slice(3).map(item => item.done), [true, false, false]);
const bound = bkpChecklist({ hasDesignPlan: true, documents: [{ ...quote, state: "offered" }, { ...quote, id: "q2" }, contract], instalments: [] });
assert.equal(bound.milestones[2], false, "A different accepted revision cannot satisfy the live contract binding");
assert.equal(bkpChecklist({ hasDesignPlan: true, documents: [{ ...quote, payload: { total_cents: "0", price_set: false } }], instalments: [] }).milestones[2], false);
const credit = bkpChecklist({ hasDesignPlan: true, documents: [quote, { ...contract, state: "signed" }], instalments: [{ ...row, net_cents: "0" }] });
assert.equal(credit.rows[0].done, false, "Zero-net credit still requires a posted invoice/credit summary");
assert.equal(credit.rows[0].checks.at(-1)?.task, undefined, "No cash action for a fully credited instalment");
const paid = { ...row, invoice_id: "i1", invoice_document_id: "d1", balance: { outstanding_cents: "0", allocated_cents: "10000", net_cents: "10000", is_active: true } };
const work = { ...paid, id: "r2", position: 2, needs_acceptance: true };
const collecting = bkpChecklist({ hasDesignPlan: true, documents: [quote, { ...contract, state: "signed" }], instalments: [work, paid, { ...row, id: "old", is_active: false }] });
assert.equal(collecting.rows.length, 2);
assert.equal(collecting.currentRow?.id, "r2", "Paid money alone cannot complete work acceptance");
assert.equal(collecting.milestones[4], false);
assert.equal(collecting.rows[0].done, true);
assert.equal(collecting.rows[0].checks.some(item => /ใบเสร็จ/.test(item.label)), false, "No unsupported per-instalment receipt assertion");
const settled = bkpChecklist({ hasDesignPlan: true, documents: [quote, { ...contract, state: "signed" }], instalments: [paid, { ...work, accepted_at: "2026-11-08" }] });
assert.equal(settled.milestones[4], true);
console.log("PASS: evidence-based stages, bound revision, credit, acceptance and active instalments");
