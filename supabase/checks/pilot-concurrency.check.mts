// Disposable local container only. Parent runs this independently of its author.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const container = "taraville-walkin-schema-check-20261020";
assert.equal(process.argv.length, 2, "No database URLs or alternate targets accepted");
const saleA = "30000000-0000-0000-0000-000000000001";
const saleB = "30000000-0000-0000-0000-000000000002";
const executive = "30000000-0000-0000-0000-000000000003";
const deactivatingSale = "30000000-0000-0000-0000-000000000005";
const contact = `'{"first_name":"Concurrency","phone":"0000000000"}'::jsonb`;
const winnerContact = `'{"first_name":"Winner","phone":"0000000000"}'::jsonb`;
const loserContact = `'{"first_name":"Loser","phone":"0000000000"}'::jsonb`;
const runId = randomUUID();
type Result = { code: number | null; stdout: string; stderr: string };

function session(sql: string, keepOpen = false) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres",
    "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
  const output: Result = { code: null, stdout: "", stderr: "" };
  let isClosed = false;
  child.stdout.on("data", (data: Buffer) => { output.stdout += data.toString(); });
  child.stderr.on("data", (data: Buffer) => { output.stderr += data.toString(); });
  child.stdin.on("error", (error: Error) => { output.stderr += `\nstdin: ${error.message}`; });
  const done = new Promise<Result>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Local psql session timed out: ${JSON.stringify(output)}`));
    }, 15000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      isClosed = true;
      output.code = code;
      resolve(output);
    });
  });
  // A retained transaction also times out server-side if the parent stops.
  child.stdin.write(`\\set VERBOSITY verbose\nset statement_timeout = '8s';\n`
    + `set idle_in_transaction_session_timeout = '10s';\n${sql}\n`);
  if (!keepOpen) child.stdin.end();
  return { child, done, output, isClosed: () => isClosed };
}

async function query(sql: string) {
  const result = await session(sql).done;
  assert.equal(result.code, 0, `Local SQL failed: ${JSON.stringify(result)}`);
  return result.stdout.trim();
}

function actor(id: string, applicationName: string) {
  return `begin; set local role authenticated;\n`
    + `set local request.jwt.claim.sub = '${id}';\n`
    + `set local application_name = '${applicationName}';\n`;
}

async function waitUntil(predicate: () => boolean | Promise<boolean>, message: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}

async function contend(holderSql: string, contenderSql: string, label: string) {
  const name = `walkin_${label}_${runId}`;
  const holder = session(`${holderSql}\nselect 'LOCKED';`, true);
  let contender: ReturnType<typeof session> | undefined;
  try {
    await waitUntil(() => {
      assert.ok(!holder.isClosed(), `Holder ended before readiness: ${JSON.stringify(holder.output)}`);
      return holder.output.stdout.split("\n").includes("LOCKED");
    }, `Holder did not signal readiness: ${JSON.stringify(holder.output)}`);
    contender = session(contenderSql.replaceAll("CONTENDER_NAME", name));
    // Observe a real PostgreSQL lock wait before releasing the first transaction.
    await waitUntil(async () => {
      assert.ok(!contender?.isClosed(), `Contender did not block: ${JSON.stringify(contender?.output)}`);
      return await query(`select count(*) from pg_stat_activity where application_name = '${name}'`
        + ` and wait_event_type = 'Lock' and state = 'active';`) === "1";
    }, `No lock wait observed: ${JSON.stringify(contender.output)}`);
    holder.child.stdin.end("commit;\n");
    const [first, second] = await Promise.all([holder.done, contender.done]);
    assert.equal(first.code, 0, `Holder failed: ${JSON.stringify(first)}`);
    return { ...second, holderStdout: first.stdout };
  } finally {
    // Closing input rolls back an unfinished transaction; no fixture deletion.
    if (!holder.child.stdin.writableEnded) holder.child.stdin.end("rollback;\n");
    await Promise.allSettled([holder.done, ...(contender ? [contender.done] : [])]);
  }
}

await query(`insert into auth.users(id) values ('${saleA}'), ('${saleB}'), ('${executive}'), ('${deactivatingSale}')
  on conflict (id) do nothing;
insert into public.staff(id, full_name, role) values
  ('${saleA}', 'Synthetic Concurrent Sale A', 'sale'),
  ('${saleB}', 'Synthetic Concurrent Sale B', 'sale'),
  ('${executive}', 'Synthetic Concurrent Executive', 'executive'),
  ('${deactivatingSale}', 'Synthetic Deactivation Sale', 'sale') on conflict (id) do nothing;
