import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localEnvironment } from "./dev-local.mjs";

// Synthetic fixtures only. Never accept a caller-supplied URL or key.
assert.equal(process.argv.length, 2);
const status: Record<string, string> = JSON.parse(execFileSync("supabase", ["status", "--output", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
}));
const local = localEnvironment(status);
const database = new URL(status.DB_URL);
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "54322");
const admin = createClient(local.NEXT_PUBLIC_SUPABASE_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function sql(query: string) {
  return execFileSync("psql", ["-X", "-h", database.hostname, "-p", database.port,
    "-U", decodeURIComponent(database.username), "-d", database.pathname.slice(1),
    "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8", env: { ...process.env, PGPASSWORD: decodeURIComponent(database.password) },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
assert.equal(listed.error, null);
const nodeRequire = createRequire(import.meta.url);
const { encodeReply } = nodeRequire("next/dist/compiled/react-server-dom-webpack/client.node") as {
  encodeReply(value: unknown[]): Promise<string | FormData>;
};
async function callAction(path: string, filename: string, name: string, args: unknown[], cookie?: string) {
  assert.ok(path.startsWith("/") && !path.startsWith("//"));
  await (await fetch(`http://127.0.0.1:3100${path}`, { headers: cookie ? { Cookie: cookie } : {} })).text();
  const manifest = JSON.parse(readFileSync(new URL("../.next/dev/server/server-reference-manifest.json", import.meta.url), "utf8")) as {
    node: Record<string, { filename: string; exportedName: string }>;
  };
  const action = Object.entries(manifest.node).find(([, entry]) => entry.filename === filename && entry.exportedName === name);
  assert.ok(action, "The actual dev Server Action must be compiled");
  const response = await fetch(`http://127.0.0.1:3100${path}`, {
    method: "POST", redirect: "manual", body: await encodeReply(args), headers: {
      Origin: "http://127.0.0.1:3100", Accept: "text/x-component", "Next-Action": action[0], ...(cookie ? { Cookie: cookie } : {}),
    }, signal: AbortSignal.timeout(30000),
  });
  return response;
}
async function actor(name: string, role: "sale" | "executive") {
  const email = `salesdev_${name}@staff.taraville.invalid`;
  const password = `LocalOnly-${randomUUID()}`;
  const existing = listed.data.users.find(user => user.email === email);
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(result.error, null);
  const id = result.data.user?.id;
  assert.ok(id && /^[\da-f-]{36}$/.test(id));
  sql(`update public.staff set role='${role}',full_name='Synthetic ${name}',is_active=true where id='${id}'`);
  const session = await admin.auth.signInWithPassword({ email, password });
  assert.equal(session.error, null);
  assert.ok(session.data.session);
  const login = new FormData();
  login.set("username", `salesdev_${name}`); login.set("password", password);
  const loginResponse = await callAction("/login", "src/app/login/actions.ts", "login", [{ error: "" }, login]);
  await loginResponse.text();
  assert.ok(loginResponse.headers.get("x-action-redirect")?.startsWith("/walkin"), "Actual username Login action must succeed");
  assert.ok(loginResponse.headers.getSetCookie().some(value => value.startsWith("sb-")), "Login must persist the local session");
  return { id, token: session.data.session.access_token, refreshToken: session.data.session.refresh_token };
}
const executive = await actor("executive", "executive");
const owner = await actor("owner", "sale");
const other = await actor("other", "sale");
const operator = await actor("operator", "sale");
type Actor = typeof owner;
async function request(path: string, user: Actor | null, payload?: Record<string, unknown>) {
  const response = await fetch(`${local.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method: payload ? "POST" : "GET", headers: {
      apikey: local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(10000),
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}
function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function ok(result: Awaited<ReturnType<typeof request>>) {
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return object(result.body);
}
const rpc = (name: string, user: Actor | null, payload: Record<string, unknown> = {}) => request(`rpc/${name}`, user, payload);
const set = async (user: Actor, enabled: boolean, scope = "own", action = "financial.view") => ok(await rpc("sales_set_capability", executive, {
  p_staff_id: user.id, p_action: action, p_enabled: enabled, p_scope: scope, p_request_id: randomUUID(),
}));
await set(owner, true);
await set(other, true);
await set(owner, false, "own", "financial.prepare");
const anonymous = await rpc("sales_bootstrap", null);
assert.ok([401, 403].includes(anonymous.status));
const initial = ok(await rpc("sales_bootstrap", executive));
assert.equal(initial.can_admin, true);
assert.equal((await rpc("sales_set_capability", owner, {
  p_staff_id: owner.id, p_action: "financial.confirm", p_enabled: true, p_scope: "all", p_request_id: randomUUID(),
})).status, 403);
const leadId = randomUUID();
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${leadId}','BAAN_KUNAPAP','Synthetic Sales','HTTP','0000000000','${owner.id}','${owner.id}','${randomUUID()}',repeat('0',64),'synthetic')`);
const opened = ok(await rpc("walkin_open_project", owner, {
  p_lead_id: leadId, p_expected_version: 1, p_request_id: randomUUID(),
}));
const input = { p_lead_id: leadId, p_project_id: opened.id, p_unit_id: null, p_customer_id: null, p_request_id: randomUUID() };
assert.equal((await rpc("sales_create_case", other, input)).status, 403);
const [first, replay] = await Promise.all([rpc("sales_create_case", owner, input), rpc("sales_create_case", owner, input)]);
const created = ok(first);
assert.equal(ok(replay).id, created.id, "Concurrent replay must not create a duplicate case/customer");
assert.equal((await rpc("sales_create_case", owner, { ...input, p_customer_id: randomUUID() })).status, 400);
assert.equal((await rpc("sales_create_case", owner, { ...input, p_request_id: randomUUID() })).status, 409);
const ownDetail = ok(await rpc("sales_case_detail", owner, { p_case_id: created.id }));
assert.equal(ownDetail.can_finance, true);
assert.ok("customer_snapshot" in ownDetail);
assert.equal((await rpc("sales_case_detail", other, { p_case_id: created.id })).status, 403);
const sharedLead = await request(`leads?id=eq.${leadId}&select=id`, other);
assert.equal(sharedLead.status, 200);
assert.equal((sharedLead.body as unknown[]).length, 1, "Plain Lead sharing remains");
assert.equal((await request("sales_cases?select=*", owner)).status, 404, "No exposed finance table");
await set(other, true, "all");
assert.equal(ok(await rpc("sales_case_detail", other, { p_case_id: created.id })).can_finance, true);
await set(other, false, "all");
assert.equal((await rpc("sales_case_detail", other, { p_case_id: created.id })).status, 403, "Revocation uses current grants with the same token");
await set(other, true);
await set(owner, false);
const redacted = ok(await rpc("sales_case_detail", owner, { p_case_id: created.id }));
assert.equal(redacted.can_finance, false);
assert.ok(!("customer_snapshot" in redacted) && !("net_price_cents" in redacted));
await set(owner, true);
const reassigned = ok(await rpc("walkin_reassign_lead", executive, {
  p_lead_id: leadId, p_expected_version: 2, p_owner: other.id,
}));
assert.equal(reassigned.owner_id, other.id);
const afterTransfer = ok(await rpc("sales_case_detail", owner, { p_case_id: created.id }));
assert.equal(afterTransfer.responsible_id, owner.id);
assert.equal(afterTransfer.can_finance, false);
assert.ok(!("customer_snapshot" in afterTransfer));
assert.equal(ok(await rpc("sales_case_detail", other, { p_case_id: created.id })).can_finance, true);
assert.equal((await rpc("sales_create_case", owner, input)).status, 403, "Replay does not bypass changed ownership");
const terms = {
  list_price_cents: "10000000", promotion_price_cents: null, discount_cents: "0",
  details: { usable_area: "195" }, customer_snapshot: ownDetail.customer_snapshot,
};
const save = { p_case_id: created.id, p_expected_version: 1, p_input: terms, p_request_id: randomUUID() };
await set(other, false, "own", "financial.prepare");
assert.equal((await rpc("sales_save_case", other, save)).status, 403);
await set(other, true, "own", "financial.prepare");
assert.equal(ok(await rpc("sales_save_case", other, save)).version, 2);
assert.equal(ok(await rpc("sales_save_case", other, save)).version, 2, "Save replay does not increment twice");
assert.equal((await rpc("sales_save_case", other, { ...save, p_request_id: randomUUID() })).status, 409);
assert.equal((await rpc("sales_save_case", other, { ...save, p_input: { ...terms, discount_cents: "1" } })).status, 400);
assert.equal((await rpc("sales_save_case", other, { ...save, p_expected_version: 2, p_request_id: randomUUID(),
  p_input: { ...terms, discount_cents: "10000001" } })).status, 400);
assert.equal((await rpc("sales_save_case", other, { ...save, p_expected_version: 2, p_request_id: randomUUID(),
  p_input: { ...terms, net_price_cents: "1" } })).status, 400, "Derived totals are not accepted from clients");
ok(await rpc("sales_save_case", other, { ...save, p_expected_version: 2, p_request_id: randomUUID(),
  p_input: { ...terms, promotion_price_cents: "0" } }));
assert.equal(ok(await rpc("sales_case_detail", other, { p_case_id: created.id })).net_price_cents, "0");
assert.equal((await rpc("sales_assign_case", owner, { p_case_id: created.id, p_expected_version: 3,
  p_responsible_id: operator.id, p_request_id: randomUUID() })).status, 403);
ok(await rpc("sales_assign_case", executive, { p_case_id: created.id, p_expected_version: 3,
  p_responsible_id: operator.id, p_request_id: randomUUID() }));
const assigned = ok(await rpc("sales_case_detail", operator, { p_case_id: created.id }));
assert.equal(assigned.can_finance, false, "Job responsibility is not financial ownership");
assert.ok(!("customer_snapshot" in assigned));
assert.equal(ok(await rpc("sales_case_detail", other, { p_case_id: created.id })).can_finance, true);
const developmentInput = { p_id: null, p_expected_version: null, p_name: `Synthetic ${randomUUID()}`,
  p_address: "Local fixture only", p_is_active: true, p_request_id: randomUUID() };
assert.equal((await rpc("sales_save_development", owner, developmentInput)).status, 403);
const development = ok(await rpc("sales_save_development", executive, developmentInput));
const unitInput = { p_id: null, p_expected_version: null, p_development_id: development.id,
  p_code: "B3", p_details: { model: "Synthetic house", usable_area: "195", land_area: "64.7" },
  p_list_price_cents: "354000000", p_is_active: true, p_request_id: randomUUID() };
const unit = ok(await rpc("sales_save_unit", executive, unitInput));
assert.equal((await rpc("sales_save_unit", executive, { ...unitInput, p_request_id: randomUUID() })).status, 409);
const tvLead = randomUUID();
sql(`insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode)
values('${tvLead}','TARAVILLE','Synthetic TV','HTTP','0000000000','${owner.id}','${owner.id}','${randomUUID()}',repeat('0',64),'synthetic')`);
const tvInput = { p_lead_id: tvLead, p_project_id: null, p_unit_id: unit.id, p_customer_id: null, p_request_id: randomUUID() };
assert.equal((await rpc("sales_create_case", owner, { ...tvInput, p_customer_id: ownDetail.customer_id })).status, 403);
const tv = ok(await rpc("sales_create_case", owner, tvInput));
assert.equal(ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id })).net_price_cents, "354000000");
ok(await rpc("sales_save_unit", executive, { ...unitInput, p_id: unit.id, p_expected_version: 1,
  p_list_price_cents: "355000000", p_request_id: randomUUID() }));
assert.equal(ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id })).net_price_cents, "354000000", "Master price changes do not rewrite negotiated snapshots");
async function cookieHeader(user: Actor) {
  const cookies: { name: string; value: string }[] = [];
  const ssr = createServerClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => cookies, setAll: values => {
      for (const value of values) {
        const index = cookies.findIndex(item => item.name === value.name);
        if (index >= 0) cookies[index] = value; else cookies.push(value);
      }
    } },
  });
  const signed = await ssr.auth.setSession({ access_token: user.token, refresh_token: user.refreshToken });
  assert.equal(signed.error, null);
  return cookies.map(item => `${item.name}=${item.value}`).join("; ");
}
async function page(path: string, user: Actor) {
  const response = await fetch(`http://127.0.0.1:3100${path}`, {
    headers: { Cookie: await cookieHeader(user) }, signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200);
  return response.text();
}
assert.ok((await page("/sales", executive)).includes("งานและรายการขาย"));
assert.ok((await page("/sales/admin", executive)).includes('name="staff_id"'));
assert.ok((await page("/sales/catalog", executive)).includes("ราคาทะเบียน"));
assert.ok((await page("/sales/new", owner)).includes('name="lead_id"'));
const ownerPage = await page(`/sales/${tv.id}`, owner);
assert.ok(ownerPage.includes("3,540,000.00"));
const operatorPage = await page(`/sales/${created.id}`, operator);
assert.ok(operatorPage.includes("ไม่มีสิทธิ์ดูเอกสารและข้อมูลการเงิน"));
assert.ok(!operatorPage.includes('name="list_price"'));
const caseForm = new FormData();
const tvDetail = ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id }));
for (const [key, value] of Object.entries(object(tvDetail.customer_snapshot))) caseForm.set(key, String(value));
for (const [key, value] of Object.entries({ model: "Synthetic house", stories: "2", bedrooms: "3", bathrooms: "3",
  usable_area: "195", land_area: "64.7", notes: "Saved through actual Next action", list_price: "3540000.01", promotion_price: "", discount: "0" })) caseForm.set(key, value);
