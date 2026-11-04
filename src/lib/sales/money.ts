const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const SCALE = BigInt(10000);
const MAX_CENTS = BigInt("9223372036854775807");

function cents(value: string): bigint {
  if (!/^\d+$/.test(value) || value.length > 19) throw new Error("Invalid money");
  const amount = BigInt(value);
  if (amount > MAX_CENTS) throw new Error("Money exceeds supported range");
  return amount;
}

export function parseMoney(value: string): string {
  const match = /^(\d{1,17})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Use a nonnegative amount with at most two decimals");
  return cents((BigInt(match[1]) * HUNDRED + BigInt((match[2] ?? "").padEnd(2, "0"))).toString()).toString();
}

export function formatMoney(value: string): string {
  const amount = cents(value);
  return `${new Intl.NumberFormat("th-TH").format(amount / HUNDRED)}.${(amount % HUNDRED).toString().padStart(2, "0")}`;
}

export function netSalePrice(list: string | null, promotion: string | null, discount: string | null): string | null {
  if (list !== null) cents(list);
  const base = promotion !== null ? cents(promotion) : list !== null ? cents(list) : null;
  const reduction = discount === null ? ZERO : cents(discount);
  if (base === null) return null;
  if (reduction > base) throw new Error("Discount exceeds price");
  return (base - reduction).toString();
}

export function installmentAmounts(total: string, basisPoints: number[], designCredit = "0") {
  const price = cents(total);
  let credit = cents(designCredit);
  if (!basisPoints.length || basisPoints.some(value => !Number.isSafeInteger(value) || value <= 0 || value > 10000)
    || basisPoints.reduce((sum, value) => sum + value, 0) !== 10000) {
    throw new Error("Instalment percentages must total 100%");
  }
  if (credit > price) throw new Error("Credit exceeds contract value");
  const gross = basisPoints.map(value => price * BigInt(value) / SCALE);
  // Carry fractional satang into the final instalment so every row remains nonnegative.
  gross[gross.length - 1] += price - gross.reduce((sum, amount) => sum + amount, ZERO);
  const applied = gross.map(() => ZERO);
  for (let index = gross.length - 1; index >= 0; index--) {
    applied[index] = credit < gross[index] ? credit : gross[index];
    credit -= applied[index];
  }
  return gross.map((amount, index) => ({
    gross: amount.toString(), credit: applied[index].toString(), net: (amount - applied[index]).toString(),
  }));
}
