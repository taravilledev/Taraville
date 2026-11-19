import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// CSS modules must take colours, type sizes and radii from the tokens in globals.css.
const root = new URL("../app", import.meta.url).pathname;
const files = (readdirSync(root, { recursive: true }) as string[]).filter(file => file.endsWith(".module.css"));
assert.ok(files.length > 0, "No CSS modules found; the scan path is wrong");

const rules: [string, RegExp][] = [
  ["raw colour", /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/],
  ["raw font-size", /font-size:\s*([^;{}]+)(?=\s*[;}])/],
  ["raw border-radius", /border-radius:\s*([^;{}]+)(?=\s*[;}])/],
];
// Fixed print typography and document branding belong to the paper templates.
const paperValues: Record<string, { colours?: string[]; sizes?: string[] }> = {
  "summary/summary-print.module.css": { sizes: ["9pt"] },
  "leads/report/report.module.css": { colours: ["#111", "#bbb", "#888"], sizes: ["9pt", "10pt", "11pt", "12pt", "18pt"] },
  "sales/[id]/tasks/contract-paper.module.css": { sizes: ["10pt", "12pt"] },
  "sales/[id]/tasks/quotation-editor.module.css": { colours: ["#b6d7a8"] },
  "sales/documents/[id]/document.module.css": { colours: ["#b6d7a8"], sizes: ["10pt", "12pt"] },
  "sales/documents/[id]/receipt-paper.module.css": { sizes: ["10pt", "1.55em", ".9em", ".85em"] },
};
const token = /^var\(--[\w-]+\)$/;

const offences: string[] = [];
for (const file of files) {
  readFileSync(join(root, file), "utf8").split("\n").forEach((line, index) => {
    const paper = paperValues[file];
    for (const [name, pattern] of rules) {
      for (const match of line.matchAll(new RegExp(pattern, "g"))) {
        const value = match[1]?.trim();
        if (name === "raw font-size" && value && (token.test(value) || value === "inherit" || paper?.sizes?.includes(value))) continue;
        if (name === "raw border-radius" && value?.split(/\s+/).every(part => token.test(part) || part === "0" || part === "50%")) continue;
        if (name === "raw colour" && paper?.colours?.includes(match[0])) continue;
        offences.push(`${file}:${index + 1} ${name}: ${line.trim()}`);
      }
    }
  });
}
assert.deepEqual(offences, [], `Use var(--…) tokens from globals.css:\n${offences.join("\n")}`);
console.log(`PASS: ${files.length} CSS module(s) use design tokens for colour, font-size and border-radius`);
