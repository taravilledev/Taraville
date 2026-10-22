import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { timeout: 1000 });
  return exports;
}
const passwordModule = load("./password.ts", { zod: nodeRequire("zod") });
const { passwordChangeSchema } = passwordModule as typeof import("./password");
const current = "Synthetic-current-password";
const next = "Synthetic-new-password";
const validInput = { current, password: next, confirmation: next };
assert.deepEqual(passwordChangeSchema.parse(validInput), validInput);
for (const length of [6, 128]) {
  const password = "n".repeat(length);
  assert.equal(passwordChangeSchema.parse({ current, password, confirmation: password }).password, password);
}
assert.equal(passwordChangeSchema.parse({ ...validInput, current: "x".repeat(1024) }).current.length, 1024);
const spaced = "  Synthetic-new-password  ";
assert.equal(passwordChangeSchema.parse({ current: " ", password: spaced, confirmation: spaced }).password, spaced,
  "Passwords must remain untrimmed, including significant spaces");
const file = new File(["synthetic"], "synthetic.txt");
for (const invalid of [
  { ...validInput, current: "" }, { ...validInput, current: "x".repeat(1025) },
  { ...validInput, password: "n".repeat(5), confirmation: "n".repeat(5) },
  { ...validInput, password: "n".repeat(129), confirmation: "n".repeat(129) },
  { ...validInput, confirmation: "Different-synthetic-confirmation" },
  { ...validInput, password: current, confirmation: current },
  { current, password: spaced, confirmation: spaced.trim() },
  ...["current", "password", "confirmation"].map(key => ({ ...validInput, [key]: file })),
]) assert.equal(passwordChangeSchema.safeParse(invalid).success, false);

const staffId = "123e4567-e89b-42d3-a456-426614174000";
const otherId = "123e4567-e89b-42d3-a456-426614174001";
const email = "synthetic-staff@example.invalid";
const rawError = "PRIVATE_BACKEND_DETAIL_DO_NOT_DISPLAY";
const user = { id: staffId, email };
type AuthReply = { data: { user: { id: string; email?: string } | null }; error: unknown };
type Overrides = {
  identity?: AuthReply | Error;
  verified?: AuthReply | Error;
  updated?: AuthReply | Error;
  signedOut?: { error: unknown } | Error;
  staffFailure?: Error;
};
type Call = { name: string; value?: unknown };
function plain(value: unknown) { return JSON.parse(JSON.stringify(value)); }
function harness(overrides: Overrides = {}) {
  const calls: Call[] = [];
  const redirectSignal = new Error("Synthetic redirect sentinel");
  function reply<T>(value: T | Error) {
    if (value instanceof Error) throw value;
    return value;
  }
  const auth = {
    getUser: async () => { calls.push({ name: "getUser" }); return reply(overrides.identity ?? { data: { user }, error: null }); },
    signInWithPassword: async (value: unknown) => {
      calls.push({ name: "signInWithPassword", value: plain(value) });
      return reply(overrides.verified ?? { data: { user }, error: null });
    },
    updateUser: async (value: unknown) => {
      calls.push({ name: "updateUser", value: plain(value) });
      return reply(overrides.updated ?? { data: { user }, error: null });
    },
    signOut: async (value: unknown) => {
      calls.push({ name: "signOut", value: plain(value) });
      return reply(overrides.signedOut ?? { error: null });
    },
  };
  const actionModule = load("../../app/account/password/actions.ts", {
    "@/lib/supabase/password": passwordModule,
    "@/lib/supabase/staff": { requireStaff: async (value: unknown) => {
      calls.push({ name: "requireStaff", value });
      if (overrides.staffFailure) throw overrides.staffFailure;
      return { supabase: { auth }, staff: { id: staffId } };
    } },
    "next/navigation": { redirect: (value: unknown) => {
      calls.push({ name: "redirect", value });
      throw redirectSignal;
    } },
  }) as typeof import("../../app/account/password/actions");
  return { change: actionModule.changePassword, calls, redirectSignal };
}
function form() {
  const result = new FormData();
  result.set("current_password", current);
  result.set("new_password", next);
  result.set("confirm_password", next);
  return result;
}
function names(calls: Call[]) { return calls.map(call => call.name); }
function staffRequired(calls: Call[]) {
  assert.deepEqual(calls[0], { name: "requireStaff", value: true }, "Every action path must require active staff with forced-change allowance");
}
function safeError(state: { error?: string }) {
  assert.equal(typeof state.error, "string");
  assert.ok(state.error && !state.error.includes(rawError), "Backend errors must not reach the user");
}

