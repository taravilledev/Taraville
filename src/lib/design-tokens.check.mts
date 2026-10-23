import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// CSS modules must take colours, type sizes and radii from the tokens in globals.css.
const root = new URL("../app", import.meta.url).pathname;
const files = (readdirSync(root, { recursive: true }) as string[]).filter(file => file.endsWith(".module.css"));
assert.ok(files.length > 0, "No CSS modules found; the scan path is wrong");

const rules: [string, RegExp][] = [
  ["raw colour", /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/],
  ["raw font-size", /font-size:\s*(?!var\()\S/],
  ["raw border-radius", /border-radius:\s*(?!var\()\S/],
];
const offences: string[] = [];
for (const file of files) {
  readFileSync(join(root, file), "utf8").split("\n").forEach((line, index) => {
    for (const [name, pattern] of rules) if (pattern.test(line)) offences.push(`${file}:${index + 1} ${name}: ${line.trim()}`);
  });
}
assert.deepEqual(offences, [], `Use var(--…) tokens from globals.css:\n${offences.join("\n")}`);
console.log(`PASS: ${files.length} CSS module(s) use design tokens for colour, font-size and border-radius`);
