import assert from "node:assert/strict";
// @ts-expect-error Run directly using Node.
import { catalogPage, matchesQuery, unitActivityFields, unitStatus } from "./catalog-list.ts";

assert.equal(matchesQuery(" B3 ", ["Other model", "b3"]), true);
assert.equal(matchesQuery(" B3 ", ["Other model", null]), false);
assert.equal(matchesQuery("", ["B3", undefined]), true);
assert.equal(unitStatus(false, { is_active: true, is_available: true }), "inactive");
assert.equal(unitStatus(true, { is_active: false, is_available: true }), "inactive");
assert.equal(unitStatus(true, { is_active: true, is_available: false }), "reserved");
assert.equal(unitStatus(true, { is_active: true, is_available: true }), "available");
const rows = Array.from({ length: 43 }, (_, index) => index);
assert.deepEqual(catalogPage(rows, "999").rows, [40, 41, 42]);
assert.equal(catalogPage(rows, "-2").page, 1);
assert.equal(catalogPage([], "2").page, 1);

const unit = { id: "unit", version: 4, code: "B3", details: { model: "Example", legacy: ["keep"] },
  is_active: true, is_available: false, list_price_cents: "10000000" };
assert.deepEqual(unitActivityFields(unit, false), {
  p_code: "B3", p_details: { model: "Example", legacy: ["keep"] }, p_list_price_cents: "10000000", p_is_active: false,
});
assert.deepEqual(unitActivityFields({ ...unit, is_active: false, list_price_cents: null }, true), {
  p_code: "B3", p_details: unit.details, p_list_price_cents: null, p_is_active: true,
});