for (const key of ["current_password", "new_password", "confirm_password"]) {
  for (const value of ["", file]) {
    const test = harness();
    const invalid = form();
    invalid.set(key, value);
    safeError(await test.change({ error: "" }, invalid));
    staffRequired(test.calls);
    assert.deepEqual(names(test.calls), ["requireStaff"], "Invalid input must not invoke any Auth method");
  }
}
const unauthenticated = harness({ staffFailure: new Error("Synthetic active-staff denial") });
await assert.rejects(() => unauthenticated.change({ error: "" }, form()), /Synthetic active-staff denial/);
assert.deepEqual(names(unauthenticated.calls), ["requireStaff"]);
staffRequired(unauthenticated.calls);

for (const identity of [
  { data: { user }, error: { message: rawError } },
  { data: { user: null }, error: null },
  { data: { user: { ...user, id: otherId } }, error: null },
  { data: { user: { id: staffId } }, error: null },
  { data: { user: { id: staffId, email: "" } }, error: null },
]) {
  const test = harness({ identity });
  safeError(await test.change({ error: "" }, form()));
  staffRequired(test.calls);
  assert.deepEqual(names(test.calls), ["requireStaff", "getUser"], "Identity must match current staff and have a verified source email");
}
for (const verified of [
  { data: { user }, error: { message: rawError } },
  { data: { user: null }, error: null },
  { data: { user: { ...user, id: otherId } }, error: null },
]) {
  const test = harness({ verified });
  safeError(await test.change({ error: "" }, form()));
  staffRequired(test.calls);
  assert.deepEqual(names(test.calls), ["requireStaff", "getUser", "signInWithPassword"],
    "Reauthentication must succeed as the same staff before updating credentials");
  assert.deepEqual(test.calls[2].value, { email, password: current });
}
for (const updated of [
  { data: { user }, error: { message: rawError } },
  { data: { user: null }, error: null },
  { data: { user: { ...user, id: otherId } }, error: null },
]) {
  const test = harness({ updated });
  safeError(await test.change({ error: "" }, form()));
  staffRequired(test.calls);
  assert.deepEqual(names(test.calls), ["requireStaff", "getUser", "signInWithPassword", "updateUser"],
    "An unconfirmed update must not sign out or redirect as success");
}
for (const signedOut of [{ error: { message: rawError } }, new Error(rawError)]) {
  const test = harness({ signedOut });
  const state = await test.change({ error: "" }, form());
  safeError(state);
  assert.ok(state.error?.includes("เปลี่ยนรหัสสำเร็จแล้ว"), "Sign-out failure must acknowledge the password already changed");
  staffRequired(test.calls);
  assert.deepEqual(names(test.calls), ["requireStaff", "getUser", "signInWithPassword", "updateUser", "signOut"]);
  assert.deepEqual(test.calls[4].value, { scope: "global" });
}
const transport = harness({ updated: new Error(rawError) });
const uncertain = await transport.change({ error: "" }, form());
safeError(uncertain);
assert.ok(uncertain.error?.includes("ยังยืนยันผลการเปลี่ยนรหัสไม่ได้"), "Update transport errors must report uncertainty");
staffRequired(transport.calls);
assert.deepEqual(names(transport.calls), ["requireStaff", "getUser", "signInWithPassword", "updateUser"]);

const success = harness();
const spoofed = form();
for (const [key, value] of [
  ["id", otherId], ["user_id", otherId], ["email", "spoofed@example.invalid"],
  ["user", JSON.stringify({ id: otherId })], ["metadata", JSON.stringify({ role: "executive" })],
  ["data", JSON.stringify({ must_change_password: false })],
]) spoofed.set(key, value);
await assert.rejects(() => success.change({ error: "" }, spoofed), error => error === success.redirectSignal,
  "The redirect sentinel must escape the action's operational error handler");
staffRequired(success.calls);
assert.deepEqual(names(success.calls), ["requireStaff", "getUser", "signInWithPassword", "updateUser", "signOut", "redirect"]);
assert.deepEqual(success.calls[2].value, { email, password: current }, "Reauth must use getUser email, not submitted email");
assert.deepEqual(success.calls[3].value, { password: next, current_password: current },
  "Update payload must contain only validated password/current_password, never user IDs or metadata");
assert.deepEqual(success.calls[4].value, { scope: "global" });
assert.equal(success.calls[5].value, "/login?password=changed");
console.log("PASS: password schema, staff identity/reauthentication, minimal update payload and ordered global sign-out");
console.log("Mocks only: no real credentials changed; provider configuration, HTTP/Auth integration and browser flows are unverified.");
