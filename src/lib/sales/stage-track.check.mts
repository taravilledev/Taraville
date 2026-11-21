import assert from "node:assert/strict";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { stageTrack } from "./stage-track.ts";

const steps = ["เปิดโครงการ", "ออกแบบ", "ใบเสนอราคา", "สัญญา", "รับชำระ"];

assert.deepEqual(stageTrack(steps, 2, "active"), {
  badge: "3",
  label: "ใบเสนอราคา",
  position: 3,
  segments: ["done", "done", "current", "todo", "todo"],
});
assert.deepEqual(stageTrack(steps, 4, "done"), { badge: "✓", label: "ชำระครบ", position: null, segments: ["done", "done", "done", "done", "done"] });
assert.deepEqual(stageTrack(steps, 3, "cancelled"), { badge: "×", label: "ปิดงาน / ยกเลิก", position: null, segments: ["todo", "todo", "todo", "todo", "todo"] });
assert.equal(stageTrack(steps, 9, "active").label, "รับชำระ");

console.log("stage-track: ok");
