import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const syntheticNoticePath = "../../../docs/walkin/notices/walkin-synthetic-2026-10-21.1.json";
const liveNoticePath = "../../../docs/walkin/notices/walkin-live-2026-10-22.1.json";
function load(name: string, dependencies: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(new URL(name, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, {
    exports, TextEncoder,
    require: (dependency: string) => {
      if (dependency === "zod") return nodeRequire("zod");
      if ([syntheticNoticePath, liveNoticePath].includes(dependency)) return nodeRequire(dependency);
      if (Object.hasOwn(dependencies, dependency)) return dependencies[dependency];
      throw new Error(`Unexpected dependency: ${dependency}`);
    },
  }, { timeout: 1000 });
  return exports;
}
const privacy = load("./privacy.ts") as typeof import("./privacy");
const { leadSchema } = load("./models.ts") as typeof import("./models");
const catalog = load("./survey-questions.ts");
const validation = load("./validation.ts", { "./survey-questions": catalog }) as typeof import("./validation");
const { PRIVACY_NOTICE, SYNTHETIC_NOTICE, privacyNotice, parsePrivacyIntake, parsePrivacyMutation, privacyEventSchema, surveyChoice } = privacy;
const { parseLeadForm, mutationContextSchema } = validation;
const owner = "123e4567-e89b-42d3-a456-426614174000";
const requestId = "123e4567-e89b-42d3-a456-426614174001";
const id = "123e4567-e89b-42d3-a456-426614174002";
const staff = "Synthetic server-provided staff";
const file = new File(["synthetic"], "synthetic.txt", { type: "text/plain" });
function plain(value: unknown) { return JSON.parse(JSON.stringify(value)); }
assert.equal(createHash("sha256").update(readFileSync(new URL(syntheticNoticePath, import.meta.url))).digest("hex"),
  "5de1d920ff5330ef2a0d3708e10c1aa0e976594de4e80fd5d9d6b1cda699e317",
  "Activating live intake must preserve the exact historical synthetic snapshot");
assert.equal(SYNTHETIC_NOTICE.mode, "synthetic");
assert.equal(SYNTHETIC_NOTICE.version, "walkin-synthetic-2026-10-21.1");
assert.equal(PRIVACY_NOTICE.mode, "real");
assert.equal(PRIVACY_NOTICE.version, "walkin-live-2026-10-22.1");
assert.notEqual(PRIVACY_NOTICE.version, SYNTHETIC_NOTICE.version);
assert.equal(privacyNotice("synthetic"), SYNTHETIC_NOTICE,
  "Historical leads must present their synthetic notice rather than the live notice");
assert.equal(privacyNotice("real"), PRIVACY_NOTICE);
assert.deepEqual(plain(SYNTHETIC_NOTICE), nodeRequire(syntheticNoticePath));
assert.deepEqual(plain(PRIVACY_NOTICE), nodeRequire(liveNoticePath));
const modeSchema = leadSchema.pick({ privacy_mode: true });
for (const mode of ["synthetic", "real"] as const) {
  assert.equal(modeSchema.parse({ privacy_mode: mode }).privacy_mode, mode);
}
for (const mode of [undefined, null, "live", "REAL", ""]) {
  assert.equal(modeSchema.safeParse({ privacy_mode: mode }).success, false);
}
function intake(choice = "yes") {
  const form = new FormData();
  form.set("intake_confirmed", "on");
  form.set("survey_consent", choice);
  return form;
}
assert.equal(parsePrivacyIntake(intake("yes")), true);
const withheld = intake();
withheld.delete("survey_consent");
assert.equal(parsePrivacyIntake(withheld), false, "An unchecked optional consent box means survey consent was not given");
for (const key of ["intake_confirmed", "survey_consent"]) {
  const missing = intake();
  missing.delete(key);
  if (key === "survey_consent") assert.equal(parsePrivacyIntake(missing), false);
  else assert.throws(() => parsePrivacyIntake(missing), `${key} is required`);
  for (const value of ["", "off", "true", "false", file]) {
    const invalid = intake();
    invalid.set(key, value);
    assert.throws(() => parsePrivacyIntake(invalid), `${key} must use its explicit allowed choice`);
  }
}
for (const invalidChoice of ["on", "no", "YES", "NO", " yes "]) {
  assert.throws(() => parsePrivacyIntake(intake(invalidChoice)));
}

const operations = ["contact", "withdraw", "opt_in"] as const;
function confirmed(operation: typeof operations[number]) {
  const form = new FormData();
  form.set("confirm_operation", "on");
  if (operation === "opt_in") form.set("notice_presented", "on");
  return form;
}
for (const operation of operations) {
  const context = { id, requestId, version: 1, operation };
  assert.deepEqual(plain(parsePrivacyMutation(context, confirmed(operation))), context);
  for (const key of ["confirm_operation"]) {
    const missing = confirmed(operation);
    missing.delete(key);
    assert.throws(() => parsePrivacyMutation(context, missing), `${operation} needs ${key}`);
    for (const value of ["", "off", "true", file]) {
      const invalid = confirmed(operation);
      invalid.set(key, value);
      assert.throws(() => parsePrivacyMutation(context, invalid));
    }
  }
  if (operation === "opt_in") {
    const unread = confirmed(operation);
    unread.delete("notice_presented");
    assert.throws(() => parsePrivacyMutation(context, unread), "Opt-in requires notice presentation");
    for (const value of ["", "off", "true", file]) {
      unread.set("notice_presented", value);
      assert.throws(() => parsePrivacyMutation(context, unread));
    }
  } else {
    assert.equal(confirmed(operation).has("notice_presented"), false);
    assert.equal(parsePrivacyMutation(context, confirmed(operation)).operation, operation,
      "Contact and withdrawal must not require rereading the notice");
  }
}
const validMutation = { id, requestId, version: 1, operation: "contact" };
for (const invalid of [
  { ...validMutation, id: undefined }, { ...validMutation, id: "invalid" },
  { ...validMutation, requestId: undefined }, { ...validMutation, requestId: "invalid" },
  { ...validMutation, operation: "delete" }, { ...validMutation, operation: undefined },
  ...[undefined, null, "1", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
    .map(version => ({ ...validMutation, version })),
]) {
  assert.throws(() => Reflect.apply(parsePrivacyMutation, undefined, [invalid, confirmed("contact")]),
    "The mutation parser itself must reject an invalid ID, request, operation or version");
}
assert.equal(parsePrivacyMutation({ id, requestId, version: Number.MAX_SAFE_INTEGER, operation: "contact" },
  confirmed("contact")).version, Number.MAX_SAFE_INTEGER);

function event(eventId: number, consent: boolean | null) {
  return privacyEventSchema.parse({
    id: eventId, kind: "contact", survey_consent: consent,
    notice_presented: null, followup_requested: null,
    notice_version: "walkin-synthetic-2026-10-21.1", notice_hash: "0".repeat(64),
    recorded_at: "2026-10-21T00:00:00Z", actor_id: owner,
  });
}
assert.equal(surveyChoice([]), null, "Legacy with no evidence must remain unknown");
assert.equal(surveyChoice([event(2, null), event(1, null)]), null);
assert.equal(surveyChoice([event(3, null), event(2, false), event(1, true)]), false,
  "Newest-first evidence must ignore a null contact and preserve withdrawal");
assert.equal(surveyChoice([event(3, null), event(2, true), event(1, false)]), true);
assert.equal(surveyChoice([event(2, false), event(1, true)]), false);
assert.equal(surveyChoice([event(2, true), event(1, false)]), true);

function leadForm() {
  const form = new FormData();
  form.set("first_name", "Synthetic privacy form");
  form.set("phone", "0000000000");
  form.set("owner_id", owner);
  // The caller supplies this value from its authenticated staff record.
  form.set("survey.sales_staff", staff);
  return form;
}
for (const brand of ["TARAVILLE", "BAAN_KUNAPAP"] as const) {
  const context = mutationContextSchema.parse({ brand, requestId });
  const declined = parseLeadForm(context, leadForm(), false);
  assert.deepEqual(plain(declined.survey), { sales_staff: staff },
    "Declined survey must contain only supplied staff; generated empty multi arrays are forbidden");
  assert.equal(declined.owner, owner);
  assert.equal(declined.contact.first_name, "Synthetic privacy form");
  for (const key of ["survey.gender", "survey.address", "survey.channel_other", "survey.unknown_key",
    brand === "TARAVILLE" ? "survey.decision_factors" : "survey.layout"]) {
    for (const value of ["", "หญิง", file]) {
      const invalid = leadForm();
      invalid.set(key, value);
      assert.deepEqual(plain(parseLeadForm(context, invalid, false).survey), { sales_staff: staff },
        `Withheld consent must drop ${key} instead of storing it`);
    }
  }
  const missingStaff = leadForm();
  missingStaff.delete("survey.sales_staff");
  assert.throws(() => parseLeadForm(context, missingStaff, false), "Caller must provide the trusted staff field");
  for (const value of [file, "x".repeat(4001)]) {
    const invalid = leadForm();
    invalid.set("survey.sales_staff", value);
    assert.throws(() => parseLeadForm(context, invalid, false));
  }
  const normalForm = leadForm();
  normalForm.set("survey.gender", "หญิง");
  normalForm.set("survey.monthly_installment", brand === "TARAVILLE" ? "15000" : "6,000-8,000");
  const normal = parseLeadForm(context, normalForm, true);
  assert.equal(normal.survey.gender, "หญิง");
  assert.equal(normal.survey.sales_staff, staff);
  assert.equal(normal.survey.monthly_installment, brand === "TARAVILLE" ? "15000" : "6,000-8,000");
  assert.deepEqual(plain(normal.survey), plain(parseLeadForm(context, normalForm).survey),
    "The default parser must retain the normal survey behavior");
  assert.deepEqual(plain(normal.survey[brand === "TARAVILLE" ? "decision_factors" : "layout"]), []);
  normalForm.set("survey.monthly_installment", brand === "TARAVILLE" ? "6,000-8,000" : "15000");
  assert.throws(() => parseLeadForm(context, normalForm, true), "Normal parsing must still reject cross-brand shapes");
}
console.log("PASS: live/historical notice selection, explicit privacy choices/mutations, newest effective survey choice and dropped answers without consent");
console.log("Pure parser checks do not verify trusted staff injection, server-action wiring, HTTP/Auth, database or browser flows.");
