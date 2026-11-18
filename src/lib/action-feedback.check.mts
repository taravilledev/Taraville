import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { successMessage, withSuccessFeedback } from "./action-feedback.ts";

assert.equal(withSuccessFeedback("/sales/a?tab=design#design-fees", "sales_save_design_plan"),
  "/sales/a?tab=design&feedback=sales_save_design_plan#design-fees");
assert.equal(withSuccessFeedback("/sales/settings/catalog?project=a&q=B+3&feedback=unit_enabled", "sales_save_unit"),
  "/sales/settings/catalog?project=a&q=B+3&feedback=unit_enabled");
assert.equal(withSuccessFeedback("/sales/a?feedback=toString", "unknown"), "/sales/a?feedback=saved");
assert.equal(successMessage("toString"), undefined);
assert.equal(successMessage("<script>"), undefined);
assert.equal(successMessage("unit_disabled"), "ปิดใช้งานบ้าน/แปลงแล้ว");
assert.match(successMessage("sales_prepare_payment") ?? "", /รอยืนยัน/);
