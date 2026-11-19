const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Dates arrive as ISO yyyy-mm-dd; render them as Buddhist-era Thai dates and fall back to the raw value.
export function formatDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : formatter.format(date);
}
