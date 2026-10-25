export type Brand = "BAAN_KUNAPAP" | "TARAVILLE";

export type SurveyQuestion =
  | { key: string; label: string; kind: "single" | "multi"; options: readonly string[] }
  | { key: string; label: string; kind: "text" | "number"; placeholder: string };

const OTHER_OPTION = "อื่นๆ";
const ADDRESS: SurveyQuestion = { key: "address", label: "ที่อยู่", kind: "text", placeholder: "บ้านเลขที่ ตำบล อำเภอ จังหวัด" };
const SALES_STAFF: SurveyQuestion = { key: "sales_staff", label: "พนักงานขาย", kind: "text", placeholder: "ชื่อพนักงานขายที่ดูแล" };
const GENDER: SurveyQuestion = { key: "gender", label: "1. เพศ", kind: "single", options: ["ชาย", "หญิง"] };
const AGE: SurveyQuestion = { key: "age_range", label: "2. อายุ", kind: "single", options: ["21-30 ปี", "31-40 ปี", "41-50 ปี", "มากกว่า 50 ปี"] };

// Preserve the demo's answer labels and per-brand representations.
export const SURVEY_QUESTIONS: Record<Brand, SurveyQuestion[]> = {
  TARAVILLE: [
    ADDRESS, GENDER, AGE,
    { key: "occupation", label: "3. อาชีพ", kind: "single", options: ["เจ้าของธุรกิจ", "พนักงานบริษัท", "ข้าราชการ", "ค้าขาย"] },
    { key: "income_range", label: "4. รายได้เฉลี่ยต่อเดือน (บาท)", kind: "single", options: ["15,000-25,000", "25,001-35,000", "35,001-45,000", "มากกว่า 45,000", "มากกว่า 100,000"] },
    { key: "house_type", label: "5. รูปแบบที่อยู่อาศัยที่ท่านกำลังสนใจ", kind: "single", options: ["บ้านเดี่ยวชั้นเดียว", "บ้านเดี่ยวสองชั้น", "บ้านแฝด", "ทาวน์โฮมชั้นเดียว", "ทาวน์โฮมสองชั้น", "อาคารพาณิชย์", "คอนโด"] },
    { key: "decision_factors", label: "6. ปัจจัยที่ท่านใช้พิจารณาในการตัดสินใจเลือกซื้อที่อยู่อาศัย (ตอบได้มากกว่า 1 ข้อ)", kind: "multi", options: ["ทำเลที่ตั้ง", "ราคาที่เหมาะสม", "รูปแบบ", "ระบบรักษาความปลอดภัย"] },
    { key: "bedrooms", label: "7. จำนวนห้องนอน", kind: "single", options: ["2 ห้องนอน", "3 ห้องนอน", "มากกว่า 4 ห้องนอน"] },
    { key: "budget_range", label: "8. ราคาที่ท่านตั้งไว้เพื่อซื้อที่อยู่อาศัย", kind: "single", options: ["1-2 ล้าน", "2.1-3 ล้าน", "3 ล้านขึ้นไป"] },
    { key: "monthly_installment", label: "9. ค่างวดผ่อนบ้านต่อเดือนที่ท่านสะดวกชำระ (บาท)", kind: "number", placeholder: "เช่น 15000" },
    { key: "channel", label: "10. ท่านรู้จักโครงการและสะดวกรับข้อมูลข่าวสารทางช่องทางใด", kind: "single", options: ["Line / Facebook", "โบรชัวร์", "ป้ายไวนิล", "TikTok", OTHER_OPTION] },
    { key: "decision_time", label: "11. ระยะเวลาในการพิจารณาก่อนตัดสินใจ", kind: "single", options: ["2 สัปดาห์", "1 เดือน", "3 เดือน", "6 เดือน", "12 เดือน"] },
    { key: "purchase_reason", label: "12. เหตุผลของการซื้อที่อยู่อาศัย", kind: "single", options: ["ขยายครอบครัว", "ย้ายที่ทำงาน", "ซื้อเป็นทรัพย์สิน"] },
    SALES_STAFF,
  ],
  BAAN_KUNAPAP: [
    ADDRESS, GENDER, AGE,
    { key: "occupation", label: "3. อาชีพ", kind: "single", options: ["เจ้าของธุรกิจ", "พนักงานประจำ", "ข้าราชการ", "ค้าขาย"] },
    { key: "income_range", label: "4. รายได้เฉลี่ยต่อเดือน (บาท)", kind: "single", options: ["10,001-25,000", "25,001-35,000", "35,001-40,000", "40,001-50,000", "มากกว่า 50,000"] },
    { key: "house_type", label: "5. รูปแบบที่อยู่อาศัยที่ท่านกำลังสนใจ", kind: "single", options: ["บ้านเดี่ยวชั้นเดียว", "บ้านเดี่ยว 2 ชั้น", "ทาวน์โฮมชั้นเดียว", "ทาวน์โฮม 2 ชั้น", "ทาวน์โฮม 3 ชั้น", "บ้านแฝด", "อาคารพาณิชย์", "คอนโด"] },
    { key: "layout", label: "ลักษณะฟังก์ชันภายในที่ท่านต้องการ (ตอบได้มากกว่า 1 ข้อ)", kind: "multi", options: ["2 ห้องนอน", "3 ห้องนอน", "2 ห้องน้ำ", "3 ห้องน้ำ", OTHER_OPTION] },
    { key: "budget_range", label: "6. ราคาที่ท่านคาดว่าจะสร้างที่อยู่อาศัย", kind: "single", options: ["ต่ำกว่า 500,000 บาท", "500,000-1,000,000 บาท", "1-2 ล้านบาท", "2-3 ล้านบาท", "3-4 ล้านบาท", "4 ล้านบาทขึ้นไป"] },
    { key: "channel", label: "7. ท่านรู้จักและสะดวกรับข้อมูลข่าวสารจากบริษัทฯ ทางช่องทางใด", kind: "single", options: ["Line / Facebook", "สื่อสิ่งพิมพ์ / โบรชัวร์", "เพื่อนและครอบครัว", "ป้ายไวนิล", OTHER_OPTION] },
    { key: "monthly_installment", label: "8. ค่างวดที่สะดวกในการผ่อนชำระต่อเดือน (บาท)", kind: "single", options: ["6,000-8,000", "9,000-12,000", "14,000-16,000", "มากกว่า 20,000"] },
    SALES_STAFF,
  ],
};
