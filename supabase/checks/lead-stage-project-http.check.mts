// Local HTTP simulation of lead stage, close/reopen and BK Project rules (ADR 0008, 0009); no production access.
// Requires all nine migrations, PostgREST in container:taraville-live-sql-20261022,
// active fixture staff 400...001 (Sale), 002 (Executive), 003 (Sale).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

assert.equal(process.argv.length, 2, "No alternate hosts, credentials or remote targets accepted");
const source = String.raw`
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

const sale = "40000000-0000-4000-a000-000000000001";
const executive = "40000000-0000-4000-a000-000000000002";
const sale2 = "40000000-0000-4000-a000-000000000003";
const yy = String((new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear() + 543) % 100).padStart(2, "0");
function token(sub) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "."
    + encode({ role: "authenticated", sub, exp: Math.floor(Date.now() / 1000) + 600 });
  return unsigned + "." + createHmac("sha256", "taraville-local-test-signing-secret-not-production")
    .update(unsigned).digest("base64url");
}
const tokens = Object.fromEntries([sale, executive, sale2].map(id => [id, token(id)]));
async function request(path, actor = sale, payload) {
  const response = await fetch("http://127.0.0.1:3000/" + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: { ...(actor === null ? {} : { Authorization: "Bearer " + tokens[actor] }), "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(3000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
function ok(result, label) {
  assert.equal(result.status, 200, label + ": " + JSON.stringify(result.body));
  return Array.isArray(result.body) ? result.body[0] : result.body;
}
function rejected(result, status, code, message, label) {
  assert.equal(result.status, status, label + ": " + JSON.stringify(result));
  assert.equal(result.body.code, code, label + ": " + JSON.stringify(result.body));
  if (message) assert.equal(result.body.message, message, label + ": " + JSON.stringify(result.body));
}
async function rows(path, actor = sale) {
  const result = await request(path, actor);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
const lead = async id => (await rows("leads?id=eq." + id))[0];
const stage = async (id, actor = sale) => (await rows("walkin_leads_staged?id=eq." + id + "&select=stage", actor))[0]?.stage;
const create = brand => request("rpc/walkin_create_lead_with_privacy", sale, {
  p_request_id: randomUUID(), p_brand: brand, p_contact: { first_name: "SyntheticStageHTTP", phone: "0000000000" },
  p_survey: {}, p_owner: sale, p_notice_version: "walkin-live-2026-10-22.1",
  p_notice_presented: true, p_followup_requested: true, p_survey_consent: false,
});
const close = (id, version, reason, text, actor = sale, requestId = randomUUID()) =>
  request("rpc/walkin_close_lead", actor, { p_lead_id: id, p_expected_version: version, p_request_id: requestId, p_reason: reason, p_reason_text: text ?? null });
const reopen = (id, version, actor = sale) =>
  request("rpc/walkin_reopen_lead", actor, { p_lead_id: id, p_expected_version: version, p_request_id: randomUUID() });
const open = (id, version, actor = sale, requestId = randomUUID()) =>
  request("rpc/walkin_open_project", actor, { p_lead_id: id, p_expected_version: version, p_request_id: requestId });
const cancel = (id, version, reason, actor = executive, requestId = randomUUID()) =>
  request("rpc/walkin_cancel_project", actor, { p_project_id: id, p_expected_version: version, p_request_id: requestId, p_reason: reason });

// Stage through the view; close/reopen over HTTP
const tv = ok(await create("TARAVILLE"), "create Taraville lead");
assert.equal(await stage(tv.id), "received");
assert.equal(await stage(tv.id, sale2), undefined, "another Sale must not see the stage view row");
rejected(await close(tv.id, tv.version, "other"), 400, "22023", "invalid_close_reason", "other without text");
rejected(await close(tv.id, tv.version, "duplicate", null, sale2), 403, "42501", "access_denied", "another Sale closing");
rejected(await close(tv.id, tv.version + 5, "duplicate"), 409, "PT409", "stale_lead", "stale close");
const closeRequest = randomUUID();
const closed = ok(await close(tv.id, tv.version, "other", " moved abroad ", sale, closeRequest), "close");
assert.equal(closed.closed_reason, "other");
assert.equal(closed.version, tv.version + 1);
assert.equal(ok(await close(tv.id, tv.version, "other", "moved abroad", sale, closeRequest), "close replay").version, tv.version + 1);
assert.equal(await stage(tv.id), "closed");
assert.deepEqual(await rows("lead_status_events?lead_id=eq." + tv.id + "&select=kind,reason,reason_text"),
  [{ kind: "close", reason: "other", reason_text: "moved abroad" }]);
const hidden = await rows("walkin_leads_staged?id=eq." + tv.id + "&stage=neq.closed&select=id");
assert.equal(hidden.length, 0, "the default list filter must hide the closed lead");
rejected(await request("lead_status_events?limit=1", null), 401, "42501", null, "anonymous history read");
const reopened = ok(await reopen(tv.id, closed.version, executive), "Executive reopen");
assert.equal(reopened.closed_at, null);
assert.equal(await stage(tv.id), "received");

// Projects: BK only, codes, stage, cancel, reissue
rejected(await open(tv.id, reopened.version), 400, "22023", "invalid_lead_state", "open on Taraville");
const bk = ok(await create("BAAN_KUNAPAP"), "create BK lead");
rejected(await open(bk.id, bk.version, sale2), 403, "42501", "access_denied", "another Sale opening");
const openRequest = randomUUID();
const project = ok(await open(bk.id, bk.version, sale, openRequest), "open project");
assert.match(project.code, new RegExp("^BKP-" + yy + "-\\d{3,}$"));
assert.equal(project.status, "active");
assert.equal(ok(await open(bk.id, bk.version, sale, openRequest), "open replay").id, project.id);
assert.equal((await lead(bk.id)).version, bk.version + 1, "open bumps the lead version once");
assert.equal(await stage(bk.id), "project_opened");
assert.equal((await rows("projects?lead_id=eq." + bk.id + "&select=id", sale2)).length, 0, "another Sale must not see the project");
rejected(await close(bk.id, bk.version + 1, "duplicate"), 400, "22023", "invalid_lead_state", "close with an active project");
rejected(await cancel(project.id, 1, "mistake", sale), 403, "42501", "access_denied", "Sale cancelling");
rejected(await cancel(project.id, 1, "   "), 400, "22023", "invalid_cancel_reason", "blank cancel reason");
rejected(await cancel(project.id, 9, "mistake"), 409, "PT409", "stale_project", "stale cancel");
const cancelRequest = randomUUID();
const cancelled = ok(await cancel(project.id, 1, "opened by mistake", executive, cancelRequest), "Executive cancel");
assert.equal(cancelled.status, "cancelled");
assert.equal(await stage(bk.id), "received");
const leadAfterCancel = (await lead(bk.id)).version;
assert.equal(ok(await cancel(project.id, 1, "opened by mistake", executive, cancelRequest), "cancel replay").version, cancelled.version);
assert.equal((await lead(bk.id)).version, leadAfterCancel, "cancel replay must not bump the lead");
rejected(await cancel(project.id, 1, "different reason", executive, cancelRequest), 400, "22023", "request_conflict", "cancel replay with another reason");
rejected(await cancel(project.id, 2, "again"), 400, "22023", "invalid_project_state", "cancel twice");
const second = ok(await open(bk.id, (await lead(bk.id)).version), "open after cancel");
assert.notEqual(second.code, project.code, "a cancelled code is never reused");
assert.equal((await rows("projects?lead_id=eq." + bk.id + "&select=status&order=created_at")).map(p => p.status).join(), "cancelled,active");
rejected(await request("projects", sale, { code: "BKP-00-999", brand: "BAAN_KUNAPAP", lead_id: bk.id, created_by: sale, create_request_id: randomUUID() }),
  403, "42501", null, "direct project insert");

// Races: exactly one of two concurrent writers on the same lead version wins; the other gets 409
for (const [label, first, other] of [
  ["two opens", id => open(id, 1), id => open(id, 1)],
  ["open versus close", id => open(id, 1), id => close(id, 1, "duplicate")],
]) {
  const racer = ok(await create("BAAN_KUNAPAP"), "create race lead");
  assert.equal(racer.version, 1);
  const results = await Promise.all([first(racer.id), other(racer.id)]);
  const statuses = results.map(result => result.status).sort();
  assert.deepEqual(statuses, [200, 409], label + ": " + JSON.stringify(results));
  assert.equal(results.find(result => result.status === 409).body.code, "PT409", label);
  assert.ok((await rows("projects?lead_id=eq." + racer.id + "&status=eq.active&select=id")).length <= 1, label);
  assert.equal((await lead(racer.id)).version, 2, label + ": the loser must not advance the version");
}

// Anonymous callers are denied
rejected(await open(bk.id, 1, null), 401, "42501", null, "anonymous open");
rejected(await cancel(second.id, 1, "x", null), 401, "42501", null, "anonymous cancel");
console.log("PASS: local HTTP stage view, close/reopen, project open/cancel/reissue, ownership and anonymous denial");
console.log("PASS: concurrent open/open and open/close each produce one 200 and one 409/PT409");
console.log("Not production, real Auth, browser or device verification.");
`;
const result = spawnSync("docker", [
  "run", "-i", "--rm", "--pull=never", "--name", `taraville-stage-project-http-check-${Date.now()}`,
  "--network", "container:taraville-live-sql-20261022", "node:22-alpine", "node", "--input-type=module",
], { input: source, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
assert.ifError(result.error);
assert.equal(result.status, 0, `Local HTTP check failed:\n${result.stdout}\n${result.stderr}`);
process.stdout.write(result.stdout);
console.log("Dummy local fixtures remain only in the local tmpfs database; no production requests were made.");
