import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { describeChange, diffPermissions } from "./permission-diff.ts"

const saved = { "case.view": { enabled: true, scope: "own" }, "refund.pay": { enabled: false, scope: "own" } } as const
const edit = (action: string, value: { enabled: boolean; scope: "own" | "all" }) => ({ ...saved, [action]: value })

assert.deepEqual(diffPermissions(saved, { ...saved }), [])

const toggled = diffPermissions(saved, edit("refund.pay", { enabled: true, scope: "own" }))
assert.equal(toggled.length, 1)
assert.equal(describeChange("ขอคืนเงิน", toggled[0]), "ขอคืนเงิน: ปิด → เปิด")

const scoped = diffPermissions(saved, edit("case.view", { enabled: true, scope: "all" }))
assert.equal(describeChange("ดูงาน", scoped[0]), "ดูงาน: เฉพาะของตน → ทั้งหมด")

const both = diffPermissions(saved, edit("refund.pay", { enabled: true, scope: "all" }))
assert.equal(describeChange("จ่ายคืน", both[0]), "จ่ายคืน: ปิด → เปิด · เฉพาะของตน → ทั้งหมด")

// Toggling back to the saved value leaves nothing to save.
assert.deepEqual(diffPermissions(saved, edit("refund.pay", { ...saved["refund.pay"] })), [])
console.log("permission-diff ok")
