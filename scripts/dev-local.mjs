import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function localEnvironment(status) {
  const url = new URL(status.API_URL);
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.username || url.password || typeof key !== "string" || !key.trim()) {
    throw new Error("Local Supabase URL and publishable key are required");
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: url.href.replace(/\/$/, ""),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let local;
  try {
    const status = execFileSync("supabase", ["status", "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    local = localEnvironment(JSON.parse(status));
  } catch {
    console.error("Local Supabase is unavailable. Start it with supabase start; dev did not start.");
    process.exit(1);
  }
  const child = spawn(process.execPath, [
    resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1",
    "--port", "3100", ...process.argv.slice(2),
  ], { env: { ...process.env, ...local }, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Local dev server could not start"); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
