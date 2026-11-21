import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { safeNextPath } from "./next-path.ts";

assert.equal(safeNextPath("/sales/42?tab=money"), "/sales/42?tab=money");
assert.equal(safeNextPath("/dashboard#top"), "/dashboard");
assert.equal(safeNextPath("/leads/../sales"), "/sales");
for (const unsafe of [undefined, null, 42, "", "dashboard", "//evil.example", "/\\evil.example", "\\\\evil.example",
  "https://evil.example/x", "javascript:alert(1)", "/login", "/login?next=/sales", `/${"a".repeat(2048)}`]) {
  assert.equal(safeNextPath(unsafe), null, `must reject ${String(unsafe).slice(0, 40)}`);
}
console.log("PASS: next-path keeps same-origin paths and rejects off-site, protocol-relative and /login targets");
