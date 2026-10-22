import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseConfig } from "./config";

export async function serverClient(isWritable = false) {
  // Auth starts asynchronous session work that must never run during prerendering.
  await connection();
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Proxy refreshes read-only renders; Actions must persist their own cookies.
        if (isWritable) values.forEach(({ name, value, options }) => store.set(name, value, options));
      },
    },
  });
}