update public.staff set is_active = true where id = '${deactivatingSale}';`);
const leadId = await query(actor(saleA, `walkin_setup_${runId}`)
  + `select id from public.walkin_create_lead('${randomUUID()}', 'TARAVILLE', ${contact}, '{}', '${saleA}'); commit;`);
assert.match(leadId, /^[0-9a-f-]{36}$/, "Create must return exactly one lead UUID");

const denied = await contend(
  actor(executive, `walkin_reassign_${runId}`)
    + `select version from public.walkin_reassign_lead('${leadId}', 1, '${saleB}');`,
  actor(saleA, "CONTENDER_NAME")
    + `select id from public.walkin_update_lead('${leadId}', 1, ${loserContact}, '{}'); commit;`,
  "old_owner",
);
assert.notEqual(denied.code, 0, `Old owner update unexpectedly succeeded: ${JSON.stringify(denied)}`);
assert.match(denied.stderr, /42501: access_denied/, JSON.stringify(denied));
assert.equal(await query(`select owner_id || '|' || version || '|' || first_name
  from public.leads where id = '${leadId}';`), `${saleB}|2|Concurrency`,
"Reassignment must survive the blocked old-owner update without contact overwrite");

assert.equal(await query(actor(executive, `walkin_reset_${runId}`)
  + `select version from public.walkin_reassign_lead('${leadId}', 2, '${saleA}'); commit;`), "3");
const stale = await contend(
  actor(saleA, `walkin_winner_${runId}`)
    + `select version from public.walkin_update_lead('${leadId}', 3, ${winnerContact}, '{}');`,
  actor(saleA, "CONTENDER_NAME")
    + `select version from public.walkin_update_lead('${leadId}', 3, ${loserContact}, '{}'); commit;`,
  "stale_edit",
);
assert.notEqual(stale.code, 0, `Both concurrent edits unexpectedly succeeded: ${JSON.stringify(stale)}`);
assert.match(stale.stderr, /PT409: stale_lead/, JSON.stringify(stale));
assert.equal(await query(`select owner_id || '|' || version || '|' || first_name
  from public.leads where id = '${leadId}';`), `${saleA}|4|Winner`,
"Exactly one expected-version edit must commit; the losing payload must not overwrite it");

const sharedRequest = randomUUID();
const createSql = `select id from public.walkin_create_lead('${sharedRequest}', 'TARAVILLE', ${contact}, '{}', '${saleA}');`;
const created = await contend(
  actor(saleA, `walkin_create_winner_${runId}`) + createSql,
  actor(saleA, "CONTENDER_NAME") + createSql + " commit;",
  "identical_create",
);
assert.equal(created.code, 0, `Concurrent identical retry failed: ${JSON.stringify(created)}`);
const firstId = created.holderStdout.split("\n").filter((line) => line !== "LOCKED" && line !== "").join("\n");
assert.match(firstId, /^[0-9a-f-]{36}$/, "Holder must return exactly one new lead UUID");
assert.equal(created.stdout.trim(), firstId, "Concurrent identical creates must return the same lead UUID");
assert.equal(await query(`select count(*) from public.leads
  where created_by = '${saleA}' and create_request_id = '${sharedRequest}';`), "1",
"Concurrent identical creates must persist exactly one row");

const deactivateLeadId = await query(actor(deactivatingSale, `walkin_deactivate_setup_${runId}`)
  + `select id from public.walkin_create_lead('${randomUUID()}', 'TARAVILLE', ${contact}, '{}', '${deactivatingSale}'); commit;`);
assert.match(deactivateLeadId, /^[0-9a-f-]{36}$/, "Deactivation fixture needs one lead UUID");
const deactivated = await contend(
  actor(deactivatingSale, `walkin_before_deactivation_${runId}`)
    + `select version from public.walkin_update_lead('${deactivateLeadId}', 1, ${winnerContact}, '{}');`,
  `begin; set local application_name = 'CONTENDER_NAME';\n`
    + `update public.staff set is_active = false where id = '${deactivatingSale}' returning is_active; commit;`,
  "deactivation",
);
assert.equal(deactivated.code, 0, `Serialized deactivation failed: ${JSON.stringify(deactivated)}`);
assert.equal(deactivated.holderStdout, "2\nLOCKED\n", "Pending authorized edit must finish before deactivation");
assert.equal(deactivated.stdout.trim(), "f", "Deactivation must complete after the actor's SHARE lock releases");
assert.equal(await query(`select s.is_active || '|' || l.version || '|' || l.first_name
  from public.staff s join public.leads l on l.owner_id = s.id
  where s.id = '${deactivatingSale}' and l.id = '${deactivateLeadId}';`), "false|2|Winner",
"The authorized edit must commit and the staff member must then be inactive");
const inactiveMutation = await session(actor(deactivatingSale, `walkin_after_deactivation_${runId}`)
  + `select id from public.walkin_create_lead('${randomUUID()}', 'TARAVILLE', ${contact}, '{}', '${deactivatingSale}'); commit;`).done;
assert.notEqual(inactiveMutation.code, 0, `Inactive actor mutation succeeded: ${JSON.stringify(inactiveMutation)}`);
assert.match(inactiveMutation.stderr, /42501: access_denied/, JSON.stringify(inactiveMutation));
console.log("PASS: observed lock waits for reassignment, stale edits, identical creates and staff deactivation");
console.log("Not covered: HTTP requests, production configuration, browser or device flows.");
console.log("Synthetic fixtures remain in the disposable local container until its lifecycle ends.");
