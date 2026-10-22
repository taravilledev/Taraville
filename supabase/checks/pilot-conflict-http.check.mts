// Local disposable PostgREST fixture only; this is not production security verification.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

assert.equal(process.argv.length, 2, "No alternate hosts, database URLs or remote targets accepted");
const source = String.raw`
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

const sale = "40000000-0000-4000-a000-000000000001";
const executive = "40000000-0000-4000-a000-000000000002";
const requestId = randomUUID();
const contact = { first_name: "LocalHTTPtest", phone: "0000000000" };
const winner = { ...contact, first_name: "LocalHTTPwinner" };
const loser = { ...contact, first_name: "LocalHTTPloser" };
function token(sub) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "."
    + encode({ role: "authenticated", sub, exp: Math.floor(Date.now() / 1000) + 600 });
  return unsigned + "." + createHmac("sha256", "taraville-local-test-signing-secret-not-production")
    .update(unsigned).digest("base64url");
}
const tokens = { [sale]: token(sale), [executive]: token(executive) };
async function request(path, actor, payload, extraHeaders = {}) {
  const started = performance.now();
  const response = await fetch("http://127.0.0.1:3000/" + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + tokens[actor],
      "Content-Type": "application/json",
      Accept: "application/vnd.pgrst.object+json",
      ...extraHeaders,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(3000),
  });
  const body = await response.json();
  return { status: response.status, body, elapsed: performance.now() - started, headers: response.headers };
}
function success(result, label) {
  assert.equal(result.status, 200, label + ": " + JSON.stringify(result.body));
}
function conflict(result, label) {
  assert.equal(result.status, 409, label + ": " + JSON.stringify(result.body));
  assert.equal(result.body.code, "PT409", label + " must use the non-retry SQLSTATE");
  assert.equal(result.body.message, "stale_lead", label + " must preserve the conflict contract");
  assert.ok(result.elapsed < 3000, label + " exceeded the three-second response budget");
}

const created = await request("rpc/walkin_create_lead", sale, {
  p_request_id: requestId, p_brand: "TARAVILLE", p_contact: contact, p_survey: {}, p_owner: sale,
});
success(created, "create");
assert.match(created.body.id, /^[0-9a-f-]{36}$/);
assert.equal(created.body.version, 1);
assert.equal(created.body.owner_id, sale);
const id = created.body.id;
const updated = await request("rpc/walkin_update_lead", sale, {
  p_lead_id: id, p_expected_version: 1, p_contact: winner, p_survey: {},
});
success(updated, "current-version update");
assert.equal(updated.body.version, 2);
assert.equal(updated.body.first_name, winner.first_name);
const staleUpdate = await request("rpc/walkin_update_lead", sale, {
  p_lead_id: id, p_expected_version: 1, p_contact: loser, p_survey: {},
});
conflict(staleUpdate, "stale update");
const staleReassign = await request("rpc/walkin_reassign_lead", executive, {
  p_lead_id: id, p_expected_version: 1, p_owner: sale,
});
conflict(staleReassign, "stale Executive reassignment");
const saved = await request("leads?id=eq." + id + "&select=id,version,first_name,owner_id,created_by", sale);
success(saved, "read persisted lead");
assert.deepEqual(saved.body, { id, version: 2, first_name: winner.first_name, owner_id: sale, created_by: sale },
  "Rejected mutations must not advance the version or overwrite the winner's payload");
const counted = await request("leads?create_request_id=eq." + requestId + "&select=id", sale, undefined, {
  Accept: "application/json", Prefer: "count=exact",
});
success(counted, "count local request fixture");
assert.deepEqual(counted.body, [{ id }], "Exactly one local lead must exist for this new request UUID");
assert.equal(counted.headers.get("content-range"), "0-0/1");
console.log("PASS: local HTTP create/update 200; stale update and reassignment 409/PT409 within 3s");
console.log("PASS: one request fixture; persisted version 2 and winning payload unchanged");
console.log("Local HTTP regression only; production authorization, Auth, browser and device flows remain unverified.");
`;

const result = spawnSync("docker", [
  "run", "-i", "--pull=never", "--name", `taraville-walkin-conflict-http-check-${Date.now()}`,
  "--network", "container:taraville-walkin-schema-check-20261020",
  "node:22-alpine", "node", "--input-type=module",
], { input: source, encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024 });
assert.ifError(result.error);
assert.equal(result.status, 0, `Local HTTP check failed:\n${result.stdout}\n${result.stderr}`);
process.stdout.write(result.stdout);
console.log("Synthetic fixture and stopped check container remain local; no production requests were made.");
