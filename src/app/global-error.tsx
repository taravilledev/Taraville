"use client";

import "./globals.css";
import { ErrorCard } from "./error-card";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return <html lang="th"><body>
    <title>เปิดหน้านี้ไม่สำเร็จ · Taraville Group</title>
    <ErrorCard error={error} retry={retry} />
  </body></html>;
}
