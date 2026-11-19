import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports: Record<string, unknown> = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("./money.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports }, { timeout: 1000 });
const { parseMoney, formatMoney, netSalePrice, installmentAmounts } = exports as typeof import("./money");
assert.equal(parseMoney("3540000.01"), "354000001");
assert.equal(formatMoney("354000001"), "3,540,000.01");
for (const invalid of ["-1", "1.001", "NaN", "1e3", "1,000", "92233720368547758.08"]) assert.throws(() => parseMoney(invalid));
assert.equal(netSalePrice("10000", "0", null), "0");
assert.equal(netSalePrice(null, null, "100"), null);
assert.throws(() => netSalePrice("100", null, "101"));
const schedule = [1000, 1800, 1800, 1800, 1800, 1800];
const rows = installmentAmounts("10000000", schedule, "2500000");
assert.equal(rows.at(-1)?.net, "0");
assert.equal(rows.at(-2)?.net, "1100000");
assert.equal(rows.reduce((sum, row) => sum + BigInt(row.net), BigInt(0)).toString(), "7500000");
for (const credit of ["1800000", "2500000", "10000000"]) {
  const result = installmentAmounts("10000000", schedule, credit);
  assert.equal(result.reduce((sum, row) => sum + BigInt(row.net) + BigInt(row.credit), BigInt(0)).toString(), "10000000");
  assert.ok(result.every(row => BigInt(row.net) >= BigInt(0)));
}
assert.equal(installmentAmounts("2", [2500, 2500, 2500, 2500]).at(-1)?.net, "2");
assert.throws(() => installmentAmounts("100", [5000]));
assert.throws(() => installmentAmounts("100", [10000], "101"));
console.log("PASS: exact satang, promotion zero, credit conservation and zero-net instalments");
