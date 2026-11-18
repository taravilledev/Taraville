import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { z } from "zod";

const source = readFileSync(new URL("./agreement-models.ts", import.meta.url), "utf8");
const declaration = source.match(/export const scheduleRowSchema = ([\s\S]*?);/)?.[1];
assert.ok(declaration);
const schema = runInNewContext(declaration, { z, cents: z.string().regex(/^\d+$/) });
const deposit = { position: 0, label: "Deposit", gross_cents: "100", credit_cents: "0", net_cents: "100", needs_acceptance: false };
assert.equal(schema.parse(deposit).progress_percent, null, "jsonb_strip_nulls omits deposit progress");
assert.equal(schema.parse({ ...deposit, progress_percent: null }).progress_percent, null);
assert.equal(schema.parse({ ...deposit, progress_percent: 20 }).progress_percent, 20);
assert.equal(schema.safeParse({ ...deposit, progress_percent: "20" }).success, false);
console.log("PASS: omitted/null deposit progress and numeric work progress");
