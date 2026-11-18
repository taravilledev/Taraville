"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { feedbackParam, successMessage } from "@/lib/action-feedback";

export function ActionFeedback() {
  const code = useSearchParams().get(feedbackParam);

  useEffect(() => {
    const message = successMessage(code);
    if (!message) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(feedbackParam) !== code) return;
    url.searchParams.delete(feedbackParam);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    toast.success(message);
  }, [code]);

  return null;
}
