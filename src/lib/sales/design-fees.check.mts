import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { nextDesignPayment } from "./design-fees.ts";

const instalments = ["350000", "350000", "500000"];
assert.deepEqual(nextDesignPayment(instalments, "100000"), { position: 1, amount: "250000" });
assert.deepEqual(nextDesignPayment(instalments, "350000"), { position: 2, amount: "350000" });
assert.deepEqual(nextDesignPayment(instalments, "800000"), { position: 3, amount: "400000" });
assert.equal(nextDesignPayment(instalments, "1200000"), null);
assert.equal(nextDesignPayment(instalments, "1300000"), null);
console.log("Design payment suggestion handles partial and completed receipts");
