export const designPackages = [
  { id: "under150", range: "ต่ำกว่า 150 ตร.ม.", amounts: [3500, 3500, 5000], total: 12000 },
  { id: "under200", range: "150 ถึงต่ำกว่า 200 ตร.ม.", amounts: [7500, 7500, 10000], total: 25000 },
  { id: "under250", range: "200 ถึงต่ำกว่า 250 ตร.ม.", amounts: [9000, 10000, 11000], total: 30000 },
  { id: "upto300", range: "250–300 ตร.ม.", amounts: [12000, 13000, 15000], total: 40000 },
] as const;

export const designAreaPattern = "(?=.*[1-9])[0-9]{1,9}(\\.[0-9]{1,3})?";
const validArea = new RegExp(`^${designAreaPattern}$`);

export function designTierForArea(area: string) {
  if (!validArea.test(area)) return null;
  const size = Number(area);
  if (size < 150) return "under150";
  if (size < 200) return "under200";
  if (size < 250) return "under250";
  return size <= 300 ? "upto300" : "custom";
}

export function sumDesignInstalments(cents: readonly string[]) {
  return cents.reduce((sum, amount) => sum + BigInt(amount), BigInt(0));
}
export function nextDesignPayment(instalments: string[], received: string) {
  let remaining = BigInt(received);
  for (const [index, amount] of instalments.entries()) {
    const due = BigInt(amount);
    if (remaining < due) return { position: index + 1, amount: (due - remaining).toString() };
    remaining -= due;
  }
  return null;
}

