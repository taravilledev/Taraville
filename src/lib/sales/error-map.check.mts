import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { describeError, errorCodes, errorState, guidance, resolveFix } from "../errors/error-map.ts";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { missingContractPrerequisite } from "./contract-template.ts";

// Latest definition of each function across the migrations (a later create replaces an earlier one, a drop removes it).
const dir = new URL("../../../supabase/migrations/", import.meta.url);
const definitions = new Map<string, string>();
for (const file of readdirSync(dir).filter(name => name.endsWith(".sql")).sort()) {
  const sql = readFileSync(new URL(file, dir), "utf8");
  const marks = [...sql.matchAll(/^\s*(?:create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(|drop\s+function\s+(?:if\s+exists\s+)?([\w."]+))/gim)];
  const seen = new Set<string>();
  marks.forEach((mark, index) => {
    if (mark[2]) { definitions.delete(mark[2].replaceAll('"', "").replace(/^public\./, "")); return; }
    const name = mark[1].replaceAll('"', "").replace(/^public\./, "");
    const body = sql.slice(mark.index, marks[index + 1]?.index ?? sql.length);
    definitions.set(name, (seen.has(name) ? definitions.get(name) ?? "" : "") + body);
    seen.add(name);
  });
}
const raised = new Set<string>();
for (const body of definitions.values()) {
  for (const statement of body.matchAll(/raise\s+exception([^;]*);/gi)) {
    const code = statement[1].match(/message\s*=\s*'([^']*)'/i)?.[1] ?? statement[1].match(/^\s*'([^']*)'/)?.[1];
    if (code && /^[a-z0-9_]+$/.test(code)) raised.add(code);
  }
}
assert.ok(definitions.size > 100 && raised.size > 100, "migration parser found too little");
const tabled = new Set<string>(errorCodes);
assert.deepEqual([...raised].filter(code => !tabled.has(code)), [], "raised codes with no entry in src/lib/errors/error-map.ts");
assert.deepEqual([...tabled].filter(code => !raised.has(code)), [], "table entries no function raises any more");

// Messages say cause and action in Thai, with no code terms.
const entries = errorCodes.map((code: string) => ({ code, ...describeError("sales", undefined, code) }));
for (const { code, message } of entries) {
  assert.ok(/[฀-๿]/.test(message), `${code}: message must be Thai`);
  assert.ok(!/[a-z]+_[a-z_]+/.test(message), `${code}: message shows a code term`);
}
assert.notEqual(describeError("sales", "42501", "independent_refund_approval_required").message, describeError("sales", "42501").message);
assert.notEqual(describeError("sales", "42501", "confirmed_payment_immutable").message, describeError("sales", "42501").message);
for (const scope of ["sales", "walkin"] as const) {
  assert.doesNotMatch(describeError(scope, "XX000", "secret_backend_table").message, /secret/);
  assert.doesNotMatch(describeError(scope, undefined, "constructor").message, /function|\[object/);
}

// Executive-only places never leave the table as a link for anyone else.
const ids = { caseId: "11111111-1111-4111-8111-111111111111", leadId: "22222222-2222-4222-8222-222222222222", brand: "BAAN_KUNAPAP", staffId: "33333333-3333-4333-8333-333333333333" };
type Kind = NonNullable<Parameters<typeof resolveFix>[0]>;
const kinds = new Set<Kind>(entries.flatMap(({ fix }: { fix?: Kind }) => fix ? [fix] : []));
for (const kind of kinds) {
  const forSales = resolveFix(kind, { ...ids, isExecutive: false });
  if (kind === "issuer" || kind === "permissions") assert.equal(forSales, undefined, `${kind} must not link for Sales`);
  else assert.match(forSales?.href ?? "", new RegExp(`^/(sales|leads)/`), `${kind} should link for Sales`);
  if (forSales) assert.doesNotMatch(forSales.href, /^\/sales\/settings\//);
  assert.ok(resolveFix(kind, { ...ids, isExecutive: true }), `${kind} should link for an executive`);
  assert.equal(resolveFix(kind, { isExecutive: true }) === undefined, !["issuer", "permissions"].includes(kind), `${kind} without ids`);
}
for (const kind of ["issuer", "permissions"] as const) assert.ok(kinds.has(kind), `${kind} is no longer used by any code`);
assert.deepEqual(resolveFix("issuer", { brand: "BAAN_KUNAPAP", isExecutive: true }), { label: "ไปตั้งค่าบริษัทผู้ออกเอกสาร", href: "/sales/settings/issuers?brand=BAAN_KUNAPAP" });
assert.equal(resolveFix("task:close", { caseId: ids.caseId, isExecutive: true })?.href, `/sales/${ids.caseId}?task=close`);
assert.equal(resolveFix("tab:quotation", { caseId: ids.caseId, isExecutive: false })?.href, `/sales/${ids.caseId}?tab=quotation`);
assert.equal(resolveFix("lead-project", { leadId: ids.leadId, isExecutive: false })?.href, `/leads/${ids.leadId}`);

// Sales are told whom to ask; the link only appears for executives.
const sales = errorState("sales", { code: "22023", message: "issuer_configuration_required" }, { ...ids, isExecutive: false });
assert.equal(sales.fix, undefined);
assert.match(sales.error, /แจ้งผู้บริหาร/);
assert.equal(errorState("sales", { code: "22023", message: "issuer_configuration_required" }, { ...ids, isExecutive: true }).fix?.href, "/sales/settings/issuers?brand=BAAN_KUNAPAP");
assert.equal(errorState("walkin", { code: "22023", message: "sales_closeout_required" }, { caseId: ids.caseId, isExecutive: true }).fix?.href, `/sales/${ids.caseId}?task=close`);
assert.equal(guidance("sales_permission_denied", { isExecutive: false }).fix, undefined);
assert.equal(guidance("sales_permission_denied", { isExecutive: true }).fix?.href, "/sales/settings/permissions");

// Header and lock-task notice: issuer first, then approval; synthetic leads skip the approval only.
assert.equal(missingContractPrerequisite(undefined), null);
assert.equal(missingContractPrerequisite({ contractor_name: "", contract_text_approved: true }), "issuer_configuration_required");
assert.equal(missingContractPrerequisite({ contractor_name: "บริษัท", contract_text_approved: false }), "approved_contract_text_required");
assert.equal(missingContractPrerequisite({ contractor_name: "บริษัท", contract_text_approved: false, is_synthetic: true }), null);
assert.equal(missingContractPrerequisite({ contractor_name: "บริษัท", contract_text_approved: true }), null);
console.log(`PASS: ${tabled.size} raised codes all mapped, ${kinds.size} fix kinds resolve without leaking executive-only links`);
console.log("Pure checks do not verify HTTP, the live database or browser rendering.");
