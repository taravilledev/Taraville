import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports: Record<string, unknown> = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("./username.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, require: createRequire(import.meta.url) });
const { usernameEmail, usernameSchema } = exports as typeof import("./username");
assert.equal(usernameEmail(" Sale1 "), "sale1@staff.taraville.invalid");
assert.equal(usernameEmail("executive"), "executive@staff.taraville.invalid");
for (const value of ["", "ab", "sale@example.com", "sale 1", "../sale", "ฝ่ายขาย", "x".repeat(33), "1sale"]) {
  assert.equal(usernameSchema.safeParse(value).success, false);
}
console.log("PASS: canonical usernames map deterministically; invalid identifiers rejected");
