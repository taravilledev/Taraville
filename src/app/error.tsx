"use client";

import { ErrorCard } from "./error-card";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorCard error={error} retry={retry} />;
}
