const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function belowMillion(value: bigint, hasHigher: boolean) {
  const text = value.toString();
  let result = "";
  for (let index = 0; index < text.length; index++) {
    const digit = Number(text[index]);
    const place = text.length - index - 1;
    if (!digit) continue;
    if (place === 0 && digit === 1 && (text.length > 1 || hasHigher)) result += "เอ็ด";
    else if (place === 1 && digit === 1) result += "สิบ";
    else if (place === 1 && digit === 2) result += "ยี่สิบ";
    else result += digits[digit] + places[place];
  }
  return result;
}
function integer(value: bigint): string {
  if (!value) return digits[0];
  const high = value / BigInt(1000000);
  const low = value % BigInt(1000000);
  return (high ? `${integer(high)}ล้าน` : "") + (low ? belowMillion(low, high > BigInt(0)) : "");
}

export function contractMoneyText(cents: string) {
  const value = BigInt(cents);
  const baht = value / BigInt(100);
  const satang = value % BigInt(100);
  if (!baht && satang) return `${integer(satang)}สตางค์`;
  return `${integer(baht)}บาท${satang ? `${integer(satang)}สตางค์` : "ถ้วน"}`;
}
