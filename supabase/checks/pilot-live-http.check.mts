// Local HTTP simulation of live-mode rules; no real customer data or production access.
// Requires the seven migrations, PostgREST in container:taraville-walkin-schema-check-20261020,
// active fixture staff 400...001 (Sale), 002 (Executive), 003 (Sale), inactive 004 (Sale).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

assert.equal(process.argv.length, 2, "No alternate hosts, credentials or remote targets accepted");
const archive = JSON.parse(readFileSync(new URL("../../docs/walkin/notices/walkin-live-2026-10-22.1.json", import.meta.url), "utf8"));
const source = String.raw`
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
const archive = ${JSON.stringify(archive)};

const sale = "40000000-0000-4000-a000-000000000001";
const executive = "40000000-0000-4000-a000-000000000002";
const sale2 = "40000000-0000-4000-a000-000000000003";
const inactive = "40000000-0000-4000-a000-000000000004";
const noticeVersion = "walkin-live-2026-10-22.1";
const contact = { first_name: "SyntheticPrivacyHTTP", phone: "0000000000" };
const started = Date.now();
function token(sub) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "."
    + encode({ role: "authenticated", sub, exp: Math.floor(Date.now() / 1000) + 600 });
  return unsigned + "." + createHmac("sha256", "taraville-local-test-signing-secret-not-production")
    .update(unsigned).digest("base64url");
}
const tokens = Object.fromEntries([sale, executive, sale2, inactive].map(id => [id, token(id)]));
async function request(path, actor = sale, payload, method = payload === undefined ? "GET" : "POST") {
  const response = await fetch("http://127.0.0.1:3000/" + path, {
    method, headers: { ...(actor === null ? {} : { Authorization: "Bearer " + tokens[actor] }), "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(3000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
function ok(result, label) {
  assert.equal(result.status, 200, label + ": " + JSON.stringify(result.body));
  return Array.isArray(result.body) ? result.body[0] : result.body;
}
function rejected(result, codes, label) {
  assert.ok(result.status >= 400 && result.status < 500, label + ": " + JSON.stringify(result));
  assert.ok(codes.includes(result.body.code), label + ": " + JSON.stringify(result.body));
}
async function rows(path, actor = sale) {
  const result = await request(path, actor);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.ok(Array.isArray(result.body));
  return result.body;
}
const events = (id, actor = sale) => rows("lead_privacy_events?lead_id=eq." + id + "&order=recorded_at,id", actor);
const lead = async (id, actor = sale) => (await rows("leads?id=eq." + id, actor))[0];
function payload(brand = "TARAVILLE", consent = true, survey = { gender: "หญิง" }) {
  return { p_request_id: randomUUID(), p_brand: brand, p_contact: contact, p_survey: survey, p_owner: sale,
    p_notice_version: noticeVersion, p_notice_presented: true, p_followup_requested: true, p_survey_consent: consent };
}
const create = (data, actor = sale) => request("rpc/walkin_create_lead_with_privacy", actor, data);
const event = (data, actor = sale) => request("rpc/walkin_record_privacy_event", actor, data);
function eventPayload(id, version, kind, consent = null) {
  return { p_lead_id: id, p_expected_version: version, p_request_id: randomUUID(), p_kind: kind, p_survey_consent: consent };
}
function trustedEvidence(evidence, brand, requestId, actor = sale) {
  assert.equal(evidence.actor_id, actor);
  assert.equal(evidence.request_id, requestId);
  assert.equal(evidence.notice_version, noticeVersion);
  const { companies, ...notice } = archive;
  assert.deepEqual(evidence.notice_snapshot, { ...notice, brand, company: companies[brand] },
    "Exact server snapshot must match the archived notice for this brand");
  assert.match(evidence.notice_hash, /^[0-9a-f]{64}$/, "Hash correctness is checked separately in local SQL");
  const recorded = Date.parse(evidence.recorded_at);
  assert.ok(Number.isFinite(recorded) && recorded >= started - 5000 && recorded <= Date.now() + 5000,
    "Evidence recording time must come from the server during this request");
}

for (const [id, role, isActive] of [[sale, "sale", true], [executive, "executive", true],
  [sale2, "sale", true], [inactive, "sale", false]]) {
  const fixture = (await rows("staff?id=eq." + id, executive))[0];
  assert.ok(fixture, "Required local staff fixture missing: " + id);
  assert.equal(fixture.role, role);
  assert.equal(fixture.is_active, isActive);
}

for (const changes of [
  { p_notice_presented: false }, { p_notice_presented: null }, { p_followup_requested: false },
  { p_followup_requested: null }, { p_survey_consent: null }, { p_notice_version: null },
  { p_notice_version: "unknown-notice" }, { p_notice_version: "walkin-synthetic-2026-10-21.1" },
]) {
  const invalid = { ...payload(), ...changes };
  rejected(await create(invalid), ["22023"], "Required explicit privacy choices/version");
  assert.equal((await rows("leads?create_request_id=eq." + invalid.p_request_id)).length, 0);
  assert.equal((await rows("lead_privacy_events?request_id=eq." + invalid.p_request_id)).length, 0,
    "Rejected privacy create must not leave an orphan event");
}
const declinedPayload = payload("TARAVILLE", false, {});
const declined = ok(await create(declinedPayload), "Declined survey still permits core contact");
assert.deepEqual(Object.keys(declined.survey), ["sales_staff"]);
assert.equal(typeof declined.survey.sales_staff, "string");
const declinedEvidence = await events(declined.id);
assert.equal(declinedEvidence.length, 1);
assert.equal(declinedEvidence[0].survey_consent, false);
rejected(await event(eventPayload(declined.id, 1, "survey_choice", true)), ["22023"],
  "Opt-in after refusal requires a newly presented versioned notice");
const optInRequest = { ...eventPayload(declined.id, 1, "survey_choice", true),
  p_notice_version: noticeVersion, p_notice_presented: true };
const optedIn = ok(await event(optInRequest), "Explicit notice-backed opt-in");
assert.equal(optedIn.version, 2);
assert.equal(optedIn.last_contact_at, declined.last_contact_at, "Consent changes must not renew contact dates");
const consentedEdit = ok(await request("rpc/walkin_update_lead", sale, {
  p_lead_id: declined.id, p_expected_version: 2, p_contact: contact, p_survey: { gender: "หญิง" },
}), "Ordinary profile edit after explicit opt-in");
assert.deepEqual(consentedEdit.survey, { gender: "หญิง" });
assert.equal(consentedEdit.last_contact_at, declined.last_contact_at);
const answeredRefusal = payload("TARAVILLE", false, { gender: "หญิง" });
rejected(await create(answeredRefusal), ["22023"], "Refusal must reject optional profile answers");
assert.equal((await rows("leads?create_request_id=eq." + answeredRefusal.p_request_id)).length, 0);
const staffName = (await rows("staff?id=eq." + sale))[0].full_name;
for (const brand of ["TARAVILLE", "BAAN_KUNAPAP"]) {
  const data = payload(brand, true, { gender: "หญิง", sales_staff: "forged client staff" });
  const created = ok(await create(data), "Consented live-mode fixture " + brand);
  assert.equal(created.brand, brand);
  assert.equal(created.privacy_mode, "real");
  assert.equal(created.survey.gender, "หญิง");
  assert.equal(created.survey.sales_staff, staffName, "Staff answer is server-derived, not client-supplied identity");
  assert.ok(Number.isFinite(Date.parse(created.last_contact_at)));
  const evidence = await events(created.id);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].notice_presented, true);
  assert.equal(evidence[0].followup_requested, true);
  assert.equal(evidence[0].survey_consent, true);
  trustedEvidence(evidence[0], brand, data.p_request_id);
  const replay = ok(await create(data), "Identical privacy create replay");
  assert.equal(replay.id, created.id);
  assert.equal((await events(created.id)).length, 1);
  assert.equal((await rows("leads?create_request_id=eq." + data.p_request_id)).length, 1);
  rejected(await create({ ...data, p_survey_consent: false, p_survey: {} }), ["22023"], "Changed replay privacy choice");
}

const data = payload();
const created = ok(await create(data), "Withdrawal fixture");
const originalTime = created.last_contact_at;
const originalEvents = await events(created.id);
assert.deepEqual(await events(created.id, sale2), [], "Other Sale must not read evidence");
rejected(await event(eventPayload(created.id, 1, "survey_choice", false), sale2), ["42501"], "Other Sale privacy mutation");
for (const [method, body, suffix] of [
  ["POST", { lead_id: created.id, actor_id: sale, request_id: randomUUID(), kind: "contact" }, ""],
  ["PATCH", { notice_snapshot: "client-tampered" }, "?lead_id=eq." + created.id],
  ["DELETE", undefined, "?lead_id=eq." + created.id],
]) {
  rejected(await request("lead_privacy_events" + suffix, sale, body, method), ["42501"], "Direct event " + method);
}
assert.deepEqual(await events(created.id), originalEvents, "Direct writes must not alter evidence");
const withdrawal = eventPayload(created.id, 1, "survey_choice", false);
const withdrawn = ok(await event(withdrawal), "Withdrawal simulation");
assert.equal(withdrawn.version, 2);
assert.deepEqual(withdrawn.survey, { sales_staff: created.survey.sales_staff });
assert.equal(withdrawn.last_contact_at, originalTime, "Survey withdrawal must not renew contact date");
const afterWithdrawal = await events(created.id);
assert.equal(afterWithdrawal.length, 2);
assert.equal(afterWithdrawal[1].kind, "survey_choice");
assert.equal(afterWithdrawal[1].survey_consent, false);
trustedEvidence(afterWithdrawal[1], "TARAVILLE", withdrawal.p_request_id);
assert.deepEqual(afterWithdrawal[0], originalEvents[0], "Earlier evidence must remain unchanged");
const update = (survey, version) => request("rpc/walkin_update_lead", sale, {
  p_lead_id: created.id, p_expected_version: version, p_contact: contact, p_survey: survey,
});
rejected(await update({ gender: "หญิง" }, 2), ["22023"], "Ordinary edit must not restore withdrawn optional answers");
const staffOnly = ok(await update({ sales_staff: "Synthetic survey staff" }, 2), "Staff-only ordinary edit");
assert.equal(staffOnly.version, 3);
assert.equal(staffOnly.last_contact_at, originalTime);
assert.deepEqual(await events(created.id), afterWithdrawal, "Ordinary edit must not append/invent consent");
const contactEvent = eventPayload(created.id, 3, "contact");
const contacted = ok(await event(contactEvent), "Actual-contact simulation");
assert.equal(contacted.version, 4);
assert.ok(Date.parse(contacted.last_contact_at) > Date.parse(originalTime), "Contact event alone renews the contact date");
const contactReplay = ok(await event(contactEvent), "Contact replay");
assert.equal(contactReplay.version, 4);
assert.equal(contactReplay.last_contact_at, contacted.last_contact_at);
const afterContact = await events(created.id);
assert.equal(afterContact.length, 3);
assert.equal(afterContact[2].kind, "contact");
assert.equal(afterContact[2].survey_consent, false, "Contact must preserve the latest explicit declined choice");
assert.equal(afterContact[2].notice_presented, null);
assert.equal(afterContact[2].followup_requested, null);
trustedEvidence(afterContact[2], "TARAVILLE", contactEvent.p_request_id);
assert.equal(afterContact.filter(row => row.request_id === contactEvent.p_request_id).length, 1);
rejected(await event({ ...contactEvent, p_kind: "survey_choice", p_survey_consent: false }), ["22023"],
  "Changed event kind with the same request UUID must not be accepted as replay");
const stale = await event(eventPayload(created.id, 1, "contact"));
assert.equal(stale.status, 409);
assert.equal(stale.body.code, "PT409");
assert.equal(stale.body.message, "stale_lead");
assert.deepEqual(await events(created.id), afterContact);
assert.equal((await lead(created.id)).version, 4);
const reassigned = ok(await request("rpc/walkin_reassign_lead", executive, {
  p_lead_id: created.id, p_expected_version: 4, p_owner: sale2,
}), "Reassignment");
assert.equal(reassigned.version, 5);
assert.equal(reassigned.last_contact_at, contacted.last_contact_at);
assert.deepEqual(await events(created.id), [], "Old owner must lose evidence access immediately");
rejected(await event(eventPayload(created.id, 5, "contact")), ["42501"], "Old owner contact mutation");
assert.deepEqual(await events(created.id, sale2), afterContact);
assert.deepEqual(await events(created.id, executive), afterContact);

const legacyRequest = randomUUID();
rejected(await request("rpc/walkin_create_lead", sale, {
  p_request_id: legacyRequest, p_brand: "TARAVILLE", p_contact: contact, p_survey: {}, p_owner: sale,
}), ["42501"], "Legacy direct create must be revoked");
assert.equal((await rows("leads?create_request_id=eq." + legacyRequest)).length, 0);
const inactiveCreate = payload();
rejected(await create(inactiveCreate, inactive), ["42501"], "Inactive staff must not create");
assert.equal((await rows("leads?create_request_id=eq." + inactiveCreate.p_request_id)).length, 0);
assert.deepEqual(await rows("leads?limit=1", inactive), [], "Inactive staff must not read Leads");
assert.deepEqual(await events(created.id, inactive), [], "Inactive staff must not read evidence");
rejected(await event(eventPayload(created.id, 5, "contact"), inactive), ["42501"], "Inactive staff mutation");
rejected(await create({ ...payload(), p_owner: sale2 }), ["42501"], "Sale cannot create for another Sale");
rejected(await create({ ...payload(), p_owner: executive }, executive), ["22023"], "Executive needs an active Sale owner");
const executiveCreate = payload("BAAN_KUNAPAP", false, {});
const executiveLead = ok(await create(executiveCreate, executive), "Executive can create for an active Sale");
assert.equal(executiveLead.owner_id, sale);
assert.equal(executiveLead.created_by, executive);
assert.equal(executiveLead.privacy_mode, "real");
assert.equal(executiveLead.survey.sales_staff, (await rows("staff?id=eq." + executive, executive))[0].full_name);
assert.equal((await events(executiveLead.id, executive)).length, 1);
trustedEvidence((await events(executiveLead.id, executive))[0], "BAAN_KUNAPAP", executiveCreate.p_request_id, executive);
assert.deepEqual(await rows("leads?id=eq." + executiveLead.id, sale2), [], "Other Sale cannot read Lead");

const parallelCreatePayload = payload();
const parallelCreates = await Promise.all([create(parallelCreatePayload), create(parallelCreatePayload)]);
const parallelLeadA = ok(parallelCreates[0], "Concurrent privacy create A");
const parallelLeadB = ok(parallelCreates[1], "Concurrent identical privacy create B");
assert.equal(parallelLeadA.id, parallelLeadB.id, "Concurrent identical privacy creates must return one Lead");
const parallelLeads = await rows("leads?create_request_id=eq." + parallelCreatePayload.p_request_id);
assert.equal(parallelLeads.length, 1, "Concurrent create must persist exactly one Lead");
assert.equal(parallelLeads[0].version, 1);
const parallelInitial = await events(parallelLeadA.id);
assert.equal(parallelInitial.length, 1, "Concurrent create must persist exactly one initial privacy event");
assert.equal(parallelInitial[0].kind, "initial");
assert.equal(parallelInitial[0].request_id, parallelCreatePayload.p_request_id);
trustedEvidence(parallelInitial[0], "TARAVILLE", parallelCreatePayload.p_request_id);

const racingLead = ok(await create(payload()), "Concurrent event fixture");
const racingRequests = [eventPayload(racingLead.id, 1, "contact"), eventPayload(racingLead.id, 1, "survey_choice", false)];
const racingResults = await Promise.all(racingRequests.map(data => event(data)));
assert.deepEqual(racingResults.map(result => result.status).sort(), [200, 409],
  "Two new event requests using one version must have exactly one winner");
const winningIndex = racingResults.findIndex(result => result.status === 200);
const losingIndex = 1 - winningIndex;
assert.equal(racingResults[losingIndex].body.code, "PT409");
assert.equal(racingResults[losingIndex].body.message, "stale_lead");
const winningLead = ok(racingResults[winningIndex], "Concurrent event winner");
assert.equal(winningLead.version, 2);
const racingSaved = await lead(racingLead.id);
assert.equal(racingSaved.version, 2, "Only one concurrent event may advance the Lead version");
const racingEvents = await events(racingLead.id);
assert.equal(racingEvents.length, 2, "Only one concurrent event may append to the initial evidence");
assert.equal(racingEvents[1].request_id, racingRequests[winningIndex].p_request_id);
assert.equal(racingEvents[1].kind, racingRequests[winningIndex].p_kind);
assert.ok(!racingEvents.some(row => row.request_id === racingRequests[losingIndex].p_request_id));
if (racingRequests[winningIndex].p_kind === "survey_choice") {
  assert.deepEqual(racingSaved.survey, { sales_staff: racingLead.survey.sales_staff });
  assert.equal(racingSaved.last_contact_at, racingLead.last_contact_at);
  assert.equal(racingEvents[1].survey_consent, false);
} else {
  assert.deepEqual(racingSaved.survey, racingLead.survey);
  assert.ok(Date.parse(racingSaved.last_contact_at) > Date.parse(racingLead.last_contact_at));
  assert.equal(racingEvents[1].survey_consent, true);
}
const anonymousCreate = payload();
rejected(await request("lead_privacy_events?limit=1", null), ["42501"], "Anonymous evidence SELECT");
rejected(await create(anonymousCreate, null), ["42501"], "Anonymous privacy create");
rejected(await event(eventPayload(racingLead.id, 2, "contact"), null), ["42501"], "Anonymous privacy event");
assert.equal((await rows("leads?create_request_id=eq." + anonymousCreate.p_request_id)).length, 0);
assert.equal((await events(racingLead.id)).length, 2, "Anonymous calls must not append evidence");
console.log("PASS: local live-mode create/evidence, refusal, withdrawal, contact replay, role isolation and inactive denial");
console.log("PASS: historical notice rejected for new intake and legacy direct create denied");
console.log("PASS: concurrent privacy create/event contracts and anonymous denial");
console.log("Not production/legal approval, real Auth, browser/device or real-customer verification.");
`;
const result = spawnSync("docker", [
  "run", "-i", "--pull=never", "--name", `taraville-walkin-live-http-check-${Date.now()}`,
  "--network", "container:taraville-live-sql-20261022", "node:22-alpine", "node", "--input-type=module",
], { input: source, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
assert.ifError(result.error);
assert.equal(result.status, 0, `Local live HTTP check failed:\n${result.stdout}\n${result.stderr}`);
process.stdout.write(result.stdout);
console.log("Dummy local fixtures and stopped check container remain; no production requests were made.");
