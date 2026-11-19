import assert from "node:assert/strict";
// @ts-expect-error Node executes this check directly
import { documentLibrary } from "./document-library.ts";

const quote = { id: "q1", kind: "quotation", state: "accepted", number: "Q1", revision: 1, parent_id: null, payload: { total_cents: "10000", price_set: true } };
const contract = { ...quote, id: "c1", kind: "contract", number: "C1", state: "signed", parent_id: "q1" };
const docs = [quote, { ...quote, id: "q2", number: "Q2", revision: 2 }, contract,
  { ...contract, id: "c0", number: "C0", state: "cancelled" }];
const finance = { documents: docs.map(doc => ({ ...doc, document_date: "2026-11-08", amount_cents: null })), };
const rows = documentLibrary(finance, { documents: docs });
assert.equal(rows.length, 4, "Joining projections must not duplicate documents");
assert.equal(rows.find(doc => doc.id === "q1")?.history, false);
assert.equal(rows.find(doc => doc.id === "q2")?.history, true, "Current quote follows the actual contract binding, not the newest accepted revision");
assert.match(rows.find(doc => doc.id === "q1")?.note ?? "", /C1/);
assert.equal(rows.find(doc => doc.id === "c0")?.history, true);
assert.equal(rows.find(doc => doc.id === "q1")?.amount, "10000");
assert.equal(rows.find(doc => doc.id === "q1")?.date, "2026-11-08");
assert.equal(documentLibrary({ documents: [] }, { documents: [{ ...quote, payload: { price_set: false, total_cents: "0" } }] })[0].amount, null);
assert.equal(documentLibrary({ documents: [] }, { documents: [{ ...quote, state: "cancelled", payload: { price_set: false, total_cents: "0" } }] })[0].status, "ยกเลิกแล้ว");
assert.equal(documentLibrary({ documents: [{ id: "r", kind: "receipt", number: "R", state: "issued", document_date: "2026-11-08", amount_cents: "10" }] }, { documents: [] })[0].group, "receipt");
assert.deepEqual(documentLibrary({ documents: [] }, { documents: [] }), []);
const concurrent = documentLibrary({ documents: [] }, { documents: [quote, contract,
  { ...contract, id: "awaiting", state: "awaiting_signature" },
  { ...contract, id: "new-draft", state: "draft", parent_id: "q1", revision: 3 },
] });
assert.equal(concurrent.find(doc => doc.id === "c1")?.history, false, "Signed contract remains visible alongside a newer draft");
assert.equal(concurrent.find(doc => doc.id === "awaiting")?.history, false, "Awaiting-signature work is visible outside passive history");
assert.equal(concurrent.find(doc => doc.id === "new-draft")?.history, false);
console.log("PASS: exact contract binding, revision history, merged dates/amounts and receipt grouping");
