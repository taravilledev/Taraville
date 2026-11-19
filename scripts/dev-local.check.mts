import assert from "node:assert/strict";
import { localEnvironment } from "./dev-local.mjs";

const local = { API_URL: "http://127.0.0.1:54321", PUBLISHABLE_KEY: "local-test-key" };
assert.deepEqual(localEnvironment(local), {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test-key",
});
assert.throws(() => localEnvironment({ ...local, API_URL: "https://production.supabase.co" }));
assert.throws(() => localEnvironment({ ...local, API_URL: "http://user:pass@localhost:54321" }));
assert.throws(() => localEnvironment({ API_URL: local.API_URL }));
console.log("Local dev environment rejects remote targets and missing credentials");