const submitted = await callAction(`/sales/${tv.id}`, "src/app/sales/actions.ts", "saveCase",
  [{ id: tv.id, version: 1, requestId: randomUUID() }, { error: "" }, caseForm], await cookieHeader(executive));
await submitted.text();
assert.ok(submitted.headers.get("x-action-redirect")?.startsWith(`/sales/${tv.id}`));
assert.equal(ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id })).net_price_cents, "354000001");
const denied = await callAction(`/sales/${tv.id}`, "src/app/sales/actions.ts", "saveCase",
  [{ id: tv.id, version: 2, requestId: randomUUID() }, { error: "" }, caseForm], await cookieHeader(owner));
assert.equal(denied.headers.get("x-action-redirect"), null);
assert.ok((await denied.text()).includes("คุณไม่มีสิทธิ์"));
assert.equal(ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id })).version, 2);
const grantForm = new FormData();
for (const [key, value] of Object.entries({ staff_id: owner.id, capability: "financial.prepare", enabled: "true", scope: "own", request_id: randomUUID() })) grantForm.set(key, value);
const granted = await callAction("/sales/admin", "src/app/sales/actions.ts", "setCapability", [{ error: "" }, grantForm], await cookieHeader(executive));
await granted.text();
assert.ok(granted.headers.get("x-action-redirect")?.startsWith("/sales/admin"));
caseForm.set("list_price", "3540000.02");
const allowed = await callAction(`/sales/${tv.id}`, "src/app/sales/actions.ts", "saveCase",
  [{ id: tv.id, version: 2, requestId: randomUUID() }, { error: "" }, caseForm], await cookieHeader(owner));
await allowed.text();
assert.ok(allowed.headers.get("x-action-redirect")?.startsWith(`/sales/${tv.id}`));
assert.equal(ok(await rpc("sales_case_detail", owner, { p_case_id: tv.id })).net_price_cents, "354000002");
sql(`update public.staff set is_active=false where id='${other.id}'`);
assert.equal((await rpc("sales_bootstrap", other)).status, 403, "Inactive user denied with existing token");
sql(`update public.staff set is_active=true where id='${other.id}'`);
console.log("PASS: local authenticated HTTP case creation, replay, shared Lead isolation, financial revocation/reassignment and inactive denial");
