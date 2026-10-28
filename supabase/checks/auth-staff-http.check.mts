// Local GoTrue + PostgreSQL only. Parent starts services and independently runs this check.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

assert.equal(process.argv.length, 2, "No alternate targets or credentials accepted");
const origin = "http://127.0.0.1:55439";
const container = "taraville-auth-staff-sql-20261028";
const secret = "taraville-auth-staff-local-only-secret-20261028";
const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const password = randomBytes(32).toString("base64url");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const claims = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 600,
})}`;
const serviceToken = `${claims}.${createHmac("sha256", secret).update(claims).digest("base64url")}`;
type User = { id: string; email: string; email_confirmed_at?: string | null };
type Staff = { id: string; full_name: string; role: string; is_active: boolean };

async function request(path: string, method: string, body: unknown, token = serviceToken) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  // Never include response bodies: token and password responses are sensitive even locally.
  assert.ok(response.ok, `${method} ${path.split("?")[0]} returned HTTP ${response.status}`);
  return await response.json();
}

function query(sql: string) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres",
    "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 0, "Local SQL readback failed");
  return result.stdout.trim();
}

function staffOf(id: string): Staff {
  assert.match(id, /^[0-9a-f-]{36}$/, "Auth response must provide a UUID");
  const row = query(`select row_to_json(s) from (
    select id, full_name, role, is_active from public.staff where id = '${id}'
  ) s;`);
  assert.ok(row, "Auth Create user succeeded without creating staff");
  return JSON.parse(row);
}

async function createUser(email: string, metadata: unknown): Promise<User> {
  const user: User = await request("/admin/users", "POST", {
    email, password, email_confirm: true, user_metadata: metadata,
  });
  assert.match(user.id, /^[0-9a-f-]{36}$/, "Created Auth user must have a UUID");
  assert.equal(user.email, email);
  assert.ok(user.email_confirmed_at, "Local fixture must be confirmed without sending mail");
  return user;
}

async function login(email: string) {
  const result = await request("/token?grant_type=password", "POST", { email, password });
  assert.equal(typeof result.access_token, "string", "Password login must return a token");
  assert.match(result.user?.id ?? "", /^[0-9a-f-]{36}$/, "Password login must identify the user");
  return { token: result.access_token as string, id: result.user.id as string };
}

const created = await createUser(`trigger-${runId}@staff.taraville.invalid`, {
  full_name: "  Synthetic HTTP Staff  ", role: "executive", is_active: true,
});
assert.deepEqual(staffOf(created.id), {
  id: created.id, full_name: "Synthetic HTTP Staff", role: "sale", is_active: false,
});
console.log("PASS: real Auth admin Create user produces the same UUID and inactive Sale staff");

const session = await login(created.email);
assert.equal(session.id, created.id);
await request("/user", "PUT", {
  data: { full_name: "Overwrite", role: "executive", is_active: true },
}, session.token);
assert.deepEqual(staffOf(created.id), {
  id: created.id, full_name: "Synthetic HTTP Staff", role: "sale", is_active: false,
});
assert.equal(query(`begin; set local role authenticated;
  select set_config('request.jwt.claim.sub', '${created.id}', true);
  select coalesce(private.walkin_actor_role(), 'NO_ROLE'); rollback;`).split("\n").at(-1), "NO_ROLE",
"An authenticated inactive Auth user must still have no application role");
console.log("PASS: user metadata update cannot rename staff, grant Executive or activate access");

const blank = await createUser(`blank-${runId}@staff.taraville.invalid`, { full_name: "   " });
assert.deepEqual(staffOf(blank.id), {
  id: blank.id, full_name: blank.email, role: "sale", is_active: false,
});
const long = await createUser(`long-${runId}@staff.taraville.invalid`, { full_name: "ก".repeat(201) });
assert.deepEqual(staffOf(long.id), {
  id: long.id, full_name: "ก".repeat(200), role: "sale", is_active: false,
});
console.log("PASS: blank and long metadata names do not break Auth creation");

const rename = await createUser(`admin-${runId}@taraville.com`, {});
const previousStaff = staffOf(rename.id);
const previousLogin = await login(rename.email);
assert.equal(previousLogin.id, rename.id);
const alias = `admin-${runId}@staff.taraville.invalid`;
const renamed: User = await request(`/admin/users/${rename.id}`, "PUT", { email: alias, email_confirm: true });
assert.equal(renamed.id, rename.id);
assert.equal(renamed.email, alias);
assert.ok(renamed.email_confirmed_at, "Admin email change must preserve confirmed access");
const renamedLogin = await login(alias);
assert.equal(renamedLogin.id, rename.id, "Alias login must preserve identity and the original password");
assert.deepEqual(staffOf(rename.id), previousStaff, "Email changes must not overwrite staff");
const rejectedOldEmail = await fetch(`${origin}/token?grant_type=password`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: rename.email, password }), signal: AbortSignal.timeout(10000),
});
assert.equal(rejectedOldEmail.status, 400, "Old email must no longer authenticate after rename");
await rejectedOldEmail.body?.cancel();
console.log("PASS: Auth admin alias change preserves UUID, confirmation, password and staff");
console.log("Local fixtures remain in the disposable containers; no production or browser verification.");
