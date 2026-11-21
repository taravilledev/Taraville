import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { loginErrorMessage } from "./login-error.ts";

assert.match(loginErrorMessage({ code: "invalid_credentials", status: 400 }), /^ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/);
assert.match(loginErrorMessage({ code: "over_request_rate_limit", status: 429 }), /^ลองผิดหลายครั้งเกินไป/);
assert.match(loginErrorMessage({ status: 429 }), /^ลองผิดหลายครั้งเกินไป/);
assert.match(loginErrorMessage({ name: "AuthRetryableFetchError", status: 0 }), /^เชื่อมต่อระบบไม่ได้/);
assert.match(loginErrorMessage({ code: "user_banned", status: 400 }), /^เข้าสู่ระบบไม่สำเร็จ/);
console.log("PASS: login errors map wrong credentials, rate limit and network failures to distinct messages");
