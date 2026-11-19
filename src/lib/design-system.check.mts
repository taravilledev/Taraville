import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ADR 0031: shadcn + Tailwind utilities with semantic colour tokens; CSS modules only shrink.
const srcRoot = new URL("..", import.meta.url).pathname;
const all = (readdirSync(srcRoot, { recursive: true }) as string[]).map(file => file.split("\\").join("/"));

// 1. Colours in .ts/.tsx (whole file, so cn()/cva() arguments are covered) must be semantic tokens.
const palette = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const colourRules: [string, RegExp][] = [
  ["raw palette utility", new RegExp(`\\b(?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|shadow|accent|caret|decoration|placeholder)-(?:${palette})\\b`)],
  ["arbitrary colour", /-\[(?:#|rgba?\(|hsla?\(|oklch\()/],
];
const sources = all.filter(file => /\.tsx?$/.test(file) && !file.endsWith(".check.mts"));
assert.ok(sources.length > 0, "No sources found; the scan path is wrong");
const colourOffences: string[] = [];
for (const file of sources) {
  readFileSync(join(srcRoot, file), "utf8").split("\n").forEach((line, index) => {
    for (const [name, pattern] of colourRules) if (pattern.test(line)) colourOffences.push(`${file}:${index + 1} ${name}: ${line.trim()}`);
  });
}
assert.deepEqual(colourOffences, [], `Use semantic colour tokens (bg-primary, text-muted-foreground, bg-brand-tv…):\n${colourOffences.join("\n")}`);

// 1b. Primitives must follow density (.dense): control sizes come from --control-h / --tap-min and text from the app scale.
const fixedSize = /\b(?:h|size)-(?:8|9|10)\b|\bmd:text-/;
const sizeOffences: string[] = [];
for (const file of sources.filter(file => file.startsWith("components/ui/"))) {
  readFileSync(join(srcRoot, file), "utf8").split("\n").forEach((line, index) => {
    if (fixedSize.test(line)) sizeOffences.push(`${file}:${index + 1} fixed control size: ${line.trim()}`);
  });
}
assert.deepEqual(sizeOffences, [], `Use h-(--control-h) / h-(--tap-min) and text-md in ui/ (ADR 0031):\n${sizeOffences.join("\n")}`);

// 2. CSS modules: print documents stay forever; the migration allowlist only ever loses entries (plan-shadcn-migration P3/P4).
const PRINT_MODULES = new Set([
  "leads/report/report.module.css",
  "sales/[id]/tasks/contract-paper.module.css",
  "sales/[id]/tasks/payment-paper.module.css",
  "sales/documents/[id]/document.module.css",
  "sales/documents/[id]/receipt-paper.module.css",
]);
const MIGRATION_ALLOWLIST = new Set([
  "dashboard/overview.module.css",
  "login/auth.module.css",
  "sales/[id]/tasks/contract-wizard.module.css",
  "sales/[id]/tasks/quotation-acceptance.module.css",
  "sales/[id]/tasks/quotation-editor.module.css",
  "sales/[id]/tasks/task-header.module.css",
  "summary/summary.module.css",
]);
const modules = all.filter(file => file.startsWith("app/") && file.endsWith(".module.css")).map(file => file.slice(4));
const unknown = modules.filter(file => !PRINT_MODULES.has(file) && !MIGRATION_ALLOWLIST.has(file));
assert.deepEqual(unknown, [], `New CSS modules are not allowed (ADR 0031); build with ui/ components and utilities:\n${unknown.join("\n")}`);
const stale = [...PRINT_MODULES, ...MIGRATION_ALLOWLIST].filter(file => !modules.includes(file));
assert.deepEqual(stale, [], `Remove deleted modules from the lists in design-system.check.mts:\n${stale.join("\n")}`);

console.log(`PASS: ${sources.length} source files use semantic colours; ${modules.length} CSS modules (${PRINT_MODULES.size} print, ${MIGRATION_ALLOWLIST.size} left to migrate)`);
