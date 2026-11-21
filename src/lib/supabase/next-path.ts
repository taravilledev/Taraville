const BASE = "http://next-path.invalid";
export const REQUEST_PATH_HEADER = "x-request-path";

// Only a same-origin path survives, so a crafted `?next=` can never send a signed-in user off-site.
export function safeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 2048) return null;
  let url: URL;
  try { url = new URL(value, BASE); } catch { return null; }
  if (url.origin !== BASE || url.pathname.startsWith("/login")) return null;
  return `${url.pathname}${url.search}`;
}
