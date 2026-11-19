import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { groupDashboardProjects } from "./project-ownership.ts";

const mine = { responsible_id: "actor", code: "BKP-mine", can_finance: false };
const others = { responsible_id: "other", code: "BKP-other", can_finance: true };
const groups = groupDashboardProjects([others, mine], "actor");
assert.deepEqual(groups.all, [others, mine]);
assert.deepEqual(groups.mine, [mine]);
assert.deepEqual(groups.others, [others]);
assert.deepEqual(groupDashboardProjects([mine], "actor").others, []);
assert.equal(groups.mine[0]?.can_finance, false);
assert.equal(groups.others[0]?.can_finance, true);
