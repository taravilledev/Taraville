import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { activeHref, navItems } from "./nav.ts"

const executive = navItems("executive")
assert.deepEqual(executive.map(item => item.label), ["ภาพรวม", "รับลูกค้า", "ลูกค้า (Lead)", "โครงการ", "การเงินบ้านคุณภาพ", "รายงาน Lead", "ตั้งค่า"])
assert.deepEqual(executive.map(item => item.href), ["/dashboard", "/walkin", "/leads", "/sales", "/summary", "/leads/report", "/sales/settings"])
// flow-to-be §3.9: sales see ตั้งค่า (catalog editors and read-only viewers); other staff do not.
assert.deepEqual(navItems("sale").map(item => item.label), ["หน้าหลัก", "รับลูกค้า", "ลูกค้า (Lead)", "โครงการ", "รายงาน Lead", "ตั้งค่า"])
assert.deepEqual(navItems("staff").map(item => item.label), ["หน้าหลัก", "รับลูกค้า", "ลูกค้า (Lead)", "โครงการ", "รายงาน Lead"])

const cases: [string, string | undefined][] = [
  ["/leads/report", "/leads/report"],
  ["/leads/1a2b", "/leads"],
  ["/sales/settings/catalog", "/sales/settings"],
  ["/sales/1a2b", "/sales"],
  ["/summary", "/summary"],
  ["/dashboard", "/dashboard"],
  ["/dashboardx", undefined],
  ["/account/password", undefined],
]
for (const [pathname, expected] of cases) assert.equal(activeHref(pathname, executive), expected, pathname)
console.log("nav.check passed")
